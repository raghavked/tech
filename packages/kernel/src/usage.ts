/**
 * Token usage over a session: the budget status a client shows and the deterministic number
 * formats the briefs and reports print. No locale, so two replicas render the same text.
 */
import { type Usage, usageTotal } from "@henosis/protocol";

export interface BudgetStatus {
  /** Input plus output tokens used on the branch so far. */
  used: number;
  /** The policy's soft budget, or null when none is set. */
  budget: number | null;
  /** used / budget, 0 when there is no budget. */
  fraction: number;
  /** True once `used` passes the budget. */
  over: boolean;
}

export function budgetStatus(state: {
  usage: Usage;
  policy: { tokenBudget: number | null };
}): BudgetStatus {
  const used = usageTotal(state.usage);
  const budget = state.policy.tokenBudget ?? null;
  const fraction = budget ? used / budget : 0;
  return { used, budget, fraction, over: budget !== null && used > budget };
}

/** "12,345": a deterministic thousands separator (no locale). */
export function formatTokens(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "980", "12.4k", "123k", "1.2M": the short form a chip or a card foot shows. */
export function compactTokens(n: number): string {
  if (n < 1000) return String(Math.round(n));
  const short = (x: number) => (x < 100 ? x.toFixed(1).replace(/\.0$/, "") : String(Math.round(x)));
  if (n < 1_000_000) return `${short(n / 1000)}k`;
  return `${short(n / 1_000_000)}M`;
}

/** One line for a brief: "12,345 (in 10,000, out 2,345, cache read 4,000)". */
export function describeUsage(u: Usage): string {
  const parts = [`in ${formatTokens(u.input)}`, `out ${formatTokens(u.output)}`];
  if (u.cacheRead) parts.push(`cache read ${formatTokens(u.cacheRead)}`);
  if (u.cacheWrite) parts.push(`cache write ${formatTokens(u.cacheWrite)}`);
  return `${formatTokens(usageTotal(u))} (${parts.join(", ")})`;
}

/** "12,345 of 50,000 (25%)" or "12,345, no budget". */
export function describeBudget(b: BudgetStatus): string {
  if (b.budget === null) return `${formatTokens(b.used)}, no budget`;
  const pct = Math.round(b.fraction * 100);
  return `${formatTokens(b.used)} of ${formatTokens(b.budget)} (${pct}%)${b.over ? ", over budget" : ""}`;
}
