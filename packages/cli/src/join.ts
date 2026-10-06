/** Interactive terminal client: a human participant in a live session. */
import { createInterface } from "node:readline";
import { fold, type SessionState } from "@henosis/kernel";
import type {
  Actor,
  ClientMessage,
  DirectiveInput,
  ServerMessage,
  SessionEvent,
} from "@henosis/protocol";
import WebSocket from "ws";

const HELP = `Type text to steer the goal. Commands:
  /scope <name> <text>     steer a named scope        /constrain <text>   add a constraint
  /interrupt <text>        redirect now               /pause | /resume | /cancel
  /approve <id> | /deny <id>                          /resolve <contention> <winner-directive>
  /handoff <actor>  /accept <id>  /decline <id>       /role <actor> <observer|contributor|driver|owner>
  /fork <branch>  /merge <branch>  /switch <branch>   /checkpoint [label]
  /brief  /state  /files  /note <text>  /quit`;

export async function joinSession(
  url: string,
  sessionId: string,
  actor: Actor,
  token?: string,
  branch = "main",
): Promise<void> {
  const ws = new WebSocket(url);
  let state: SessionState | null = null;
  const out = (line: string) => process.stdout.write(`${line}\n`);
  const send = (m: ClientMessage) => ws.send(JSON.stringify(m));
  await new Promise<void>((r, j) => {
    ws.once("open", () => r());
    ws.once("error", j);
  });
  const joinMsg: ClientMessage = token
    ? { type: "join", sessionId, actor, token, branch }
    : { type: "join", sessionId, actor, branch };
  send(joinMsg);
  ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString()) as ServerMessage;
    switch (m.type) {
      case "joined":
        out(`joined ${m.sessionId} on branch ${m.branch} as ${actor.name}`);
        break;
      case "snapshot":
        state = fold(m.events);
        out(
          `history: ${m.events.length} events; status ${state.status}; driver ${state.driver ?? "nobody"}`,
        );
        break;
      case "event":
        if (state) state = fold([m.event], state);
        out(describe(m.event, state));
        break;
      case "presence":
        out(
          `presence: ${m.entries.map((e) => `${e.actor.name}${e.online ? "" : " (offline)"} [${e.role}${e.status ? `, ${e.status}` : ""}]`).join(", ")}`,
        );
        break;
      case "brief":
        out(m.markdown);
        break;
      case "error":
        out(`! ${m.message}`);
        break;
    }
  });
  ws.on("close", () => {
    out("disconnected");
    process.exit(0);
  });
  out(HELP);
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${actor.name}> `,
  });
  rl.prompt();
  rl.on("line", (line) => {
    const msg = parseLine(line.trim(), state);
    if (msg === "quit") {
      send({ type: "leave" });
      ws.close();
      return;
    }
    if (msg === "help") out(HELP);
    else if (msg === "state") out(JSON.stringify(summary(state), null, 2));
    else if (msg === "files")
      out(
        Object.keys(state?.workspace ?? {})
          .sort()
          .join("\n") || "(empty)",
      );
    else if (msg) send(msg);
    rl.prompt();
  });
}

function directive(partial: Partial<DirectiveInput> & { text: string }): ClientMessage {
  return {
    type: "directive",
    input: { mode: "steer", scope: "goal", supersedes: [], interrupt: false, ...partial },
  };
}

function parseLine(
  line: string,
  _state: SessionState | null,
): ClientMessage | "quit" | "help" | "state" | "files" | null {
  if (!line) return null;
  if (!line.startsWith("/")) return directive({ text: line });
  const [cmd, ...rest] = line.slice(1).split(/\s+/);
  const text = rest.join(" ");
  switch (cmd) {
    case "scope": {
      const [scope, ...t] = rest;
      return scope && t.length ? directive({ text: t.join(" "), scope }) : null;
    }
    case "constrain":
      return text ? directive({ text, mode: "constrain", scope: "constraint" }) : null;
    case "interrupt":
      return text ? directive({ text, interrupt: true }) : null;
    case "pause":
      return directive({ text: text || "pause", mode: "pause" });
    case "resume":
      return directive({ text: text || "resume", mode: "resume" });
    case "cancel":
      return directive({ text: text || "cancel", mode: "cancel" });
    case "approve":
      return rest[0] ? { type: "vote", approvalId: rest[0], vote: "approve" } : null;
    case "deny":
      return rest[0] ? { type: "vote", approvalId: rest[0], vote: "deny" } : null;
    case "resolve":
      return rest[0] ? { type: "resolve", contentionId: rest[0], winner: rest[1] ?? null } : null;
    case "handoff":
      return rest[0] ? { type: "handoff.request", to: rest[0] } : null;
    case "accept":
      return rest[0] ? { type: "handoff.accept", handoffId: rest[0] } : null;
    case "decline":
      return rest[0] ? { type: "handoff.decline", handoffId: rest[0] } : null;
    case "role": {
      const role = rest[1];
      if (!rest[0] || !role || !["observer", "contributor", "driver", "owner"].includes(role))
        return null;
      return {
        type: "role",
        actorId: rest[0],
        role: role as "observer" | "contributor" | "driver" | "owner",
      };
    }
    case "fork":
      return rest[0] ? { type: "fork", branch: rest[0] } : null;
    case "merge":
      return rest[0] ? { type: "merge", source: rest[0] } : null;
    case "switch":
      return rest[0] ? { type: "switch", branch: rest[0] } : null;
    case "checkpoint":
      return { type: "checkpoint", label: text || "manual" };
    case "brief":
      return { type: "brief" };
    case "note":
      return text ? { type: "note", text } : null;
    case "state":
      return "state";
    case "files":
      return "files";
    case "help":
      return "help";
    case "quit":
    case "exit":
      return "quit";
    default:
      return null;
  }
}

function summary(s: SessionState | null) {
  if (!s) return null;
  return {
    status: s.status,
    driver: s.driver,
    goal: s.intent.goal?.text ?? null,
    steers: Object.fromEntries(Object.entries(s.intent.steers).map(([k, v]) => [k, v.text])),
    constraints: s.intent.constraints.map((c) => c.text),
    contentions: Object.values(s.contentions).filter((c) => !c.resolved),
    approvals: Object.values(s.approvals)
      .filter((a) => a.status === "pending")
      .map((a) => ({ id: a.id, tool: a.call.name, risk: a.call.risk })),
    handoffs: Object.values(s.handoffs).filter((h) => h.status === "pending"),
    branches: Object.keys(s.branches),
    turns: s.turns.length,
  };
}

export function describe(e: SessionEvent, s: SessionState | null): string {
  const who = s?.participants[e.actor]?.actor.name ?? e.actor;
  switch (e.kind) {
    case "directive.submitted":
      return `${who} [${e.payload.input.mode}/${e.payload.input.scope}] ${e.payload.input.text} (${e.payload.directiveId}${s?.directives[e.payload.directiveId]?.status === "contended" ? ", CONTENDED" : ""})`;
    case "agent.turn.started":
      return `agent: turn ${e.payload.turn} started`;
    case "agent.model.completed":
      return `agent: ${e.payload.text}`;
    case "agent.tool.requested":
      return `agent -> ${e.payload.call.name} ${JSON.stringify(e.payload.call.args).slice(0, 100)}`;
    case "agent.tool.completed":
      return `  ${e.payload.result.ok ? "ok" : "failed"}: ${e.payload.result.output.split("\n")[0]?.slice(0, 100)}`;
    case "agent.turn.ended":
      return `agent: turn ended (${e.payload.reason}) ${e.payload.summary}`;
    case "approval.requested":
      return `APPROVAL NEEDED ${e.payload.approvalId}: ${e.payload.call.name} [${e.payload.call.risk}] ${JSON.stringify(e.payload.call.args)}  -> /approve ${e.payload.approvalId}`;
    case "approval.voted":
      return `${who} voted ${e.payload.vote} on ${e.payload.approvalId} (${s?.approvals[e.payload.approvalId]?.status})`;
    case "handoff.requested":
      return `${who} offers the driver seat to ${e.payload.to} -> /accept ${e.payload.handoffId}`;
    case "handoff.accepted":
      return `${who} is now the driver`;
    case "contention.resolved":
      return `${who} resolved ${e.payload.contentionId}`;
    case "workspace.changed":
      return `workspace: ${Object.keys(e.payload.changes).join(", ")}`;
    case "branch.created":
      return `branch ${e.payload.branch} forked from ${e.payload.fromBranch}`;
    case "branch.merged":
      return `merged ${e.payload.source}; conflicts: ${e.payload.conflicts.join(", ") || "none"}`;
    case "participant.joined":
      return `${e.payload.actor.name} joined as ${e.payload.role}`;
    case "participant.left":
      return `${who} left`;
    case "role.changed":
      return `${e.payload.actorId} is now ${e.payload.role}`;
    case "note.posted":
      return `${who}: ${e.payload.text}`;
    default:
      return `${e.kind}`;
  }
}
