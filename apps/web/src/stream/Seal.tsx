/**
 * The seal (design/henosis/explorations/sig-paper-and-lacquer): the mark in one ink beside one
 * word and when it landed, pressed at −4° on a decision the circle made. One word set: United (a
 * unite that landed clean), Approved and Denied (an approval or a release gate decided), Returned
 * (a handoff that went back). It marks an outcome, never an author, and only on the line in the
 * stream.
 *
 * One per screen: every seal on the page registers here with its place in the log, and only the
 * latest one draws itself; an older decision in the same viewport keeps its sentence.
 */
import { useEffect, useSyncExternalStore } from "react";
import { copy } from "../copy.js";
import { Mark } from "../ui.js";

export type SealWord = "united" | "approved" | "denied" | "returned";

const landings = new Map<string, number>();

/**
 * When a decision landed on this client: remembered the first time its sealed line is drawn, and
 * only when the thing it decides arrived live (`live`); history has no time of day and gets null.
 */
export function landedAt(id: string, live: boolean, now: number = Date.now()): number | null {
  const known = landings.get(id);
  if (known !== undefined) return known;
  if (!live) return null;
  landings.set(id, now);
  return now;
}

const mounted = new Map<string, number>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The seal that draws: the one latest in the log among those on the page. */
function latest(): string | null {
  let best: string | null = null;
  let at = Number.NEGATIVE_INFINITY;
  for (const [id, rank] of mounted) {
    if (rank >= at) {
      best = id;
      at = rank;
    }
  }
  return best;
}

export function Seal({
  id,
  rank,
  word,
  when,
  fresh = false,
}: {
  /** The event or approval this seals. */
  id: string;
  /** Its place in the log: of the seals on the page, the highest rank draws. */
  rank: number;
  word: SealWord;
  /** The time it reached this client, or its turn when it is history. */
  when: string;
  /** The decision just landed: the seal presses in once. */
  fresh?: boolean;
}) {
  const shown = useSyncExternalStore(
    subscribe,
    () => latest() === id,
    () => false,
  );
  useEffect(() => {
    mounted.set(id, rank);
    emit();
    return () => {
      mounted.delete(id);
      emit();
    };
  }, [id, rank]);
  if (!shown) return null;
  const label = copy.stream.seal[word];
  return (
    <span
      className={`seal ${word}${fresh ? " fresh" : ""}`}
      role="img"
      aria-label={copy.stream.sealLabel(label, when)}
    >
      <Mark size={18} cut="mono" />
      <span aria-hidden="true">{label}</span>
      <span className="when" aria-hidden="true">
        {when}
      </span>
    </span>
  );
}
