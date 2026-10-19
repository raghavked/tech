/**
 * reconnect-resume: what the session and project websocket clients share when a socket drops.
 * Exponential backoff with jitter, an immediate retry when the browser says it is back online
 * or the tab is shown again, and the one quiet line the views show while it happens.
 */

import { useEffect, useState } from "react";
import { copy } from "./copy.js";
import { Loader } from "./ui.js";

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

/** What a client reports about the re-dial it has scheduled: which attempt, and when it fires. */
export interface Retry {
  attempt: number;
  at: number;
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

  /** The retry just scheduled, for the snapshot: attempt number and the time it fires. */
  pending(delay: number): Retry {
    return { attempt: this.attempt, at: Date.now() + delay };
  }

  /** A dial succeeded: start the backoff over. */
  reset(): void {
    this.attempt = 0;
    this.cancel();
  }

  /** "Try now": dial at once instead of waiting out the backoff. */
  now(): void {
    this.fire();
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

/** "14:02": the clock time of a timestamp, for "the stream is as of 14:02". */
export function clockOf(ts: number | null | undefined): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Whole seconds until `at`, re-read every second while the line shows. */
function useCountdown(at: number | null | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!at) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [at]);
  return at ? Math.max(0, Math.round((at - now) / 1000)) : null;
}

/**
 * The one quiet line under the top row while a dropped socket is being re-dialled (error-states):
 * the mark's halo pulse, then "Reconnecting · attempt 3 · again in 4s · the stream is as of 14:02 ·
 * Try now". Every part but the first is optional; a view passes what its client knows.
 */
export function ReconnectLine({
  reconnecting,
  retry,
  asOf,
  onTryNow,
}: {
  reconnecting: boolean;
  retry?: Retry | null | undefined;
  /** The timestamp of the last event the view holds. */
  asOf?: number | null | undefined;
  onTryNow?: (() => void) | undefined;
}) {
  const inSeconds = useCountdown(reconnecting ? retry?.at : null);
  if (!reconnecting) return null;
  const line = copy.wait.reconnectLine(retry?.attempt ?? null, inSeconds, clockOf(asOf));
  return (
    <div className="conn">
      <Loader kind="halo" label={line} after8s={copy.wait.offlineCause} />
      {onTryNow && (
        <button type="button" className="btn ghost sm" onClick={onTryNow}>
          {copy.wait.tryNow}
        </button>
      )}
    </div>
  );
}
