/**
 * The spend ring (sig-token-art): token spend drawn as the mark's ring, filled from the seam at
 * twelve, clockwise, against a soft budget.
 *
 * - Input is the lighter step and output the darker step of one chocolate (`--spend-in`,
 *   `--spend-out` in styles/spend-ring.css); a hair of the track shows between two segments.
 * - The budget is outside the stroke: one tick at 80 %, the share past it in amber, and past
 *   100 % a thin lap around the ring with the seam drawn through it, so "over" is a second shape
 *   and never only a colour.
 * - Cache read is a dotted arc inside the track, beside the budget and never in it: its length is
 *   the usage report's share (cache read over input plus cache read), so it reads the same with
 *   or without a budget.
 * - With no budget the ring has no seam, no tick and no percent: it is the spend alone, split
 *   into input and output.
 * - An apricot ember sits at the leading edge while a turn is spending.
 *
 * Three cuts: `card` (100 px, the figure and the percent inside), `meter` (72 px, the percent
 * inside, or the figure when there is no budget) and `row` (18 px, track and fill only, for a
 * line that already carries its numbers). The drawing is hidden from assistive technology; the
 * wrapper is a meter (an image when there is no budget) whose name says the numbers.
 */
import { compactTokens, formatTokens } from "@henosis/kernel";
import { copy } from "./copy.js";

/** Amber from 80 % of a budget: the same line every meter draws. */
const WARN = 0.8;
/** The drawing is 96 units square; the ring is r 36 under a 9-unit stroke. */
const MID = 48;
const R = 36;
/** Hundredths of the ring left open between two segments. */
const GAP = 1.2;
/** The cache arc's dots: a 0.1 dash under a round cap every 2.3 hundredths. */
const DOT = 2.3;

export type SpendTone = "none" | "under" | "near" | "over";

/** Where a spend stands against its budget; "none" when there is no budget to stand against. */
export function spendTone(used: number, budget: number | null): SpendTone {
  if (budget === null || budget <= 0) return "none";
  if (used > budget) return "over";
  return used / budget >= WARN ? "near" : "under";
}

/** "62%", and ">999%" past the point where the figure would outgrow the ring. */
export function spendPercent(used: number, budget: number): string {
  const pct = Math.round((used / budget) * 100);
  return pct > 999 ? ">999%" : `${pct}%`;
}

interface Segment {
  kind: "in" | "out" | "amber";
  from: number;
  to: number;
}

/** The filled arcs in hundredths of the ring, in drawing order. */
export function spendSegments(input: number, output: number, budget: number | null): Segment[] {
  const used = input + output;
  if (used <= 0) return [];
  const all: Segment[] = [];
  if (budget === null || budget <= 0) {
    const split = (input / used) * 100;
    all.push({ kind: "in", from: 0, to: split }, { kind: "out", from: split, to: 100 });
  } else {
    const shown = Math.min(100, (used / budget) * 100);
    const calm = Math.min(shown, WARN * 100);
    const split = Math.min((input / budget) * 100, calm);
    all.push(
      { kind: "in", from: 0, to: split },
      { kind: "out", from: split, to: calm },
      { kind: "amber", from: WARN * 100, to: shown },
    );
  }
  return all.filter((s) => s.to - s.from > 0.05);
}

/** A point on the unrotated drawing: `pct` hundredths clockwise from twelve, at radius `r`. */
function polar(r: number, pct: number): [number, number] {
  const a = (pct / 100) * Math.PI * 2 - Math.PI / 2;
  return [MID + r * Math.cos(a), MID + r * Math.sin(a)];
}

/** The dash pattern of a dotted arc `share` (0..1) of the way round a pathLength-100 circle. */
function dots(share: number): string | null {
  const n = Math.round((Math.min(1, share) * 100) / DOT);
  if (n <= 0) return null;
  return `${"0.1 2.2 ".repeat(n - 1)}0.1 200`;
}

