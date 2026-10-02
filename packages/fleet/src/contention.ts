/**
 * Cross-session contention detection from session states: two open sessions touching the
 * same path without a claim, or a merge that left conflicts on a path another session holds.
 */
import type { SessionState } from "@fold/kernel";
import { pathCovered } from "./claims.js";
import type { FleetContentionKind } from "./events.js";
import { activeClaims, type ProjectState } from "./state.js";

export interface DetectedContention {
  kind: FleetContentionKind;
  sessionIds: string[];
  resource: string;
  detail: string;
}

export function activePathsOf(s: SessionState): string[] {
  const paths = new Set<string>();
  const recent = [...s.turns.slice(-3), ...(s.currentTurn ? [s.currentTurn] : [])];
  for (const t of recent)
    for (const c of t.toolCalls)
      if (typeof c.args.path === "string" && c.name.startsWith("workspace."))
        paths.add(c.args.path);
  return [...paths].sort();
}

export function detectFleetContentions(
  project: ProjectState,
  sessions: Record<string, SessionState>,
): DetectedContention[] {
  const out: DetectedContention[] = [];
  const ids = Object.keys(sessions)
    .filter((id) => project.sessions[id]?.open)
    .sort();
  const claims = activeClaims(project);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i] as string;
      const b = ids[j] as string;
      const pa = activePathsOf(sessions[a] as SessionState);
      const pb = new Set(activePathsOf(sessions[b] as SessionState));
      for (const p of pa) {
        if (!pb.has(p)) continue;
        const claimed = claims.some(
          (c) => pathCovered(p, c.resource) && (c.sessionId === a || c.sessionId === b),
        );
        if (!claimed)
          out.push({
            kind: "path-overlap",
            sessionIds: [a, b],
            resource: `path:${p}`,
            detail: `both sessions wrote ${p} without a claim`,
          });
      }
    }
  }
  for (const id of ids) {
    const st = sessions[id] as SessionState;
    for (const path of st.openConflicts) {
      const holder = claims.find((c) => c.sessionId !== id && pathCovered(path, c.resource));
      if (holder)
        out.push({
          kind: "merge-conflict",
          sessionIds: [id, holder.sessionId],
          resource: `path:${path}`,
          detail: `merge left conflict markers in ${path}, held by ${holder.ownerId}'s session`,
        });
    }
  }
  return out;
}
