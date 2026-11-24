/**
 * The rating as a dial (sig-approval-dial): the one rating shape in the product. A rim of five
 * stops over 240°, each a radio named "4 of 5, Good"; the gate's bar cut into the rim as a notch
 * with the band past it washed apricot; the team's average so far as a thin needle from the
 * centre; your hand the chocolate knob and its pointer, resting dashed at the rating a plain
 * Approve sends until you turn it.
 *
 * `Dial` is the face a release gate is rated on (the stream's notice, the queue's open row and
 * sheet). `MiniDial` is the same drawing small: with `onChange` the compact control on the plan
 * card, the queue's rows and the inbox; without it the 36 × 28 glyph beside a rater's number.
 * Both controls are one radiogroup with a roving tabindex: arrows move, Home and End jump, Space
 * and Enter pick, 1–5 pick at once, 0 clears. On the big face a click picks the nearest word
 * and a drag turns the hand with a detent at each stop.
 */
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { copy, DEFAULT_RATING } from "../copy.js";
import { ICONS, Icon, ratingLevel } from "../ui.js";

/** What a gate has so far against what its rule needs: `ratingProgress()`'s shape. */
export interface DialGate {
  count: number;
  min: number;
  average: number;
  bar: number;
}

const STOPS = [1, 2, 3, 4, 5] as const;
/** Five stops over 240°, 0° at twelve: the first at −120°, 60° apart. */
const A0 = -120;
const STEP = 60;
const SWEEP = 240;
const degOf = (v: number) => A0 + (v - 1) * STEP;
const clampStop = (v: number) => Math.min(5, Math.max(1, Math.round(v)));
const round2 = (n: number) => Math.round(n * 100) / 100;

interface Face {
  w: number;
  h: number;
  cx: number;
  cy: number;
  r: number;
}
/** The gate's face, the compact control and the glyph: one geometry at three radii. */
const BIG: Face = { w: 360, h: 212, cx: 180, cy: 136, r: 100 };
const SMALL: Face = { w: 112, h: 74, cx: 56, cy: 48, r: 34 };
const GLYPH: Face = { w: 36, h: 28, cx: 18, cy: 16, r: 11 };

function pt(f: Face, deg: number, r: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [round2(f.cx + r * Math.cos(a)), round2(f.cy + r * Math.sin(a))];
}

function arc(f: Face, from: number, to: number, r = f.r): string {
  const [x1, y1] = pt(f, from, r);
  const [x2, y2] = pt(f, to, r);
  return `M${x1} ${y1} A${r} ${r} 0 ${Math.abs(to - from) > 180 ? 1 : 0} ${to > from ? 1 : 0} ${x2} ${y2}`;
}

/** A bar the rim can carry: inside the scale, or nothing to draw. */
const barOf = (gate: DialGate | null | undefined): number | null =>
  gate && gate.bar >= 1 && gate.bar <= 5 ? gate.bar : null;

/** The four properties the drawing moves by: the hand, the fill, the preview and the needle. */
function dialVars(
  hand: number | null,
  fill: number | null,
  preview: number | null,
  gate: DialGate | null | undefined,
): CSSProperties {
  return {
    "--deg": `${degOf(hand ?? DEFAULT_RATING)}deg`,
    "--len": fill === null ? 0 : (fill - 1) * STEP,
    "--plen": preview === null ? 0 : (preview - 1) * STEP,
    "--avg-deg": `${degOf(gate?.count ? gate.average : DEFAULT_RATING)}deg`,
  } as CSSProperties;
}

// ---- the radios: one behaviour for the face and the compact control ------------------------

interface RadioProps {
  value: number | null;
  /** Where the hand rests, and where Tab lands, before a pick: the rating a plain Approve sends. */
  rest: number | null;
  locked: boolean;
  onChange: (n: number) => void;
  onClear?: (() => void) | undefined;
  onPreview?: ((n: number | null) => void) | undefined;
}

