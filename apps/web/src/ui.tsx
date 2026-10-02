/** Small shared pieces on top of tokens.css v2: the mark, avatars, pills, panels, course line. */
import type { Resource } from "@fold/fleet";
import { type ReactNode, useEffect, useState } from "react";
import { initials } from "./identity.js";

/** The Fold mark inline: hull, fold bar, grip. On `.chrome` the tokens recolour hull and bar. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 96 96" width="24" height="24" aria-hidden="true" className="mark">
      <rect x="12" y="12" width="72" height="72" rx="14" className="m-sheet" fill="#2A3244" />
      <path d="M84 12v34L50 12z" fill="#56352D" />
      <path d="M84 46L50 12 84 12z" fill="#E2C4A6" />
      <path d="M50 12L84 46" stroke="#F3EEE7" stroke-width="3" stroke-linecap="round" />
    </svg>
  );
}

export function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg className="ic" viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
export const ICONS = {
  sessions: "M2 4h12M2 8h8M2 12h10",
  fleet: "M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z",
  memory: "M3 2.5h8a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2zM3 11.5h10",
  mgmt: "M3 13V8M8 13V3M13 13V6",
  handoff: "M2 8h11M9 4l4 4-4 4",
  pause: "M5 3v10M11 3v10",
  play: "M5 3l8 5-8 5z",
  send: "M2 8l12-6-4 12-2-5z",
  bell: "M4 11V7a4 4 0 0 1 8 0v4l1 2H3zM6.5 14h3",
};

export function Avatar({
  id,
  name,
  small = false,
  driver = false,
  agent = false,
  title,
}: {
  id: string;
  name: string;
  small?: boolean;
  driver?: boolean;
  agent?: boolean;
  title?: string;
}) {
  const cls = ["avatar", agent ? "agent" : "", small ? "small" : "", driver ? "driver" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} title={title ?? name} data-id={id}>
      {agent ? "A" : initials(name)}
    </span>
  );
}

export const STATUS: Record<string, { cls: string; label: string }> = {
  running: { cls: "running", label: "Running" },
  awaiting_approval: { cls: "awaiting", label: "Awaiting approval" },
  blocked: { cls: "blocked", label: "Blocked" },
  paused: { cls: "paused", label: "Paused" },
  idle: { cls: "idle", label: "Idle" },
  cancelled: { cls: "idle", label: "Cancelled" },
  closed: { cls: "idle", label: "Closed" },
  offline: { cls: "idle", label: "Offline" },
};

export function Pill({
  status,
  suffix,
  count,
}: {
  status: string | null | undefined;
  suffix?: string;
  count?: number;
}) {
  const s = STATUS[status ?? "offline"] ?? { cls: "idle", label: "Idle" };
  return (
    <span className={`pill ${s.cls}`}>
      {count !== undefined ? `${count} ${s.label.toLowerCase()}` : s.label}
      {suffix ? ` · ${suffix}` : ""}
    </span>
  );
}

/** Card border by session status: attention for approvals, danger for blocked. */
export function toneOf(status: string | null | undefined): string {
  switch (status) {
    case "awaiting_approval":
      return "attention";
    case "blocked":
      return "danger";
    default:
      return "";
  }
}

export function Panel({
  title,
  extra,
  className = "",
  children,
}: {
  title: ReactNode;
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      <header>
        <span className="eyebrow">{title}</span>
        {extra}
      </header>
      <div className="body">{children}</div>
    </section>
  );
}

/** An inspector section: eyebrow header with a count, then a column body. */
export function Sec({
  title,
  extra,
  className = "",
  children,
}: {
  title: ReactNode;
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`sec ${className}`}>
      <header>
        <span>{title}</span>
        {extra}
      </header>
      <div>{children}</div>
    </section>
  );
}

export function Brief({ text, empty = "No brief yet." }: { text: string | null; empty?: string }) {
  return text ? <pre className="brief">{text}</pre> : <p className="muted small">{empty}</p>;
}

export function ErrorLine({ errors }: { errors: string[] }) {
  const last = errors[errors.length - 1];
  return last ? <div className="note danger">{last}</div> : null;
}

/** The apricot course line under the top bar: one dot per epoch, the fill at the current turn. */
export function CourseLine({
  turn,
  epochs,
  label,
}: {
  turn: number;
  epochs: number[];
  label: string;
}) {
  const span = Math.max(turn, 10);
  const pct = (t: number) => `${Math.min(100, (t / span) * 100)}%`;
  return (
    <div className="courseline" title={label}>
      <div className="course">
        <i style={{ left: 0, width: pct(turn) }} />
        {epochs.map((t) => (
          <b key={t} style={{ left: pct(t) }} title={`turn ${t}`} />
        ))}
        <b style={{ left: pct(turn) }} title={`turn ${turn} · now`} />
      </div>
    </div>
  );
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
