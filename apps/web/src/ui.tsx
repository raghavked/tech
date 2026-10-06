/** Small shared pieces on top of tokens.css v5: the mark, loaders, line icons, avatars, status words. */
import type { Resource } from "@henosis/fleet";
import { budgetStatus, compactTokens, formatTokens } from "@henosis/kernel";
import type { EntryRecord } from "@henosis/memory";
import { type Usage, usageTotal } from "@henosis/protocol";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { copy, status as statusWords } from "./copy.js";
import { initials } from "./identity.js";
import { useMotion } from "./theme.js";
import { getToasts, subscribeToasts, toast } from "./toast.js";

/** `toast("Link copied")`: a short text at the bottom centre that goes away by itself. */
/** Whether motion plays right now ("full") or the page is calm; see theme.ts. */
export { toast, useMotion };

export type MarkStyle = "ring" | "bead" | "dot";

/**
 * The Henosis mark inline (design/mark.svg): two arcs, a person's and an agent's, that close
 * into one ring around one centre. `joining` plays the arcs closing (the loading motion);
 * `settle` plays it once (the app has loaded). `style` is the team's choice: the two arcs, one
 * solid ring, or a plain dot carrying the team's `emblem`. Colours come from `--mark-disc`,
 * `--mark-arc-a`, `--mark-arc-b` and `--mark-dot` (the team look sets `--mark-ring`/`--mark-bead`).
 */
export function Mark({
  size = 22,
  joining = false,
  settle = false,
  style = "ring",
  emblem,
  className = "",
}: {
  size?: number;
  joining?: boolean;
  settle?: boolean;
  style?: MarkStyle;
  emblem?: string | undefined;
  className?: string;
}) {
  const cls = `mark ${style}${joining ? " joining" : ""}${settle ? " settle" : ""}${className ? ` ${className}` : ""}`;
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} aria-hidden="true" className={cls}>
      <circle cx="48" cy="48" r="46" fill="var(--mark-disc, #2A3244)" />
      {style === "ring" && (
        <path
          d="M48 20 A28 28 0 0 1 48 76"
          stroke="var(--mark-arc-a, var(--mark-bead, #56352D))"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          className="arc a"
        />
      )}
      {style === "ring" && (
        <path
          d="M48 76 A28 28 0 0 1 48 20"
          stroke="var(--mark-arc-b, var(--mark-ring, #E2C4A6))"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          className="arc b"
        />
      )}
      {style === "ring" && (
        <circle
          cx="48"
          cy="48"
          r="7"
          fill="var(--mark-dot, var(--mark-ring, #E2C4A6))"
          className="dot"
        />
      )}
      {style === "bead" && (
        <circle
          cx="48"
          cy="48"
          r="28"
          fill="none"
          stroke="var(--mark-ring, #E2C4A6)"
          strokeWidth="10"
          className="arc"
        />
      )}
      {style === "bead" && (
        <circle cx="48" cy="48" r="7" fill="var(--mark-bead, #56352D)" className="dot" />
      )}
      {style === "dot" && (
        <circle cx="48" cy="48" r="30" fill="var(--mark-ring, #E2C4A6)" className="dot" />
      )}
      {style === "dot" && emblem && (
        <text
          x="48"
          y="60"
          textAnchor="middle"
          fontFamily="var(--serif)"
          fontSize="36"
          fill="var(--mark-disc, #2A3244)"
        >
          {emblem}
        </text>
      )}
    </svg>
  );
}

export type LoaderKind = "join" | "orbit" | "weave" | "shimmer";

/**
 * The four loaders of tokens.css. `join`: the mark with the bead travelling round the ring,
 * for connecting and joining; `orbit`: three dots in the three palette colours that orbit and
 * converge, for short waits; `weave`: a thin bar of two strands under the top row, for a long
 * operation; `shimmer`: skeleton rows with an apricot sheen where a list will be. Without
 * motion each sits in its rest state. `label` is read out and shown beside join and orbit.
 */
