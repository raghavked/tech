/** Small shared pieces on top of tokens.css v3: the mark, line icons, avatars, status words. */
import type { Resource } from "@fold/fleet";
import type { EntryRecord } from "@fold/memory";
import { type ReactNode, useEffect, useState } from "react";
import { initials } from "./identity.js";

/** The Fold mark inline (design/mark.svg): sheet, underside, folded corner, crease. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} aria-hidden="true" className="mark">
      <rect x="12" y="12" width="72" height="72" rx="14" fill="var(--fg, #2A3244)" />
      <path d="M84 12v34L50 12z" fill="#56352D" />
      <path d="M84 46L50 12 84 12z" fill="#E2C4A6" />
      <path d="M50 12L84 46" stroke="#F3EEE7" strokeWidth="3" strokeLinecap="round" />
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

/** Status as a word with a quiet dot: `.status.running`, `.status.awaiting`... */
export const STATUS: Record<string, { cls: string; label: string }> = {
  running: { cls: "running", label: "Running" },
  awaiting_approval: { cls: "awaiting", label: "Needs approval" },
  blocked: { cls: "blocked", label: "Blocked" },
  paused: { cls: "paused", label: "Paused" },
  idle: { cls: "idle", label: "Idle" },
  cancelled: { cls: "idle", label: "Cancelled" },
  closed: { cls: "idle", label: "Closed" },
  offline: { cls: "idle", label: "Offline" },
};

export function Status({
  status,
  children,
}: {
  status: string | null | undefined;
  children?: ReactNode;
}) {
  const s = STATUS[status ?? "offline"] ?? { cls: "idle", label: "Idle" };
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
    prompt("Copy this link", text);
  } catch {
    // ignore
  }
  return false;
}
