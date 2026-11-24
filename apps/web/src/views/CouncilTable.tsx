/**
 * The council's table (docs/19_council.md; design/henosis/explorations/sig-council-table): the
 * council room drawn as the table it is. The member models sit on a ring with the chair at
 * twelve, and each person sits beside their model; a person in the room without a model sits in
 * the gap between two seats. Every word a model said is an arc from its seat to the centre,
 * where the chair's plan forms: a dashed ghost while they deliberate, the apricot disc once the
 * plan is written, with each step's number at its owner's edge. The disc's rim is the mark's
 * two arcs: the models' words close the left one, the people's ratings the right one. A model
 * that holds a dissent opens the ring at its seat and steps back.
 *
 * The drawing is decoration over real structure: the seats are a list, each model's tile a
 * button named by its state ("Dee's agent, chair, agrees, answered round 2, Dee is in the
 * room") that goes to its latest word in the stream, and the line under the table is a polite
 * live region. Everything it shows comes from `councilTable` (council.ts); the geometry is
 * `tableGeometry` (councilGeometry.ts), laid out in CSS pixels for the width the table has.
 */
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { copy } from "../copy.js";
import type { CouncilTableView, TablePerson, TableSeat } from "../council.js";
import {
  arcPath,
  nameLines,
  polar,
  type SeatGeometry,
  type TableGeometry,
  tableGeometry,
  wordPath,
  wordSpread,
} from "../councilGeometry.js";

const T = copy.council.table;

/** The width the table has, measured before the first paint and whenever its box changes. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      setWidth(Math.round(el.clientWidth));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);
  return [ref, width] as const;
}

/**
 * Which of these keys arrived after the table was first drawn. The room opens as a finished
 * drawing; only what lands while it is open draws itself in, once. `known` is false while the
 * source of the keys has not answered yet (the chair's session, for the ratings): what it
 * first says was already so, and is not an arrival.
 */
function useArrivals(keys: string[], known = true) {
  const seen = useRef<Set<string> | null>(null);
  const late = useRef(new Set<string>());
  if (known && seen.current) for (const k of keys) if (!seen.current.has(k)) late.current.add(k);
  useEffect(() => {
    if (!known) return;
    const next = seen.current ?? new Set<string>();
    for (const k of keys) next.add(k);
    seen.current = next;
  });
  return (key: string) => late.current.has(key);
}

const px = (n: number) => Math.round(n * 100) / 100;

/** Does a line of the plan's small mono type clear the owners' marks on either side of it? */
const fitsBetweenMarks = (text: string, g: TableGeometry) =>
  (text.length * 6.6) / 2 <= g.markAt - g.markR - 3;

/** A person on the ring: the circle with their initial, presence, and their rating around it. */
function PersonMark({
  p,
  at,
  out,
  g,
  voting,
  bridged,
  popped,
}: {
  p: TablePerson;
  at: { x: number; y: number };
  out: { x: number; y: number };
  g: TableGeometry;
  voting: boolean;
  /** This person instructed the model beside them: the circle fills with the hand. */
  bridged: boolean;
  popped: boolean;
}) {
  const cls = [
    "ct-person",
    p.present ? "here" : "away",
    voting ? "voting" : "",
    p.waited ? "waited" : "",
    bridged ? "instructed" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <g className={cls} transform={`translate(${px(at.x)} ${px(at.y)})`}>
      <circle className="ct-pwait" r={g.ringR + 1} />
      <circle className="ct-ptrack" r={g.ringR} pathLength={5} transform="rotate(-90)" />
      <circle
        className="ct-prate"
        r={g.ringR}
        pathLength={5}
        transform="rotate(-90)"
        style={{ strokeDasharray: `${p.rating ?? 0} 5` }}
      />
      <circle className="ct-pcut" r={g.ringR} pathLength={5} transform="rotate(-90)" />
      <circle className="ct-pback" r={g.pr} />
      <circle className="ct-pfill" r={g.pr} />
      <text className="ct-pinit" y={0.5}>
        {p.initial}
      </text>
      {p.present && (
        <circle
          className="ct-phere"
          cx={px(-out.x * g.pr)}
          cy={px(-out.y * g.pr)}
          r={g.compact ? 3 : 3.75}
        />
      )}
      {p.rating !== null && (
        <g transform={`translate(${px(out.x * g.badgeAt)} ${px(out.y * g.badgeAt)})`}>
          <g className={`ct-badge${popped ? " enter" : ""}`}>
            <circle r={g.badgeR} />
            <text y={0.5}>{p.rating}</text>
          </g>
        </g>
      )}
    </g>
  );
}