function useRadios({ value, rest, locked, onChange, onClear, onPreview }: RadioProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [preview, setPreviewState] = useState<number | null>(null);
  const [clicked, setClicked] = useState<number | null>(null);
  // The detent's pop is a class on a timer, never `animationend`: under Calm that event never fires.
  useEffect(() => {
    if (clicked === null) return;
    const t = setTimeout(() => setClicked(null), 200);
    return () => clearTimeout(t);
  }, [clicked]);
  const setPreview = (n: number | null) => {
    if (locked) return;
    setPreviewState(n);
    onPreview?.(n);
  };
  const pick = (n: number) => {
    if (locked) return;
    setClicked(n);
    if (n !== value) onChange(n);
  };
  const onKey = (e: ReactKeyboardEvent<HTMLButtonElement>, n: number) => {
    if (locked || e.metaKey || e.ctrlKey || e.altKey) return;
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
        pick(n);
        break;
      case "0":
        if (!onClear) return;
        onClear();
        break;
      default:
        if (!/^[1-5]$/.test(e.key)) return;
        pick(Number(e.key));
        refs.current[Number(e.key) - 1]?.focus();
    }
    // The key is the dial's: the card and the page behind it rate with 1–5 too.
    e.preventDefault();
    e.stopPropagation();
    if (next !== null) refs.current[next - 1]?.focus();
  };
  const radio = (n: number) => ({
    type: "button" as const,
    role: "radio" as const,
    ref: (el: HTMLButtonElement | null) => {
      refs.current[n - 1] = el;
    },
    "aria-checked": value === n,
    "aria-label": copy.rating.name(n),
    "aria-disabled": locked || undefined,
    tabIndex: n === (value ?? rest ?? 1) ? 0 : -1,
    onKeyDown: (e: ReactKeyboardEvent<HTMLButtonElement>) => onKey(e, n),
    onFocus: () => setPreview(n),
    onBlur: () => setPreview(null),
    onPointerEnter: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.pointerType !== "touch") setPreview(n);
    },
    onPointerLeave: () => setPreview(null),
  });
  return { preview: locked ? null : preview, clicked, pick, radio, setClicked };
}

/** Where a radio sits over the drawing, as a share of the face. */
const place = (f: Face, deg: number, r: number): CSSProperties => {
  const [x, y] = pt(f, deg, r);
  return { left: `${(x / f.w) * 100}%`, top: `${(y / f.h) * 100}%` };
};

// ---- the face a gate is rated on ------------------------------------------------------------

/**
 * While the hand is dragged it shows `s + 4·d³` of the finger's value (`s` the nearest stop, `d`
 * the distance to it): flat at each word, quick between words, continuous at the half-way points.
 */
const detent = (v: number) => {
  const s = Math.round(v);
  const d = v - s;
  return s + 4 * d * d * d;
};

/** A bar within ten degrees of a stop shares that stop's tick and word. */
const onStop = (bar: number) => Math.abs(bar - Math.round(bar)) < 0.17;

/** Where the bar's label goes: outside the notch, or with the word when the bar is a stop. */
function barLabel(bar: number): { x: number; y: number; anchor: "start" | "middle" | "end" } {
  if (onStop(bar)) {
    const d = degOf(Math.round(bar));
    const [x, y] = pt(BIG, d, BIG.r + 26);
    if (d === 0) return { x: x + 24, y: y - 2, anchor: "start" };
    return { x, y: y - 13, anchor: d < 0 ? "end" : "start" };
  }
  const [x, y] = pt(BIG, degOf(bar), BIG.r + 24);
  return { x, y: y + 4, anchor: "middle" };
}

