#!/usr/bin/env node
/** fold: the multiplayer kernel for long-running agent sessions. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fleetBrief, Project, type SerializedLedger } from "@henosis/fleet";
import { checkReplay, handoffBrief, type SerializedLog, Session } from "@henosis/kernel";
import type { Actor } from "@henosis/protocol";
import {
  ClaudeModel,
  claudeAvailable,
  defaultTools,
  type Model,
  ScriptedModel,
} from "@henosis/runner";
import {
  authConfigFromEnv,
  HenosisServer,
  migrateStore,
  openLiveStore,
  openStoreEnd,
  renderMigrateTable,
  storeKindOf,
} from "@henosis/server";
import {
  councilSection,
  isChatLog,
  loadChat,
  loadChatFile,
  renderChatReport,
  renderCouncil,
  renderCouncilList,
} from "./council.js";
import { runDemo } from "./demo.js";
import { joinSession } from "./join.js";
import { renderReport } from "./report.js";

const USAGE = `henosis <command> [options]

  serve    [--port 7700] [--dir ./store] [--model scripted|claude] [--token T]   run the session server
           [--store file|postgres] [--database-url URL]                         (postgres: the Team edition's store)
  migrate  --from <dir>|postgres --to <dir>|postgres [--database-url URL]      copy every log and document, verify head hashes
  demo     [--dir ./store-demo]                                                 offline multiplayer scenario
  join     <session> --as <name> [--url ws://127.0.0.1:7700/ws] [--token T] [--branch main]
  replay   <log.json> [--branch main]                                           fold the log, print the brief
  verify   <log.json>                                                           check hashes and replay determinism
  report   <log.json> [--chat <chat.json>]                                      markdown report of every branch, with a Tokens section;
                                                                                a chat log reports its groups and councils (Council section)
  council  <org> [<id>] [--dir ./store]                                         a council's rounds and conclusion from the org's chat log; no id lists them
  fleet    <ledger.json>                                                        fleet brief from a project ledger
  slack    --config slack.json [--port 7700] [--dir ./store] [--model ...]     serve plus the Slack adapter (socket mode)
  github   --config github.json [--port 7700] [--dir ./store] [--model ...]    serve plus the GitHub adapter (one comment per pull request)
  digest   [--dir ./store] [--out ./digests | --smtp smtp://u:p@host:587]      the leads' digests: .eml files, SMTP, or the text to stdout
           [--from "Henosis <digest@example.com>"] [--cadence weekly|daily] [--to <user>] [--app-url URL]

slack.json: { "botToken": "xoxb-...", "appToken": "xapp-...", "map": { "teams": {"payments": "C..."},
             "projects": {"billing": "C..."}, "management": "C...", "users": {"U123": "ana"} }, "projects": ["billing"] }
github.json: { "token": "ghp_...", "prs": { "<sessionId>": "owner/repo#418" }, "projects": ["billing"],
             "appBaseUrl": "https://henosis.example.com", "apiBaseUrl": "https://henosis.example.com" }

Environment: HENOSIS_OFFLINE=1 blocks the Claude adapter; ANTHROPIC_API_KEY enables it.
             HENOSIS_TOKEN is the dev-mode shared token; HENOSIS_OIDC_ISSUER, HENOSIS_OIDC_CLIENT_ID
             and (optional) HENOSIS_OIDC_AUDIENCE switch serve to single sign-on (docs/07, "Identity").
             HENOSIS_AUTH=supabase with SUPABASE_URL and SUPABASE_ANON_KEY (optional SUPABASE_JWT_SECRET,
             HENOSIS_AUTO_JOIN=org:team:project:role) signs people in through Supabase Auth (docs/20).
             HENOSIS_DATABASE_URL is the postgres store's connection string (or --database-url).
             HENOSIS_SMTP_URL and HENOSIS_MAIL_FROM are what the digest command sends through when --smtp and --from are absent.
Exit codes: 0 ok, 2 usage, 3 verification failed, 4 network.`;

function parseArgs(argv: string[]): { positional: string[]; flags: Record<string, string | true> } {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else flags[key] = true;
    } else positional.push(a);
  }
  return { positional, flags };
}

function flag(flags: Record<string, string | true>, key: string, fallback: string): string {
  const v = flags[key];
  return typeof v === "string" ? v : fallback;
}

function loadLog(path: string): Session {
  const data = JSON.parse(readFileSync(resolve(path), "utf8")) as SerializedLog;
  return Session.fromSerialized(data);
}

/** A store that cannot be opened as asked is a usage error: one line, exit 2. */
class StoreUsageError extends Error {}

/** A chat log that is not where it was said to be is a usage error too. */
function chatOrUsage<T>(load: () => T): T {
  try {
    return load();
  } catch (err) {
    throw new StoreUsageError(err instanceof Error ? err.message : String(err));
  }
}

