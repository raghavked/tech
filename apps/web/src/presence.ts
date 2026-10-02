/**
 * Presence while composing: who is writing a directive right now, and how many are watching.
 *
 * The wire already carries a free-form presence status per client; this module gives the
 * web app one vocabulary for it ("composing", "composing:team"), a debounced sender for the
 * composer, and the quiet lines the session page shows above the composer and in the avatar
 * stack tooltip. Pure helpers first; the hook at the end.
 */
import type { PresenceEntry } from "@fold/protocol";
import { useCallback, useEffect, useRef } from "react";

/**
 * Well-known presence status: this human is typing a directive. Sent debounced while the
 * composer is in use, "" on send, blur or idle; a client that drops off loses it with its
 * connection. The server relays any string, so the CLI prints it as-is.
 */
export const PRESENCE_COMPOSING = "composing";
/** Status sent while writing to the people in the session rather than to the agent. */
export const PRESENCE_COMPOSING_TEAM = `${PRESENCE_COMPOSING}:team`;

export function isComposing(status: string): boolean {
  return status === PRESENCE_COMPOSING || status === PRESENCE_COMPOSING_TEAM;
}

/** Everyone else who is online and writing, in presence order. */
export function othersComposing(presence: PresenceEntry[], meId: string): PresenceEntry[] {
  return presence.filter((p) => p.online && p.actor.id !== meId && isComposing(p.status));
}

/** "Bo is writing a directive", "Bo and Dee are writing", or null when nobody else is. */
export function composingLine(presence: PresenceEntry[], meId: string): string | null {
  const who = othersComposing(presence, meId);
  const first = who[0];
  if (!first) return null;
  if (who.length === 1) {
    const to = first.status === PRESENCE_COMPOSING_TEAM ? "to the team" : "a directive";
    return `${first.actor.name} is writing ${to}`;
  }
  const names = who.map((p) => p.actor.name);
  if (who.length === 2) return `${names[0]} and ${names[1]} are writing`;
  const rest = who.length - 2;
  return `${names[0]}, ${names[1]} and ${rest} other${rest === 1 ? "" : "s"} are writing`;
}

/** Online people with the observer role: watching, not steering. */
export function observerCount(presence: PresenceEntry[]): number {
  return presence.filter((p) => p.online && p.role === "observer").length;
}

/** The avatar stack tooltip: "Ana (driving), Bo, Cy · 3 here · 1 observer". */
export function presenceSummary(presence: PresenceEntry[], driverId: string | null): string {
  const online = presence.filter((p) => p.online);
  const names = online.map((p) => {
    const marks = [
      p.actor.id === driverId ? "driving" : "",
      isComposing(p.status) ? "writing" : "",
    ].filter(Boolean);
    return marks.length ? `${p.actor.name} (${marks.join(", ")})` : p.actor.name;
  });
  const observers = observerCount(presence);
  const watching =
    observers === 0 ? "no observers" : `${observers} observer${observers === 1 ? "" : "s"}`;
  return `${names.join(", ")} · ${online.length} here · ${watching}`;
}

/** How long after the last keystroke the status clears on its own, if send or blur never come. */
export const COMPOSING_IDLE_MS = 4_000;

/**
 * Debounced composing presence for one composer. `typing(status)` sends the status once when
 * it changes and arms an idle timer; `clear()` sends "" if anything was sent. Call `typing`
 * from the textarea's change handler, `clear` on send, blur, empty text and unmount.
 */
export function useComposing(
  send: (status: string) => void,
  idleMs: number = COMPOSING_IDLE_MS,
): { typing: (status?: string) => void; clear: () => void } {
  const st = useRef<{ status: string | null; timer: ReturnType<typeof setTimeout> | null }>({
    status: null,
    timer: null,
  });
  const clear = useCallback(() => {
    const s = st.current;
    if (s.timer) clearTimeout(s.timer);
    s.timer = null;
    if (s.status !== null) {
      s.status = null;
      send("");
    }
  }, [send]);
  const typing = useCallback(
    (status: string = PRESENCE_COMPOSING) => {
      const s = st.current;
      if (s.status !== status) {
        s.status = status;
        send(status);
      }
      if (s.timer) clearTimeout(s.timer);
      s.timer = setTimeout(() => {
        s.timer = null;
        s.status = null;
        send("");
      }, idleMs);
    },
    [send, idleMs],
  );
  useEffect(() => clear, [clear]);
  return { typing, clear };
}
