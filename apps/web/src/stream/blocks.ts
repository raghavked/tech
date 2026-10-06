/**
 * The conversation column as blocks, folded incrementally.
 *
 * `blocksOf` turns a session log into the rows the stream renders. `BlockFolder` does the same
 * work one event at a time: a live event costs one `push`, never a refold of the whole history.
 * The output stays identical to `blocksOf` over the same events (`test/longlog.test.ts` checks).
 * React-friendly: a block that changes after it was appended (a tool step completing) is replaced
 * by a fresh object at the same index, so memoised rows re-render only when their block did.
 */
import type { SessionState } from "@henosis/kernel";
import type { SessionEvent, ToolCall } from "@henosis/protocol";
import { copy } from "../copy.js";
import { ICONS } from "../ui.js";

export interface Step {
  id: string;
  name: string;
  doing: string;
  done: string;
  icon: string;
  args: string;
  ok: boolean | null;
  output: string;
}

export type AgentBlock = { kind: "agent"; id: string; text: string; steps: Step[] };

export type Block =
  | { kind: "human"; id: string; who: string; text: string; sub: string; team?: boolean }
  | AgentBlock
  | { kind: "divider"; id: string; text: string; danger?: boolean }
  | { kind: "approval"; id: string; approvalId: string };

/** What a tool call does, in words (copy.steps): `ask` for the approval sentence, `doing`/`done` for the step. */
export function describeCall(call: ToolCall): {
  ask: string;
  doing: string;
  done: string;
  icon: string;
} {
  const a = call.args as Record<string, unknown>;
  const str = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : "");
  const list = (k: string) => (Array.isArray(a[k]) ? (a[k] as unknown[]).map(String) : []);
  const w = copy.steps;
  switch (call.name) {
    case "workspace.read":
      return { ...w.read(str("path")), icon: ICONS.file };
    case "workspace.write":
      return { ...w.write(str("path")), icon: ICONS.pen };
    case "workspace.delete":
      return { ...w.delete(str("path")), icon: ICONS.file };
    case "workspace.list":
      return { ...w.list, icon: ICONS.file };
    case "shell.run":
      return {
        ...w.shell([str("command"), ...list("args")].join(" ").trim()),
        icon: ICONS.terminal,
      };
    case "deploy":
      return { ...w.deploy(str("env")), icon: ICONS.rocket };
    case "memory.remember":
      return { ...w.remember(str("key")), icon: ICONS.memory };
    case "memory.recall":
      return { ...w.recall, icon: ICONS.memory };
    case "fleet.claim":
      return { ...w.claim, icon: ICONS.tool };
    case "fleet.release":
      return { ...w.release, icon: ICONS.tool };
    default:
      return { ...w.other(call.name, JSON.stringify(call.args).slice(0, 60)), icon: ICONS.tool };
  }
}

/**
 * Folds events into blocks one at a time. `sync` consumes only the events it has not seen; it
 * starts over when handed a different log (a reconnect, a branch switch, a shorter array).
 */
export class BlockFolder {
  /** Appended in place; replaced blocks get a new object at the same index. */
  blocks: Block[] = [];
  /** Bumps whenever `blocks` changed; cheap to compare in a hook or a memo. */
  version = 0;
  /** How many events have been folded. */
  count = 0;
  private first: SessionEvent | null = null;
  private readonly steps = new Map<string, { step: Step; blockIndex: number }>();
  private agent: { block: AgentBlock; index: number } | null = null;

  reset(): void {
    this.blocks = [];
    this.count = 0;
    this.first = null;
    this.steps.clear();
    this.agent = null;
    this.version += 1;
  }

  /** Henosis whatever is new in `events`; returns the (same, mutated) block array. */
  sync(events: readonly SessionEvent[], s: SessionState, meId: string): Block[] {
    const sameLog = this.count <= events.length && (this.count === 0 || events[0] === this.first);
    if (!sameLog) this.reset();
    if (this.count === 0 && events.length > 0) this.first = events[0] ?? null;
    for (let i = this.count; i < events.length; i++) {
      const e = events[i];
      if (e) this.push(e, s, meId);
    }
    this.count = events.length;
    return this.blocks;
  }

