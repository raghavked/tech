/**
 * Branch merge planning: workspace three-way merge plus directive carry-over.
 *
 * The base is the tree at the source branch's fork checkpoint. Directives active on the source
 * are carried into the target as merged directives; the arbiter then treats them as concurrent
 * with whatever the target holds in the same scope, so a scope both branches steered differently
 * becomes a contention instead of a silent override. Constraints are unioned by text.
 */
import type { DirectiveInput } from "@fold/protocol";
import { shortId } from "./hash.js";
import type { SessionLog } from "./log.js";
import { fold, type SessionState } from "./state.js";
import { type BlobStore, mergeTrees, type Tree, type TreeMerge } from "./workspace.js";

export interface MergePlan {
  source: string;
  target: string;
  base: string;
  merge: TreeMerge;
  carried: { id: string; author: string; rank: number; input: DirectiveInput }[];
}

export function planMerge(
  log: SessionLog,
  source: string,
  target: string,
  store: BlobStore,
): MergePlan {
  const meta = log.branchMeta(source);
  if (!meta) throw new Error(`unknown branch ${source}`);
  if (!meta.forkPoint) throw new Error(`branch ${source} has no fork point`);
  const baseState = fold(log.eventsUpTo(target, meta.forkPoint));
  const ours = fold(log.eventsOf(target));
  const theirs = fold(log.eventsOf(source));
  const base: Tree = baseState.workspace;
  const merge = mergeTrees(base, ours.workspace, theirs.workspace, store);
  const carried = carryDirectives(ours, theirs, baseState);
  const cp = baseState.checkpoints.find((c) => c.eventId === meta.forkPoint);
  return { source, target, base: cp?.id ?? meta.forkPoint, merge, carried };
}

function carryDirectives(ours: SessionState, theirs: SessionState, base: SessionState) {
  const out: MergePlan["carried"] = [];
  const baseIds = new Set(Object.keys(base.directives));
  const ourTexts = new Set(
    Object.values(ours.directives)
      .filter((d) => d.status === "active")
      .map((d) => `${d.input.mode}|${d.input.scope}|${d.input.text}`),
  );
  for (const d of Object.values(theirs.directives)) {
    if (baseIds.has(d.id)) continue; // existed before the fork; the target already has it
    if (d.status !== "active" && d.status !== "contended") continue;
    if (d.input.mode !== "steer" && d.input.mode !== "constrain") continue;
    const key = `${d.input.mode}|${d.input.scope}|${d.input.text}`;
    if (ourTexts.has(key)) continue;
    const id = shortId("dir", "merge", theirs.branch, d.id);
    out.push({ id, author: d.author, rank: d.rank, input: { ...d.input, supersedes: [] } });
  }
  return out;
}
