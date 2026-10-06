/** Small shared pieces on top of tokens.css v3: the mark, line icons, avatars, status words. */
import type { Resource } from "@henosis/fleet";
import type { EntryRecord } from "@henosis/memory";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { copy, status as statusWords } from "./copy.js";
import { initials } from "./identity.js";
import { getToasts, subscribeToasts, toast } from "./toast.js";

/** `toast("Link copied")`: a short text at the bottom centre that goes away by itself. */
export { toast };

/**
 * The Henosis mark inline (design/mark.svg): a ring open at the top and the newcomer's bead
 * that completes it. `joining` plays the bead sliding into the gap (the loading motion).
 */
export function Mark({ size = 22, joining = false }: { size?: number; joining?: boolean }) {
  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      aria-hidden="true"
      className={`mark${joining ? " joining" : ""}`}
    >
      <circle cx="48" cy="48" r="46" fill="var(--mark-disc, #2A3244)" />
      <path
        d="M60.5 22.9 A28 28 0 1 1 35.5 22.9"
        stroke="var(--mark-ring, #E2C4A6)"
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
        className="ring"
      />
      <circle
        cx="48"
        cy="20"
        r="7.5"
        fill="var(--mark-bead, #56352D)"
        stroke="var(--mark-ring, #E2C4A6)"
        strokeWidth="2"
        className="bead"
      />
    </svg>
  );
}

/** Thin 1.5px line icons on a 16-grid; `d` is one path. */
export function Icon({
  d,
  size = 16,
  className = "",
}: {
  d: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={`ic ${className}`}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

export const ICONS = {
  menu: "M2.5 4.5h11M2.5 8h11M2.5 11.5h11",
  plus: "M8 3v10M3 8h10",
  search: "M7 12.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM11 11l3.5 3.5",
  send: "M8 13V3M4 7l4-4 4 4",
  close: "M4 4l8 8M12 4l-8 8",
  chevron: "M6 4l4 4-4 4",
  file: "M4 2h5l3 3v9H4zM9 2v3h3",
  pen: "M11 2.5l2.5 2.5L6 12.5H3.5V10z",
  terminal: "M3 4l4 4-4 4M8 12h5",
  memory: "M3 2.5h8a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2zM3 11.5h10",
  rocket: "M8 2c2 1 4 4 3 8H5c-1-4 1-7 3-8zM5 10l-2 3M11 10l2 3M8 7h.01",
  tool: "M10.5 2.5l3 3-2 2-3-3zM8.5 4.5L3 10v3h3l5.5-5.5",
  handoff: "M2 8h11M9 4l4 4-4 4",
  check: "M3 8.5l3 3 7-7",
  dots: "M3 8h.01M8 8h.01M13 8h.01",
  sun: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1",
  moon: "M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z",
  bell: "M4 11V7a4 4 0 0 1 8 0v4l1 2H3zM6.5 14h3",
  link: "M6.5 9.5l3-3M5 11l-1 1a2.5 2.5 0 0 1-3.5-3.5l2-2A2.5 2.5 0 0 1 6 6.5M11 5l1-1a2.5 2.5 0 0 1 3.5 3.5l-2 2A2.5 2.5 0 0 1 10 9.5",
  branch: "M4 3v10M4 3a1.5 1.5 0 1 0 0 0M12 4a1.5 1.5 0 1 0 0 0M12 5.5c0 3-8 2-8 5",
  clock: "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM8 5v3.5l2.5 1.5",
  down: "M8 3v10M4 9l4 4 4-4",
  inbox:
    "M2.5 9h3l1 2h3l1-2h3M2.5 9V4.5A1.5 1.5 0 0 1 4 3h8a1.5 1.5 0 0 1 1.5 1.5V9M2.5 9v3a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9",
  back: "M13 8H3M7 4L3 8l4 4",
  columns: "M2.5 3h11v10h-11zM8 3v10",
  play: "M5.5 3.5v9l7-4.5z",
};

export function Avatar({
  id,
  name,
  driver = false,
  agent = false,
  title,
}: {
  id: string;
  name: string;
  driver?: boolean;
  agent?: boolean;
  title?: string;
}) {
  return (
    <span className={`avatar${driver ? " driver" : ""}`} title={title ?? name} data-id={id}>
      {agent ? "A" : initials(name)}
    </span>
  );
}

/** Status as a word with a quiet dot: `.status.running`, `.status.awaiting`... Words live in copy.ts. */
export const STATUS: Record<string, { cls: string; label: string }> = {
  running: { cls: "running", label: statusWords.running },
  awaiting_approval: { cls: "awaiting", label: statusWords.awaiting_approval },
  blocked: { cls: "blocked", label: statusWords.blocked },
  paused: { cls: "paused", label: statusWords.paused },
  idle: { cls: "idle", label: statusWords.idle },
  cancelled: { cls: "idle", label: statusWords.cancelled },
  closed: { cls: "idle", label: statusWords.closed },
  offline: { cls: "idle", label: statusWords.offline },
};

export function Status({
  status,
  children,
}: {
  status: string | null | undefined;
  children?: ReactNode;
}) {
  const s = STATUS[status ?? "offline"] ?? { cls: "idle", label: statusWords.idle };
  return (
    <span className={`status ${s.cls}`}>
      {s.label}
      {children}
    </span>
  );
}

export function ErrorLine({ errors }: { errors: string[] }) {
  const last = errors[errors.length - 1];
  return last ? <p className="small danger">{last}</p> : null;
}

export function fmtResource(r: Resource): string {
  switch (r.type) {
    case "path":
      return r.pattern;
    case "service":
      return `svc:${r.name}`;
    case "ticket":
      return `ticket:${r.key}`;
  }
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => {
    try {
      return matchMedia(query).matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      const mq = matchMedia(query);
      const on = () => setMatch(mq.matches);
      on();
      mq.addEventListener("change", on);
      return () => mq.removeEventListener("change", on);
    } catch {
      return undefined;
    }
  }, [query]);
  return match;
}

export function shortSha(sha: string | undefined): string | null {
  return sha ? sha.slice(0, 7) : null;
}

export function attribLine(e: EntryRecord): string {
  const a = e.attribution;
  const parts = [a.userName ?? a.userId];
  if (a.sessionId) parts.push(a.sessionId);
  const sha = shortSha(a.commitSha);
  if (sha) parts.push(sha);
  return parts.join(" · ");
}

/** One remembered line: content, then who added it, quietly. */
export function MemoryLine({ e, conflict = false }: { e: EntryRecord; conflict?: boolean }) {
  return (
    <div className={`memline${conflict ? " conflict" : ""}`}>
      <span>
        {e.key && <span className="mono muted">{e.key} </span>}
        {e.content}
      </span>
      <span className="small faint">{attribLine(e)}</span>
    </div>
  );
}

/** The toast stack: rendered once by App, bottom-centre, text only, nothing to click. */
export function Toasts() {
  const list = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  if (list.length === 0) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="toast">
          {t.text}
        </div>
      ))}
    </div>
  );
}

