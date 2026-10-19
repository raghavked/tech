/**
 * Empty states as invitations (design/henosis/explorations/empty-states, illustration): the ring
 * open because nothing has joined yet, one serif sentence in the product's voice, one line on what
 * fills the page and who puts it there, one action in the hand's colour and at most one quiet one,
 * and a dashed ghost of what the first real thing looks like. Row size inside a page that has
 * other things; page size where the page is empty. Plus the demo session and an offline hook.
 */
import { type ReactNode, useEffect, useState } from "react";
import { slugify } from "./identity.js";
import { navigate, paths } from "./router.js";
import { ICONS, Icon } from "./ui.js";

export interface EmptyAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

/**
 * The twelve spots: one grammar, the two arcs moved, rotated, dashed or shortened in four inks
 * (the person's arc, the agent's, the apricot centre, the dashed ghost), never a disc behind
 * them on cream. Each names a product moment and knows which page it belongs to.
 */
export type SpotName =
  | "open"
  | "join"
  | "whole"
  | "crew"
  | "baton"
  | "gate"
  | "plan"
  | "unite"
  | "memory"
  | "inbox"
  | "contention"
  | "meter";

const ARC_A = "M48 20 A28 28 0 0 1 48 76";
const ARC_B = "M48 76 A28 28 0 0 1 48 20";
const arc = (d: string, ink: "a" | "b", extra: Record<string, string | number> = {}) => (
  <path
    key={`${ink}:${d}`}
    d={d}
    className={`arc ${ink}`}
    fill="none"
    strokeWidth={10}
    strokeLinecap="round"
    {...extra}
  />
);
const ghost = (cx: number, cy: number, r = 7) => (
  <circle
    key={`g${cx}${cy}`}
    cx={cx}
    cy={cy}
    r={r}
    fill="none"
    className="ghost"
    strokeWidth={2}
    strokeDasharray="3 3"
  />
);
const dot = (r = 7, cx = 48, cy = 48) => (
  <circle key={`d${cx}${cy}`} cx={cx} cy={cy} r={r} className="dot" />
);

