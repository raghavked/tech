/** Small shared pieces on top of tokens.css v6: the mark, loaders, line icons, avatars, status, counts, pills, stars. */
import type { Resource } from "@henosis/fleet";
import { budgetStatus, compactTokens, formatTokens } from "@henosis/kernel";
import type { EntryRecord } from "@henosis/memory";
import { type Usage, usageTotal } from "@henosis/protocol";
import {
  type CSSProperties,
  Fragment,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { isTyping, moveCursor } from "./approvalsQueue.js";
import { copy, DEFAULT_RATING, RATING_WORDS, status as statusWords } from "./copy.js";
import { initials } from "./identity.js";
import { useMotion } from "./theme.js";
import { getToasts, subscribeToasts, toast } from "./toast.js";

/** `toast("Link copied")`: a short text at the bottom centre that goes away by itself. */
/** Whether motion plays right now ("full") or the page is calm; see theme.ts. */
export { DEFAULT_RATING, RATING_WORDS, toast, useMotion };

// ---- the mark ----------------------------------------------------------------------------

/** The five cuts of design/mark.svg; `auto` picks by size (default ≥ 32, small 20–31, tiny < 20). */
export type MarkCut = "auto" | "default" | "small" | "tiny" | "bare" | "mono";
/** The onboarding set: faint ring → one arc → two arcs apart → closed; `ring5` is the tour's segmented ring. */
export type MarkState = "closed" | "apart" | "faint" | "one-arc" | "ring5";
/** What sits at the centre: the dot, a team's emblem (a crest at 48 px and up, the dot below), or nothing. */
export type MarkCentre = "dot" | "emblem" | "none";
/** A bare cut's ground, which picks its arc colours (brand-board's table); a disc is always "on navy". */
export type MarkGround = "navy" | "cream" | "apricot" | "choc" | "paper";

/** Geometry per cut on the 96 grid: the disc radius (null = no disc), the arcs' radius and stroke, the centre's radius. */
const CUTS: Record<
  Exclude<MarkCut, "auto">,
  { disc: number | null; r: number; w: number; dot: number }
> = {
  default: { disc: 46, r: 28, w: 10, dot: 7 },
  small: { disc: 48, r: 29, w: 13, dot: 8.5 },
  tiny: { disc: null, r: 32, w: 16, dot: 10 },
  bare: { disc: null, r: 30, w: 12, dot: 8 },
  mono: { disc: null, r: 30, w: 12, dot: 8 },
};

/** The cut a size takes when none is named (SYSTEM.md §5, the size ladder). */
export function cutFor(size: number): "default" | "small" | "tiny" {
  return size >= 32 ? "default" : size >= 20 ? "small" : "tiny";
}

/** The team look's mark option ("ring" | "bead" | "dot" in the store) as the centre and whether the arcs show. */
export function markLook(mark: "ring" | "bead" | "dot" | undefined): {
  centre: MarkCentre;
  arcs: boolean;
} {
  if (mark === "bead") return { centre: "emblem", arcs: true };
  if (mark === "dot") return { centre: "dot", arcs: false };
  return { centre: "dot", arcs: true };
}

/**
 * The Henosis mark, inline (the same geometry as design/mark.svg's symbols, drawn by React so the
 * `.arc` and `.dot` rules can move it and the team look can set its disc): two arcs, a person's
 * (chocolate, right) and an agent's (apricot, left), that close into one ring around one centre.
 * Colour reaches it only through `--mark-disc`, `--mark-arc-a`, `--mark-arc-b` and `--mark-dot`;
 * a bare cut takes a `ground` instead. `joining` plays the arcs closing (loop), `once` with it a
 * single run (a join, a first load), `settle` the 0.8 s arrive, `halo` the waiting pulse, `live`
 * a pulsing centre; `ghost` is the dashed centre of something not yet in the circle.
 */
export function Mark({
  size = 22,
  cut = "auto",
  state = "closed",
  ghost = false,
  joining = false,
  once = false,
  settle = false,
  live = false,
  halo = false,
  ground,
  centre = "dot",
  arcs = true,
  emblem,
  segments,
  className = "",
  title,
}: {
  size?: number;
  cut?: MarkCut;
  state?: MarkState;
  ghost?: boolean;
  joining?: boolean;
  once?: boolean;
  settle?: boolean;
  live?: boolean;
  halo?: boolean;
  ground?: MarkGround | undefined;
  centre?: MarkCentre;
  /** false: the disc with only its centre (the team look's "dot only"). */
  arcs?: boolean;
  emblem?: string | undefined;
  /** The tour's segmented ring: how many segments (five by default with `state="ring5"`). */
  segments?: number | undefined;
  className?: string;
  /** Names the mark for a reader (the rail's brand); every other copy is decoration. */
  title?: string | undefined;
}) {
  const c = cut === "auto" ? cutFor(size) : cut;
  const g = CUTS[c];
  const mono = c === "mono";
  const arcA = mono ? "currentColor" : "var(--mark-arc-a, #56352D)";
  const arcB = mono ? "currentColor" : "var(--mark-arc-b, #E2C4A6)";
  const dotFill = mono ? "currentColor" : "var(--mark-dot, #E2C4A6)";
  const crest = centre === "emblem" && Boolean(emblem) && size >= 48;
  const segs = state === "ring5" ? (segments ?? 5) : segments;
  const cls = [
    "mark",
    c !== "default" ? c : null,
    size < 24 ? "still" : null,
    state !== "closed" ? state : null,
    ghost ? "ghost" : null,
    joining ? "joining" : null,
    joining && once ? "once" : null,
    settle ? "settle" : null,
    live ? "live" : null,
    halo ? "waiting" : null,
    ground ? `on-${ground}` : null,
    className || null,
  ]
    .filter(Boolean)
    .join(" ");
  const top = 48 - g.r;
  const bottom = 48 + g.r;
  const ring = 2 * Math.PI * g.r;
  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      className={cls}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {g.disc !== null && (
        <circle className="disc" cx="48" cy="48" r={g.disc} fill="var(--mark-disc, #2A3244)" />
      )}
      {arcs && segs ? (
        <circle
          className="ring5"
          cx="48"
          cy="48"
          r={g.r}
          fill="none"
          stroke={arcB}
          strokeWidth={g.w}
          strokeDasharray={`${ring / segs - g.w * 0.55} ${g.w * 0.55}`}
          transform="rotate(-90 48 48)"
        />
      ) : arcs ? (
        <>
          <path
            className="arc a"
            d={`M48 ${top} A${g.r} ${g.r} 0 0 1 48 ${bottom}`}
            stroke={arcA}
            strokeWidth={g.w}
            fill="none"
            strokeLinecap="round"
          />
          <path
            className="arc b"
            d={`M48 ${bottom} A${g.r} ${g.r} 0 0 1 48 ${top}`}
            stroke={arcB}
            strokeWidth={g.w}
            fill="none"
            strokeLinecap="round"
            opacity={mono ? 0.55 : undefined}
            style={mono ? { strokeDasharray: "var(--mark-dash, 0)" } : undefined}
          />
        </>
      ) : null}
      {crest ? (
        <text
          className="crest"
          x="48"
          y="59"
          textAnchor="middle"
          fontFamily="var(--serif)"
          fontSize={emblem && emblem.length > 1 ? 26 : 32}
          fill={dotFill}
        >
          {emblem}
        </text>
      ) : !arcs ? (
        <>
          <circle className="dot" cx="48" cy="48" r={g.r + g.w / 2} fill={dotFill} />
          {emblem && (
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
        </>
      ) : centre !== "none" ? (
        <circle className="dot" cx="48" cy="48" r={g.dot} fill={dotFill} />
      ) : null}
    </svg>
  );
}

/**
 * The joining line (MOTION.md §7): a 30–40 px mark playing arcs-close once, a serif sentence with
 * the name in chocolate, the time in mono. The same line for a person, an agent or a session.
 */
export function JoinLine({
  name,
  when,
  size = 30,
  className = "",
}: {
  name: string;
  when?: string | undefined;
  size?: number;
  className?: string;
}) {
  return (
    <div className={`joinline${className ? ` ${className}` : ""}`}>
      <Mark size={size} joining once />
      <span>
        <span className="who">{name}</span>
        {copy.join.line(name).slice(name.length)}
      </span>
      {when && <span className="when">{when}</span>}
    </div>
  );
}

// ---- loaders -----------------------------------------------------------------------------

/**
 * One loader per meaning (SYSTEM.md §13): `join` the app joins you (the mark, arcs close), `orbit`
 * you join people (three dots converge, only at the 54 px page centre on a first join), `halo` a
 * small wait (the mark's centre pulsing, inline and in toasts), `weave` rows arrive (two strands
 * under a title), `shimmer` words arrive (only the lines where the summary will land).
 */
export type LoaderKind = "join" | "orbit" | "halo" | "weave" | "shimmer";

/** After 8 s a wait shows its cause; after 30 s one chocolate action. */
export const WAIT_CAUSE_MS = 8_000;
export const WAIT_ACTION_MS = 30_000;

/** 0 while young, 1 once a cause is due, 2 once an action is due; restarts when `key` changes. */
export function useWaitStage(key: string | number = 0): 0 | 1 | 2 {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the timers restart when the wait changes
  useEffect(() => {
    setStage(0);
    const a = setTimeout(() => setStage(1), WAIT_CAUSE_MS);
    const b = setTimeout(() => setStage(2), WAIT_ACTION_MS);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [key]);
  return stage;
}

/**
 * A wait with a sentence. `label` names who and what ("Joining Bo, Cy and Dee in Checkout."),
 * never "loading"; `count` is the second line ("1,204 of 2,310 events folded"); `after8s` is the
 * cause that appears later and `after30s` the one action. Without motion each loader sits in its
 * rest state and the sentence carries the wait. Every loader has `role="status"`.
 */
export function Loader({
  kind,
  label,
  name,
  count,
  after8s,
  after30s,
  size,
  rows = 3,
  title = false,
  stack = false,
  className = "",
}: {
  kind: LoaderKind;
  /** The sentence beside the loader; a string is also the accessible name. */
  label?: ReactNode;
  /** The accessible name when `label` is not a plain string. */
  name?: string;
  /** The second line: a count, in mono. */
  count?: string | null | undefined;
  after8s?: string | undefined;
  after30s?: { label: string; onClick: () => void } | undefined;
  /** join: the mark's size (28 inline, 120 at launch). */
  size?: number;
  /** shimmer: how many rows. */
  rows?: number;
  /** shimmer: a taller first row where a heading will be. */
  title?: boolean;
  /** Stack the loader over its sentence (the page centre). */
  stack?: boolean;
  className?: string;
}) {
  const stage = useWaitStage(typeof label === "string" ? label : name);
  const text = typeof label === "string" ? label : name;
  const cls = `loader ${kind}${stack ? " stack" : ""}${className ? ` ${className}` : ""}`;
  const a11y = text
    ? { role: "status" as const, "aria-label": text }
    : { role: "status" as const, "aria-hidden": true };
  const tail = (
    <>
      {count && <span className="n">{count}</span>}
      {stage >= 1 && after8s && <span className="cause">{after8s}</span>}
      {stage >= 2 && after30s && (
        <button type="button" className="btn primary sm act" onClick={after30s.onClick}>
          {after30s.label}
        </button>
      )}
    </>
  );
  if (kind === "join")
    return (
      <span className={cls} {...a11y}>
        <Mark size={size ?? 28} joining />
        {label && <span className="lbl">{label}</span>}
        {tail}
      </span>
    );
  if (kind === "orbit")
    return (
      <span className={`wait orbit${stack ? " stack" : ""}`} {...a11y}>
        <span className={cls} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        {label && <span className="lbl">{label}</span>}
        {tail}
      </span>
    );
  if (kind === "halo")
    return (
      <span className={`wait halo${stack ? " stack" : ""}`} {...a11y}>
        <span className={cls} aria-hidden="true" />
        {label && <span className="lbl">{label}</span>}
        {tail}
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

// ---- the rating control ------------------------------------------------------------------

/** low (1–2), mid (3), high (4–5): the word's colour takes the -ink tokens. */
export function ratingLevel(n: number): "low" | "mid" | "high" {
  return n <= 2 ? "low" : n === 3 ? "mid" : "high";
}

/**
 * Five SVG stars in one radiogroup with a roving tabindex (rating-control): the rating control on
 * a plan and under a release gate, in the stream, the queue and the inbox. Each star is a radio
 * named "n of 5, Word"; the serif word beside says what the pick does; `tick` draws the gate
 * threshold after the third star. Keys: arrows preview, 1–5 pick, Enter picks, 0 clears.
 * `value` null means nothing chosen yet; Tab then lands on the default the button will send.
 */
export function Stars({
  value,
  onChange,
  onClear,
  label = copy.rating.yourRating,
  size = "md",
  tick = false,
  word = true,
  disabled = false,
  readonly = false,
}: {
  value: number | null;
  onChange: (n: number) => void;
  /** `0` clears the pick when the owner can hold "no rating". */
  onClear?: (() => void) | undefined;
  label?: string;
  size?: "sm" | "md" | "lg";
  /** Under a ratings rule: the hairline after the third star. */
  tick?: boolean;
  /** Show the word beside the stars. */
  word?: boolean;
  disabled?: boolean;
  /** Submitted: the stars locked with a drawn check. */
  readonly?: boolean;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const locked = disabled || readonly;
  const shown = (locked ? null : preview) ?? value ?? 0;
  const focusAt = value ?? (tick ? DEFAULT_RATING : 1);
  const onKey = (e: ReactKeyboardEvent<HTMLButtonElement>, n: number) => {
    if (locked) return;
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = Math.min(5, n + 1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = Math.max(1, n - 1);
        break;
      case "Home":
        next = 1;
        break;
      case "End":
        next = 5;
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        onChange(n);
        return;
      case "0":
        e.preventDefault();
        onClear?.();
        return;
      default:
        if (/^[1-5]$/.test(e.key)) {
          e.preventDefault();
          onChange(Number(e.key));
        }
        return;
    }
    e.preventDefault();
    setPreview(next);
    refs.current[next - 1]?.focus();
  };
  return (
    <div
      className={`stars${size !== "md" ? ` ${size}` : ""}${locked ? " locked" : ""}`}
      role="radiogroup"
      aria-label={label}
      onMouseLeave={() => setPreview(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Fragment key={n}>
          {tick && n === 4 && <span className="tick" aria-hidden="true" />}
          {/* biome-ignore lint/a11y/useSemanticElements: a star is a drawn SVG button; the group is the radio control */}
          <button
            type="button"
            role="radio"
            ref={(el) => {
              refs.current[n - 1] = el;
            }}
            className={`star${shown >= n ? (value !== null && n <= value ? " on" : " pre") : ""}`}
            aria-checked={value === n}
            aria-label={copy.rating.name(n)}
            aria-disabled={readonly || undefined}
            tabIndex={n === focusAt ? 0 : -1}
            disabled={disabled}
            onMouseEnter={() => !locked && setPreview(n)}
            onFocus={() => !locked && setPreview(n)}
            onBlur={() => setPreview(null)}
            onClick={() => !locked && onChange(n)}
            onKeyDown={(e) => onKey(e, n)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d={ICONS.star} />
            </svg>
          </button>
        </Fragment>
      ))}
      {word && shown > 0 && (
        <span className={`word ${ratingLevel(shown)}`} aria-hidden="true">
          {copy.rating.word(shown)}
        </span>
      )}
      {readonly && value !== null && <Icon d={ICONS.check} size={14} className="draw" />}
    </div>
  );
}

// ---- avatars, status, counts, pills ------------------------------------------------------

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

/**
 * Status as a class and a word: the five words (running, awaiting approval, blocked, paused,
 * idle) plus closed and offline, each its own drawing in tokens.css (filled, filled + halo,
 * filled red, slate, hollow, hollow-faint, dashed). Only Running moves. Words live in copy.ts.
 */
export const STATUS: Record<string, { cls: string; label: string }> = {
  running: { cls: "running", label: statusWords.running },
  awaiting_approval: { cls: "awaiting", label: statusWords.awaiting_approval },
  blocked: { cls: "blocked", label: statusWords.blocked },
  paused: { cls: "paused", label: statusWords.paused },
  idle: { cls: "idle", label: statusWords.idle },
  cancelled: { cls: "closed", label: statusWords.cancelled },
  closed: { cls: "closed", label: statusWords.closed },
  offline: { cls: "offline", label: statusWords.offline },
  done: { cls: "done", label: "Done" },
};

/** The status word and class for a status string; unknown reads as idle, missing as offline. */
export function statusOf(status: string | null | undefined): { cls: string; label: string } {
  return STATUS[status ?? "offline"] ?? { cls: "idle", label: statusWords.idle };
}

/**
 * The bare dot: the colour, with the word hidden inside it for a reader ("Running"). Sizes 6 / 8
 * / 10 / 12 as xs / md / lg / xl. `label` overrides the hidden word; "" leaves the dot silent.
 */
export function Dot({
  status,
  size = "md",
  label,
  className = "",
}: {
  status: string | null | undefined;
  size?: "xs" | "md" | "lg" | "xl";
  label?: string;
  className?: string;
}) {
  const s = statusOf(status);
  const text = label ?? s.label;
  return (
    <span
      className={`dot ${s.cls}${size !== "md" ? ` ${size}` : ""}${className ? ` ${className}` : ""}`}
    >
      {text && <span className="sr-only">{text}</span>}
    </span>
  );
}

/** Status as a word with its quiet dot: `.status.running`; the dot carries the colour, the word stays ink. */
export function Status({
  status,
  size,
  children,
}: {
  status: string | null | undefined;
  size?: "xs" | "lg";
  children?: ReactNode;
}) {
  const s = statusOf(status);
  return (
    <span className={`status ${s.cls}${size ? ` ${size}` : ""}`}>
      {s.label}
      {children}
    </span>
  );
}

/**
 * The pending count: mono on solid apricot with navy ink, the only solid apricot in the frame.
 * Nothing at zero, 99+ past ninety-nine, pops on change; counts only what you can act on.
 */
export function Count({
  n,
  size = "md",
  pop = true,
  at = false,
  title,
  className = "",
}: {
  n: number;
  size?: "xs" | "sm" | "md" | "lg";
  pop?: boolean;
  /** The chocolate serif "@" for a mention. */
  at?: boolean;
  title?: string;
  className?: string;
}) {
  if (!at && n <= 0) return null;
  const cls = `count${size !== "md" ? ` ${size}` : ""}${pop ? " pop" : ""}${at ? " at" : ""}${className ? ` ${className}` : ""}`;
  return (
    <span className={cls} title={title} key={n}>
      {at ? "@" : n > 99 ? "99+" : n}
    </span>
  );
}

export type PillKind =
  | "team"
  | "solo"
  | "planning"
  | "status"
  | "risk"
  | "irreversible"
  | "gate"
  | "plain";

/**
 * Five things may be a badge: the status word, the pending count (`Count`), Solo/Team, Planning,
 * the crew name. A status pill sets the word in ink on the tinted ground, the dot carrying the
 * colour, in both themes.
 */
export function Pill({
  kind = "plain",
  status,
  risk,
  size,
  className = "",
  children,
}: {
  kind?: PillKind;
  status?: string | null | undefined;
  risk?: "read" | "write" | "exec" | "external" | "irreversible" | undefined;
  size?: "sm" | "lg";
  className?: string;
  children?: ReactNode;
}) {
  const s = kind === "status" ? statusOf(status) : null;
  const cls = [
    "pill",
    kind !== "plain" ? kind : null,
    s?.cls ?? null,
    risk ?? null,
    size ?? null,
    className || null,
  ]
    .filter(Boolean)
    .join(" ");
  return <span className={cls}>{children ?? s?.label}</span>;
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

// ---- the keyboard cursor -----------------------------------------------------------------

/**
 * One keyboard cursor for a list of rows (approvals queue, memory browser): j / k and the arrows
 * move it, `keys` act on the row under it, Enter included; nothing fires while the person types
 * somewhere. Rows carry `data-key` so the cursor scrolls into view. The row under the cursor
 * takes `.cursor`: the selection wash with the hairline ring and the gutter stripe.
 */
export function useCursor(
  keys: string[],
  opts: { keys?: Record<string, (key: string) => void>; enabled?: boolean } = {},
): { cursor: string | null; set: (key: string | null) => void } {
  const [cursorKey, setCursorKey] = useState<string | null>(null);
  const cursor = cursorKey && keys.includes(cursorKey) ? cursorKey : (keys[0] ?? null);
  const latest = useRef({ keys, cursor, opts });
  latest.current = { keys, cursor, opts };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const { keys, cursor, opts } = latest.current;
      if (opts.enabled === false) return;
      switch (e.key) {
        case "j":
        case "ArrowDown":
          setCursorKey(moveCursor(keys, cursor, 1));
          break;
        case "k":
        case "ArrowUp":
          setCursorKey(moveCursor(keys, cursor, -1));
          break;
        default: {
          const fn = opts.keys?.[e.key];
          if (!fn || cursor === null) return;
          fn(cursor);
        }
      }
      e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!cursor) return;
    document
      .querySelector(`[data-key="${CSS.escape(cursor)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);
  return { cursor, set: setCursorKey };
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

/**
 * Solo or Team; the background transitions and the word crossfades when the answer changes.
 * `withNames` adds "· with Bo" after the word (the title row).
 */
export function TeamPill({ row, withNames = false }: { row: AgentRow; withNames?: boolean }) {
  const t = teamOf(row);
  const word = t.team ? "Team" : "Solo";
  const names = t.with.map((p) => p.name);
  return (
    <span className={`pill ${t.team ? "team" : "solo"}`}>
      <span className="w" key={word}>
        {word}
      </span>
      {withNames && names.length > 0 && ` · with ${names.join(", ")}`}
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
        <Dot status={status} />
        <span className="t">{row.title || row.sessionId}</span>
        <Count n={pending} title="Approvals waiting" />
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
