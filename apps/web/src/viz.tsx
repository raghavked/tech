/**
 * The chart component, in plain SVG and HTML on the tokens (SYSTEM.md §17, COMPONENTS.md 5.4):
 *
 * - one `Bars` for every "by project / person / agent" chart: stacked in + out marks in navy and
 *   chocolate stepped at the family's saturation (`--chart-in` / `--chart-out` in styles.css,
 *   #424F7C / #90483A on cream, lifted to #7F90C6 / #C97C64 on the dark surface; the dataviz
 *   validator passes lightness, CVD, normal-vision and contrast for both pairs; the chroma floor
 *   is the family's own choice, so texture is the second discriminator under `prefers-contrast:
 *   more` and forced colours), a 2 px surface gap between the segments, the value at the tip,
 *   the hover readout *replacing the row's value column* so it never covers a neighbour, a
 *   reading sentence and a table twin under every chart;
 * - `Area` for a lone series over turns, in the hand with the 10 % wash and a crosshair readout;
 * - `StatTile`: label · mono value · small unit · a detail line; colour only for a budget past
 *   80 %; deltas are ink with a sign.
 *
 * Text wears text tokens, never the series colour; axis ticks and values are mono.
 */
import { compactTokens, formatTokens } from "@henosis/kernel";
import { type ReactNode, useId, useState } from "react";
import { copy } from "./copy.js";

/** The budget's amber line, the same 0.8 every meter uses. */
export const BUDGET_WARN = 0.8;