  /** Henosis one event. `s` is the state after it (or any later state; names only). */
  push(e: SessionEvent, s: SessionState, meId: string): void {
    const name = (id: string) => s.participants[id]?.actor.name ?? id;
    const out = this.blocks;
    const touched = () => {
      this.version += 1;
    };
    const divider = (text: string, danger = false) => {
      out.push({ kind: "divider", id: e.id, text, danger });
      touched();
    };
    const human = (text: string, sub = "", team = false) => {
      out.push({ kind: "human", id: e.id, who: name(e.actor), text, sub, team });
      touched();
    };
    switch (e.kind) {
      case "directive.submitted": {
        const i = e.payload.input;
        const parts = [
          i.mode !== "steer" ? i.mode : "",
          i.scope !== "goal" ? i.scope : "",
          i.interrupt ? copy.stream.interrupt : "",
        ];
        human(i.text, parts.filter(Boolean).join(" · "));
        this.agent = null;
        break;
      }
      case "note.posted":
        human(e.payload.text, "", true);
        break;
      case "agent.model.completed": {
        const block: AgentBlock = { kind: "agent", id: e.id, text: e.payload.text, steps: [] };
        this.agent = { block, index: out.length };
        out.push(block);
        touched();
        break;
      }
      case "agent.tool.requested": {
        const d = describeCall(e.payload.call);
        const step: Step = {
          id: e.payload.call.id,
          name: e.payload.call.name,
          doing: d.doing,
          done: d.done,
          icon: d.icon,
          args: JSON.stringify(e.payload.call.args, null, 1),
          ok: null,
          output: "",
        };
        if (!this.agent) {
          const block: AgentBlock = { kind: "agent", id: e.id, text: "", steps: [step] };
          this.agent = { block, index: out.length };
          out.push(block);
        } else {
          // A new object so a memoised row sees the change; same id, same index.
          const block: AgentBlock = {
            ...this.agent.block,
            steps: [...this.agent.block.steps, step],
          };
          out[this.agent.index] = block;
          this.agent.block = block;
        }
        this.steps.set(step.id, { step, blockIndex: this.agent.index });
        touched();
        break;
      }
      case "agent.tool.completed": {
        const hit = this.steps.get(e.payload.result.callId);
        if (hit) {
          const step: Step = {
            ...hit.step,
            ok: e.payload.result.ok,
            output: e.payload.result.output,
          };
          const prev = out[hit.blockIndex];
          if (prev && prev.kind === "agent") {
            const block: AgentBlock = {
              ...prev,
              steps: prev.steps.map((st) => (st.id === step.id ? step : st)),
            };
            out[hit.blockIndex] = block;
            if (this.agent && this.agent.index === hit.blockIndex) this.agent.block = block;
          }
          hit.step = step;
          touched();
        }
        break;
      }
      case "agent.turn.ended":
        if (e.payload.reason !== "done")
          divider(copy.stream.turnEnded(e.payload.turn, e.payload.reason, e.payload.summary));
        break;
      case "approval.requested":
        out.push({ kind: "approval", id: e.id, approvalId: e.payload.approvalId });
        touched();
        break;
      case "project.directive.applied":
        divider(copy.stream.projectDirection(name(e.payload.author), e.payload.input.text));
        break;
      case "contention.resolved":
        divider(copy.stream.picked(name(e.actor)));
        break;
      case "directive.withdrawn":
        divider(copy.stream.withdrew(name(e.actor)));
        break;
      case "handoff.requested":
        divider(
          copy.stream.offered(
            name(e.actor),
            e.payload.to === meId ? copy.roles.you : name(e.payload.to),
          ),
        );
        break;
      case "handoff.accepted":
        divider(copy.stream.hasTheBaton(name(e.actor)));
        break;
      case "handoff.declined":
        divider(copy.stream.declined(name(e.actor)));
        break;
      case "participant.joined":
        divider(copy.stream.joined(e.payload.actor.name, e.payload.role));
        break;
      case "participant.left":
        divider(copy.stream.left(name(e.actor)));
        break;
      case "role.changed":
        divider(copy.stream.roleChanged(name(e.payload.actorId), e.payload.role));
        break;
      case "checkpoint.created":
        divider(copy.stream.checkpoint(e.payload.label));
        break;
      case "branch.created":
        divider(copy.stream.forked(e.payload.branch, e.payload.fromBranch));
        break;
      case "branch.merged":
        divider(
          // The merge lands on the target branch; `payload.base` is the merge-base checkpoint.
          copy.stream.folded(e.payload.source, e.branch, e.payload.conflicts.length),
          e.payload.conflicts.length > 0,
        );
        break;
      case "workspace.blocked":
        divider(copy.stream.writeRefused(e.payload.path, e.payload.holderSessionId), true);
        break;
      case "fleet.contention.mirrored":
        divider(
          copy.stream.fleetContention(
            e.payload.kind,
            e.payload.resource,
            e.payload.sessionIds.filter((id) => id !== s.sessionId),
            e.payload.resolved,
          ),
          !e.payload.resolved,
        );
        break;
      default:
        break;
    }
  }
}

/** The whole log at once; what the stream did before it folded incrementally. */
export function blocksOf(events: readonly SessionEvent[], s: SessionState, meId: string): Block[] {
  const f = new BlockFolder();
  for (const e of events) f.push(e, s, meId);
  return f.blocks;
}

/** A rough height in px for a block before it has been measured; only the scrollbar notices. */
export function estimateHeight(b: Block): number {
  switch (b.kind) {
    case "human":
      return 44 + 24 * Math.ceil(Math.max(1, b.text.length) / 70);
    case "agent":
      return 25 * Math.max(b.text ? Math.ceil(b.text.length / 90) : 0, 0) + 27 * b.steps.length + 4;
    case "divider":
      return 20;
    case "approval":
      return 96;
  }
}