export function SpendRing({
  input,
  output,
  cacheRead = 0,
  budget = null,
  size = "meter",
  live = false,
  what,
}: {
  /** Input and output tokens: what a budget counts. */
  input: number;
  output: number;
  /** Cache read: never in the fill; its share of the input the agent saw is the dotted arc. */
  cacheRead?: number;
  /** The soft budget, or null: the ring then shows the spend alone, with no percent. */
  budget?: number | null;
  size?: "row" | "meter" | "card";
  /** A turn is spending now: the ember at the leading edge. */
  live?: boolean;
  /** Whose spend this is, said first in the accessible name: "Billing page". */
  what?: string;
}) {
  const used = input + output;
  const cap = budget !== null && budget > 0 ? budget : null;
  const tone = spendTone(used, cap);
  const over = cap !== null && used > cap ? ((used - cap) / cap) * 100 : 0;
  const segs = spendSegments(input, output, cap);
  const edge = cap === null ? (used > 0 ? 100 : 0) : Math.min(100, (used / cap) * 100);
  const closed = cap === null && segs.length > 1;
  const row = size === "row";
  const cache = row || cacheRead <= 0 ? null : dots(cacheRead / (input + cacheRead));

  const figures =
    cap === null
      ? copy.usage.ringSpend(formatTokens(used))
      : copy.usage.ringOfBudget(
          formatTokens(used),
          formatTokens(cap),
          Math.round((used / cap) * 100),
        );
  const name = [
    what ? copy.usage.ringNamed(what, figures) : figures,
    cache ? copy.usage.ringCache(formatTokens(cacheRead)) : null,
    live ? copy.usage.spendingNow : null,
  ]
    .filter(Boolean)
    .join(", ");
  const semantics =
    cap === null
      ? { role: "img", "aria-label": name }
      : {
          role: "meter",
          "aria-label": name,
          "aria-valuemin": 0,
          "aria-valuemax": cap,
          "aria-valuenow": Math.min(used, cap),
          "aria-valuetext":
            tone === "over"
              ? copy.usage.ringOver(formatTokens(used - cap))
              : tone === "near"
                ? copy.usage.ringNear(formatTokens(cap - used))
                : copy.usage.ringUnder(formatTokens(cap - used)),
        };

  const [tx1, ty1] = polar(41.5, WARN * 100);
  const [tx2, ty2] = polar(45.5, WARN * 100);
  const [ex, ey] = polar(R, edge);
  return (
    <span
      className="spend-ring"
      data-cut={size}
      data-tone={tone}
      data-live={live || undefined}
      {...semantics}
    >
      <svg viewBox="0 0 96 96" aria-hidden="true" focusable="false">
        <g transform={`rotate(-90 ${MID} ${MID})`}>
          <circle className="ring-track" cx={MID} cy={MID} r={R} />
          {row ? (
            edge > 0 && (
              <circle
                className="ring-seg ring-fill"
                cx={MID}
                cy={MID}
                r={R}
                pathLength={100}
                strokeDasharray={`${edge.toFixed(2)} 100`}
              />
            )
          ) : (
            <>
              {segs.map((s, i) => {
                const last = i === segs.length - 1;
                const span = s.to - s.from;
                const gap = last && !closed ? 0 : Math.min(GAP, span / 2);
                return (
                  <circle
                    key={s.kind}
                    className={`ring-seg ring-${s.kind}`}
                    cx={MID}
                    cy={MID}
                    r={R}
                    pathLength={100}
                    strokeDasharray={`${(span - gap).toFixed(2)} 100`}
                    strokeDashoffset={(-s.from).toFixed(2)}
                  />
                );
              })}
              {over > 0 && (
                <circle
                  className="ring-lap"
                  cx={MID}
                  cy={MID}
                  r={43.5}
                  pathLength={100}
                  strokeDasharray={`${Math.min(100, over).toFixed(2)} 100`}
                />
              )}
              {cache && (
                <circle
                  className="ring-cache"
                  cx={MID}
                  cy={MID}
                  r={28.5}
                  pathLength={100}
                  strokeDasharray={cache}
                />
              )}
            </>
          )}
        </g>
        {row && tone === "over" && <circle className="ring-past" cx={MID} cy={MID} r={11} />}
        {!row && cap !== null && (
          <>
            <line className="ring-tick" x1={tx1} y1={ty1} x2={tx2} y2={ty2} />
            <line className="ring-seam" x1={MID} y1={tone === "over" ? 1.5 : 6} x2={MID} y2={18} />
          </>
        )}
        {!row && live && (
          <>
            <circle className="ring-halo" cx={ex} cy={ey} r={8} />
            <circle className="ring-ember" cx={ex} cy={ey} r={4} />
          </>
        )}
      </svg>
      {!row && (
        <span className="ring-mid" aria-hidden="true">
          {size === "card" || cap === null ? (
            <span className="ring-n">{compactTokens(used)}</span>
          ) : (
            <span className="ring-n ring-pct">{spendPercent(used, cap)}</span>
          )}
          {size === "card" &&
            (cap === null ? (
              <span className="ring-p">{copy.usage.tokens}</span>
            ) : (
              <span className="ring-p ring-pct">{spendPercent(used, cap)}</span>
            ))}
        </span>
      )}
    </span>
  );
}
