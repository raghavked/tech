/**
 * Replay and determinism checks. Because tool and model outputs are recorded in the log,
 * folding the log reconstructs the state without re-running anything.
 */
import type { SessionEvent } from "@tiller/protocol";
import { hashValue } from "./hash.js";
import type { SessionLog } from "./log.js";
import { fold, type SessionState } from "./state.js";

export function stateHash(state: SessionState): string {
  return hashValue(state);
}

export function replayBranch(log: SessionLog, branch: string): SessionState {
  return fold(log.eventsOf(branch));
}

/**
 * Restore from a serialized state snapshot taken at `snapshot.seq` plus the tail of the log.
 * Equivalent to a full replay; used to resume a long session quickly.
 */
export function resumeFrom(snapshot: SessionState, events: readonly SessionEvent[]): SessionState {
  const tail = events.filter((e) => e.seq > snapshot.seq);
  return fold(tail, snapshot);
}

export interface ReplayCheck {
  ok: boolean;
  branch: string;
  fullHash: string;
  resumedHash: string;
  chain: ReturnType<SessionLog["verify"]>;
}

/** Verify the hash chain and that resume-from-midpoint equals full replay. */
export function checkReplay(log: SessionLog, branch: string): ReplayCheck {
  const chain = log.verify();
  const events = log.eventsOf(branch);
  const full = fold(events);
  const mid = Math.floor(events.length / 2);
  const snapshot = fold(events.slice(0, mid));
  const resumed = resumeFrom(snapshot, events);
  const fullHash = stateHash(full);
  const resumedHash = stateHash(resumed);
  return { ok: chain.ok && fullHash === resumedHash, branch, fullHash, resumedHash, chain };
}