export function Dial({
  value,
  onChange,
  onClear,
  onPreview,
  gate = null,
  rest = DEFAULT_RATING,
  label = copy.rating.yourRating,
  size = "md",
  readonly = false,
}: {
  /** The pick; null while the hand rests. */
  value: number | null;
  onChange: (n: number) => void;
  /** `0` clears the pick when the owner can hold "no rating". */
  onClear?: (() => void) | undefined;
  /** The stop under the pointer or the focus, for the word beside the face. */
  onPreview?: ((n: number | null) => void) | undefined;
  /** The ratings in so far and the rule's bar: the needle, the notch and the band past it. */
  gate?: DialGate | null;
  /** Where the hand rests before a pick; null draws no hand (a reader who cannot rate). */
  rest?: number | null;
  label?: string;
  /** `sm` is the queue's open row: the same face at 260 px. */
  size?: "md" | "sm";
  /** Sent: the hand stays where it was put and the check is drawn in the knob. */
  readonly?: boolean;
}) {
  const reads = useId();
  const face = useRef<HTMLDivElement | null>(null);
  const press = useRef<{ x: number; y: number; id: number } | null>(null);
  const crossed = useRef<number | null>(null);
  const dragged = useRef(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [pressing, setPressing] = useState(false);
  const { preview, clicked, pick, radio, setClicked } = useRadios({
    value,
    rest,
    locked: readonly,
    onChange,
    onClear,
    onPreview,
  });
  const bar = barOf(gate);
  const hand = value ?? rest;
  const previewing = preview !== null && preview !== value && drag === null;

  /** The pointer as a value on the scale, or null inside the knob where an angle means nothing. */
  const valueAt = (e: { clientX: number; clientY: number }, inner: number): number | null => {
    const box = face.current?.getBoundingClientRect();
    if (!box?.width) return null;
    const x = ((e.clientX - box.left) / box.width) * BIG.w - BIG.cx;
    const y = ((e.clientY - box.top) / box.height) * BIG.h - BIG.cy;
    if (Math.hypot(x, y) < inner) return null;
    // 0° at twelve, clockwise; the gap at the bottom resolves to the nearer end.
    const deg = Math.max(A0, Math.min(A0 + SWEEP, (Math.atan2(x, -y) * 180) / Math.PI));
    return 1 + (deg - A0) / STEP;
  };
  const cross = (n: number) => {
    crossed.current = n;
    setClicked(n);
    if (n !== value) onChange(n);
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (readonly || e.button > 0) return;
    press.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dragged.current = false;
    setPressing(true);
  };
  const endPress = () => {
    press.current = null;
    crossed.current = null;
    setPressing(false);
    setDrag(null);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    // The button came up somewhere the face could not hear it: the press is over.
    if (e.buttons === 0) {
      endPress();
      return;
    }
    if (drag === null && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return;
    const v = valueAt(e, 18);
    if (v === null) return;
    if (drag === null) {
      // A turn, not a tap: the face keeps the pointer until it lifts.
      try {
        face.current?.setPointerCapture(e.pointerId);
      } catch {
        // the pointer already left
      }
      dragged.current = true;
      onPreview?.(null);
    }
    setDrag(detent(v));
    const stop = clampStop(v);
    if (stop !== crossed.current) {
      cross(stop);
      try {
        navigator.vibrate?.(6);
      } catch {
        // no haptics here
      }
    }
  };
  // A click on a word, the rim or the band picks the nearest stop; a turn already picked.
  const onClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    if (readonly) return;
    const v = valueAt(e, 46);
    if (v !== null) pick(clampStop(v));
  };

  const cls = [
    "dial",
    size === "sm" ? "sm" : "",
    hand === null ? "nohand" : value === null && drag === null ? "rest" : "",
    previewing ? "previewing" : "",
    drag !== null ? "dragging" : "",
    pressing ? "pressing" : "",
    readonly ? "locked" : "",
    readonly && value !== null ? "sent" : "",
    gate?.count ? "" : "noavg",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={cls}
      role="radiogroup"
      aria-label={label}
      aria-describedby={gate ? reads : undefined}
      style={dialVars(drag ?? hand, drag ?? value, previewing ? preview : null, gate)}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the face is the drag surface; the five radios on it are the controls */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the radios carry the keys */}
      <div
        className="face"
        ref={face}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPress}
        onPointerCancel={endPress}
        onPointerLeave={() => {
          if (drag === null) endPress();
        }}
        onClick={onClick}
      >
        <Drawing bar={bar} cur={value} pre={preview} click={clicked} />
        {STOPS.map((n) => (
          // biome-ignore lint/a11y/useSemanticElements: a stop is drawn on the rim; the group is the radio control
          <button
            key={n}
            {...radio(n)}
            className="stop"
            style={place(BIG, degOf(n), BIG.r + 6)}
            onClick={(e) => {
              e.stopPropagation();
              if (dragged.current) dragged.current = false;
              else pick(n);
            }}
          />
        ))}
      </div>
      {!readonly && (
        <span className="dial-keys" aria-hidden="true">
          <span className="fine">{onClear ? copy.rating.keysClear : copy.rating.keys}</span>
          <span className="coarse">{copy.rating.touch}</span>
        </span>
      )}
      {gate && (
        <span className="sr-only" id={reads}>
          {copy.rating.reads(gate.count, gate.min, gate.average, gate.bar)}
        </span>
      )}
    </div>
  );
}