/** A seat's label outside the ring: who it is, whose it is, what it holds. */
function SeatLabel({ seat, sg, g }: { seat: TableSeat; sg: SeatGeometry; g: TableGeometry }) {
  type Line = { cls: string; text: string; h: number; yours?: boolean };
  const lines: Line[] = [];
  const { nameChars, ownerChars } = sg.label;
  if (g.compact) {
    for (const text of nameLines(seat.member.name, nameChars, 2))
      lines.push({ cls: "ct-name", text, h: 16 });
  } else {
    const yours = seat.person?.me ?? false;
    if (seat.chair) lines.push({ cls: "ct-kicker", text: T.chair, h: 16 });
    lines.push({ cls: "ct-name", text: nameLines(seat.member.name, nameChars, 1)[0] ?? "", h: 22 });
    lines.push({
      cls: "ct-owner",
      text: seat.person
        ? (nameLines(
            copy.council.modelOf(seat.person.name),
            ownerChars - (yours ? T.yours.length + 1 : 0),
            1,
          )[0] ?? "")
        : copy.council.shared,
      h: 18,
      yours,
    });
    const word =
      seat.thinking === "plan"
        ? T.writing
        : seat.thinking === "answer"
          ? T.thinking
          : seat.dissent
            ? T.dissentWord
            : seat.stance
              ? copy.council.stance[seat.stance]
              : "";
    // the warn ink is for a model that holds out, never for one that is still thinking
    const warn = !seat.thinking && (seat.dissent !== null || seat.stance === "differ");
    if (word) lines.push({ cls: `ct-state${warn ? " differ" : ""}`, text: word, h: 16 });
  }
  const total = lines.reduce((n, l) => n + l.h, 0);
  const { x, y, anchor, side } = sg.label;
  // beside the ring a label leans away from the seat's person, who sits a step clockwise
  const lean = sg.ux > 0 ? -6 : 4;
  let top = side === "above" ? y - total : side === "below" ? y : y - total / 2 + lean;
  return (
    <g className="ct-label" textAnchor={anchor}>
      {lines.map((l) => {
        const base = top + l.h * 0.76;
        top += l.h;
        return (
          <text className={l.cls} x={px(x)} y={px(base)} key={`${l.cls}/${l.text}`}>
            {l.text}
            {l.yours && (
              <tspan className="ct-yours" dx={5}>
                {T.yours}
              </tspan>
            )}
          </text>
        );
      })}
    </g>
  );
}

