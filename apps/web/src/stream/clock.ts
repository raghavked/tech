/**
 * The log carries a logical clock, not the time of day. What the client can know is when an
 * event reached it: a live event's arrival is remembered here so the stream can print a time
 * beside a person's message, the scrubber can label a turn, and a row that just arrived can
 * play its entrance once. History has no arrival and prints its turn instead.
 */

const arrivals = new Map<string, number>();

/** How long after arrival a row still counts as new, and plays its entrance. */
export const FRESH_MS = 4_000;

export function rememberArrival(eventId: string, at: number = Date.now()): void {
  if (!arrivals.has(eventId)) arrivals.set(eventId, at);
}

/** When the event reached this client, or null for history. */
export function arrivalOf(eventId: string): number | null {
  return arrivals.get(eventId) ?? null;
}

/** True while the event's arrival is within `FRESH_MS` of now. */
export function isFresh(eventId: string, now: number = Date.now()): boolean {
  const at = arrivals.get(eventId);
  return at !== undefined && now - at < FRESH_MS;
}

/** "09:14" in the viewer's locale, or null when there is no arrival to show. */
export function timeOf(eventId: string): string | null {
  const at = arrivals.get(eventId);
  return at === undefined ? null : clockText(at);
}

export function clockText(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Tests and fixtures: forget every arrival. */
export function resetClock(): void {
  arrivals.clear();
}