/** The class a stop's mark wears: the pick, the preview, the detent's pop. */
const markClass = (n: number, cur: number | null, pre: number | null, click: number | null) =>
  `dstop${cur === n ? " picked" : ""}${pre === n ? " near" : ""}${click === n ? " click" : ""}`;

/** The face's drawing: placed by the one geometry, moved by the four properties on the dial. */
function Drawing({
  bar,
  cur,
  pre,
  click,
}: {
  bar: number | null;
  cur: number | null;
  pre: number | null;
  click: number | null;
}) {
  const f = BIG;
  const end = A0 + SWEEP;
  return (
    <svg viewBox={`0 0 ${f.w} ${f.h}`} aria-hidden="true" focusable="false">
      {bar !== null && bar < 5 && <path className="band" d={arc(f, degOf(bar), end)} />}
      <path className="fill" d={arc(f, A0, end)} pathLength={SWEEP} />
      <path className="pre" d={arc(f, A0, end)} pathLength={SWEEP} />
      <path className="rim" d={arc(f, A0, end)} />
      {bar !== null && <Notch bar={bar} />}
      <g className="needle-g">
        <line className="needle-halo" {...seg(f, 0, 30, f.r - 8)} />
        <line className="needle" {...seg(f, 0, 30, f.r - 8)} />
        <circle className="needle-cap" cx={f.cx} cy={f.cy - (f.r - 8)} r={2.5} />
      </g>
      {STOPS.map((n) => {
        const d = degOf(n);
        const [lx, ly] = pt(f, d, f.r + 26);
        const [nx, ny] = pt(f, d, f.r - 22);
        return (
          <g className={markClass(n, cur, pre, click)} key={n}>
            <line className="tick" {...seg(f, d, f.r - 7, f.r + 7)} />
            <text
              className="label"
              x={lx}
              y={ly + (d === 0 ? -2 : 5)}
              textAnchor={d < 0 ? "end" : d > 0 ? "start" : "middle"}
            >
              {copy.rating.word(n)}
            </text>
            <text className="num" x={nx} y={ny + 3.5} textAnchor="middle">
              {n}
            </text>
          </g>
        );
      })}
      <circle className="knob" cx={f.cx} cy={f.cy} r={22} />
      <g className="hand">
        <line className="pointer" {...seg(f, 0, 28, f.r - 31)} />
        <line className="slot" {...seg(f, 0, 7, 17)} />
      </g>
      <path className="check" d={`M${f.cx - 8} ${f.cy + 1} l6 6 l11 -13`} />
    </svg>
  );
}

/**
 * The rule's bar on the rim: a cut through it, a V and "bar 3.5". Between two stops the V dents
 * the rim; on a stop it stands just outside the tick it shares the angle with.
 */