export function Loader({
  kind,
  label,
  rows = 3,
  title = false,
  className = "",
}: {
  kind: LoaderKind;
  label?: string;
  /** shimmer: how many rows. */
  rows?: number;
  /** shimmer: a taller first row where a heading will be. */
  title?: boolean;
  className?: string;
}) {
  const cls = `loader ${kind}${className ? ` ${className}` : ""}`;
  const a11y = label ? { role: "status" as const, "aria-label": label } : { "aria-hidden": true };
  if (kind === "join")
    return (
      <span className={cls} {...a11y}>
        <Mark size={28} joining />
        {label && <span className="lbl">{label}</span>}
      </span>
    );
  if (kind === "orbit")
    return (
      <span className={cls} {...a11y}>
        <i />
        <i />
        <i />
      </span>
    );
  if (kind === "weave")
    return (
      <span className={cls} {...a11y}>
        <i />
        <i />
      </span>
    );
  return (
    <div className={cls} {...a11y}>
      {title && <i className="title" />}
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the rows are identical placeholders
        <i key={i} />
      ))}
    </div>
  );
}

/**
 * The ids that appeared in `ids` since the last render, kept for `ms`: the "joined" ripple on
 * an avatar when someone enters the session. The first render seeds without ripples.
 */
export function useJustJoined(ids: string[], ms = 1000): Set<string> {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const key = ids.join("\u0000");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the identity of `ids`
  useEffect(() => {
    const now = new Set(ids);
    if (seen.current === null) {
      seen.current = now;
      return;
    }
    const added = ids.filter((id) => !seen.current?.has(id));
    seen.current = now;
    if (added.length === 0) return;
    setFresh((f) => new Set([...f, ...added]));
    // Each arrival keeps its own timer; a later arrival must not cancel an earlier ripple's end.
    setTimeout(
      () =>
        setFresh((f) => {
          const next = new Set(f);
          for (const id of added) next.delete(id);
          return next;
        }),
      ms,
    );
  }, [key, ms]);
  return fresh;
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
  star: "M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z",
};

/**
 * Five stars as buttons: the rating control on a plan and on a release-gate approval. Keyboard
 * reachable (each star is a button named "Rate n of 5"); the chosen star and those before it
 * fill. `value` null means nothing chosen yet.
 */
export function Stars({
  value,
  onChange,
  label = copy.plan.yourRating,
  size = 16,
  disabled = false,
}: {
  value: number | null;
  onChange: (n: number) => void;
  label?: string;
  size?: number;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <fieldset className="stars" aria-label={label} onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          className={`star${shown >= n ? " on" : ""}`}
          aria-label={copy.plan.rate(n)}
          aria-pressed={value === n}
          disabled={disabled}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onBlur={() => setHover(null)}
          onClick={() => onChange(n)}
        >
          <Icon d={ICONS.star} size={size} className={shown >= n ? "fill" : ""} />
        </button>
      ))}
    </fieldset>
  );
}