const SPOTS: Record<SpotName, () => ReactNode[]> = {
  open: () => [
    arc("M58 20 A28 28 0 0 1 58 76", "a"),
    arc("M38 76 A28 28 0 0 1 38 20", "b"),
    ghost(48, 48),
  ],
  join: () => [
    arc(ARC_A, "a", { transform: "rotate(22 48 48)" }),
    arc(ARC_B, "b", { transform: "rotate(-22 48 48)" }),
    dot(4.5),
  ],
  whole: () => [arc(ARC_A, "a"), arc(ARC_B, "b"), dot()],
  crew: () => [
    arc("M33 30 A18 18 0 0 1 33 66", "a", { strokeWidth: 7 }),
    arc("M33 66 A18 18 0 0 1 33 30", "b", { strokeWidth: 7 }),
    arc("M63 30 A18 18 0 0 1 63 66", "a", { strokeWidth: 7 }),
    arc("M63 66 A18 18 0 0 1 63 30", "b", { strokeWidth: 7 }),
    dot(6),
  ],
  baton: () => [
    arc(ARC_A, "a"),
    arc(ARC_B, "b"),
    <path
      key="trail"
      d="M28 28 A28 28 0 0 1 48 20"
      className="dot-stroke"
      fill="none"
      strokeWidth={4}
      strokeLinecap="round"
      strokeDasharray="2 5"
    />,
    dot(6.5, 67.8, 28.2),
    dot(4),
  ],
  gate: () => [
    arc("M40 20 A28 28 0 0 1 40 76", "a"),
    arc("M40 76 A28 28 0 0 1 40 20", "b"),
    ghost(40, 48),
    ghost(84, 38, 6),
    ghost(84, 58, 6),
  ],
  plan: () => [
    arc(ARC_A, "a", { strokeDasharray: "14 15.3" }),
    arc(ARC_B, "b", { strokeDasharray: "14 15.3" }),
    dot(),
  ],
  unite: () => [
    arc(ARC_A, "a"),
    arc(ARC_B, "b"),
    <path
      key="branch"
      d="M48 8 A40 40 0 0 1 48 88"
      className="ghost"
      fill="none"
      strokeWidth={3}
      strokeLinecap="round"
      strokeDasharray="1 6"
    />,
    dot(5.5, 48, 88),
    dot(),
  ],
  memory: () => [
    <circle key="track" cx={48} cy={48} r={42} fill="none" className="track" strokeWidth={3} />,
    arc(ARC_A, "a"),
    arc(ARC_B, "b"),
    <circle key="ring" cx={48} cy={48} r={13} fill="none" className="ghost" strokeWidth={2} />,
    dot(5),
  ],
  inbox: () => [
    arc(ARC_A, "a"),
    arc(ARC_B, "b"),
    <path
      key="r1"
      d="M61 12.3 A38 38 0 0 1 83.7 35"
      className="dot-stroke"
      fill="none"
      strokeWidth={3.5}
      strokeLinecap="round"
    />,
    <path
      key="r2"
      d="M63.4 5.7 A45 45 0 0 1 90.3 32.6"
      className="dot-stroke"
      fill="none"
      strokeWidth={3.5}
      strokeLinecap="round"
      opacity={0.55}
    />,
    dot(),
  ],
  contention: () => [
    arc(ARC_A, "a", { transform: "rotate(-38 48 48)" }),
    arc(ARC_B, "b", { transform: "rotate(38 48 48)", opacity: 0.92 }),
    <circle key="warn" cx={48} cy={20} r={6.5} className="warn" />,
    ghost(48, 48),
  ],
  meter: () => [
    <circle key="track" cx={48} cy={48} r={28} fill="none" className="track" strokeWidth={10} />,
    arc("M48 20 A28 28 0 0 1 75.2 41.9", "a"),
    dot(),
  ],
};

/**
 * A spot at `size` px (96 on a page, 48 on a card, 24 in a row). Below 48 only Open and Whole
 * keep their drawing; the rest fall back to Whole with the row cut (heavier stroke, no
 * satellites). Colours come from `.spot` in styles.css: chocolate and navy on cream, apricot-deep
 * and cream on dark and on navy, the ghost always dashed apricot.
 */