function Notch({ bar }: { bar: number }) {
  const f = BIG;
  const deg = degOf(bar);
  const lift = onStop(bar) ? 9 : 0;
  const at = barLabel(bar);
  const v = [
    pt(f, deg - 2.6, f.r + 7 + lift),
    pt(f, deg, f.r - 3 + lift),
    pt(f, deg + 2.6, f.r + 7 + lift),
  ];
  return (
    <>
      <line className="cut" {...seg(f, deg, f.r - 9, f.r + 9)} />
      <path className="notch" d={`M${v.map((p) => p.join(" ")).join(" L")}`} />
      <text className="bar-label" x={at.x} y={at.y} textAnchor={at.anchor}>
        {copy.rating.bar(bar)}
      </text>
    </>
  );
}

/** A radial stroke at `deg` from `r1` to `r2`. */
function seg(f: Face, deg: number, r1: number, r2: number) {
  const [x1, y1] = pt(f, deg, r1);
  const [x2, y2] = pt(f, deg, r2);
  return { x1, y1, x2, y2 };
}

// ---- the same dial, small -------------------------------------------------------------------

/**
 * With `onChange`: the compact control (a radiogroup, 112 × 74) with the word beside it. Without:
 * the 36 × 28 glyph that stands beside a rating someone gave; the number next to it carries the
 * value for readers, so the glyph is hidden from them.
 */
export function MiniDial({
  value,
  onChange,
  onClear,
  gate = null,
  rest = null,
  label = copy.rating.yourRating,
  word = true,
  idle = "",
  readonly = false,
  kind = "",
}: {
  value: number | null;
  onChange?: ((n: number) => void) | undefined;
  onClear?: (() => void) | undefined;
  gate?: DialGate | null;
  /** Where the hand rests before a pick: a gate's default. A plan has none, so no hand is drawn. */
  rest?: number | null;
  label?: string;
  /** The control: the word and "4 of 5" beside the face. */
  word?: boolean;
  /** The control: what stands beside the face while nothing is picked or previewed. */
  idle?: string;
  /** The control: submitted, locked at the rating given with the drawn check. */
  readonly?: boolean;
  /** The glyph: `waiting` an empty dashed rim, `voice` a vote that does not count, `closed` the gate that opened. */
  kind?: "" | "waiting" | "voice" | "closed";
}) {
  if (onChange)
    return (
      <MiniControl
        value={value}
        onChange={onChange}
        onClear={onClear}
        gate={gate}
        rest={rest}
        label={label}
        word={word}
        idle={idle}
        readonly={readonly}
      />
    );
  const f = GLYPH;
  const end = A0 + SWEEP;
  const bar = barOf(gate);
  const hand = kind === "waiting" ? null : (value ?? rest);
  const cls = [
    "dial-glyph",
    kind,
    hand === null ? "nohand" : value === null ? "rest" : "",
    readonly ? "locked" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} style={dialVars(hand, value, null, null)}>
      <svg viewBox={`0 0 ${f.w} ${f.h}`} aria-hidden="true" focusable="false">
        <path className="rim" d={arc(f, A0, end)} />
        <path className="fill" d={arc(f, A0, end)} pathLength={SWEEP} />
        {kind === "closed" && (
          <>
            <path className="close agent" d={arc(f, A0, A0 - 60)} pathLength={60} />
            <path className="close person" d={arc(f, end, end + 60)} pathLength={60} />
            <circle className="centre" cx={f.cx} cy={f.cy} r={5.5} />
          </>
        )}
        {bar !== null && <line className="notch" {...seg(f, degOf(bar), f.r - 2.5, f.r + 2.5)} />}
        <g className="hand">
          <line className="pointer" {...seg(f, 0, 3.5, f.r - 2.5)} />
        </g>
        <circle className="knob" cx={f.cx} cy={f.cy} r={3} />
      </svg>
    </span>
  );
}

