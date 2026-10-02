/**
 * Tools execute against the session so every workspace change is a logged event. The shell
 * runs in a materialized scratch copy of the workspace; its output is recorded, its side
 * effects on disk are not (the log stays authoritative).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, normalize } from "node:path";
import type { Session } from "@atelier/kernel";
import type { ToolCall } from "@atelier/protocol";
import type { ToolSpec } from "./model.js";

export interface ToolContext {
  session: Session;
  branch: string;
  agentId: string;
}

export interface ToolImpl {
  spec: ToolSpec;
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<string>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolImpl>();
  register(tool: ToolImpl): this {
    this.tools.set(tool.spec.name, tool);
    return this;
  }
  get(name: string): ToolImpl | undefined {
    return this.tools.get(name);
  }
  specs(): ToolSpec[] {
    return [...this.tools.values()].map((t) => t.spec);
  }
  /** Build a ToolCall with the registry's risk class for the tool. */
  call(id: string, name: string, args: Record<string, unknown>): ToolCall {
    const t = this.tools.get(name);
    return { id, name, args, risk: t?.spec.risk ?? "irreversible" };
  }
}

function safePath(p: unknown): string {
  if (typeof p !== "string" || !p) throw new Error("path must be a non-empty string");
  const n = normalize(p).replace(/\\/g, "/");
  if (n.startsWith("/") || n.startsWith("..") || n.includes("/../"))
    throw new Error(`unsafe path ${p}`);
  return n;
}

const str = (v: unknown, name: string): string => {
  if (typeof v !== "string") throw new Error(`${name} must be a string`);
  return v;
};

export const workspaceList: ToolImpl = {
  spec: {
    name: "workspace.list",
    description: "List files in the workspace.",
    risk: "read",
    schema: { type: "object", properties: {}, additionalProperties: false },
  },
  async run(_args, ctx) {
    return Object.keys(ctx.session.state(ctx.branch).workspace).sort().join("\n") || "(empty)";
  },
};

export const workspaceRead: ToolImpl = {
  spec: {
    name: "workspace.read",
    description: "Read a file from the workspace.",
    risk: "read",
    schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
  },
  async run(args, ctx) {
    const path = safePath(args.path);
    const content = ctx.session.readFile(ctx.branch, path);
    if (content === undefined) throw new Error(`no such file ${path}`);
    return content;
  },
};

export const workspaceWrite: ToolImpl = {
  spec: {
    name: "workspace.write",
    description: "Create or overwrite a file in the workspace.",
    risk: "write",
    schema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
      additionalProperties: false,
    },
  },
  async run(args, ctx) {
    const path = safePath(args.path);
    ctx.session.writeFile(ctx.branch, ctx.agentId, path, str(args.content, "content"));
    return `wrote ${path}`;
  },
};

export const workspaceDelete: ToolImpl = {
  spec: {
    name: "workspace.delete",
    description: "Delete a file from the workspace.",
    risk: "write",
    schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
  },
  async run(args, ctx) {
    const path = safePath(args.path);
    ctx.session.deleteFile(ctx.branch, ctx.agentId, path);
    return `deleted ${path}`;
  },
};

const SHELL_ALLOWLIST = new Set([
  "node",
  "ls",
  "cat",
  "echo",
  "wc",
  "grep",
  "head",
  "tail",
  "sort",
  "python3",
  "sh",
]);

export const shellRun: ToolImpl = {
  spec: {
    name: "shell.run",
    description:
      "Run an allow-listed command in a scratch copy of the workspace and return its output. Changes it makes on disk are discarded.",
    risk: "exec",
    schema: {
      type: "object",
      properties: {
        command: { type: "string" },
        args: { type: "array", items: { type: "string" } },
      },
      required: ["command"],
      additionalProperties: false,
    },
  },
  async run(args, ctx) {
    const command = str(args.command, "command");
    if (!SHELL_ALLOWLIST.has(command)) throw new Error(`command not allowed: ${command}`);
    const argv = Array.isArray(args.args) ? args.args.map((a) => String(a)) : [];
    const dir = mkdtempSync(join(tmpdir(), "atelier-ws-"));
    try {
      const ws = ctx.session.state(ctx.branch).workspace;
      for (const [path, hash] of Object.entries(ws)) {
        const content = ctx.session.store.get(hash) ?? "";
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), content);
      }
      const r = spawnSync(command, argv, {
        cwd: dir,
        encoding: "utf8",
        timeout: 20_000,
        maxBuffer: 1 << 20,
      });
      const out = `${r.stdout ?? ""}${r.stderr ? `\n[stderr]\n${r.stderr}` : ""}`.trim();
      if (r.error) throw r.error;
      return `exit ${r.status}\n${out.slice(0, 8000)}`;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
};

export const deploy: ToolImpl = {
  spec: {
    name: "deploy",
    description:
      "Deploy the workspace to an environment. Irreversible; requires a quorum of approvers.",
    risk: "irreversible",
    schema: {
      type: "object",
      properties: { env: { type: "string" } },
      required: ["env"],
      additionalProperties: false,
    },
  },
  async run(args, ctx) {
    const env = str(args.env, "env");
    const st = ctx.session.state(ctx.branch);
    const marker = `deployed ${Object.keys(st.workspace).length} files to ${env} at seq ${st.seq}\n`;
    ctx.session.writeFile(ctx.branch, ctx.agentId, `.deployments/${env}.log`, marker);
    return marker.trim();
  },
};

export function defaultTools(): ToolRegistry {
  return new ToolRegistry()
    .register(workspaceList)
    .register(workspaceRead)
    .register(workspaceWrite)
    .register(workspaceDelete)
    .register(shellRun)
    .register(deploy);
}
