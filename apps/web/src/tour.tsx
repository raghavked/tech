/**
 * The tour (tour, SCREENS.md §19, MOTION.md §10): five coach marks on the real session, in
 * order rail → stream → plan → gate → composer. One look-here layer: a navy dim (near-black in
 * dark) with one target left clear and lit by the apricot halo; one coach mark at a time with a
 * serif headline in the product's voice, Back / Next / Skip and the → ← esc keys; the
 * five-segment ring in the mark's corner closing one segment a step, its centre a dashed ghost
 * until "Close the ring" pops it and the toast says "Dee is in the circle."
 *
 * Nothing is moved or mocked: the targets are the page's own elements, scrolled into view
 * before the mark rises. The lit target stays live (a tour never blocks a vote); focus stays in
 * the coach mark; the dim is `aria-hidden`. An arriving approval ends the tour from the view.
 * It shows once, on the first session opened after the first run, and again from Settings.
 */
import type { SessionState } from "@henosis/kernel";
import { describeRule, ruleFor } from "@henosis/kernel";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { DEFAULT_RATING } from "./approvalsQueue.js";
import { PHONE_QUERY } from "./breakpoints.js";
import { copy } from "./copy.js";
import { ICONS, Icon, useMediaQuery } from "./ui.js";

// ---- when it shows ---------------------------------------------------------------------------

export const TOUR_KEY = "henosis.tour";
export type TourState = "pending" | "done";

export function tourState(): TourState | null {
  try {
    const v = localStorage.getItem(TOUR_KEY);
    return v === "pending" || v === "done" ? v : null;
  } catch {
    return null;
  }
}

function setTourState(v: TourState): void {
  try {
    localStorage.setItem(TOUR_KEY, v);
  } catch {
    // private mode: the tour runs from memory alone
  }
  for (const fn of listeners) fn();
}

const listeners = new Set<() => void>();

/** Settings · Take the tour, and the first run's "Open session": the next session opened starts it. */
export function requestTour(): void {
  setTourState("pending");
}

/** The first run asks once: a browser that has never done the tour gets it on its first session. */
export function requestTourIfNew(): void {
  if (tourState() === null) setTourState("pending");
}

export function finishTour(): void {
  setTourState("done");
}

export function tourPending(): boolean {
  return tourState() === "pending";
}

// ---- the five -------------------------------------------------------------------------------

export type TourStepId = "rail" | "stream" | "plan" | "gate" | "composer";

export interface TourStep {
  id: TourStepId;
  title: string;
  body: string;
  /** The apricot-wash tip under the body. */
  tip?: string;
  /** What the mark says when its target is not on the page. */
  missing?: string;
  /** The Next button's object ("the stream"); the last step closes the ring. */
  next: string | null;
  /** Where the mark sits against its target. */
  side: "right" | "below" | "above";
}

/** CSS selectors for each step's target, tried in order; the last match wins for stream cards. */
export const TOUR_TARGETS: Record<TourStepId, { selector: string; last?: boolean }> = {
  rail: { selector: ".sidebar.rail" },
  stream: { selector: 'section[aria-label="Conversation"] .msg' },
  plan: { selector: ".notice.plan", last: true },
  gate: { selector: ".notice[data-approval]" },
  composer: { selector: ".composer-wrap" },
};

/** The five coach marks, with the bodies reading this session's policy. */
export function tourStepsFor(s: SessionState): TourStep[] {
  const t = copy.tour;
  const gateRule = describeRule(ruleFor(s.policy.approvals, "irreversible"));
  return [
    { id: "rail", title: t.rail.title, body: t.rail.body, next: t.rail.next, side: "right" },
    {
      id: "stream",
      title: t.stream.title,
      body: t.stream.body,
      next: t.stream.next,
      side: "below",
    },
    {
      id: "plan",
      title: t.plan.title,
      body: s.policy.planFirst
        ? t.plan.body(s.policy.planApproval.min, s.policy.planApproval.average)
        : t.plan.bodyOff,
      tip: t.plan.tip,
      missing: t.plan.missing,
      next: t.plan.next,
      side: "below",
    },
    {
      id: "gate",
      title: t.gate.title,
      body: t.gate.body(gateRule, DEFAULT_RATING),
      tip: t.gate.tip,
      missing: t.gate.missing,
      next: t.gate.next,
      side: "below",
    },
    {
      id: "composer",
      title: t.composer.title,
      body: t.composer.body,
      next: null,
      side: "above",
    },
  ];
}

