/**
 * The conversation column as blocks, folded incrementally.
 *
 * `blocksOf` turns a session log into the rows the stream renders. `BlockFolder` does the same
 * work one event at a time: a live event costs one `push`, never a refold of the whole history.
 * The output stays identical to `blocksOf` over the same events (`test/longlog.test.ts` checks).
 * React-friendly: a block that changes after it was appended (a tool step completing) is replaced
 * by a fresh object at the same index, so memoised rows re-render only when their block did.
 *
 * Every block carries the turn it fell in; the agent's carries the plan step it ran under, so
 * the stream's right-hand meta rule holds: people carry a time, the agent carries
 * "turn N · step k of m".
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
  /** The mono result at the right once the step finished: "exit 0", "212 lines", "+64 −0". */
  result: string;
}

export type AgentBlock = {
  kind: "agent";
  id: string;
  text: string;
  steps: Step[];
  turn: number;
  /** The plan step the turn ran under, one-based, with the plan's length; null outside a plan. */
  step: { k: number; m: number } | null;
};

export type Block =
  | {
      kind: "human";
      id: string;
      who: string;
      actorId: string;
      text: string;
      /** The mode and "interrupt", when the directive was not a plain steer. */
      sub: string;
      /** The scope the directive landed on ("goal", "api"); the mono chip in the meta. */
      scope: string;
      /** The first message on a goal wears the italic serif "Goal" label. */
      goal?: boolean;
      team?: boolean;
      turn: number;
    }
  | AgentBlock
  | { kind: "divider"; id: string; text: string; danger?: boolean; turn: number }
  /** Someone joined the circle: the serif line with the mark closing once. */
  | { kind: "join"; id: string; who: string; role: string; agent: boolean; turn: number }
  | { kind: "approval"; id: string; approvalId: string; turn: number }
  /** Plan first: the card renders from `state.plans[planId]`, live. */
  | { kind: "plan"; id: string; planId: string; turn: number };

/**
 * What a tool call does, in words (copy.steps): `ask` for the approval sentence, `doing`/`done`
 * for the step; `verb` and `object` are the same ask split so the object can be set in mono.
 */
export function describeCall(call: ToolCall): {
  ask: string;
  doing: string;
  done: string;
  icon: string;
  verb: string;
  object: string;
} {
  const a = call.args as Record<string, unknown>;
  const str = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : "");
  const list = (k: string) => (Array.isArray(a[k]) ? (a[k] as unknown[]).map(String) : []);
  const w = copy.steps;
  switch (call.name) {
    case "workspace.read":
      return { ...w.read(str("path")), icon: ICONS.file, verb: "read", object: str("path") };
    case "workspace.write":
      return { ...w.write(str("path")), icon: ICONS.pen, verb: "write", object: str("path") };
    case "workspace.delete":
      return { ...w.delete(str("path")), icon: ICONS.file, verb: "delete", object: str("path") };
    case "workspace.list":
      return { ...w.list, icon: ICONS.file, verb: "list", object: "the workspace" };
    case "shell.run": {
      const cmd = [str("command"), ...list("args")].join(" ").trim();
      return { ...w.shell(cmd), icon: ICONS.terminal, verb: "run", object: cmd };
    }
    case "deploy":
      return { ...w.deploy(str("env")), icon: ICONS.rocket, verb: "deploy to", object: str("env") };
    case "memory.remember":
      return {
        ...w.remember(str("key")),
        icon: ICONS.memory,
        verb: "remember",
        object: str("key"),
      };
    case "memory.recall":
      return { ...w.recall, icon: ICONS.memory, verb: "recall", object: "team memory" };
    case "fleet.claim":
      return { ...w.claim, icon: ICONS.tool, verb: "claim", object: "a resource" };
    case "fleet.release":
      return { ...w.release, icon: ICONS.tool, verb: "release", object: "a claim" };
    case "plan.propose":
      return { ...w.propose, icon: ICONS.memory, verb: "propose", object: "a plan" };
    case "plan.step": {
      const id = str("stepId");
      return { ...w.planStep(id), icon: ICONS.check, verb: "start", object: `step ${id}` };
    }
    default: {
      const args = JSON.stringify(call.args).slice(0, 60);
      return { ...w.other(call.name, args), icon: ICONS.tool, verb: call.name, object: args };
    }
  }
}

