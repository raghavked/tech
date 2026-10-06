/**
 * Intent arbitration: turning many concurrent human directives into one unambiguous intent.
 *
 * Model. A session's intent is a lattice-shaped value:
 *   - constraints: a grow-only set (constraints never conflict; they stack),
 *   - a register per scope ("goal", "api", "tests", ...) holding the winning steer,
 *   - a control state (running / paused / cancelled).
 *
 * Two steers on the same scope are *concurrent* when the agent has not acted between them
 * (same epoch; an epoch is the interval between agent turn starts) or when one of them arrived
 * through a merge. The rules, applied per scope:
 *   1. Same author: their latest directive supersedes their earlier one.
 *   2. Different authority rank: the higher rank wins; the lower directive is *shadowed*
 *      (recorded and visible, not applied) whether earlier or later.
 *   3. Same rank, not concurrent (the agent acted in between): the later one is a redirect
 *      and supersedes the earlier one.
 *   4. Same rank, concurrent: a *contention*. Under policy "block" the scope is frozen until a
 *      driver or owner resolves it (or an author withdraws); "latest-wins" picks the latest;
 *      "driver-wins" picks the one whose author holds the driver token, else blocks.
 *
 * Within an epoch the result does not depend on arrival order of directives from different
 * authors (see test/intent.test.ts), which is what makes the composed intent safe to compute on
 * every replica without coordination.
 */
import type {
  ContentionPolicy,
  DirectiveInput,
  DirectiveOrigin,
  DirectiveStatus,
  Role,
} from "@henosis/protocol";
import { GOAL_SCOPE, ROLE_RANK } from "@henosis/protocol";
import { shortId } from "./hash.js";

export interface DirectiveRecord {
  id: string;
  author: string;
  input: DirectiveInput;
  /** Authority rank of the author at submission time. */
  rank: number;
  /** Epoch at submission: number of agent turns started before it. */
  epoch: number;
  seq: number;
  /** Carried in by a merge: concurrent with everything in its scope. */
  merged: boolean;
  /** "project" when applied by a lead through the fleet layer. */
  origin: DirectiveOrigin;
  status: DirectiveStatus;
  contentionId: string | null;
}

export interface Contention {
  id: string;
  scope: string;
  directiveIds: string[];
  resolved: boolean;
}

export interface SteerRegister {
  directiveId: string;
  author: string;
  text: string;
  seq: number;
  origin: DirectiveOrigin;
}

export type ControlState = "running" | "paused" | "cancelled";

export interface Intent {
  goal: SteerRegister | null;
  steers: Record<string, SteerRegister>;
  constraints: { directiveId: string; author: string; text: string; origin: DirectiveOrigin }[];
  control: ControlState;
  /** True when a not-yet-consumed interrupting steer exists. */
  interrupt: boolean;
  /** Scopes frozen by an open contention. */
  contendedScopes: string[];
}

export interface ArbitrationResult {
  intent: Intent;
  /** New status per directive id (only directives whose status is derived by arbitration). */
  statuses: Record<string, DirectiveStatus>;
  contentions: Contention[];
}

export interface Arbiter {
  rankOf(actorId: string): number;
  driver: string | null;
  policy: ContentionPolicy;
  /** Epoch of the last consumed turn; directives with epoch < this have been acted upon. */
  epoch: number;
  /** Directive ids already consumed by an interrupting turn. */
  consumedInterrupts: ReadonlySet<string>;
}

const CONTROL_MIN_RANK: Record<"pause" | "resume" | "cancel", number> = {
  pause: ROLE_RANK.contributor,
  resume: ROLE_RANK.driver,
  cancel: ROLE_RANK.driver,
};