export function Avatar({
  id,
  name,
  driver = false,
  agent = false,
  joined = false,
  title,
}: {
  id: string;
  name: string;
  driver?: boolean;
  agent?: boolean;
  /** Plays the "joined" ripple once: set for a second when this person enters the session. */
  joined?: boolean;
  title?: string;
}) {
  return (
    <span
      className={`avatar${driver ? " driver" : ""}${agent ? " agent" : ""}${joined ? " joined" : ""}`}
      title={title ?? name}
      data-id={id}
    >
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

// ---- token usage -------------------------------------------------------------------------

/** Warn at 80% of a budget, danger past it. */
export const BUDGET_WARN = 0.8;

/**
 * A quiet chip, "12.4k tokens", that opens on hover or focus to input, output and cache, with
 * a hairline budget bar beneath it when the policy sets one. A tap pins the breakdown (touch
 * has no hover); `open` keeps it shown, as the drawer's Usage section does.
 */
export function TokenMeter({
  usage,
  budget = null,
  open = false,
}: {
  usage: Usage;
  budget?: number | null;
  open?: boolean;
}) {
  const [pinned, setPinned] = useState(false);
  const b = budgetStatus({ usage, policy: { tokenBudget: budget } });
  const pct = b.budget === null ? null : Math.round(b.fraction * 100);
  const tone = b.over ? " danger" : pct !== null && b.fraction >= BUDGET_WARN ? " warn" : "";
  const rows: [string, string][] = [
    [copy.usage.input, formatTokens(usage.input)],
    [copy.usage.output, formatTokens(usage.output)],
    [copy.usage.cacheRead, formatTokens(usage.cacheRead)],
    [copy.usage.cacheWrite, formatTokens(usage.cacheWrite)],
    [
      copy.usage.budget,
      b.budget === null || pct === null
        ? copy.usage.noBudget
        : copy.usage.ofBudget(formatTokens(b.used), formatTokens(b.budget), pct),
    ],
  ];
  return (
    <span className={`meter${tone}${open ? " open" : pinned ? " pinned" : ""}`}>
      <button
        type="button"
        className="chip"
        aria-label={copy.usage.label(formatTokens(b.used), pct)}
        aria-expanded={open || pinned}
        onClick={() => setPinned((v) => !v)}
      >
        {copy.usage.chip(compactTokens(b.used))}
      </button>
      {b.budget !== null && (
        <span className="bar" aria-hidden="true">
          <span
            className="fill"
            style={{ width: `${Math.min(100, Math.round(b.fraction * 100))}%` }}
          />
        </span>
      )}
      <span className="meter-pop">
        {rows.map(([k, v]) => (
          <span className="kv-line" key={k}>
            <span className="muted">{k}</span>
            <span className="mono">{v}</span>
          </span>
        ))}
        {tone && (
          <span className={`kv-line${b.over ? " danger" : " warnish"}`}>
            {b.over ? copy.usage.over : copy.usage.nearing}
          </span>
        )}
      </span>
    </span>
  );
}

// ---- the agents rail ---------------------------------------------------------------------

export interface AgentRow {
  sessionId: string;
  ownerId: string;
  title: string;
  open: boolean;
  crew: string | null;
  report: {
    status: string;
    goal: string | null;
    summary: string;
    pendingApprovals: number;
    usage?: Usage | undefined;
    /** Plan first: the plan the session is on. */
    plan?: { status: string; estTokens: number; actualTokens: number } | undefined;
  } | null;
  live: string | null;
  people: { id: string; name: string; role: string; online: boolean; driving: boolean }[];
}

/** Solo or team: a session is a team when more than one human is in it or when it is in a crew. */
export function teamOf(row: AgentRow): { team: boolean; with: AgentRow["people"] } {
  const humans = row.people.filter((p) => p.online);
  const others = humans.filter((p) => p.id !== row.ownerId);
  return { team: humans.length > 1 || Boolean(row.crew), with: others };
}

/** Solo or Team; the background transitions and the word crossfades when the answer changes. */
export function TeamPill({ row }: { row: AgentRow }) {
  const t = teamOf(row);
  const word = t.team ? "Team" : "Solo";
  return (
    <span className={`pill ${t.team ? "team" : "solo"}`}>
      <span className="w" key={word}>
        {word}
      </span>
    </span>
  );
}

/** What an agent is doing, in one line: the goal while running, the last summary otherwise. */
export function doingOf(row: AgentRow): { lead: string; text: string } {
  const r = row.report;
  const status = row.live ?? r?.status ?? "idle";
  // The report lands at turn boundaries; until then the title stands in for the goal.
  const goal = r?.goal || row.title || row.sessionId;
  const summary = (r?.summary ?? "").replace(/^(DONE|continuing):?\s*/i, "").trim();
  if (status === "awaiting_approval") return { lead: "waiting on", text: `an approval · ${goal}` };
  if (r?.plan?.status === "proposed" && status !== "running")
    return { lead: "waiting for", text: `${copy.plan.waitingFor} · ${goal}` };
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
  index = 0,
}: {
  row: AgentRow;
  href: string;
  active: boolean;
  nameOf: (id: string) => string;
  /** Position in the rail: staggers the slide-and-fade entrance (`.agent.enter`, `--i`). */
  index?: number;
}) {
  const status = row.open ? (row.live ?? row.report?.status ?? "idle") : "closed";
  const d = doingOf(row);
  const t = teamOf(row);
  const online = row.people.filter((p) => p.online);
  const withNames = t.with.map((p) => p.name);
  const tokens = usageTotal(row.report?.usage);
  const pending = row.report?.pendingApprovals ?? 0;
  return (
    <a
      className={`agent enter${active ? " active" : ""}`}
      href={href}
      title={row.sessionId}
      style={{ "--i": index } as CSSProperties}
    >
      <span className="head">
        <span className={`dot ${status}`} />
        <span className="t">{row.title || row.sessionId}</span>
        {pending > 0 && (
          <span className="pill badge" title="Approvals waiting" key={pending}>
            {pending}
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
        {tokens > 0 && (
          <span className="tokens mono" title={copy.usage.chip(formatTokens(tokens))}>
            {compactTokens(tokens)}
          </span>
        )}
      </span>
    </a>
  );
}
