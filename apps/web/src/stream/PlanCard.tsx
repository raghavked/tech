/**
 * Plan first: the plan as a ledger in the stream (plan-card). A white card with a stripe that
 * carries the status; the goal with the italic serif "Goal" label; step rows on a grid of ring ·
 * title + detail · risk pill · actual · estimate; the totals meter against the budget with the
 * estimate tick; the team's ratings as chips with mini stars and "by the team's ratings" in
 * green; the decisions with one sentence under them. It renders from `state.plans[planId]`, so
 * it is live. The irreversible step's row points at the gate in the stream ("waits at the gate
 * below") when its approval is pending, so plan and gate are one object.
 */
import {
  type ApprovalRecord,
  compactTokens,
  isRatingsRule,
  type PlanStepRecord,
  planActualTokens,
  rankOf,
  ratingSummary,
  ruleFor,
  type SessionState,
} from "@henosis/kernel";
import { type Actor, ROLE_RANK } from "@henosis/protocol";
import { type KeyboardEvent, memo, useState } from "react";
import type { HenosisClient } from "../client.js";
import { copy } from "../copy.js";
import { isTyping } from "../shortcuts.js";
import { ICONS, Icon, Stars } from "../ui.js";
import { isFresh } from "./clock.js";

/** What the card shows, as one string: the state is cloned on every event, so compare by value. */
export function planSig(s: SessionState, planId: string, meId: string): string {
  const p = s.plans[planId];
  if (!p) return "";
  const gates = Object.values(s.approvals)
    .filter((a) => a.planId === planId)
    .map((a) => `${a.id}:${a.status}:${a.stepIndex}`);
  return [
    p.status,
    p.decidedBy,
    p.note,
    p.supersededBy,
    s.policy.tokenBudget,
    s.driver,
    rankOf(s, meId),
    ...p.steps.map((st) => `${st.id}:${st.status}:${st.actualTokens}`),
    ...Object.entries(p.ratings).map(([id, r]) => `${id}=${r.rating}:${r.note}`),
    ...gates,
  ].join("|");
}

export const PlanCard = memo(
  PlanCardRow,
  (prev, next) =>
    prev.planId === next.planId &&
    prev.client === next.client &&
    prev.me.id === next.me.id &&
    ownersSig(prev.owners) === ownersSig(next.owners) &&
    planSig(prev.s, prev.planId, prev.me.id) === planSig(next.s, next.planId, next.me.id),
);

type Moment = "proposed" | "running" | "done" | "superseded" | "rejected";

function momentOf(p: { status: string; supersededBy: string | null }): Moment {
  if (p.supersededBy || p.status === "revise") return "superseded";
  if (p.status === "approved") return "running";
  if (p.status === "done") return "done";
  if (p.status === "rejected") return "rejected";
  return "proposed";
}

const ownersSig = (o: Record<string, string> | undefined) =>
  o
    ? Object.entries(o)
        .map(([k, v]) => `${k}=${v}`)
        .join("|")
    : "";

