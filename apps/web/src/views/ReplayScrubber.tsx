/**
 * The replay scrubber: a thin row under the top row with one dot per turn. Hidden until
 * hovered, or pinned from the details drawer. Dragging folds the session up to that turn in
 * the client; the newest dot is now.
 */
import type { SessionState } from "@fold/kernel";
import type { SessionEvent } from "@fold/protocol";
import { type KeyboardEvent, type PointerEvent, useMemo, useRef } from "react";
import { foldUpTo, markIndexOf, type TurnMark, turnMarks, viewingLabel } from "../replay.js";

/** The stream to show: live when `viewSeq` is null, otherwise the log folded up to it. */
export function useReplay(
  events: SessionEvent[],
  state: SessionState | null,
  viewSeq: number | null,
): { events: SessionEvent[]; state: SessionState | null; marks: TurnMark[] } {
  const marks = useMemo(() => turnMarks(events), [events]);
  const view = useMemo(
    () => (viewSeq === null ? { events, state } : foldUpTo(events, viewSeq)),
    [events, state, viewSeq],
  );
  return { ...view, marks };
}

export function ReplayScrubber({
  marks,
  viewSeq,
  pinned,
  onView,
}: {
  marks: TurnMark[];
  viewSeq: number | null;
  pinned: boolean;
  /** `null` returns to now. */
  onView: (seq: number | null) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const n = marks.length;
  const at = markIndexOf(marks, viewSeq);
  const viewing = viewSeq !== null;
  if (n === 0) return null;
  const pick = (i: number) => {
    const idx = Math.max(0, Math.min(n - 1, i));
    const mark = marks[idx];
    onView(idx === n - 1 || !mark ? null : mark.endSeq);
  };
  const pickAt = (clientX: number) => {
    const el = track.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = r.width > 0 ? (clientX - r.left) / r.width : 1;
    pick(Math.round(f * (n - 1)));
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pickAt(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return;
    pickAt(e.clientX);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === "ArrowLeft" || e.key === "ArrowDown"
        ? -1
        : e.key === "ArrowRight" || e.key === "ArrowUp"
          ? 1
          : 0;
    if (step) pick(at + step);
    else if (e.key === "Home") pick(0);
    else if (e.key === "End") pick(n - 1);
    else return;
    e.preventDefault();
  };
  return (
    <div className={`scrubber${pinned || viewing ? " on" : ""}`}>
      <div
        ref={track}
        className="track"
        role="slider"
        tabIndex={0}
        aria-label="Turn"
        aria-valuemin={1}
        aria-valuemax={n}
        aria-valuenow={at + 1}
        aria-valuetext={`Turn ${at + 1} of ${n}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
      >
        {marks.map((m, i) => (
          <span
            key={m.startSeq}
            className={`tick${i < at ? " seen" : ""}${i === at ? " at" : ""}`}
            title={`Turn ${i + 1}`}
          />
        ))}
      </div>
      <span className="label">
        {viewing ? (
          <>
            {viewingLabel(at, n)} ·{" "}
            <button type="button" className="linkish" onClick={() => onView(null)}>
              Return to now
            </button>
          </>
        ) : (
          `${n} turn${n === 1 ? "" : "s"}`
        )}
      </span>
    </div>
  );
}

/** The drawer's switch for the scrubber. */
export function ReplayToggle({ pinned, onToggle }: { pinned: boolean; onToggle: () => void }) {
  return (
    <section className="group">
      <h3>Time travel</h3>
      <p className="muted small">Scrub back through the agent's turns; nothing is sent.</p>
      <button type="button" className="btn sm" aria-pressed={pinned} onClick={onToggle}>
        {pinned ? "Hide scrubber" : "Show scrubber"}
      </button>
    </section>
  );
}