export function arbitrate(
  directives: readonly DirectiveRecord[],
  existing: readonly Contention[],
  ctx: Arbiter,
): ArbitrationResult {
  const statuses: Record<string, DirectiveStatus> = {};
  const live = directives.filter((d) => d.status !== "withdrawn" && d.status !== "superseded");
  const resolvedIds = new Set(existing.filter((c) => c.resolved).map((c) => c.id));

  // Constraints: grow-only.
  const constraints = live
    .filter((d) => d.input.mode === "constrain" && d.rank >= ROLE_RANK.contributor)
    .sort((a, b) => a.seq - b.seq)
    .map((d) => {
      statuses[d.id] = "active";
      return { directiveId: d.id, author: d.author, text: d.input.text, origin: d.origin };
    });

  // Control: last authorised control directive wins; steers revive a cancelled session.
  let control: ControlState = "running";
  for (const d of [...live].sort((a, b) => a.seq - b.seq)) {
    const mode = d.input.mode;
    if (mode === "pause" || mode === "resume" || mode === "cancel") {
      if (d.rank < CONTROL_MIN_RANK[mode]) {
        statuses[d.id] = "shadowed";
        continue;
      }
      statuses[d.id] = "active";
      control = mode === "pause" ? "paused" : mode === "resume" ? "running" : "cancelled";
    } else if (mode === "steer" && d.rank >= ROLE_RANK.contributor && control === "cancelled") {
      control = "running";
    }
  }

  // Steers: per-scope arbitration.
  const steers: Record<string, SteerRegister> = {};
  const contentions: Contention[] = existing.map((c) => ({
    ...c,
    directiveIds: [...c.directiveIds],
  }));
  const contendedScopes: string[] = [];
  const byScope = new Map<string, DirectiveRecord[]>();
  for (const d of live) {
    if (d.input.mode !== "steer") continue;
    if (d.rank < ROLE_RANK.contributor) {
      statuses[d.id] = "shadowed";
      continue;
    }
    const arr = byScope.get(d.input.scope) ?? [];
    arr.push(d);
    byScope.set(d.input.scope, arr);
  }

  for (const [scope, all] of byScope) {
    // Rule 1: same author -> latest only.
    const latestByAuthor = new Map<string, DirectiveRecord>();
    for (const d of [...all].sort((a, b) => a.seq - b.seq)) {
      const prev = latestByAuthor.get(d.author);
      if (prev) statuses[prev.id] = "superseded";
      latestByAuthor.set(d.author, d);
    }
    const candidates = [...latestByAuthor.values()];

    // Rule 2: highest rank wins; lower ranks are shadowed.
    const top = Math.max(...candidates.map((d) => d.rank));
    const topSet = candidates.filter((d) => d.rank === top);
    for (const d of candidates) if (d.rank < top) statuses[d.id] = "shadowed";

    // Rule 3 / 4 among the top-ranked.
    const winner = pickAmongPeers(topSet, ctx);
    if (winner.kind === "winner") {
      for (const d of topSet)
        statuses[d.id] = d.id === winner.directive.id ? "active" : "superseded";
      steers[scope] = toRegister(winner.directive);
      continue;
    }
    // Contention.
    const ids = winner.directives.map((d) => d.id).sort();
    const id = shortId("ctn", scope, ids);
    if (!resolvedIds.has(id)) {
      if (!contentions.some((c) => c.id === id)) {
        contentions.push({ id, scope, directiveIds: ids, resolved: false });
      }
      for (const d of winner.directives) statuses[d.id] = "contended";
      contendedScopes.push(scope);
    } else {
      // Resolved earlier but still concurrent: the resolution already superseded the losers,
      // so the remaining candidate wins. Guard anyway.
      const last = [...winner.directives].sort((a, b) => b.seq - a.seq)[0] as DirectiveRecord;
      statuses[last.id] = "active";
      steers[scope] = toRegister(last);
    }
  }

  const goal = steers[GOAL_SCOPE] ?? null;
  if (goal) delete steers[GOAL_SCOPE];

  const interrupt = live.some(
    (d) =>
      d.input.mode === "steer" &&
      d.input.interrupt &&
      statuses[d.id] === "active" &&
      !ctx.consumedInterrupts.has(d.id),
  );

  return {
    intent: {
      goal,
      steers,
      constraints,
      control,
      interrupt,
      contendedScopes: contendedScopes.sort(),
    },
    statuses,
    contentions,
  };
}

type PeerPick =
  | { kind: "winner"; directive: DirectiveRecord }
  | { kind: "contention"; directives: DirectiveRecord[] };

function pickAmongPeers(peers: DirectiveRecord[], ctx: Arbiter): PeerPick {
  if (peers.length === 1) return { kind: "winner", directive: peers[0] as DirectiveRecord };
  const bySeq = [...peers].sort((a, b) => a.seq - b.seq);
  const latest = bySeq[bySeq.length - 1] as DirectiveRecord;
  const concurrent = bySeq.filter((d) => d.merged || d.epoch === latest.epoch || latest.merged);
  if (concurrent.length <= 1) {
    // Rule 3: the agent acted between them; the latest is a redirect.
    return { kind: "winner", directive: latest };
  }
  // Rule 4: concurrent peers.
  switch (ctx.policy) {
    case "latest-wins":
      return { kind: "winner", directive: latest };
    case "driver-wins": {
      const d = concurrent.find((x) => x.author === ctx.driver);
      if (d) return { kind: "winner", directive: d };
      return { kind: "contention", directives: concurrent };
    }
    default:
      return { kind: "contention", directives: concurrent };
  }
}

function toRegister(d: DirectiveRecord): SteerRegister {
  return { directiveId: d.id, author: d.author, text: d.input.text, seq: d.seq, origin: d.origin };
}

/** Effective rank of a participant: their role, lifted to driver if they hold the token. */
export function effectiveRank(role: Role, isDriver: boolean): number {
  return Math.max(ROLE_RANK[role], isDriver ? ROLE_RANK.driver : 0);
}

/** Render the intent as the system-prompt fragment the runner hands to the model. */
export function renderIntent(intent: Intent): string {
  const lines: string[] = [];
  const tag = (o: DirectiveOrigin) => (o === "project" ? "[project] " : "");
  lines.push(
    `GOAL: ${intent.goal ? `${tag(intent.goal.origin)}${intent.goal.text}` : "(no goal set; ask the team)"}`,
  );
  const scopes = Object.keys(intent.steers).sort();
  if (scopes.length) {
    lines.push("DIRECTION BY SCOPE:");
    for (const s of scopes) {
      const r = intent.steers[s] as SteerRegister;
      lines.push(`  [${s}] ${tag(r.origin)}${r.text}`);
    }
  }
  if (intent.constraints.length) {
    lines.push("STANDING CONSTRAINTS (never violate):");
    for (const c of intent.constraints) lines.push(`  - ${tag(c.origin)}${c.text}`);
  }
  if (intent.contendedScopes.length) {
    lines.push(
      `UNDER DISCUSSION (do not act on these scopes until resolved): ${intent.contendedScopes.join(", ")}`,
    );
  }
  return lines.join("\n");
}