function PlanCardRow({
  s,
  planId,
  me,
  client,
  owners,
}: {
  s: SessionState;
  planId: string;
  me: Actor;
  client: HenosisClient;
  /** The council (docs/19_council.md): the member model that owns each step, by step id. */
  owners?: Record<string, string>;
}) {
  const p = s.plans[planId];
  const [note, setNote] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  if (!p) return null;
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const human = s.participants[me.id]?.actor.kind === "human";
  const rank = rankOf(s, me.id);
  const live = !p.supersededBy;
  const moment = momentOf(p);
  const showStars = live && human && rank >= ROLE_RANK.contributor;
  const canRate = showStars && p.status === "proposed";
  const canDecide =
    live &&
    human &&
    rank >= ROLE_RANK.driver &&
    (p.status === "proposed" || p.status === "approved");
  const mine = p.ratings[me.id] ?? null;
  const r = ratingSummary(p);
  const used = planActualTokens(p);
  const raters = Object.entries(p.ratings).sort((a, b) => a[1].seq - b[1].seq);
  const rate = (rating: number) => client.send({ type: "plan.rate", planId, rating, note });
  const decide = (status: "approved" | "revise" | "rejected") =>
    client.send({ type: "plan.decide", planId, status, note: decisionNote });
  const decidedBy =
    p.decidedBy === "policy"
      ? copy.plan.byPolicy
      : p.decidedBy
        ? copy.plan.decidedBy(name(p.decidedBy))
        : "";
  const budget = s.policy.tokenBudget;
  const scale = Math.max(budget ?? 0, p.estTokens, used, 1);
  const pct = (n: number) => `${Math.min(100, (n / scale) * 100)}%`;
  const gateFor = (st: PlanStepRecord, i: number): ApprovalRecord | null =>
    Object.values(s.approvals).find(
      (a) =>
        a.status === "pending" &&
        a.planId === planId &&
        a.stepIndex === i &&
        isRatingsRule(ruleFor(s.policy.approvals, a.call.risk)),
    ) ??
    (st.risk === "irreversible"
      ? (Object.values(s.approvals).find(
          (a) => a.status === "pending" && a.planId === planId && a.stepIndex === i,
        ) ?? null)
      : null);
  // 1–5 rate the plan while the card has focus and nobody types (keyboard-first).
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!canRate || isTyping(e.target as HTMLElement) || e.metaKey || e.ctrlKey || e.altKey) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 5) {
      rate(n);
      e.preventDefault();
    }
  };
  const statusWord = copy.plan.status[p.status];
  return (
    <section
      className={`plan ${moment}${isFresh(p.id) ? " enter" : ""}`}
      aria-label={copy.plan.title}
      onKeyDown={onKeyDown}
    >
      <div className="head">
        <span className="serif">{copy.plan.heading(p.steps.length)}</span>
        <span className="small faint">{copy.plan.proposedOn(p.turn)}</span>
        <span className={`status plan-${p.status}`}>{statusWord}</span>
      </div>
      <p className="goal">
        <span className="lbl">{copy.stream.goal}</span>
        {p.goal}
      </p>
      {p.rationale && <p className="small muted why">{p.rationale}</p>}
      <div className="steps">
        {p.steps.map((st, i) => {
          const gate = gateFor(st, i);
          const state = gate ? "gate" : st.status;
          const over = st.status === "done" && st.actualTokens > st.estTokens;
          const under = st.status === "done" && st.actualTokens <= st.estTokens;
          const detail = gate
            ? copy.plan.waitsBelow
            : st.risk === "irreversible" && st.status !== "done"
              ? copy.plan.waitsAtGate
              : st.detail;
          return (
            <div className={`pstep ${state}`} key={st.id}>
              <span className="n" aria-hidden="true">
                {st.status === "done" ? <Icon d={ICONS.check} size={12} /> : i + 1}
              </span>
              <span className="t">
                <span className="title">{st.title}</span>
                {detail && <span className="d">{detail}</span>}
                {owners?.[st.id] && (
                  <span className="owner">{copy.council.owner(owners[st.id] ?? "")}</span>
                )}
                <span className="sr-only"> · {copy.plan.stepStatus[st.status]}</span>
              </span>
              <span className={`pill risk sm ${st.risk}`}>{st.risk}</span>
              <span
                className={`used${st.status === "running" ? " sofar" : over ? " over" : under ? " under" : ""}`}
              >
                {st.status === "pending"
                  ? "—"
                  : st.status === "running"
                    ? copy.plan.soFar(compactTokens(tokensSoFar(s, st)))
                    : st.actualTokens.toLocaleString("en-US")}
                {st.status === "done" && <span className="sr-only"> {copy.plan.usedWord}</span>}
              </span>
              <span className="est">{st.estTokens.toLocaleString("en-US")}</span>
            </div>
          );
        })}
      </div>
      <div className="totals">
        <span className="budget" aria-hidden="true">
          <i style={{ width: pct(used) }} />
          <s className="tick est" style={{ left: pct(p.estTokens) }} />
        </span>
        <span className="cap mono">
          {budget
            ? copy.plan.ofBudget(compactTokens(used), compactTokens(budget))
            : copy.plan.usedOfEst(compactTokens(used), compactTokens(p.estTokens))}
        </span>
        <span className="foot small muted">{copy.plan.totals(p.estTokens, used, budget)}</span>
      </div>
      {!live && <p className="small faint">{copy.plan.replaced}</p>}
      {live && (
        <div className="rating">
          {showStars && (
            <Stars
              value={mine?.rating ?? null}
              onChange={rate}
              label={copy.rating.ratePlan}
              readonly={!canRate}
            />
          )}
          {canRate && (
            <input
              className="input sm note"
              aria-label={copy.plan.noteHint}
              placeholder={copy.plan.noteHint}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
          <span className="mono progress">
            {copy.plan.progress(
              r.count,
              s.policy.planApproval.min,
              r.average,
              copy.plan.statusWord[p.status],
            )}
            {p.status === "proposed" &&
            (r.count < s.policy.planApproval.min || r.average < s.policy.planApproval.average)
              ? ` · ${copy.plan.needs(s.policy.planApproval.min, s.policy.planApproval.average)}`
              : ""}
          </span>
        </div>
      )}
      {live && (raters.length > 0 || decidedBy) && (
        <div className="raters">
          {raters.map(([id, x]) => (
            <span className="rater" key={id} title={x.note || undefined}>
              <span className="serif">{name(id)}</span>
              <span className="sr-only"> {copy.plan.ratedIt} </span>
              <MiniStars n={x.rating} />
              <span className="mono">{x.rating}</span>
              {x.note && <q>{x.note}</q>}
            </span>
          ))}
          {p.status !== "proposed" && decidedBy && (
            <span className={`by${p.decidedBy === "policy" ? "" : " owner"}`}>
              {p.decidedBy === "policy" && <Icon d={ICONS.check} size={14} />}
              {decidedBy}
            </span>
          )}
        </div>
      )}
      {live && p.note && p.decidedBy && p.decidedBy !== "policy" && (
        <p className="small muted">{p.note}</p>
      )}
      {canDecide && (
        <div className="actions">
          <input
            className="input sm note"
            aria-label={copy.plan.decisionHint}
            placeholder={copy.plan.decisionHint}
            value={decisionNote}
            onChange={(e) => setDecisionNote(e.target.value)}
          />
          {p.status === "proposed" && (
            <button type="button" className="btn primary sm" onClick={() => decide("approved")}>
              {copy.plan.approveNow}
            </button>
          )}
          <button type="button" className="btn sm" onClick={() => decide("revise")}>
            {copy.plan.askRevise}
          </button>
          <button type="button" className="btn ghost sm danger" onClick={() => decide("rejected")}>
            {copy.plan.reject}
          </button>
          <span className="means">
            {p.status === "proposed" ? copy.plan.approveMeans : copy.plan.reviseMeans}
          </span>
        </div>
      )}
    </section>
  );
}

/** Tokens the running step has spent so far: the branch's total since the step started. */
function tokensSoFar(s: SessionState, st: PlanStepRecord): number {
  const total = s.usage.input + s.usage.output + s.usage.cacheRead + s.usage.cacheWrite;
  return Math.max(0, total - st.startedTokens);
}

/** Five tiny stars, `n` of them lit; the number beside them carries the value for readers. */
export function MiniStars({ n }: { n: number }) {
  return (
    <span className="mini" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} d={ICONS.star} size={11} className={i <= n ? "fill" : ""} />
      ))}
    </span>
  );
}