/** The mono result at the right of a finished step. */
export function resultOf(step: Pick<Step, "name" | "ok" | "output">): string {
  const r = copy.steps.result;
  if (step.ok === null) return "";
  if (!step.ok) return r.failed;
  switch (step.name) {
    case "shell.run":
      return r.exitOk;
    case "workspace.read": {
      const n = step.output ? step.output.split("\n").length : 0;
      return r.lines(n);
    }
    case "workspace.write":
      return r.written;
    case "workspace.delete":
      return r.deleted;
    case "deploy":
      return r.deployed;
    case "memory.remember":
      return r.kept;
    default:
      return r.done;
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
  private turn = 0;
  /** The active plan's step ids in order, and which one is running (for "step k of m"). */
  private planSteps: string[] = [];
  private planK: number | null = null;

  reset(): void {
    this.blocks = [];
    this.count = 0;
    this.first = null;
    this.steps.clear();
    this.agent = null;
    this.turn = 0;
    this.planSteps = [];
    this.planK = null;
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
    const turn = this.turn;
    const touched = () => {
      this.version += 1;
    };
    const divider = (text: string, danger = false) => {
      out.push({ kind: "divider", id: e.id, text, danger, turn });
      touched();
    };
    switch (e.kind) {
      case "directive.submitted": {
        const i = e.payload.input;
        const parts = [i.mode !== "steer" ? i.mode : "", i.interrupt ? copy.stream.interrupt : ""];
        out.push({
          kind: "human",
          id: e.id,
          who: name(e.actor),
          actorId: e.actor,
          text: i.text,
          sub: parts.filter(Boolean).join(" · "),
          scope: i.scope,
          goal: i.mode === "steer" && i.scope === "goal",
          turn,
        });
        touched();
        this.agent = null;
        break;
      }
      case "note.posted":
        out.push({
          kind: "human",
          id: e.id,
          who: name(e.actor),
          actorId: e.actor,
          text: e.payload.text,
          sub: "",
          scope: "",
          team: true,
          turn,
        });
        touched();
        break;
      case "agent.turn.started":
        this.turn = e.payload.turn;
        break;
      case "agent.model.completed": {
        const block: AgentBlock = {
          kind: "agent",
          id: e.id,
          text: e.payload.text,
          steps: [],
          turn: e.payload.turn,
          step: this.stepOf(),
        };
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
          result: "",
        };
        if (!this.agent) {
          const block: AgentBlock = {
            kind: "agent",
            id: e.id,
            text: "",
            steps: [step],
            turn: e.payload.turn,
            step: this.stepOf(),
          };
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
          const done = { ...hit.step, ok: e.payload.result.ok, output: e.payload.result.output };
          const step: Step = { ...done, result: resultOf(done) };
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
        out.push({ kind: "approval", id: e.id, approvalId: e.payload.approvalId, turn });
        touched();
        break;
      case "plan.proposed":
        this.planSteps = e.payload.steps.map((st) => st.id);
        this.planK = null;
        out.push({ kind: "plan", id: e.id, planId: e.payload.planId, turn });
        touched();
        this.agent = null;
        break;
      case "plan.step.started": {
        const i = this.planSteps.indexOf(e.payload.stepId);
        this.planK = i >= 0 ? i + 1 : this.planK;
        // The turn's block was appended before its step started: say the step on it now.
        if (this.agent && this.agent.block.turn === e.payload.turn) {
          const block: AgentBlock = { ...this.agent.block, step: this.stepOf() };
          out[this.agent.index] = block;
          this.agent.block = block;
          touched();
        }
        break;
      }
      case "plan.decided":
        divider(copy.stream.planDecided(name(e.actor), e.payload.status));
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
        out.push({
          kind: "join",
          id: e.id,
          who: e.payload.actor.name,
          role: e.payload.role,
          agent: e.payload.actor.kind === "agent",
          turn,
        });
        touched();
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

  private stepOf(): { k: number; m: number } | null {
    return this.planK !== null && this.planSteps.length
      ? { k: this.planK, m: this.planSteps.length }
      : null;
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
      return 72 + 24 * Math.ceil(Math.max(1, b.text.length) / 70);
    case "agent":
      return (
        28 + 24 * Math.max(b.text ? Math.ceil(b.text.length / 90) : 0, 0) + 30 * b.steps.length
      );
    case "divider":
      return 20;
    case "join":
      return 32;
    case "approval":
      return 160;
    case "plan":
      return 320;
  }
}