export function StatTile({
  label,
  value,
  unit,
  detail,
  trend,
  meter,
}: {
  label: string;
  /** Already formatted: "212k", "4", "≈ 980k". */
  value: string;
  /** A small faint word after the value: "tokens", "open", "rated". */
  unit?: string;
  detail?: ReactNode;
  trend?: number[];
  /** A soft budget under the value: the only colour a tile may carry, past 80 %. */
  meter?: { used: number; budget: number };
}) {
  const fraction = meter && meter.budget > 0 ? meter.used / meter.budget : null;
  const tone =
    fraction === null ? "" : fraction > 1 ? " over" : fraction >= BUDGET_WARN ? " warn" : "";
  return (
    <div className={`stat${tone}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {trend && trend.length > 1 && <Sparkline values={trend} />}
      {meter && fraction !== null && (
        // biome-ignore lint/a11y/useSemanticElements: a <meter> cannot be drawn as the 3 px hairline with the 80 % tick
        <span
          className="stat-meter"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={meter.budget}
          aria-valuenow={Math.min(meter.used, meter.budget)}
          aria-label={copy.viz.ofBudget(formatTokens(meter.used), formatTokens(meter.budget))}
        >
          <span className="fill" style={{ width: `${Math.min(100, fraction * 100)}%` }} />
          <span className="tick" />
        </span>
      )}
      {detail && <span className="stat-detail">{detail}</span>}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 110;
  const h = 26;
  const max = Math.max(...values, 1);
  const pts: [number, number][] = values.map((v, i) => [
    (i / Math.max(values.length - 1, 1)) * (w - 6) + 3,
    h - 3 - (v / max) * (h - 6),
  ]);
  const d = pts.map((pt, i) => `${i ? "L" : "M"}${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1] as [number, number];
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <path d={d} fill="none" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinejoin="round" />
      <circle
        cx={last[0]}
        cy={last[1]}
        r="3.5"
        fill="var(--accent)"
        stroke="var(--surface)"
        strokeWidth="2"
      />
    </svg>
  );
}

export interface BarRow {
  key: string;
  label: string;
  /** A faint word after the label: "Cy's", "Ana's agent". */
  sub?: string;
  input: number;
  output: number;
  href?: string;
  /** A session running now: an apricot tip on the mark. */
  live?: boolean;
  /** The avatar before the label, when the row is a person or an agent. */
  avatar?: ReactNode;
}

/** "58,412 · 27 %": the readout that takes the value column's place while a row is hovered. */
export function readout(total: number, share: number): string {
  return `${formatTokens(total)} · ${Math.round(share * 100)}%`;
}

/**
 * The reading sentence under a by-whom chart: who took the most, or that the spread is even
 * (SCREENS.md §10: "Even spread; no one person is over a third.").
 */
export function readingOf(rows: readonly BarRow[], noun: string): string {
  const totals = rows.map((r) => r.input + r.output);
  const sum = totals.reduce((n, v) => n + v, 0);
  if (!sum || !rows.length) return copy.viz.readingEmpty;
  const top = Math.max(...totals);
  const i = totals.indexOf(top);
  const share = top / sum;
  if (rows.length > 1 && share <= 1 / 3) return copy.viz.readingEven(noun);
  return copy.viz.readingTop(rows[i]?.label ?? "", Math.round(share * 100), rows.length, noun);
}

/** Stacked in + out bars, sorted as given; value at the tip; hover readout in the value column. */
export function Bars({
  title,
  rows,
  reading,
  unit = copy.viz.tokens,
  empty = copy.viz.nothingYet,
}: {
  title: string;
  rows: BarRow[];
  /** One sentence that says what the chart shows; computed with `readingOf` when absent. */
  reading?: string;
  unit?: string;
  empty?: string;
}) {
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const id = useId();
  const totals = rows.map((r) => r.input + r.output);
  const max = Math.max(...totals, 1);
  const total = totals.reduce((n, v) => n + v, 0);
  const sentence = reading ?? readingOf(rows, copy.viz.rowNoun);
  return (
    <figure className="chart" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}>
      <figcaption className="chart-head">
        <span className="chart-title" id={`${id}-t`}>
          {title}
          <span className="chart-legend" aria-hidden="true">
            <i className="sw sw-in" /> {copy.viz.in}
            <i className="sw sw-out" /> {copy.viz.out}
          </span>
        </span>
        {rows.length > 0 && (
          <button
            type="button"
            className="btn ghost sm"
            aria-pressed={table}
            onClick={() => setTable((v) => !v)}
          >
            {table ? copy.viz.chart : copy.viz.table}
          </button>
        )}
      </figcaption>
      {rows.length === 0 && <p className="muted small">{empty}</p>}
      {rows.length > 0 && table && (
        <table className="chart-table">
          <thead>
            <tr>
              <th scope="col">{copy.viz.name}</th>
              <th scope="col" className="num">
                {copy.viz.in}
              </th>
              <th scope="col" className="num">
                {copy.viz.out}
              </th>
              <th scope="col" className="num">
                {unit}
              </th>
              <th scope="col" className="num">
                {copy.viz.share}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key}>
                <td>
                  {r.label}
                  {r.sub && <span className="faint"> · {r.sub}</span>}
                </td>
                <td className="num mono">{formatTokens(r.input)}</td>
                <td className="num mono">{formatTokens(r.output)}</td>
                <td className="num mono">{formatTokens(totals[i] ?? 0)}</td>
                <td className="num mono">
                  {total ? `${Math.round(((totals[i] ?? 0) / total) * 100)}%` : "0%"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > 0 && !table && (
        <ul className={`bars${rows.length === 1 ? " lone" : ""}`}>
          {rows.map((r, i) => {
            const sum = totals[i] ?? 0;
            const on = hover === r.key;
            const inW = (r.input / max) * 100;
            const outW = (r.output / max) * 100;
            const inner = (
              <>
                {r.avatar && <span className="bar-avatar">{r.avatar}</span>}
                <span className="bar-label ellipsis">
                  {r.label}
                  {r.sub && <span className="faint"> · {r.sub}</span>}
                </span>
                <span className="bar-track" aria-hidden="true">
                  {r.input > 0 && <span className="bar-seg seg-in" style={{ width: `${inW}%` }} />}
                  {r.output > 0 && (
                    <span
                      className={`bar-seg seg-out${r.live ? " live" : ""}`}
                      style={{ width: `${outW}%` }}
                    />
                  )}
                </span>
                <span
                  className={`bar-value mono${on ? " readout" : ""}`}
                  role={on ? "status" : undefined}
                >
                  {on ? readout(sum, total ? sum / total : 0) : compactTokens(sum)}
                </span>
                <span className="sr-only">
                  {copy.viz.rowLabel(formatTokens(r.input), formatTokens(r.output), unit)}
                </span>
              </>
            );
            const hoverProps = {
              onPointerEnter: () => setHover(r.key),
              onPointerLeave: () => setHover(null),
              onFocus: () => setHover(r.key),
              onBlur: () => setHover(null),
            };
            return (
              <li key={r.key} className={`bar-item${r.avatar ? " with-avatar" : ""}`}>
                {r.href ? (
                  <a className="bar-row" href={r.href} {...hoverProps}>
                    {inner}
                  </a>
                ) : (
                  <button type="button" className="bar-row" {...hoverProps}>
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="chart-reading" id={`${id}-d`}>
        {rows.length ? sentence : empty}
      </p>
    </figure>
  );
}

export interface SeriesPoint {
  label: string;
  value: number;
  detail?: string;
}

/** One series over an ordered axis: a 2 px line in the hand with a 10 % wash, crosshair readout, table twin. */
export function Area({
  title,
  points,
  reading,
  unit = copy.viz.tokens,
}: {
  title: string;
  points: SeriesPoint[];
  /** The sentence under the chart; the peak bucket when absent. */
  reading?: string;
  unit?: string;
}) {
  const [table, setTable] = useState(false);
  const [at, setAt] = useState<number | null>(null);
  const id = useId();
  const w = 560;
  const h = 150;
  const padL = 44;
  const padB = 22;
  const padT = 10;
  const plotW = w - padL - 8;
  const plotH = h - padB - padT;
  const max = Math.max(...points.map((p) => p.value), 1);
  const nice = niceMax(max);
  const x = (i: number) =>
    padL + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => padT + plotH - (v / nice) * plotH;
  const line = points
    .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(" ");
  const area = points.length
    ? `${line} L${x(points.length - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L${x(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
    : "";
  const ticks = [0, nice / 2, nice];
  const cur = at === null ? null : points[at];
  const peak = points.reduce<SeriesPoint | null>((b, p) => (!b || p.value > b.value ? p : b), null);
  const sentence =
    reading ??
    (peak
      ? copy.viz.readingPeak(peak.label, formatTokens(peak.value), unit)
      : copy.viz.readingEmpty);
  const desc = points.map((p) => `${p.label} ${formatTokens(p.value)}`).join(", ");
  return (
    <figure className="chart wide" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}>
      <figcaption className="chart-head">
        <span className="chart-title" id={`${id}-t`}>
          {title}
          <span className="chart-legend" aria-hidden="true">
            <i className="sw sw-hand" /> {copy.viz.inPlusOut}
          </span>
        </span>
        {points.length > 0 && (
          <button
            type="button"
            className="btn ghost sm"
            aria-pressed={table}
            onClick={() => setTable((v) => !v)}
          >
            {table ? copy.viz.chart : copy.viz.table}
          </button>
        )}
      </figcaption>
      {points.length === 0 && <p className="muted small">{copy.viz.nothingYet}</p>}
      {points.length > 0 && table && (
        <table className="chart-table">
          <thead>
            <tr>
              <th scope="col">{copy.viz.when}</th>
              <th scope="col" className="num">
                {unit}
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.label}>
                <td>{p.label}</td>
                <td className="num mono">{formatTokens(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {points.length > 0 && !table && (
        <div className="area-wrap">
          <svg
            className="area"
            viewBox={`0 0 ${w} ${h}`}
            role="img"
            aria-labelledby={`${id}-st ${id}-sd`}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const px = ((e.clientX - rect.left) / rect.width) * w;
              let best = 0;
              for (let i = 1; i < points.length; i++)
                if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
              setAt(best);
            }}
            onPointerLeave={() => setAt(null)}
          >
            <title id={`${id}-st`}>{title}</title>
            <desc id={`${id}-sd`}>{desc}</desc>
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={padL}
                  x2={w - 8}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? "var(--ink-3)" : "var(--line)"}
                  strokeWidth="1"
                />
                <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="tick">
                  {compactTokens(t)}
                </text>
              </g>
            ))}
            <path d={area} fill="var(--accent)" opacity="0.1" />
            <path
              d={line}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((p, i) => (
              <text
                key={p.label}
                x={x(i)}
                y={h - 6}
                textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                className="tick"
                style={{
                  display:
                    i === 0 || i === points.length - 1 || points.length <= 8 ? undefined : "none",
                }}
              >
                {p.label}
              </text>
            ))}
            {at !== null && cur && (
              <g>
                <line
                  x1={x(at)}
                  x2={x(at)}
                  y1={padT}
                  y2={padT + plotH}
                  stroke="var(--ink-3)"
                  strokeWidth="1"
                />
                <circle
                  cx={x(at)}
                  cy={y(cur.value)}
                  r="4"
                  fill="var(--accent)"
                  stroke="var(--surface)"
                  strokeWidth="2"
                />
              </g>
            )}
            {at === null && points.length > 0 && (
              <circle
                cx={x(points.length - 1)}
                cy={y((points[points.length - 1] as SeriesPoint).value)}
                r="4"
                fill="var(--accent)"
                stroke="var(--surface)"
                strokeWidth="2"
              />
            )}
          </svg>
          {cur && (
            <span className="chart-tip" role="status">
              <b className="mono">{formatTokens(cur.value)}</b> {unit} · {cur.label}
              {cur.detail ? ` · ${cur.detail}` : ""}
            </span>
          )}
        </div>
      )}
      <p className="chart-reading" id={`${id}-d`}>
        {sentence}
      </p>
    </figure>
  );
}

function niceMax(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  const n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
  return n * p;
}