/**
 * Toasts for a websocket client's snapshot: every server error as it arrives, and one
 * "Connection lost" when a live socket closes. Call it from a view with `snap.connected` and
 * `snap.errors`.
 */
export function useConnectionToasts(connected: boolean, errors: string[]): void {
  const wasConnected = useRef(false);
  useEffect(() => {
    if (connected) wasConnected.current = true;
    else if (wasConnected.current) {
      wasConnected.current = false;
      toast("Connection lost");
    }
  }, [connected]);
  useEffect(() => {
    const last = errors[errors.length - 1];
    if (last) toast(last);
  }, [errors]);
}

/** A guarded clipboard write; falls back to a prompt when the API is unavailable. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    prompt(copy.session.copyLink, text);
  } catch {
    // ignore
  }
  return false;
}

// ---- the agents rail ---------------------------------------------------------------------

export interface AgentRow {
  sessionId: string;
  ownerId: string;
  title: string;
  open: boolean;
  crew: string | null;
  report: { status: string; goal: string | null; summary: string; pendingApprovals: number } | null;
  live: string | null;
  people: { id: string; name: string; role: string; online: boolean; driving: boolean }[];
}

/** Solo or team: a session is a team when more than one human is in it or when it is in a crew. */
export function teamOf(row: AgentRow): { team: boolean; with: AgentRow["people"] } {
  const humans = row.people.filter((p) => p.online);
  const others = humans.filter((p) => p.id !== row.ownerId);
  return { team: humans.length > 1 || Boolean(row.crew), with: others };
}

export function TeamPill({ row }: { row: AgentRow }) {
  const t = teamOf(row);
  return <span className={`pill ${t.team ? "team" : "solo"}`}>{t.team ? "Team" : "Solo"}</span>;
}

/** What an agent is doing, in one line: the goal while running, the last summary otherwise. */
export function doingOf(row: AgentRow): { lead: string; text: string } {
  const r = row.report;
  const status = row.live ?? r?.status ?? "idle";
  // The report lands at turn boundaries; until then the title stands in for the goal.
  const goal = r?.goal || row.title || row.sessionId;
  const summary = (r?.summary ?? "").replace(/^(DONE|continuing):?\s*/i, "").trim();
  if (status === "awaiting_approval") return { lead: "waiting on", text: `an approval · ${goal}` };
  if (status === "blocked") return { lead: "blocked on", text: goal };
  if (status === "running") return { lead: "working on", text: goal };
  if (status === "paused") return { lead: "paused on", text: goal };
  if (!r) return { lead: "waiting for", text: "a goal" };
  return { lead: "last", text: summary || goal };
}

export function AgentCard({
  row,
  href,
  active,
  nameOf,
}: {
  row: AgentRow;
  href: string;
  active: boolean;
  nameOf: (id: string) => string;
}) {
  const status = row.open ? (row.live ?? row.report?.status ?? "idle") : "closed";
  const d = doingOf(row);
  const t = teamOf(row);
  const online = row.people.filter((p) => p.online);
  const withNames = t.with.map((p) => p.name);
  return (
    <a className={`agent${active ? " active" : ""}`} href={href} title={row.sessionId}>
      <span className="head">
        <span className={`dot ${status}`} />
        <span className="t">{row.title || row.sessionId}</span>
        {(row.report?.pendingApprovals ?? 0) > 0 && (
          <span className="pill" title="Approvals waiting">
            {row.report?.pendingApprovals}
          </span>
        )}
      </span>
      <span className="doing">
        <i>{d.lead}</i> {d.text}
      </span>
      <span className="foot">
        <TeamPill row={row} />
        {online.length > 0 && (
          <span className="stack" aria-hidden="true">
            {online.slice(0, 3).map((p) => (
              <Avatar key={p.id} id={p.id} name={p.name} driver={p.driving} />
            ))}
          </span>
        )}
        <span className="with">
          {t.with.length ? `with ${withNames.join(", ")}` : nameOf(row.ownerId)}
        </span>
      </span>
    </a>
  );
}
