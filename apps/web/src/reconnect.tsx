/**
 * reconnect-resume: what the session and project websocket clients share when a socket drops.
 * Exponential backoff with jitter, an immediate retry when the browser says it is back online
 * or the tab is shown again, and the one quiet line the views show while it happens.
 */

import { useEffect, useState } from "react";
import { copy, status as statusWords } from "./copy.js";
import { Loader, Mark } from "./ui.js";

export const RECONNECT_BASE_MS = 500;
export const RECONNECT_MAX_MS = 15_000;

/** ±25% jitter on a delay so a fleet of tabs does not thunder. */
export function jittered(ms: number): number {
  return Math.round(ms * (0.75 + Math.random() * 0.5));
}

/** 0.5s, 1s, 2s, 4s … capped at 15s, with ±25% jitter so a fleet of tabs does not thunder. */
export function reconnectDelay(attempt: number): number {
  return jittered(Math.min(RECONNECT_BASE_MS * 2 ** Math.max(0, attempt), RECONNECT_MAX_MS));
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
  /** The delay the server asked for before the next dial, from the snapshot's `reconnect.delayMs`. */
  private hinted: number | null = null;
  constructor(private readonly dial: () => void) {}

  /**
   * The snapshot's `reconnect.delayMs`: one backoff policy for a fleet of tabs. It sets the first
   * dial after this socket drops; the dials after that back off from the client's own ladder.
   */
  hint(delayMs: number): void {
    this.hinted = Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : null;
  }

  /** Schedule the next dial; returns the delay chosen. */
  schedule(): number {
    this.cancel();
    const delay = this.hinted !== null ? jittered(this.hinted) : reconnectDelay(this.attempt);
    this.hinted = null;
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

// ---- what this browser last saw ------------------------------------------------------------

/**
 * The little this browser keeps of a session for the server-down page: when it last saw it,
 * the status word and the turn. Only the time and the state, never the stream (a shared
 * machine should not be left holding the words), so "What it last saw" can say "14:02 ·
 * Running, turn 3" and no more.
 */
export interface LastSeen {
  at: number;
  status: string;
  turn: number;
}

export const lastSeenKey = (projectId: string, sessionId: string) =>
  `henosis.lastseen.${projectId}/${sessionId}`;

export function rememberLastSeen(projectId: string, sessionId: string, seen: LastSeen): void {
  try {
    localStorage.setItem(lastSeenKey(projectId, sessionId), JSON.stringify(seen));
  } catch {
    // private mode or quota: the page says only that it has not seen the session
  }
}

export function readLastSeen(projectId: string, sessionId: string): LastSeen | null {
  try {
    const raw = localStorage.getItem(lastSeenKey(projectId, sessionId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<LastSeen>;
    if (typeof v.at !== "number" || typeof v.status !== "string" || typeof v.turn !== "number")
      return null;
    return { at: v.at, status: v.status, turn: v.turn };
  } catch {
    return null;
  }
}

/** The host a websocket URL points at ("henosis.payments.internal"), for the server-down line. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Server down takes the page (error-states): the apart mark with its ghost centre, what
 * happened, what still works, what Henosis is doing (the next dial), "What it last saw" with a
 * time, and Retry as the one action; the CLI line underneath. Only this state takes the mark's
 * centre away; a dropped socket keeps the full ring.
 */
export function ServerGone({
  online,
  host,
  retry,
  lastSeen,
  sessionId,
  onRetry,
}: {
  /** The browser's own word: online but the server is not answering, or offline. */
  online: boolean;
  host: string;
  retry?: Retry | null | undefined;
  lastSeen: LastSeen | null;
  sessionId: string;
  onRetry: () => void;
}) {
  const inSeconds = useCountdown(retry?.at ?? null);
  const when = clockOf(lastSeen?.at);
  return (
    <section className="server-gone" aria-label={copy.bad.serverGone}>
      <Mark size={72} state="apart" ghost />
      <h2 className="serif">{online ? copy.bad.serverGone : copy.bad.youAreOffline}</h2>
      <p className="muted">
        {online ? copy.bad.serverLine(host) : copy.bad.offlineLine}
        {inSeconds !== null ? ` ${copy.bad.again(inSeconds)}` : ""}
      </p>
      <div className="last">
        <span className="k">{when ? copy.bad.lastSaw(when) : copy.bad.nothingSeen}</span>
        {lastSeen && when && (
          <span>
            {copy.bad.lastSawLine(
              statusWords[lastSeen.status as keyof typeof statusWords] ?? lastSeen.status,
              lastSeen.turn,
            )}
          </span>
        )}
      </div>
      <div className="actions">
        <button type="button" className="btn primary" onClick={onRetry}>
          {copy.bad.retry}
        </button>
      </div>
      <span className="cli mono small faint">{copy.bad.cli(sessionId)}</span>
    </section>
  );
}

/** "as of 14:02" beside something stale: the presence stack while the socket is down. */
export function AsOf({ ts }: { ts: number | null | undefined }) {
  const when = clockOf(ts);
  if (!when) return null;
  return <span className="asof small faint">{copy.bad.asOf(when)}</span>;
}
