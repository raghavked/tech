#!/usr/bin/env node
/** fold: the multiplayer kernel for long-running agent sessions. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fleetBrief, Project, type SerializedLedger } from "@fold/fleet";
import { checkReplay, handoffBrief, type SerializedLog, Session } from "@fold/kernel";
import type { Actor } from "@fold/protocol";
import {
  ClaudeModel,
  claudeAvailable,
  defaultTools,
  type Model,
  ScriptedModel,
} from "@fold/runner";
import { FoldServer } from "@fold/server";
import { runDemo } from "./demo.js";
import { joinSession } from "./join.js";
import { renderReport } from "./report.js";

const USAGE = `fold <command> [options]

  serve    [--port 7700] [--dir ./store] [--model scripted|claude] [--token T]   run the session server
  demo     [--dir ./store-demo]                                                 offline multiplayer scenario
  join     <session> --as <name> [--url ws://127.0.0.1:7700/ws] [--token T] [--branch main]
  replay   <log.json> [--branch main]                                           fold the log, print the brief
  verify   <log.json>                                                           check hashes and replay determinism
  report   <log.json>                                                           markdown report of every branch
  fleet    <ledger.json>                                                        fleet brief from a project ledger
  slack    --config slack.json [--port 7700] [--dir ./store] [--model ...]     serve plus the Slack adapter (socket mode)

slack.json: { "botToken": "xoxb-...", "appToken": "xapp-...", "map": { "teams": {"payments": "C..."},
             "projects": {"billing": "C..."}, "management": "C...", "users": {"U123": "ana"} }, "projects": ["billing"] }

Environment: FOLD_OFFLINE=1 blocks the Claude adapter; ANTHROPIC_API_KEY enables it.
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

function pickModel(name: string): Model {
  if (name === "claude") {
    if (!claudeAvailable()) {
      process.stderr.write(
        "claude model requested but ANTHROPIC_API_KEY is unset or FOLD_OFFLINE=1\n",
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
      const token = typeof tokenFlag === "string" ? tokenFlag : process.env.FOLD_TOKEN;
      const server = new FoldServer({
        root,
        model,
        tools: defaultTools(),
        token,
        log: (l) => process.stderr.write(`${l}\n`),
      });
      const bound = await server.listen(port, flag(flags, "host", "127.0.0.1"));
      process.stdout.write(
        `fold server on ws://127.0.0.1:${bound}/ws (model ${model.name}, store ${root}${token ? ", token required" : ""})\n`,
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
      };
      const { BoltSlackClient, ChannelMap, SlackAdapter } = await import("@fold/slack");
      const port = Number(flag(flags, "port", "7700"));
      const root = resolve(flag(flags, "dir", "./store"));
      const server = new FoldServer({
        root,
        model: pickModel(flag(flags, "model", "scripted")),
        tools: defaultTools(),
        token: process.env.FOLD_TOKEN,
        log: (l) => process.stderr.write(`${l}\n`),
      });
      const bound = await server.listen(port, flag(flags, "host", "127.0.0.1"));
      const adapter = new SlackAdapter({
        server,
        client: new BoltSlackClient({ botToken: cfg.botToken, appToken: cfg.appToken }),
        map: ChannelMap.parse(cfg.map),
        log: (l) => process.stderr.write(`${l}\n`),
      });
      for (const pid of cfg.projects ?? server.orgs.projectsFor(null).map((p) => p.projectId))
        adapter.watchProject(pid);
      await adapter.start();
      server.integrations.slack = true;
      process.stdout.write(
        `fold server on ws://127.0.0.1:${bound}/ws with Slack adapter (socket mode)\n`,
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
      const token = typeof tokenFlag === "string" ? tokenFlag : process.env.FOLD_TOKEN;
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
      process.stdout.write(renderReport(loadLog(positional[0])));
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
    process.stderr.write(`${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
    process.exitCode = 1;
  },
);