export function CouncilTable({
  view,
  onSeat,
  onRate,
  instructHref,
}: {
  view: CouncilTableView;
  /** Go to this model's latest word in the stream. */
  onSeat: (key: string) => void;
  /** Go to the plan's rating control. */
  onRate: () => void;
  /** The instruct room of this person's own model, while the council runs. */
  instructHref: string | null;
}) {
  const [stage, width] = useWidth();
  const [focus, setFocus] = useState<string | null>(null);
  const n = view.seats.length;
  const g = width > 0 ? tableGeometry(width, n) : null;
  const planned = view.centre.kind === "plan";
  const arrived = useArrivals([
    ...view.seats.flatMap((s) => s.words.map((w) => `word/${s.key}/${w.seq}`)),
    ...view.seats.flatMap((s) => (s.instructed ? [`instructed/${s.key}`] : [])),
    ...(planned ? ["plan"] : []),
  ]);
  const rated = useArrivals(
    [
      ...view.seats.flatMap((s) => (s.person?.rating != null ? [s.person.userId] : [])),
      ...view.guests.flatMap((p) => (p.rating !== null ? [p.userId] : [])),
    ],
    view.voting,
  );
  const spread = wordSpread(n);
  const big = g ? g.rc >= 76 : false;

  const stepOf = (seat: TableSeat, sg: SeatGeometry): CSSProperties => ({
    transform: seat.dissent ? `translate(${px(sg.step.x)}px, ${px(sg.step.y)}px)` : "none",
  });
  const mine = (key: string) => (focus === key ? " mine" : "");

  return (
    <section
      className={`council-table${focus ? " dim" : ""}${g?.compact ? " compact" : ""}`}
      aria-label={T.name}
    >
      <div className="ct-now">
        <p className="ct-line" role="status">
          {view.line}
        </p>
        {(view.waitsForMe || instructHref) && (
          <div className="ct-acts">
            {view.waitsForMe && (
              <button type="button" className="btn primary sm" onClick={onRate}>
                {copy.rating.ratePlan}
              </button>
            )}
            {instructHref && view.mine && (
              <a className="btn sm" href={instructHref}>
                {copy.council.instructRoom(view.mine.name)}
              </a>
            )}
          </div>
        )}
      </div>
      <div className="ct-stage" ref={stage} style={g ? { height: g.height } : undefined}>
        {g && (
          <svg
            className="ct-drawing"
            viewBox={`0 0 ${g.width} ${g.height}`}
            width={g.width}
            height={g.height}
            aria-hidden="true"
            focusable="false"
          >
            <g className="ct-words">
              {view.seats.map((seat, i) => {
                const sg = g.seats[i];
                if (!sg) return null;
                const replies = seat.words.filter((w) => w.round === "discussion");
                return seat.words.map((w) => {
                  const alone = w.round === "individual";
                  const k = replies.indexOf(w);
                  const s = Math.max(4, spread - 7 * (replies.length - 1 - k));
                  const a0 = alone ? sg.a - 3 : sg.a - s;
                  const a1 = alone ? sg.a + Math.min(9, spread * 0.4) : sg.a + s;
                  const end = polar(g.cx, g.cy, a1, g.rimR + 6);
                  const tickA = polar(g.cx, g.cy, a1, g.rimR + 11);
                  const tickB = polar(g.cx, g.cy, a1, g.rimR + 2);
                  const late = arrived(`word/${seat.key}/${w.seq}`);
                  const cls = [
                    alone ? "alone" : "reply",
                    w.stance ?? "",
                    w.latest ? "latest" : "",
                    late ? "enter" : "",
                    focus === seat.key ? "mine" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <g key={`${seat.key}/${w.seq}`}>
                      <path
                        className={`ct-word ${cls}`}
                        pathLength={1}
                        d={wordPath(
                          g.cx,
                          g.cy,
                          a0,
                          a1,
                          alone ? g.r - 7 : g.r - 12,
                          g.rimR + 6,
                          alone ? 0 : 0.4,
                        )}
                      />
                      {w.stance === "agree" && (
                        <circle
                          className={`ct-wend ${cls}`}
                          cx={px(end.x)}
                          cy={px(end.y)}
                          r={2.8}
                        />
                      )}
                      {w.stance === "add" && (
                        <circle
                          className={`ct-wend ${cls}`}
                          cx={px(end.x)}
                          cy={px(end.y)}
                          r={3.6}
                        />
                      )}
                      {w.stance === "differ" && (
                        <path
                          className={`ct-wend ${cls}`}
                          d={`M${px(tickA.x)} ${px(tickA.y)} L${px(tickB.x)} ${px(tickB.y)}`}
                        />
                      )}
                    </g>
                  );
                });
              })}
            </g>

            <g className="ct-ring">
              {view.seats.map((seat, i) => {
                const sg = g.seats[i];
                if (!sg) return null;
                return (
                  <g key={seat.key}>
                    <path className={`ct-halo${seat.thinking ? " thinking" : ""}`} d={sg.seg} />
                    <path
                      className={`ct-seg${seat.dissent ? " gap" : seat.answeredNow ? " lit" : ""}${mine(seat.key)}`}
                      d={sg.seg}
                      pathLength={1}
                      style={{ strokeDasharray: seat.dissent ? ".15 .70 .15" : ".5 0 .5" }}
                    />
                    {sg.tick && (
                      <line
                        className="ct-tick"
                        x1={px(sg.tick[0].x)}
                        y1={px(sg.tick[0].y)}
                        x2={px(sg.tick[1].x)}
                        y2={px(sg.tick[1].y)}
                      />
                    )}
                  </g>
                );
              })}
            </g>

            <g className="ct-centre">
              {!planned && (
                <>
                  <circle
                    className="ct-ghost"
                    cx={g.cx}
                    cy={g.cy}
                    r={g.rc}
                    style={{ "--ct-words": px(view.wordsFraction) } as CSSProperties}
                  />
                  <GhostWords view={view} g={g} big={big} />
                </>
              )}
              {view.wordsFraction > 0 && (
                <circle className="ct-rim-track" cx={g.cx} cy={g.cy} r={g.rimR} />
              )}
              <path
                className={`ct-rim models${view.wordsFraction > 0 ? "" : " none"}`}
                d={arcPath(g.cx, g.cy, 180, 360, g.rimR)}
                pathLength={1}
                style={{ strokeDasharray: `${px(view.wordsFraction)} 1` }}
              />
              <path
                className={`ct-rim people${view.ratingsFraction > 0 ? "" : " none"}`}
                d={arcPath(g.cx, g.cy, 0, 180, g.rimR)}
                pathLength={1}
                style={{ strokeDasharray: `${px(view.ratingsFraction)} 1` }}
              />
              {view.centre.kind === "plan" && (
                <g className={`ct-plan${arrived("plan") ? " enter" : ""}`}>
                  <circle className="ct-disc" cx={g.cx} cy={g.cy} r={g.rc} />
                  {view.seats.map((seat, i) => {
                    const sg = g.seats[i];
                    if (!sg || seat.steps.length === 0) return null;
                    const natural = ((2 * g.markR + 3) / g.markAt) * (180 / Math.PI);
                    const sep = Math.min(natural, 360 / n / seat.steps.length);
                    return seat.steps.map((st, j) => {
                      const at = polar(
                        g.cx,
                        g.cy,
                        sg.a + (j - (seat.steps.length - 1) / 2) * sep,
                        g.markAt,
                      );
                      return (
                        <g transform={`translate(${px(at.x)} ${px(at.y)})`} key={st.n}>
                          <g className={`ct-mark${st.done ? " done" : ""}`}>
                            <circle r={g.markR} />
                            <text y={0.5}>{st.n}</text>
                          </g>
                        </g>
                      );
                    });
                  })}
                  <text className={`ct-ctext${big ? " big" : ""}`} x={g.cx} y={g.cy}>
                    <tspan className="t1" x={g.cx} dy={big ? -13 : -2}>
                      {T.thePlan}
                    </tspan>
                    {big && (
                      <tspan className="t2" x={g.cx} dy={18}>
                        {fitsBetweenMarks(T.steps(view.centre.steps, view.centre.owners), g)
                          ? T.steps(view.centre.steps, view.centre.owners)
                          : T.stepsOnly(view.centre.steps)}
                      </tspan>
                    )}
                    <tspan className="t3" x={g.cx} dy={big ? 21 : 14}>
                      {big ? view.centre.state : view.centre.short}
                    </tspan>
                  </text>
                </g>
              )}
            </g>

            <g className="ct-people">
              {view.seats.map((seat, i) => {
                const sg = g.seats[i];
                if (!sg) return null;
                const bridged = seat.instructed && (seat.person?.me ?? false);
                return (
                  <g className={`ct-seat${mine(seat.key)}`} style={stepOf(seat, sg)} key={seat.key}>
                    {bridged && (
                      <path
                        className={`ct-bridge${arrived(`instructed/${seat.key}`) ? " enter" : ""}`}
                        pathLength={1}
                        d={`M${px(sg.person.x)} ${px(sg.person.y)} L${px(sg.x)} ${px(sg.y)}`}
                      />
                    )}
                    {seat.person && (
                      <PersonMark
                        p={seat.person}
                        at={sg.person}
                        out={sg.person.out}
                        g={g}
                        voting={view.voting}
                        bridged={bridged}
                        popped={rated(seat.person.userId)}
                      />
                    )}
                    <SeatLabel seat={seat} sg={sg} g={g} />
                  </g>
                );
              })}
              {view.guests.map((p, j) => {
                const sg = g.seats[(n - 1 - j + n) % n];
                if (!sg) return null;
                return (
                  <g className="ct-seat guest" key={p.userId}>
                    <PersonMark
                      p={p}
                      at={sg.gap}
                      out={sg.gap.out}
                      g={g}
                      voting={view.voting}
                      bridged={false}
                      popped={rated(p.userId)}
                    />
                  </g>
                );
              })}
            </g>
          </svg>
        )}
        {/* biome-ignore lint/a11y/noRedundantRoles: Safari drops the list role from a list drawn without markers */}
        <ol className="ct-seats" role="list" aria-label={T.seats}>
          {view.seats.map((seat, i) => {
            const sg = g?.seats[i];
            const style: CSSProperties | undefined = sg
              ? ({
                  left: px(sg.x),
                  top: px(sg.y),
                  "--ct-tile": `${sg.tile}px`,
                  "--ct-step-x": seat.dissent ? `${px(sg.step.x)}px` : "0px",
                  "--ct-step-y": seat.dissent ? `${px(sg.step.y)}px` : "0px",
                } as CSSProperties)
              : undefined;
            return (
              <li
                className={`ct-tile-seat${seat.chair ? " chair" : ""}${mine(seat.key)}`}
                style={style}
                key={seat.key}
              >
                <button
                  type="button"
                  className="ct-tile"
                  aria-label={seat.label}
                  title={seat.label}
                  onClick={() => onSeat(seat.key)}
                  onMouseEnter={() => setFocus(seat.key)}
                  onMouseLeave={() => setFocus(null)}
                  onFocus={() => setFocus(seat.key)}
                  onBlur={() => setFocus(null)}
                >
                  {seat.instructed && !seat.person?.me && <i className="ct-pip" />}
                </button>
              </li>
            );
          })}
          {view.guests.map((p) => (
            <li className="sr-only" key={p.userId}>
              {p.label}
            </li>
          ))}
          {view.more > 0 && <li className="sr-only">{T.more(view.more)}</li>}
        </ol>
      </div>
      {/* a margin note for one dissent or two; past that the line over the table names them */}
      {view.dissent.length > 0 && view.dissent.length <= 2 && (
        <div className="ct-dissent">
          <span className="ct-dk">{copy.council.dissent}</span>
          {view.dissent.map((d) => (
            <p key={d.key}>
              <span className="serif">{copy.council.dissentBy(d.name)}</span>
              <span className="ct-dt"> · {d.text}</span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

/** The centre before the plan: what it waits for, in two short lines and a count. */
function GhostWords({ view, g, big }: { view: CouncilTableView; g: TableGeometry; big: boolean }) {
  const c = view.centre;
  const lines =
    c.kind === "writing"
      ? big
        ? T.chairWrites(nameLines(c.chair, 18, 1)[0] ?? c.chair)
        : T.chairWritesShort
      : c.kind === "none"
        ? T.noPlan
        : T.forming;
  const count =
    c.kind === "writing"
      ? T.wordsRead(c.wordsIn)
      : c.kind === "forming"
        ? T.wordsIn(c.wordsIn, c.wordsExpected)
        : "";
  const lh = big ? 19 : 14;
  return (
    <>
      <text className={`ct-gtext${big ? " big" : ""}`} x={g.cx} y={g.cy - (big ? 8 : 2)}>
        {lines.map((l, i) => (
          <tspan x={g.cx} dy={i === 0 ? 0 : lh} key={l}>
            {l}
          </tspan>
        ))}
      </text>
      {big && count && (
        <text className="ct-gcount" x={g.cx} y={g.cy + 36}>
          {count}
        </text>
      )}
    </>
  );
}