function MiniControl({
  value,
  onChange,
  onClear,
  gate,
  rest,
  label,
  word,
  idle,
  readonly,
}: {
  value: number | null;
  onChange: (n: number) => void;
  onClear: (() => void) | undefined;
  gate: DialGate | null;
  rest: number | null;
  label: string;
  word: boolean;
  idle: string;
  readonly: boolean;
}) {
  const f = SMALL;
  const end = A0 + SWEEP;
  const reads = useId();
  const { preview, clicked, pick, radio } = useRadios({
    value,
    rest,
    locked: readonly,
    onChange,
    onClear,
  });
  const bar = barOf(gate);
  const hand = value ?? rest;
  const previewing = preview !== null && preview !== value;
  const shown = preview ?? value;
  const cls = [
    "minidial",
    hand === null ? "nohand" : value === null ? "rest" : "",
    previewing ? "previewing" : "",
    readonly ? "locked" : "",
    gate?.count ? "" : "noavg",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls}>
      <span
        className="face"
        role="radiogroup"
        aria-label={label}
        aria-describedby={gate ? reads : undefined}
        style={dialVars(hand, value, previewing ? preview : null, gate)}
      >
        <svg viewBox={`0 0 ${f.w} ${f.h}`} aria-hidden="true" focusable="false">
          {bar !== null && degOf(bar) < end && (
            <path className="band" d={arc(f, degOf(bar), end)} />
          )}
          <path className="fill" d={arc(f, A0, end)} pathLength={SWEEP} />
          <path className="pre" d={arc(f, A0, end)} pathLength={SWEEP} />
          <path className="rim" d={arc(f, A0, end)} />
          {bar !== null && (
            <>
              <line className="cut" {...seg(f, degOf(bar), f.r - 4, f.r + 4)} />
              <line className="notch" {...seg(f, degOf(bar), f.r - 5, f.r + 5)} />
            </>
          )}
          <g className="needle-g">
            <line className="needle-halo" {...seg(f, 0, 11, f.r - 4)} />
            <line className="needle" {...seg(f, 0, 11, f.r - 4)} />
            <circle className="needle-cap" cx={f.cx} cy={f.cy - (f.r - 4)} r={1.6} />
          </g>
          {STOPS.map((n) => {
            const [nx, ny] = pt(f, degOf(n), f.r + 10);
            return (
              <g className={markClass(n, value, preview, clicked)} key={n}>
                <line className="tick" {...seg(f, degOf(n), f.r - 3, f.r + 3)} />
                <text className="num" x={nx} y={ny + 3.2} textAnchor="middle">
                  {n}
                </text>
              </g>
            );
          })}
          <circle className="knob" cx={f.cx} cy={f.cy} r={7} />
          <g className="hand">
            <line className="pointer" {...seg(f, 0, 9, f.r - 7)} />
          </g>
        </svg>
        {STOPS.map((n) => (
          // biome-ignore lint/a11y/useSemanticElements: a stop is drawn on the rim; the group is the radio control
          <button
            key={n}
            {...radio(n)}
            className="stop"
            style={place(f, degOf(n), f.r + 4)}
            onClick={() => pick(n)}
          />
        ))}
      </span>
      {word && (
        <span className={`reads${shown ? ` ${ratingLevel(shown)}` : ""}`} aria-hidden="true">
          {shown ? (
            <>
              <span className="w">{copy.rating.word(shown)}</span>
              <span className="n">
                {previewing ? copy.rating.previewing(shown) : copy.approval.picked(shown)}
              </span>
            </>
          ) : (
            idle && <span className="idle">{idle}</span>
          )}
          {readonly && value !== null && <Icon d={ICONS.check} size={14} className="draw" />}
        </span>
      )}
      {gate && (
        <span className="sr-only" id={reads}>
          {copy.rating.reads(gate.count, gate.min, gate.average, gate.bar)}
        </span>
      )}
    </span>
  );
}