// ---- geometry -------------------------------------------------------------------------------

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The lit hole around a target: the target's box plus a little air, so the halo has an edge. */
export const HOLE_PAD = 6;
/** The coach mark's width on a desktop and the gap it keeps from its target. */
export const COACH_W = 352;
export const COACH_GAP = 14;
const EDGE = 16;

/** Where the coach mark sits for a target box, clamped to the viewport; centred when there is none. */
export function placeCoach(
  target: Box | null,
  viewport: { width: number; height: number },
  side: TourStep["side"],
  coach: { width: number; height: number },
): { left: number; top: number; caret: "left" | "up" | "down" | "none" } {
  const clampX = (x: number) => Math.max(EDGE, Math.min(x, viewport.width - coach.width - EDGE));
  const clampY = (y: number) => Math.max(EDGE, Math.min(y, viewport.height - coach.height - EDGE));
  if (!target)
    return {
      left: clampX((viewport.width - coach.width) / 2),
      top: clampY((viewport.height - coach.height) / 2),
      caret: "none",
    };
  if (side === "right") {
    const left = target.left + target.width + COACH_GAP;
    if (left + coach.width + EDGE <= viewport.width)
      return { left, top: clampY(target.top + 24), caret: "left" };
    return { left: clampX(left), top: clampY(target.top + target.height + COACH_GAP), caret: "up" };
  }
  const below = target.top + target.height + COACH_GAP;
  const above = target.top - coach.height - COACH_GAP;
  const fitsBelow = below + coach.height + EDGE <= viewport.height;
  const fitsAbove = above >= EDGE;
  const preferBelow = side === "below";
  if (preferBelow ? fitsBelow : !fitsAbove && fitsBelow)
    return { left: clampX(target.left), top: below, caret: "up" };
  if (fitsAbove) return { left: clampX(target.left), top: above, caret: "down" };
  // Neither side fits (a tall target): sit over its lower edge.
  return { left: clampX(target.left), top: clampY(below), caret: "none" };
}

/** The four rectangles of the dim around a hole; one whole-screen rectangle when there is no hole. */
export function dimRects(hole: Box | null, viewport: { width: number; height: number }): Box[] {
  if (!hole) return [{ left: 0, top: 0, width: viewport.width, height: viewport.height }];
  const l = Math.max(0, hole.left - HOLE_PAD);
  const t = Math.max(0, hole.top - HOLE_PAD);
  const r = Math.min(viewport.width, hole.left + hole.width + HOLE_PAD);
  const b = Math.min(viewport.height, hole.top + hole.height + HOLE_PAD);
  return [
    { left: 0, top: 0, width: viewport.width, height: t },
    { left: 0, top: b, width: viewport.width, height: Math.max(0, viewport.height - b) },
    { left: 0, top: t, width: l, height: Math.max(0, b - t) },
    { left: r, top: t, width: Math.max(0, viewport.width - r), height: Math.max(0, b - t) },
  ];
}

function findTarget(id: TourStepId): HTMLElement | null {
  const t = TOUR_TARGETS[id];
  const all = document.querySelectorAll<HTMLElement>(t.selector);
  if (!all.length) return null;
  return t.last ? (all[all.length - 1] ?? null) : (all[0] ?? null);
}

function boxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

// ---- the ring -------------------------------------------------------------------------------

const SEGMENTS = [
  "M16.84 4.03 A12 12 0 0 1 27.13 11.50",
  "M27.64 13.10 A12 12 0 0 1 23.71 25.19",
  "M22.36 26.18 A12 12 0 0 1 9.64 26.18",
  "M8.29 25.19 A12 12 0 0 1 4.36 13.10",
  "M4.87 11.50 A12 12 0 0 1 15.16 4.03",
];

/** The five-segment ring: apricot for the steps done, chocolate for now, a dashed ghost centre until the last. */
export function TourRing({ step, closed = false }: { step: number; closed?: boolean }) {
  return (
    <svg className="tour-ring" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
      {SEGMENTS.map((d, i) => (
        <path
          key={d}
          d={d}
          className={`seg${closed || i < step ? " on" : i === step ? " now" : ""}`}
        />
      ))}
      <circle className={closed ? "centre" : "ghost"} cx="16" cy="16" r="3.2" />
    </svg>
  );
}

