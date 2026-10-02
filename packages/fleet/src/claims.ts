/**
 * Claims: leases on shared ground. Conflict detection is a function of the *set* of active
 * claims, never of their arrival order, which is what lets every replica agree.
 */
import { shortId } from "@fold/kernel";
import { type ClaimMode, normalizePattern, type Resource, resourceKey } from "./events.js";

export interface ClaimRecord {
  id: string;
  sessionId: string;
  ownerId: string;
  resource: Resource;
  mode: ClaimMode;
  reason: string;
  requestedSeq: number;
  status: "pending" | "active" | "denied" | "released" | "expired";
  /** Turn counter of the holder when last touched; used for TTL expiry by the host. */
  lastTouchedTurn: number;
}

/** Two path resources overlap when one is a prefix of the other (directory containment) or equal. */
export function resourcesOverlap(a: Resource, b: Resource): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "path" && b.type === "path") {
    const x = normalizePattern(a.pattern);
    const y = normalizePattern(b.pattern);
    return (
      x === y ||
      x.startsWith(y.endsWith("/") ? y : `${y}/`) ||
      y.startsWith(x.endsWith("/") ? x : `${x}/`)
    );
  }
  return resourceKey(a) === resourceKey(b);
}

export function pathCovered(path: string, resource: Resource): boolean {
  return resource.type === "path" && resourcesOverlap({ type: "path", pattern: path }, resource);
}

/** Active claims of other sessions that conflict with `candidate` (exclusive vs anything, shared vs exclusive). */
export function conflictingClaims(
  candidate: { sessionId: string; resource: Resource; mode: ClaimMode },
  active: readonly ClaimRecord[],
): ClaimRecord[] {
  return active
    .filter((c) => c.status === "active" && c.sessionId !== candidate.sessionId)
    .filter((c) => resourcesOverlap(c.resource, candidate.resource))
    .filter((c) => c.mode === "exclusive" || candidate.mode === "exclusive")
    .sort((a, b) => a.requestedSeq - b.requestedSeq);
}

/** Who holds `path` against `sessionId`, if anyone. */
export function holderOf(
  path: string,
  sessionId: string,
  active: readonly ClaimRecord[],
): ClaimRecord | null {
  const hits = active
    .filter((c) => c.status === "active" && c.sessionId !== sessionId && c.mode === "exclusive")
    .filter((c) => pathCovered(path, c.resource))
    .sort((a, b) => a.requestedSeq - b.requestedSeq);
  return hits[0] ?? null;
}

export function claimConflictId(resource: Resource, sessionIds: string[]): string {
  return shortId("fct", "claim", resourceKey(resource), [...sessionIds].sort());
}
