/**
 * Small charts for the manager's view, in plain SVG on the tokens. One hue (the accent) for
 * magnitude, a surface gap between marks, a value at the tip, a hover readout, and a table
 * twin for every chart so nothing is colour-alone.
 */
import { compactTokens, formatTokens } from "@henosis/kernel";
import { type ReactNode, useId, useState } from "react";
import { copy } from "./copy.js";

export function StatTile({
  label,
  value,
  detail,
  trend,
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  trend?: number[];
}) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {trend && trend.length > 1 && <Sparkline values={trend} />}
      {detail && <span className="stat-detail">{detail}</span>}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 96;
  const h = 24;
  const max = Math.max(...values, 1);
  const pts: [number, number][] = values.map((v, i) => [
    (i / Math.max(values.length - 1, 1)) * (w - 4) + 2,
    h - 2 - (v / max) * (h - 4),
  ]);
  const d = pts.map((pt, i) => `${i ? "L" : "M"}${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1] as [number, number];
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <path d={d} fill="none" stroke="var(--fg-3)" strokeWidth="2" strokeLinejoin="round" />
      <circle
        cx={last[0]}
        cy={last[1]}
        r="4"
        fill="var(--accent)"
        stroke="var(--bg)"
        strokeWidth="2"
      />
    </svg>
  );
}

export interface BarRow {
  key: string;
  label: string;
  value: number;
  sub?: string;
  href?: string;
}

/** Horizontal bars, one hue, sorted as given; value at the tip; hover and focus readout. */
export function Bars({
  title,
  rows,
  unit = copy.viz.tokens,
  empty = copy.viz.nothingYet,
}: {
  title: string;
  rows: BarRow[];
  unit?: string;
  empty?: string;
}) {
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const id = useId();
  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((n, r) => n + r.value, 0);
  return (
    <figure className="chart" aria-labelledby={id}>
      <figcaption className="chart-head">
        <span id={id} className="chart-title">
          {title}
        </span>
        <button
          type="button"
          className="btn ghost sm"
          aria-pressed={table}
          onClick={() => setTable((v) => !v)}
        >
          {table ? copy.viz.chart : copy.viz.table}
        </button>
      </figcaption>
      {rows.length === 0 && <p className="muted small">{empty}</p>}
      {rows.length > 0 && table && (
        <table className="chart-table">
          <thead>
            <tr>
              <th scope="col">{copy.viz.name}</th>
              <th scope="col" className="num">
                {unit}
              </th>
              <th scope="col" className="num">
                {copy.viz.share}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td className="num mono">{formatTokens(r.value)}</td>
                <td className="num mono">
                  {total ? `${Math.round((r.value / total) * 100)}%` : "0%"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > 0 && !table && (
        <ul className="bars">
          {rows.map((r) => {
            const pct = (r.value / max) * 100;
            const on = hover === r.key;
            const inner = (
              <>
                <span className="bar-label ellipsis">
                  {r.label}
                  {r.sub && <span className="faint"> · {r.sub}</span>}
                </span>
                <span className="bar-track">
                  <span className={`bar-fill${on ? " on" : ""}`} style={{ width: `${pct}%` }} />
                </span>
                <span className="bar-value mono">{compactTokens(r.value)}</span>
                {on && (
                  <span className="chart-tip" role="status">
                    <b>{formatTokens(r.value)}</b> {unit} · {r.label}
                    {total ? ` · ${Math.round((r.value / total) * 100)}%` : ""}
                  </span>
                )}
              </>
            );
            const hoverProps = {
              onPointerEnter: () => setHover(r.key),
              onPointerLeave: () => setHover(null),
              onFocus: () => setHover(r.key),
              onBlur: () => setHover(null),
            };
            return (
              <li key={r.key} className="bar-item">
                {r.href ? (
                  <a className="bar-row" href={r.href} {...hoverProps}>
                    {inner}
                  </a>
                ) : (
                  <span className="bar-row" {...hoverProps}>
                    {inner}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}

export interface SeriesPoint {
  label: string;
  value: number;
  detail?: string;
}

/** One series over an ordered axis: a 2px line with a 10% wash, crosshair readout, table twin. */
export function Area({
  title,
  points,
  unit = copy.viz.tokens,
}: {
  title: string;
  points: SeriesPoint[];
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
  return (
    <figure className="chart" aria-labelledby={id}>
      <figcaption className="chart-head">
        <span id={id} className="chart-title">
          {title}
        </span>
        <button
          type="button"
          className="btn ghost sm"
          aria-pressed={table}
          onClick={() => setTable((v) => !v)}
        >
          {table ? copy.viz.chart : copy.viz.table}
        </button>
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
            aria-label={`${title}: ${points.map((p) => `${p.label} ${formatTokens(p.value)}`).join(", ")}`}
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
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={padL}
                  x2={w - 8}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="var(--line)"
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
                  stroke="var(--fg-3)"
                  strokeWidth="1"
                />
                <circle
                  cx={x(at)}
                  cy={y(cur.value)}
                  r="4"
                  fill="var(--accent)"
                  stroke="var(--bg)"
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
                stroke="var(--bg)"
                strokeWidth="2"
              />
            )}
          </svg>
          {cur && (
            <span className="chart-tip" role="status">
              <b>{formatTokens(cur.value)}</b> {unit} · {cur.label}
              {cur.detail ? ` · ${cur.detail}` : ""}
            </span>
          )}
        </div>
      )}
    </figure>
  );
}

function niceMax(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  const n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
  return n * p;
}
