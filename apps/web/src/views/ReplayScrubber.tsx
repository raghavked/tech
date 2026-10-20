/**
 * The replay scrubber (replay-scrubber): a row under the title bar with one dot per turn on a
 * hairline. At rest it is 36 px of dots; pinned from Details or while viewing it grows to the
 * 64 px track with the plan steps as spans above the line and the times beneath. The viewed dot
 * is ringed in apricot, now pulses with "NOW" in ink and an apricot dot beside it, a release
 * gate is a hollow diamond. The hovered turn previews in the left label (its time takes the
 * viewed time's place in the times row) and snaps back; the only action on the row is a
 * chocolate "Return to now". Dragging folds the session up to that turn
 * in the client; arrow keys and End move the view.
 */
import type { SessionState } from "@henosis/kernel";
import type { SessionEvent } from "@henosis/protocol";
import { type KeyboardEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { copy } from "../copy.js";
import {
  foldUpTo,
  markIndexOf,
  stepSpans,
  type TurnMark,
  turnMarks,
  viewingLabel,
} from "../replay.js";
import { timeOf } from "../stream/clock.js";
import { ICONS, Icon } from "../ui.js";

/** The stream to show: live when `viewSeq` is null, otherwise the log folded up to it. */
export function useReplay(
  events: SessionEvent[],
  state: SessionState | null,
  viewSeq: number | null,
): { events: SessionEvent[]; state: SessionState | null; marks: TurnMark[] } {
  const marks = useMemo(
    () => turnMarks(events, state, (id) => state?.participants[id]?.actor.name ?? id),
    [events, state],
  );
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
  steps = [],
  onView,
}: {
  marks: TurnMark[];
  viewSeq: number | null;
  pinned: boolean;
  /** The active plan's step titles, for the spans above the track. */
  steps?: readonly string[];
  /** `null` returns to now. */
  onView: (seq: number | null) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const n = marks.length;
  const at = markIndexOf(marks, viewSeq);
  const viewing = viewSeq !== null;
  const on = pinned || viewing;
  // The preview snaps back a moment after the pointer leaves.
  useEffect(() => {
    if (hover === null) return;
    const t = setTimeout(() => setHover(null), 1500);
    return () => clearTimeout(t);
  }, [hover]);
  if (n === 0) return null;
  const pick = (i: number) => {
    const idx = Math.max(0, Math.min(n - 1, i));
    const mark = marks[idx];
    onView(idx === n - 1 || !mark ? null : mark.endSeq);
  };
  const indexAt = (clientX: number): number => {
    const el = track.current;
    if (!el) return n - 1;
    const r = el.getBoundingClientRect();
    const inner = Math.max(1, r.width - 12);
    const f = (clientX - r.left - 6) / inner;
    return Math.round(Math.max(0, Math.min(1, f)) * (n - 1));
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pick(indexAt(e.clientX));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const i = indexAt(e.clientX);
    if (e.buttons === 0) {
      if (i !== hover) setHover(i);
      return;
    }
    pick(i);
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
  const pos = (i: number) => `${n > 1 ? (i / (n - 1)) * 100 : 100}%`;
  const spans = stepSpans(marks, steps);
  const hovered = hover !== null && hover !== at ? marks[hover] : null;
  const viewed = marks[at];
  const when = (m: TurnMark | undefined) => (m ? timeOf(m.eventId) : null);
  const label = (m: TurnMark) =>
    [copy.stream.turn(m.turn).replace(/^t/, "T"), when(m), m.what].filter(Boolean).join(" · ");
  const first = marks[0];
  return (
    <section
      className={`scrubber${on ? " on" : " rest"}${viewing ? " viewing" : ""}${pinned ? " pinned" : ""}`}
      aria-label={copy.replay.label}
    >
      <div className="inner">
        <div className={`viewing${hovered ? " preview" : ""}`}>
          {hovered ? (
            <span className="b">{label(hovered)}</span>
          ) : viewing ? (
            <>
              <b>{viewingLabel(at, n)}</b>
              <span className="at">
                {when(viewed) ? `${when(viewed)} · ` : ""}
                <i>{viewed?.what}</i>
              </span>
            </>
          ) : (
            <>
              <b>{copy.replay.turns(n)}</b>
              {on && (
                <span className="at">
                  {copy.stream.turn(n)} · {copy.replay.now}
                </span>
              )}
            </>
          )}
        </div>
        <div
          ref={track}
          className="track"
          role="slider"
          tabIndex={0}
          aria-label={copy.replay.slider}
          aria-valuemin={1}
          aria-valuemax={n}
          aria-valuenow={at + 1}
          aria-valuetext={copy.replay.valueText(at + 1, n)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKeyDown}
        >
          {on && spans.length > 0 && (
            <div className="steps" aria-hidden="true">
              {spans.map((sp) => {
                const from = n > 1 ? (sp.from / (n - 1)) * 100 : 0;
                const to = n > 1 ? (sp.to / (n - 1)) * 100 : 100;
                // A span stays inside the track: one near the right edge ends at its last turn.
                const width = Math.max(to - from, 8);
                const left = Math.min(from, 100 - width);
                const state = at > sp.to ? "done" : at >= sp.from ? "live" : "later";
                return (
                  <span
                    key={sp.index}
                    className={`pstep ${state}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    <span className="n">{sp.index + 1}</span>
                    <span className="lbl">{sp.title}</span>
                  </span>
                );
              })}
            </div>
          )}
          <div className="line" aria-hidden="true">
            <i style={{ width: pos(at) }} />
          </div>
          <div className="dots" aria-hidden="true">
            {marks.map((m, i) => (
              <span
                key={m.startSeq}
                className={`tick${i < at ? " seen" : ""}${i === at ? " at" : ""}${
                  i === n - 1 ? " now" : ""
                }${m.gate ? " gate" : ""}${i === hover ? " hover" : ""}`}
                title={label(m)}
              />
            ))}
          </div>
          {on && (
            <div className="times" aria-hidden="true">
              {first && n > 1 && (
                <span style={{ left: 0 }}>{when(first) ?? copy.stream.turn(first.turn)}</span>
              )}
              {viewing && viewed && !hovered && at > 0 && at < n - 1 && (
                <span className="here" style={{ left: pos(at) }}>
                  {when(viewed) ?? copy.stream.turn(viewed.turn)}
                </span>
              )}
              {hovered && hover !== null && hover > 0 && hover < n - 1 && (
                <span className="hov" style={{ left: pos(hover) }}>
                  {when(hovered) ?? copy.stream.turn(hovered.turn)}
                </span>
              )}
              <span className="now" style={{ left: "100%" }}>
                {copy.replay.nowLabel}
              </span>
            </div>
          )}
        </div>
        <div className="right">
          {viewing ? (
            <button type="button" className="btn primary sm" onClick={() => onView(null)}>
              <Icon d={ICONS.handoff} size={14} />
              {copy.composer.returnToNow}
            </button>
          ) : on ? (
            <span className="keys" aria-hidden="true">
              <kbd>←</kbd>
              <kbd>→</kbd> {copy.replay.oneTurn} <kbd>End</kbd> {copy.replay.backToNow}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** The drawer's Time travel section: the switch for the scrubber and the turns, step by step. */
export function ReplayToggle({
  pinned,
  onToggle,
  marks,
  viewSeq,
  onView,
  steps = [],
  turnTokens,
}: {
  pinned: boolean;
  onToggle: () => void;
  marks: TurnMark[];
  viewSeq: number | null;
  onView: (seq: number | null) => void;
  steps?: readonly string[];
  /** Tokens each turn spent, by turn number. */
  turnTokens: (turn: number) => string;
}) {
  const at = markIndexOf(marks, viewSeq);
  const groups: { step: number | null; title: string; items: { m: TurnMark; i: number }[] }[] = [];
  marks.forEach((m, i) => {
    const last = groups[groups.length - 1];
    if (last && last.step === m.stepIndex) last.items.push({ m, i });
    else
      groups.push({
        step: m.stepIndex,
        title: m.stepIndex === null ? "" : (steps[m.stepIndex] ?? ""),
        items: [{ m, i }],
      });
  });
  return (
    <section className="group" aria-label={copy.replay.title}>
      <h3>
        {copy.replay.title}
        <span className="sum">{marks.length ? copy.replay.turns(marks.length) : ""}</span>
      </h3>
      <label className="row switchrow">
        <span className="grow">{copy.replay.show}</span>
        <input
          type="checkbox"
          className="switch"
          role="switch"
          checked={pinned}
          aria-checked={pinned}
          onChange={onToggle}
        />
      </label>
      <p className="muted small">
        {copy.replay.hint} <kbd>←</kbd> <kbd>→</kbd> {copy.replay.oneTurn}, <kbd>End</kbd>{" "}
        {copy.replay.backToNow}.
      </p>
      {pinned && marks.length > 0 && (
        <ol className="turnlist">
          {groups.map((g) => (
            <li key={`${g.step}:${g.items[0]?.i}`} className="stepgroup">
              {g.step !== null && (
                <span className="kicker">
                  {copy.replay.step(g.step + 1)}
                  {g.title ? ` · ${g.title}` : ""}
                </span>
              )}
              {g.items.map(({ m, i }) => (
                <button
                  type="button"
                  key={m.startSeq}
                  className={`turn${i === at ? " at" : ""}${i > at ? " later" : ""}`}
                  aria-current={i === at ? "true" : undefined}
                  onClick={() => onView(i === marks.length - 1 ? null : m.endSeq)}
                >
                  <span className="n mono">{m.turn}</span>
                  <span className="what ellipsis">{m.what || copy.replay.now}</span>
                  <span className="tok mono">{turnTokens(m.turn)}</span>
                </button>
              ))}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
