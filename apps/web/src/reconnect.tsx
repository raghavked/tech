/**
 * reconnect-resume: what the session and project websocket clients share when a socket drops.
 * Exponential backoff with jitter, an immediate retry when the browser says it is back online
 * or the tab is shown again, and the one quiet line the views show while it happens.
 */

import { copy } from "./copy.js";

export const RECONNECT_BASE_MS = 500;
export const RECONNECT_MAX_MS = 15_000;

/** 0.5s, 1s, 2s, 4s … capped at 15s, with ±25% jitter so a fleet of tabs does not thunder. */
export function reconnectDelay(attempt: number): number {
  const base = Math.min(RECONNECT_BASE_MS * 2 ** Math.max(0, attempt), RECONNECT_MAX_MS);
  return Math.round(base * (0.75 + Math.random() * 0.5));
}

/** Call `fn` when the browser comes back online or the tab becomes visible; returns a disposer. */
function onWake(fn: () => void): () => void {
  const vis = () => {
    if (document.visibilityState === "visible") fn();
  };
  addEventListener("online", fn);
  document.addEventListener("visibilitychange", vis);
  return () => {
    removeEventListener("online", fn);
    document.removeEventListener("visibilitychange", vis);
  };
}

/** Schedules one dial at a time with backoff; a wake event dials at once instead of waiting. */
export class Reconnector {
  attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private wake: (() => void) | null = null;
  constructor(private readonly dial: () => void) {}

  /** Schedule the next dial; returns the delay chosen. */
  schedule(): number {
    this.cancel();
    const delay = reconnectDelay(this.attempt);
    this.attempt += 1;
    this.timer = setTimeout(() => this.fire(), delay);
    this.wake = onWake(() => this.fire());
    return delay;
  }

  /** A dial succeeded: start the backoff over. */
  reset(): void {
    this.attempt = 0;
    this.cancel();
  }

  cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.wake?.();
    this.wake = null;
  }

  private fire(): void {
    this.cancel();
    this.dial();
  }
}

/** The grey line under the top row while a dropped socket is being re-dialled. */
export function ReconnectLine({ reconnecting }: { reconnecting: boolean }) {
  if (!reconnecting) return null;
  return (
    <div className="conn" role="status" aria-live="polite">
      <span className="status">{copy.session.reconnecting}</span>
    </div>
  );
}
