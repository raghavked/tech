/**
 * Time travel: fold the session up to a point in its own log, in the client.
 * A pure fold over the events already here; nothing is asked of the server.
 *
 * `turnMarks` also reads what each turn was for the scrubber's labels ("Bo steers", "the plan",
 * "release gate"), which plan step it ran under, and whether a release gate opened in it.
 */
import { fold, isRatingsRule, ruleFor, type SessionState } from "@henosis/kernel";
import type { SessionEvent } from "@henosis/protocol";

/** One agent turn as a window of the log: from its `agent.turn.started` to just before the next. */
export interface TurnMark {
  turn: number;
  startSeq: number;
  /** Last seq that still belongs to this turn (the last event for the newest turn). */
  endSeq: number;
  /** A few words on what the turn was: who steered into it, or what it did. */
  what: string;
  /** Zero-based plan step the turn started under; null outside a plan. */
  stepIndex: number | null;
  /** A release gate (an approval under a ratings rule) was asked for in this turn. */
  gate: boolean;
  /** The id of the event that started the turn; a clock (stream/clock.ts) may know its arrival. */
  eventId: string;
}

/** One mark per turn, in order; empty when the agent has not started yet. */
export function turnMarks(
  events: readonly SessionEvent[],
  state?: SessionState | null,
  nameOf: (actorId: string) => string = (id) => id,
): TurnMark[] {
  const out: TurnMark[] = [];
  const last = events[events.length - 1]?.seq ?? -1;
  const policy = state?.policy.approvals ?? null;
  // What came between turns steers the next one: the last human directive, or a plan decision.
  let before: string | null = null;
  let stepIndex: number | null = null;
  let planSteps: string[] = [];
  let current: TurnMark | null = null;
  let did: string | null = null;
  for (const e of events) {
    switch (e.kind) {
      case "agent.turn.started": {
        if (current) current.endSeq = e.seq - 1;
        current = {
          turn: e.payload.turn,
          startSeq: e.seq,
          endSeq: last,
          what: before ?? "",
          stepIndex,
          gate: false,
          eventId: e.id,
        };
        out.push(current);
        before = null;
        did = null;
        break;
      }
      case "directive.submitted":
        before = `${nameOf(e.actor)} steers`;
        break;
      case "plan.decided":
        before = e.payload.status === "approved" ? "plan approved" : "plan sent back";
        break;
      case "plan.rated":
        before = `${nameOf(e.actor)} rates the plan`;
        break;
      case "plan.proposed":
        planSteps = e.payload.steps.map((st) => st.title);
        stepIndex = null;
        did = "the plan";
        break;
      case "plan.step.started": {
        const i = planSteps.length ? planStepIndex(e.payload.stepId) : -1;
        stepIndex = i >= 0 ? i : stepIndex;
        break;
      }
      case "approval.requested": {
        const rule = policy ? ruleFor(policy, e.payload.call.risk) : null;
        if (current && rule && isRatingsRule(rule)) {
          current.gate = true;
          did = "release gate";
        } else if (!did) did = "asks for approval";
        break;
      }
      case "agent.tool.completed":
        if (!did && e.payload.result.ok === false) did = "a step failed";
        break;
      case "agent.turn.ended":
        if (current && !current.what) {
          current.what =
            did ??
            (e.payload.reason === "done"
              ? firstWords(e.payload.summary)
              : e.payload.reason === "blocked"
                ? "held"
                : e.payload.reason);
        }
        break;
      default:
        break;
    }
  }
  if (current && !current.what) current.what = did ?? "now";
  return out;
}

/** Step ids the scripted and model runners use are `s1`, `s2`…; anything else counts from the plan's order. */
function planStepIndex(stepId: string): number {
  const m = /^s(\d+)$/.exec(stepId);
  return m ? Number(m[1]) - 1 : -1;
}

/** "Done: plan, module, tests complete." → "plan, module, tests complete" (a few words, no prefix). */
function firstWords(summary: string): string {
  const s = summary
    .replace(/^(DONE|continuing|done):?\s*/i, "")
    .replace(/\.$/, "")
    .trim();
  const words = s.split(/\s+/).slice(0, 5).join(" ");
  return words.length < s.length ? `${words}…` : words;
}

/** The session as it was once `seq` had been folded: the events up to it and their state. */
export function foldUpTo(
  events: readonly SessionEvent[],
  seq: number,
): { events: SessionEvent[]; state: SessionState } {
  const upTo = events.filter((e) => e.seq <= seq);
  return { events: upTo, state: fold(upTo) };
}

/** Which mark a viewed seq falls in; the newest when `seq` is null (now). */
export function markIndexOf(marks: readonly TurnMark[], seq: number | null): number {
  if (seq === null) return marks.length - 1;
  const i = marks.findIndex((m) => seq <= m.endSeq);
  return i === -1 ? marks.length - 1 : i;
}

export function viewingLabel(index: number, total: number): string {
  return `Viewing turn ${index + 1} of ${total}`;
}

/** Where each plan step's span sits on the track: from its first turn to its last, as mark indices. */
export function stepSpans(
  marks: readonly TurnMark[],
  titles: readonly string[],
): { index: number; title: string; from: number; to: number }[] {
  const out: { index: number; title: string; from: number; to: number }[] = [];
  marks.forEach((m, i) => {
    if (m.stepIndex === null) return;
    const span = out.find((s) => s.index === m.stepIndex);
    if (span) span.to = i;
    else out.push({ index: m.stepIndex, title: titles[m.stepIndex] ?? "", from: i, to: i });
  });
  return out;
}