export function Spot({
  name,
  size = 56,
  className = "",
}: {
  name: SpotName;
  size?: number;
  className?: string;
}) {
  const row = size < 48;
  const which: SpotName = row && name !== "open" ? "whole" : name;
  const children =
    row && which === "open"
      ? [
          arc("M60 22 A26 26 0 0 1 60 74", "a", { strokeWidth: 14 }),
          arc("M36 74 A26 26 0 0 1 36 22", "b", { strokeWidth: 14 }),
          <circle
            key="g"
            cx={48}
            cy={48}
            r={8}
            fill="none"
            className="ghost"
            strokeWidth={3}
            strokeDasharray="4 4"
          />,
        ]
      : row
        ? [
            arc("M48 22 A26 26 0 0 1 48 74", "a", { strokeWidth: 14 }),
            arc("M48 74 A26 26 0 0 1 48 22", "b", { strokeWidth: 14 }),
            dot(8),
          ]
        : SPOTS[which]();
  return (
    <svg
      className={`spot ${which}${className ? ` ${className}` : ""}`}
      viewBox="0 0 96 96"
      width={size}
      height={size}
      overflow="visible"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ActionButton({ action, primary }: { action: EmptyAction; primary: boolean }) {
  const cls = primary ? "btn primary sm" : "btn ghost sm";
  return action.href ? (
    <a className={cls} href={action.href}>
      {action.label}
    </a>
  ) : (
    <button type="button" className={cls} onClick={action.onClick}>
      {action.label}
    </button>
  );
}

/**
 * Row size (the default): the sentence on the left, the one thing to do on the right, the spot
 * at 22 px before it when named. Page size, when `title` is given: the spot at 56 px, the serif
 * sentence, `text` as the line under it, the primary `action` in the hand's colour beside a
 * `quiet` one, and `ghost`, the dashed row of what the first real thing looks like. The 5 px
 * stripe on the left is the hand, never the gradient (SYSTEM.md §7).
 */
export function EmptyState({
  text,
  action,
  quiet,
  spot,
  title,
  ghost: ghostRow,
  className = "",
}: {
  text: ReactNode;
  action?: EmptyAction | null;
  /** Page size: at most one quiet action beside the primary. */
  quiet?: EmptyAction | null;
  spot?: SpotName;
  /** The serif sentence; given, the empty state takes the page size. */
  title?: ReactNode;
  /** Page size: a dashed, never clickable, ghost of the first real row. */
  ghost?: ReactNode;
  className?: string;
}) {
  if (title !== undefined)
    return (
      <div className={`empty page${className ? ` ${className}` : ""}`}>
        <Spot name={spot ?? "open"} size={56} />
        <h2 className="serif">{title}</h2>
        <p className="line">{text}</p>
        {(action || quiet) && (
          <div className="actions">
            {action && <ActionButton action={action} primary />}
            {quiet && <ActionButton action={quiet} primary={false} />}
          </div>
        )}
        {ghostRow && (
          <div className="ghost-row" aria-hidden="true">
            <span className="tag">The first one looks like this</span>
            <div className="row">{ghostRow}</div>
          </div>
        )}
      </div>
    );
  return (
    <p className={`empty row${className ? ` ${className}` : ""}`}>
      {spot && <Spot name={spot} size={22} />}
      <span className="muted grow">{text}</span>
      {action && <ActionButton action={action} primary={false} />}
    </p>
  );
}

/** The sentence for a server that cannot be reached, with a retry. */
export function OfflineState({ online, onRetry }: { online: boolean; onRetry?: () => void }) {
  return (
    <EmptyState
      text={online ? "Henosis cannot reach its server right now." : "You are offline."}
      action={onRetry ? { label: "Retry", onClick: onRetry } : null}
    />
  );
}

// ---- the demo session --------------------------------------------------------------------

/** The project the demo session is created in: the server's own default. */
export const DEMO_PROJECT = "default";

export function demoSessionId(userId: string): string {
  return `demo-${slugify(userId) || "you"}`;
}

/** Opening the session route creates it on join: `demo-<user>` in the default project. */
export function openDemoSession(userId: string, projectId: string = DEMO_PROJECT): void {
  navigate(paths.session(projectId, demoSessionId(userId)));
}

export function DemoRow({
  userId,
  projectId = DEMO_PROJECT,
}: {
  userId: string;
  projectId?: string;
}) {
  return (
    <button
      type="button"
      className="rowitem new"
      onClick={() => openDemoSession(userId, projectId)}
    >
      <span className="row">
        <Icon d={ICONS.play} size={14} />
        Try the demo session
      </span>
      <span className="small faint mono">{demoSessionId(userId)}</span>
    </button>
  );
}

// ---- offline -------------------------------------------------------------------------------

/** What the browser says about the network; true when it does not know. */
export function useOnline(): boolean {
  const [on, setOn] = useState(() => {
    try {
      return navigator.onLine !== false;
    } catch {
      return true;
    }
  });
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    addEventListener("online", up);
    addEventListener("offline", down);
    return () => {
      removeEventListener("online", up);
      removeEventListener("offline", down);
    };
  }, []);
  return on;
}

/** True when the browser is offline, or a connection has stayed down for `after` ms. */
export function useOffline(connected: boolean, after = 4000): boolean {
  const online = useOnline();
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (connected) {
      setStale(false);
      return;
    }
    const t = setTimeout(() => setStale(true), after);
    return () => clearTimeout(t);
  }, [connected, after]);
  return !online || (!connected && stale);
}