// ---- the layer ------------------------------------------------------------------------------

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Tour({
  steps,
  onEnd,
}: {
  steps: TourStep[];
  /** `closed`: the ring closed; `skipped`: Skip or Esc. The view ends it itself on an approval. */
  onEnd: (how: "closed" | "skipped") => void;
}) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const [size, setSize] = useState({ width: COACH_W, height: 220 });
  const coach = useRef<HTMLElement>(null);
  const phone = useMediaQuery(PHONE_QUERY);
  const step = steps[Math.min(i, steps.length - 1)] as TourStep;
  const last = i >= steps.length - 1;

  // The target: scrolled into view first, then measured, and measured again as the page moves.
  useEffect(() => {
    let raf = 0;
    let el: HTMLElement | null = null;
    const measure = () => {
      raf = 0;
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      if (!el?.isConnected) el = phone && step.id === "rail" ? null : findTarget(step.id);
      setBox(el ? boxOf(el) : null);
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    el = phone && step.id === "rail" ? null : findTarget(step.id);
    if (el && step.id !== "rail" && step.id !== "composer")
      el.scrollIntoView({ block: "center", behavior: "auto" });
    queue();
    addEventListener("scroll", queue, true);
    addEventListener("resize", queue);
    return () => {
      removeEventListener("scroll", queue, true);
      removeEventListener("resize", queue);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [step.id, phone]);

  // The coach mark's own size, for placing it; its primary button takes focus on every step.
  // biome-ignore lint/correctness/useExhaustiveDependencies: measured again on every step
  useLayoutEffect(() => {
    const el = coach.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setSize((s) => (s.width === w && s.height === h ? s : { width: w, height: h }));
    el.querySelector<HTMLElement>(".foot .btn.primary")?.focus();
  }, [i, box]);

  const next = useCallback(() => {
    if (last) onEnd("closed");
    else setI((n) => n + 1);
  }, [last, onEnd]);
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);
  const skip = useCallback(() => onEnd("skipped"), [onEnd]);

  // → ← esc anywhere; Tab stays inside the mark (the dim is not live).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skip();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [next, back, skip]);
  const trap = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key !== "Tab" || !coach.current) return;
    const items = [...coach.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0] as HTMLElement;
    const lastItem = items[items.length - 1] as HTMLElement;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      lastItem.focus();
    } else if (!e.shiftKey && document.activeElement === lastItem) {
      e.preventDefault();
      first.focus();
    }
  };

  const place = phone ? null : placeCoach(box, viewport, step.side, size);
  const n = i + 1;
  return createPortal(
    <div className="lookhere" data-step={step.id}>
      <div className="lookhere-dim" aria-hidden="true">
        {dimRects(box, viewport).map((r, k) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: four fixed rectangles
            key={k}
            style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
          />
        ))}
        {box && (
          <div
            className="lookhere-spot"
            style={{
              left: box.left - HOLE_PAD,
              top: box.top - HOLE_PAD,
              width: box.width + HOLE_PAD * 2,
              height: box.height + HOLE_PAD * 2,
            }}
          />
        )}
      </div>
      <section
        ref={coach}
        className={`coach${place ? ` caret-${place.caret}` : " sheet"}`}
        role="dialog"
        aria-modal="true"
        aria-label={copy.tour.dialog(n, steps.length)}
        style={place ? { left: place.left, top: place.top, width: COACH_W } : undefined}
        onKeyDown={trap}
      >
        {phone && <span className="grab" aria-hidden="true" />}
        <div className="top">
          <TourRing step={i} />
          <span>{copy.tour.step(n, steps.length)}</span>
          <button type="button" className="skip" onClick={skip}>
            {copy.tour.skip}
          </button>
        </div>
        <h2 className="serif">{step.title}</h2>
        <p>{step.body}</p>
        {!box && step.missing && <p className="small faint">{step.missing}</p>}
        {step.tip && (
          <div className="tip">
            <Icon d={ICONS.star} size={15} />
            <span>{step.tip}</span>
          </div>
        )}
        <div className="foot">
          {i > 0 && (
            <button type="button" className="btn sm" onClick={back}>
              {copy.tour.back}
            </button>
          )}
          <button
            type="button"
            className={`btn primary sm${last ? " close-ring" : ""}`}
            onClick={next}
          >
            {last ? copy.tour.close : copy.tour.next(step.next ?? "")}
          </button>
          <span className="kbd mono">{copy.tour.keys}</span>
        </div>
      </section>
    </div>,
    document.body,
  );
}
