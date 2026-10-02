/**
 * Branch comparison: what a person sees before folding one branch into another.
 *
 * Pure over a Session's log and blob store: the files whose content differs between two
 * branches with line counts, and the last few turns on each side. The merge itself stays in
 * `Session.merge`; this only describes the two heads.
 */
import type { Session } from "./session.js";
import type { SessionState, TurnRecord } from "./state.js";
import { lineDelta } from "./workspace.js";

export interface FileDelta {
  path: string;
  /** Whether the path exists on each side; both true means the content differs. */
  inA: boolean;
  inB: boolean;
  /** Lines added and removed going from `a` to `b`. */
  plus: number;
  minus: number;
}

export interface TurnGlimpse {
  turn: number;
  summary: string;
  /** The model's text, trimmed to a line. */
  text: string;
  toolCalls: number;
  reason: string | null;
}

export interface BranchCompare {
  a: string;
  b: string;
  files: FileDelta[];
  turns: { a: TurnGlimpse[]; b: TurnGlimpse[] };
  /** Paths on `a` still carrying conflict markers from an earlier fold. */
  conflicts: string[];
}

export const COMPARE_TURNS = 3;

export function glimpse(t: TurnRecord): TurnGlimpse {
  const text = (t.summary || t.modelText).replace(/\s+/g, " ").trim();
  return {
    turn: t.turn,
    summary: t.summary.replace(/^(DONE|continuing):?\s*/i, "").trim(),
    text: text.length > 160 ? `${text.slice(0, 157)}…` : text,
    toolCalls: t.toolCalls.length,
    reason: t.reason,
  };
}

export function lastTurns(state: SessionState, n = COMPARE_TURNS): TurnGlimpse[] {
  const out = state.turns.slice(-n).map(glimpse);
  if (state.currentTurn) out.push({ ...glimpse(state.currentTurn), reason: "in progress" });
  return out.slice(-n);
}

/** Files whose content differs between two branches, with line counts from `a` to `b`. */
export function compareBranches(session: Session, a: string, b: string): BranchCompare {
  const sa = session.state(a);
  const sb = session.state(b);
  const paths = new Set([...Object.keys(sa.workspace), ...Object.keys(sb.workspace)]);
  const files: FileDelta[] = [];
  for (const path of [...paths].sort()) {
    const ha = sa.workspace[path];
    const hb = sb.workspace[path];
    if (ha === hb) continue;
    const read = (h: string | undefined) =>
      h === undefined ? null : (session.store.get(h) ?? null);
    const { plus, minus } = lineDelta(read(ha), read(hb));
    files.push({ path, inA: ha !== undefined, inB: hb !== undefined, plus, minus });
  }
  return {
    a,
    b,
    files,
    turns: { a: lastTurns(sa), b: lastTurns(sb) },
    conflicts: [...sa.openConflicts],
  };
}