/** The store `serve` and `slack` run on: a folder (the default) or postgres (`--store postgres`). */
async function pickStore(flags: Record<string, string | true>, root: string) {
  const databaseUrl = typeof flags["database-url"] === "string" ? flags["database-url"] : undefined;
  try {
    const kind = storeKindOf(flag(flags, "store", "file"));
    const store = await openLiveStore(kind, {
      root,
      databaseUrl,
      log: (l) => process.stderr.write(`${l}\n`),
    });
    return { kind, store };
  } catch (err) {
    throw new StoreUsageError(err instanceof Error ? err.message : String(err));
  }
}

/** The settings page's E-mail row: a mailer is configured when `henosis digest` has somewhere to send. */
function mailConfigured(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.HENOSIS_SMTP_URL?.trim());
}

function pickModel(name: string): Model {
  if (name === "claude") {
    if (!claudeAvailable()) {
      process.stderr.write(
        "claude model requested but ANTHROPIC_API_KEY is unset or HENOSIS_OFFLINE=1\n",
      );
      process.exit(4);
    }
    return new ClaudeModel();
  }
  return new ScriptedModel();
}

async function main(): Promise<number> {
  const [cmd, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);
  switch (cmd) {
    case "serve": {
      const port = Number(flag(flags, "port", "7700"));
      const root = resolve(flag(flags, "dir", "./store"));
      const model = pickModel(flag(flags, "model", "scripted"));
      const tokenFlag = flags.token;
      const token = typeof tokenFlag === "string" ? tokenFlag : process.env.HENOSIS_TOKEN;
      const auth = authConfigFromEnv(process.env, token);
      const { kind, store } = await pickStore(flags, root);
      const server = new HenosisServer({
        root,
        store,
        model,
        tools: defaultTools(),
        token,
        auth,
        log: (l) => process.stderr.write(`${l}\n`),
      });
      server.integrations.email = mailConfigured(process.env);
      const bound = await server.listen(port, flag(flags, "host", "127.0.0.1"));
      const identity =
        auth.mode === "oidc"
          ? `, sign-in via ${auth.issuer}`
          : auth.mode === "supabase"
            ? `, sign-in via Supabase Auth at ${auth.url}`
            : token
              ? ", token required"
              : "";
      process.stdout.write(
        `henosis server on ws://127.0.0.1:${bound}/ws (model ${model.name}, store ${kind === "file" ? root : `postgres, blobs under ${root}`}${identity})\n`,
      );
      const stop = async () => {
        await server.close();
        process.exit(0);
      };
      process.on("SIGINT", stop);
      process.on("SIGTERM", stop);
      return new Promise(() => {});
    }
    case "slack": {
      const cfgPath = flag(flags, "config", "");
      if (!cfgPath) return usage();
      const cfg = JSON.parse(readFileSync(resolve(cfgPath), "utf8")) as {
        botToken: string;
        appToken: string;
        map: Record<string, unknown>;
        projects?: string[];
        /** Where the web app is served; Slack messages then link into it (or HENOSIS_APP_URL). */
        appBaseUrl?: string;
      };
      const { BoltSlackClient, ChannelMap, SlackAdapter } = await import("@henosis/slack");
      const port = Number(flag(flags, "port", "7700"));
      const root = resolve(flag(flags, "dir", "./store"));
      const { store } = await pickStore(flags, root);
      const server = new HenosisServer({
        root,
        store,
        model: pickModel(flag(flags, "model", "scripted")),
        tools: defaultTools(),
        token: process.env.HENOSIS_TOKEN,
        auth: authConfigFromEnv(process.env, process.env.HENOSIS_TOKEN),
        log: (l) => process.stderr.write(`${l}\n`),
      });
      const bound = await server.listen(port, flag(flags, "host", "127.0.0.1"));
      const adapter = new SlackAdapter({
        server,
        client: new BoltSlackClient({ botToken: cfg.botToken, appToken: cfg.appToken }),
        map: ChannelMap.parse(cfg.map),
        appBaseUrl: cfg.appBaseUrl ?? process.env.HENOSIS_APP_URL,
        log: (l) => process.stderr.write(`${l}\n`),
      });
      for (const pid of cfg.projects ?? server.orgs.projectsFor(null).map((p) => p.projectId))
        adapter.watchProject(pid);
      await adapter.start();
      server.integrations.slack = true;
      server.integrations.email = mailConfigured(process.env);
      process.stdout.write(
        `henosis server on ws://127.0.0.1:${bound}/ws with Slack adapter (socket mode)\n`,
      );
      const stop = async () => {
        await adapter.stop();
        await server.close();
        process.exit(0);
      };
      process.on("SIGINT", stop);
      process.on("SIGTERM", stop);
      return new Promise(() => {});
    }
    case "github": {
      const cfgPath = flag(flags, "config", "");
      if (!cfgPath) return usage();
      const { GitHubAdapter, GitHubConfig, RestGitHubClient } = await import("@henosis/github");
      const cfg = GitHubConfig.parse(JSON.parse(readFileSync(resolve(cfgPath), "utf8")));
      const token = cfg.token ?? process.env.GITHUB_TOKEN;
      if (!token) {
        process.stderr.write('github: a token is needed (github.json "token" or GITHUB_TOKEN)\n');
        return 2;
      }
      const port = Number(flag(flags, "port", "7700"));
      const root = resolve(flag(flags, "dir", "./store"));
      const { store } = await pickStore(flags, root);
      const server = new HenosisServer({
        root,
        store,
        model: pickModel(flag(flags, "model", "scripted")),
        tools: defaultTools(),
        token: process.env.HENOSIS_TOKEN,
        auth: authConfigFromEnv(process.env, process.env.HENOSIS_TOKEN),
        log: (l) => process.stderr.write(`${l}\n`),
      });
      const bound = await server.listen(port, flag(flags, "host", "127.0.0.1"));
      const client = cfg.githubApiBaseUrl
        ? new RestGitHubClient({ token, apiBaseUrl: cfg.githubApiBaseUrl })
        : new RestGitHubClient({ token });
      const adapter = new GitHubAdapter({
        server,
        client,
        prs: cfg.prs,
        appBaseUrl: cfg.appBaseUrl ?? process.env.HENOSIS_APP_URL,
        apiBaseUrl: cfg.apiBaseUrl ?? process.env.HENOSIS_APP_URL,
        log: (l) => process.stderr.write(`${l}\n`),
      });
      for (const pid of cfg.projects ?? server.orgs.projectsFor(null).map((p) => p.projectId))
        adapter.watchProject(pid);
      server.integrations.github = true;
      server.integrations.email = mailConfigured(process.env);
      process.stdout.write(
        `henosis server on ws://127.0.0.1:${bound}/ws with GitHub adapter (${Object.keys(cfg.prs).length} pull request(s))\n`,
      );
      const stop = async () => {
        adapter.stop();
        await server.close();
        process.exit(0);
      };
      process.on("SIGINT", stop);
      process.on("SIGTERM", stop);
      return new Promise(() => {});
    }
    case "digest": {
      const { EmailDigest, FileMailer, parseSmtpUrl, SmtpMailer } = await import("@henosis/email");
      const root = resolve(flag(flags, "dir", "./store"));
      const { store } = await pickStore(flags, root);
      const server = new HenosisServer({
        root,
        store,
        model: new ScriptedModel(),
        tools: defaultTools(),
        log: (l) => process.stderr.write(`${l}\n`),
      });
      const out = flag(flags, "out", "");
      const smtp = flag(flags, "smtp", process.env.HENOSIS_SMTP_URL ?? "");
      const from = flag(
        flags,
        "from",
        process.env.HENOSIS_MAIL_FROM ?? "Henosis <digest@localhost>",
      );
      const cadence = flag(flags, "cadence", "weekly") === "daily" ? "daily" : "weekly";
      const only = flag(flags, "to", "");
      const mailer = out
        ? new FileMailer(resolve(out))
        : smtp
          ? new SmtpMailer(parseSmtpUrl(smtp))
          : null;
      try {
        const digests = new EmailDigest({
          server,
          mailer: mailer ?? { send: async () => ({ id: "<printed>" }) },
          from,
          appBaseUrl: flag(flags, "app-url", process.env.HENOSIS_APP_URL ?? ""),
          cadence,
          log: (l) => process.stderr.write(`${l}\n`),
        });
        const recipients = digests.recipients().filter((r) => !only || r.userId === only);
        if (!recipients.length) {
          process.stderr.write(
            "digest: nobody to send to (a lead or manager of a team with an email in users.json)\n",
          );
          return 2;
        }
        for (const r of recipients) {
          if (!mailer) {
            const rendered = digests.render(r.userId, r.teamId);
            process.stdout.write(
              `To: ${r.name} <${r.email}>\nSubject: ${rendered.subject}\n${rendered.preheader}\n\n${rendered.text}\n`,
            );
            continue;
          }
          const sent = await digests.send(r);
          process.stdout.write(`sent ${r.teamName} digest to ${r.email} (${sent.id})\n`);
        }
        return 0;
      } finally {
        await server.close();
      }
    }
    case "migrate": {
      const from = flag(flags, "from", "");
      const to = flag(flags, "to", "");
      if (!from || !to) return usage();
      if (from === "postgres" && to === "postgres") {
        process.stderr.write("migrate: one end must be a folder; there is one database URL\n");
        return 2;
      }
      const databaseUrl =
        typeof flags["database-url"] === "string" ? flags["database-url"] : undefined;
      let source: Awaited<ReturnType<typeof openStoreEnd>>;
      let target: Awaited<ReturnType<typeof openStoreEnd>>;
      try {
        source = await openStoreEnd(from, { databaseUrl });
        target = await openStoreEnd(to, { databaseUrl });
      } catch (err) {
        throw new StoreUsageError(err instanceof Error ? err.message : String(err));
      }
      try {
        const report = await migrateStore(source, target);
        process.stdout.write(renderMigrateTable(report));
        return report.ok ? 0 : 3;
      } finally {
        await source.close();
        await target.close();
      }
    }
    case "demo": {
      const root = resolve(flag(flags, "dir", "./store-demo"));
      const r = await runDemo(root, (l) => process.stdout.write(`${l}\n`));
      return r.ok ? 0 : 3;
    }
    case "join": {
      const sessionId = positional[0];
      const name = flag(flags, "as", "");
      if (!sessionId || !name) {
        process.stderr.write(`${USAGE}\n`);
        return 2;
      }
      const actor: Actor = {
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        kind: "human",
        name,
      };
      const tokenFlag = flags.token;
      const token = typeof tokenFlag === "string" ? tokenFlag : process.env.HENOSIS_TOKEN;
      await joinSession(
        flag(flags, "url", "ws://127.0.0.1:7700/ws"),
        sessionId,
        actor,
        token,
        flag(flags, "branch", "main"),
      );
      return new Promise(() => {});
    }
    case "replay": {
      if (!positional[0]) return usage();
      const s = loadLog(positional[0]);
      const branch = flag(flags, "branch", "main");
      const st = s.state(branch);
      process.stdout.write(handoffBrief(st, { events: s.events(branch) }));
      return 0;
    }
    case "verify": {
      if (!positional[0]) return usage();
      const s = loadLog(positional[0]);
      let ok = true;
      for (const branch of s.branches()) {
        const c = checkReplay(s.log, branch);
        ok &&= c.ok;
        process.stdout.write(
          `${branch}: chain ${c.chain.ok ? "ok" : `BROKEN (${JSON.stringify(c.chain)})`}; replay ${c.fullHash === c.resumedHash ? "deterministic" : "MISMATCH"} ${c.fullHash.slice(0, 12)}\n`,
        );
      }
      return ok ? 0 : 3;
    }
    case "report": {
      if (!positional[0]) return usage();
      const raw = JSON.parse(readFileSync(resolve(positional[0]), "utf8")) as unknown;
      if (isChatLog(raw)) {
        process.stdout.write(renderChatReport(loadChatFile(positional[0])));
        return 0;
      }
      const s = Session.fromSerialized(raw as SerializedLog);
      let report = renderReport(s);
      const chatPath = flag(flags, "chat", "");
      if (chatPath) {
        const council = councilSection(
          chatOrUsage(() => loadChatFile(chatPath)).state(),
          s.state().sessionId,
        );
        if (council) report += `\n${council}`;
      }
      process.stdout.write(report);
      return 0;
    }
    case "council": {
      const org = positional[0];
      if (!org) return usage();
      const chat = chatOrUsage(() => loadChat(flag(flags, "dir", "./store"), org));
      const id = positional[1];
      if (!id) {
        process.stdout.write(renderCouncilList(chat.state()));
        return 0;
      }
      const c = chat.state().councils[id];
      if (!c) {
        process.stderr.write(`no council ${id} in ${org}; \`henosis council ${org}\` lists them\n`);
        return 2;
      }
      process.stdout.write(renderCouncil(chat.state(), c));
      return 0;
    }
    case "fleet": {
      if (!positional[0]) return usage();
      const data = JSON.parse(readFileSync(resolve(positional[0]), "utf8")) as SerializedLedger;
      const p = Project.fromSerialized(data);
      const v = p.ledger.verify();
      process.stdout.write(fleetBrief(p.state()));
      process.stdout.write(`\nledger chain: ${v.ok ? "ok" : `BROKEN ${JSON.stringify(v)}`}\n`);
      return v.ok ? 0 : 3;
    }
    default:
      return usage();
  }
}

function usage(): number {
  process.stderr.write(`${USAGE}\n`);
  return 2;
}

main().then(
  (code) => {
    if (code !== undefined) process.exitCode = code;
  },
  (err) => {
    if (err instanceof StoreUsageError) {
      process.stderr.write(`${err.message}\n`);
      process.exitCode = 2;
      return;
    }
    process.stderr.write(`${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
    process.exitCode = 1;
  },
);
