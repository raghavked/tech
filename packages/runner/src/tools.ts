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

/**
 * The fleet layer's hook into a session's tools. When present, writes to paths another
 * session in the project holds are refused and become failed tool results the model sees.
 */
export interface WorkspaceGuard {
  checkWrite(
    path: string,
  ): { ok: true } | { ok: false; holderSessionId: string; holderOwner: string; claimId: string };
  claim(
    resource:
      | { type: "path"; pattern: string }
      | { type: "service"; name: string }
      | { type: "ticket"; key: string },
    mode: "exclusive" | "shared",
    reason: string,
  ): { granted: boolean; claimId: string; detail: string };
  release(claimId: string): string;
  /** Text appended to the model's context describing the rest of the fleet. */
  context(): string;
  /** Called by the runner at the end of every turn. */
  reportStatus(): void;
}

/** The organisation memory's hook into a session: attributed writes, scoped reads. */
export interface MemoryAccess {
  remember(input: {
    key?: string;
    content: string;
    kind?: "fact" | "decision" | "convention";
    tags?: string[];
    evidence?: string[];
    path?: string;
  }): string;
  recall(query: string): string;
  /** Rendered team memory for this session's scope chain; injected into the model context. */
  context(): string;
}

export interface ToolContext {
  session: Session;
  branch: string;
  agentId: string;
  guard?: WorkspaceGuard | undefined;
  memory?: MemoryAccess | undefined;
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
    guardWrite(ctx, path);
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
    guardWrite(ctx, path);
    ctx.session.deleteFile(ctx.branch, ctx.agentId, path);
    return `deleted ${path}`;
  },
};

function guardWrite(ctx: ToolContext, path: string): void {
  if (!ctx.guard) return;
  const verdict = ctx.guard.checkWrite(path);
  if (verdict.ok) return;
  ctx.session.recordBlockedWrite(
    ctx.branch,
    ctx.agentId,
    path,
    verdict.holderSessionId,
    verdict.claimId,
  );
  throw new Error(
    `${path} is held by ${verdict.holderOwner}'s session (claim ${verdict.claimId}); claim it with fleet.claim or work elsewhere`,
  );
}

export const fleetClaim: ToolImpl = {
  spec: {
    name: "fleet.claim",
    description:
      "Claim a path prefix, service or ticket for this session so other agents in the project do not touch it. Denied if another session holds it; the lead then arbitrates.",
    risk: "write",
    schema: {
      type: "object",
      properties: {
        resource: {
          type: "string",
          description: "path prefix like src/billing/, or service:<name>, or ticket:<key>",
        },
        mode: { type: "string", enum: ["exclusive", "shared"] },
        reason: { type: "string" },
      },
      required: ["resource"],
      additionalProperties: false,
    },
  },
  async run(args, ctx) {
    if (!ctx.guard) return "no fleet in this session; nothing to claim";
    const raw = str(args.resource, "resource");
    const resource = raw.startsWith("service:")
      ? ({ type: "service", name: raw.slice(8) } as const)
      : raw.startsWith("ticket:")
        ? ({ type: "ticket", key: raw.slice(7) } as const)
        : ({ type: "path", pattern: safePath(raw) } as const);
    const mode = args.mode === "shared" ? "shared" : "exclusive";
    const v = ctx.guard.claim(resource, mode, typeof args.reason === "string" ? args.reason : "");
    if (!v.granted) throw new Error(`claim denied: ${v.detail}`);
    return `claim ${v.claimId} granted: ${v.detail}`;
  },
};

export const fleetRelease: ToolImpl = {
  spec: {
    name: "fleet.release",
    description: "Release a claim this session holds.",
    risk: "write",
    schema: {
      type: "object",
      properties: { claimId: { type: "string" } },
      required: ["claimId"],
      additionalProperties: false,
    },
  },
  async run(args, ctx) {
    if (!ctx.guard) return "no fleet in this session";
    return ctx.guard.release(str(args.claimId, "claimId"));
  },
};

export const fleetStatus: ToolImpl = {
  spec: {
    name: "fleet.status",
    description: "What the other agents in this project are doing and what they hold.",
    risk: "read",
    schema: { type: "object", properties: {}, additionalProperties: false },
  },
  async run(_args, ctx) {
    return ctx.guard?.context() || "no other agents in this project";
  },
};

export const memoryRemember: ToolImpl = {
  spec: {
    name: "memory.remember",
    description:
      "Record a fact, decision or convention in the team's shared memory, attributed to this session's engineer. Use a short key like db.engine so later updates supersede it.",
    risk: "write",
    schema: {
      type: "object",
      properties: {
        key: { type: "string" },
        content: { type: "string" },
        kind: { type: "string", enum: ["fact", "decision", "convention"] },
        tags: { type: "array", items: { type: "string" } },
        evidence: { type: "array", items: { type: "string" } },
        path: { type: "string", description: "optional path prefix the entry is about" },
      },
      required: ["content"],
      additionalProperties: false,
    },
  },
  async run(args, ctx) {
    if (!ctx.memory) return "no shared memory in this session";
    const kind = args.kind === "decision" || args.kind === "convention" ? args.kind : "fact";
    return ctx.memory.remember({
      content: str(args.content, "content"),
      kind,
      ...(typeof args.key === "string" ? { key: args.key } : {}),
      ...(Array.isArray(args.tags) ? { tags: args.tags.map(String) } : {}),
      ...(Array.isArray(args.evidence) ? { evidence: args.evidence.map(String) } : {}),
      ...(typeof args.path === "string" ? { path: safePath(args.path) } : {}),
    });
  },
};

export const memoryRecall: ToolImpl = {
  spec: {
    name: "memory.recall",
    description: "Search the team's shared memory for this project, team and organisation.",
    risk: "read",
    schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  async run(args, ctx) {
    if (!ctx.memory) return "no shared memory in this session";
    return ctx.memory.recall(str(args.query, "query"));
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
    .register(deploy)
    .register(fleetClaim)
    .register(fleetRelease)
    .register(fleetStatus)
    .register(memoryRemember)
    .register(memoryRecall);
}
