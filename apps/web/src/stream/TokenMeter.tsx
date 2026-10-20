/**
 * The title row's token chip (token-meter): "12.4k tokens" with a faint percent over a 3 px
 * hairline that carries the 80 % tick, colour only when the budget turns, a pulsing apricot dot
 * while a turn spends. Hover or focus opens the breakdown, a tap pins it; `open` keeps it shown,
 * as the drawer's Usage block does. The popover keeps one fixed shape so the eye lands in the
 * same place every session: head · stacked bar · four rows including zeros · rule · budget ·
 * consequence · foot. The budget counts input and output only; cache never moves the bar.
 */
import { budgetStatus, compactTokens, formatTokens } from "@henosis/kernel";
import type { Usage } from "@henosis/protocol";
import { useState } from "react";
import { copy } from "../copy.js";

/** Warn at 80% of a budget, danger past it. */
export const BUDGET_WARN = 0.8;

export function TokenMeter({
  usage,
  budget = null,
  open = false,
  live = false,
  session,
  turn,
}: {
  usage: Usage;
  budget?: number | null;
  /** Keep the breakdown shown inline (the drawer's Usage block). */
  open?: boolean;
  /** A turn is spending now: the hairline weaves and the dot pulses. */
  live?: boolean;
  /** The popover's head: the session's name and the turn. */
  session?: string | undefined;
  turn?: number | undefined;
}) {
  const [pinned, setPinned] = useState(false);
  const b = budgetStatus({ usage, policy: { tokenBudget: budget } });
  const pct = b.budget === null ? null : Math.round(b.fraction * 100);
  const none = b.used === 0 && usage.cacheRead === 0 && usage.cacheWrite === 0;
  const tone = b.over ? " over" : pct !== null && b.fraction >= BUDGET_WARN ? " warn" : "";
  const cls = `meter${none ? " none" : ""}${live ? " live" : ""}${tone}${open ? " open" : pinned ? " pinned" : ""}`;
  const all = usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
  const share = (n: number) => (all > 0 ? `${((n / all) * 100).toFixed(1)}%` : "0%");
  const rows: [string, string, number][] = [
    ["k-in", copy.usage.input, usage.input],
    ["k-out", copy.usage.output, usage.output],
    ["k-cache", copy.usage.cacheRead, usage.cacheRead],
    ["k-write", copy.usage.cacheWrite, usage.cacheWrite],
  ];
  const left = b.budget === null ? null : Math.max(0, b.budget - b.used);
  return (
    <span className={cls}>
      <button
        type="button"
        className="tchip"
        aria-label={copy.usage.label(formatTokens(b.used), pct)}
        aria-expanded={open || pinned}
        onClick={() => setPinned((v) => !v)}
      >
        {live && <i className="spend" aria-hidden="true" />}
        {copy.usage.chip(compactTokens(b.used))}
        {pct !== null && <span className="pct">{pct}%</span>}
      </button>
      {b.budget !== null && (
        // biome-ignore lint/a11y/useSemanticElements: the hairline is drawn; the meter role names it beside the chip's colour
        <span
          className={`hair${live ? " live" : ""}${tone}`}
          role="meter"
          aria-label={copy.usage.budget}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.round(b.fraction * 100))}
        >
          <i style={{ "--spent": `${Math.min(100, Math.round(b.fraction * 100))}%` } as never} />
        </span>
      )}
      <div className="pop" role="dialog" aria-label={copy.usage.breakdown}>
        <div className="head">
          <span className="serif">{session ?? copy.usage.thisSession}</span>
          <span className="turn">
            {turn !== undefined ? copy.usage.turn(turn).toLowerCase() : ""}
            {live ? ` · ${copy.usage.live}` : ""}
          </span>
        </div>
        <div className="stacked" aria-hidden="true">
          {rows.map(([k, , n]) => (
            <i key={k} className={k} style={{ width: share(n) }} />
          ))}
        </div>
        {rows.map(([k, label, n]) => (
          <div className="kv" key={k}>
            <span className={`sw ${k}`} aria-hidden="true" />
            <span>{label}</span>
            <span className="v">{formatTokens(n)}</span>
          </div>
        ))}
        <div className="rule" />
        <div className="bud">
          <div className="row">
            <span>{copy.usage.budget}</span>
            <span className="v">
              {b.budget === null || pct === null
                ? copy.usage.noBudget
                : copy.usage.ofBudget(formatTokens(b.used), formatTokens(b.budget), pct)}
            </span>
          </div>
          {b.budget !== null && (
            <div className={`budget${tone}`} aria-hidden="true">
              <i style={{ width: `${Math.min(100, Math.round(b.fraction * 100))}%` }} />
            </div>
          )}
          <div className="left">
            {b.budget === null ? (
              copy.usage.softNone
            ) : b.over ? (
              <>
                <b>{copy.usage.over}</b> · {copy.usage.soft}
              </>
            ) : (
              <>
                {copy.usage.about} <b>{copy.usage.leftShort(compactTokens(left ?? 0))}</b> ·{" "}
                {copy.usage.cacheNotCounted}
              </>
            )}
          </div>
        </div>
        {!open && (
          <div className="foot">
            <span>
              <kbd>click</kbd> {copy.usage.pins}
            </span>
            <a href="#details">{copy.usage.inDetails}</a>
          </div>
        )}
      </div>
    </span>
  );
}
