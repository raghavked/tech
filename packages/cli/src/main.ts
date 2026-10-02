#!/usr/bin/env node
/** quorum: the multiplayer kernel for long-running agent sessions. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkReplay, handoffBrief, type SerializedLog, Session } from "@quorum/kernel";
import type { Actor } from "@quorum/protocol";
import {
  ClaudeModel,
  claudeAvailable,
  defaultTools,
  type Model,
  ScriptedModel,
} from "@quorum/runner";
import { QuorumServer } from "@quorum/server";
import { runDemo } from "./demo.js";
import { joinSession } from "./join.js";
import { renderReport } from "./report.js";

const USAGE = `quorum <command> [options]

  serve    [--port 7700] [--dir ./store] [--model scripted|claude] [--token T]   run the session server
  demo     [--dir ./store-demo]                                                 offline multiplayer scenario
  join     <session> --as <name> [--url ws://127.0.0.1:7700/ws] [--token T] [--branch main]
  replay   <log.json> [--branch main]                                           fold the log, print the brief
  verify   <log.json>                                                           check hashes and replay determinism
  report   <log.json>                                                           markdown report of every branch

Environment: QUORUM_OFFLINE=1 blocks the Claude adapter; ANTHROPIC_API_KEY enables it.
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
        "claude model requested but ANTHROPIC_API_KEY is unset or QUORUM_OFFLINE=1\n",
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
      const token = typeof tokenFlag === "string" ? tokenFlag : process.env.QUORUM_TOKEN;
      const server = new QuorumServer({
        root,
        model,
        tools: defaultTools(),
        token,
        log: (l) => process.stderr.write(`${l}\n`),
      });
      const bound = await server.listen(port, flag(flags, "host", "127.0.0.1"));
      process.stdout.write(
        `quorum server on ws://127.0.0.1:${bound}/ws (model ${model.name}, store ${root}${token ? ", token required" : ""})\n`,
      );
      const stop = async () => {
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
      const token = typeof tokenFlag === "string" ? tokenFlag : process.env.QUORUM_TOKEN;
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
