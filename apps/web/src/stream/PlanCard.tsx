/**
 * Plan first: the plan as a card in the stream. The goal, the steps with their estimates and
 * what they actually took, the totals against the budget, then the team's ratings: five stars
 * for the signed-in person, the count and average against the policy, and for an owner or
 * the driver the three decisions. It renders from `state.plans[planId]`, so it is live.
 */
import { planActualTokens, rankOf, ratingSummary, type SessionState } from "@henosis/kernel";
import { type Actor, ROLE_RANK } from "@henosis/protocol";
import { memo, useState } from "react";
import type { HenosisClient } from "../client.js";
import { copy } from "../copy.js";
import { Stars } from "../ui.js";

/** What the card shows, as one string: the state is cloned on every event, so compare by value. */
export function planSig(s: SessionState, planId: string, meId: string): string {
  const p = s.plans[planId];
  if (!p) return "";
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
  ].join("|");
}

export const PlanCard = memo(
  PlanCardRow,
  (prev, next) =>
    prev.planId === next.planId &&
    prev.client === next.client &&
    prev.me.id === next.me.id &&
    planSig(prev.s, prev.planId, prev.me.id) === planSig(next.s, next.planId, next.me.id),
);

function PlanCardRow({
  s,
  planId,
  me,
  client,
}: {
  s: SessionState;
  planId: string;
  me: Actor;
  client: HenosisClient;
}) {
  const p = s.plans[planId];
  const [note, setNote] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  if (!p) return null;
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const human = s.participants[me.id]?.actor.kind === "human";
  const rank = rankOf(s, me.id);
  const live = !p.supersededBy;
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
  return (
    <section className={`notice plan${live ? "" : " past-plan"}`} aria-label={copy.plan.title}>
      <div className="head">
        <span className="serif">{copy.plan.heading(p.steps.length)}</span>
        <span className="small faint">{copy.plan.proposedOn(p.turn)}</span>
        <span className={`status plan-${p.status}`}>{copy.plan.status[p.status]}</span>
      </div>
      <p className="goal">{p.goal}</p>
      {p.rationale && <p className="small muted">{p.rationale}</p>}
      <ol className="plansteps">
        {p.steps.map((st) => (
          <li className={`planstep ${st.status}`} key={st.id}>
            <span className="step-dot" aria-hidden="true" />
            <span className="body">
              <span className="title">{st.title}</span>
              {st.detail && <span className="d small muted">{st.detail}</span>}
            </span>
            <span className="meta small faint">
              {st.risk} · {copy.plan.est(st.estTokens)}
              {st.status === "done" ? ` · ${copy.plan.used(st.actualTokens)}` : ""}
              <span className="sr-only"> · {copy.plan.stepStatus[st.status]}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="small muted">{copy.plan.totals(p.estTokens, used, s.policy.tokenBudget)}</p>
      {!live && <p className="small faint">{copy.plan.replaced}</p>}
      {live && (
        <div className="rating">
          {showStars && <Stars value={mine?.rating ?? null} onChange={rate} disabled={!canRate} />}
          {canRate && (
            <input
              className="input sm note"
              aria-label={copy.plan.noteHint}
              placeholder={copy.plan.noteHint}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
          <span className="small muted progress">
            {copy.plan.progress(
              r.count,
              s.policy.planApproval.min,
              r.average,
              copy.plan.statusWord[p.status],
            )}
            {p.status !== "proposed" && decidedBy ? ` ${decidedBy}` : ""}
            {p.status === "proposed" && r.count < s.policy.planApproval.min
              ? ` · ${copy.plan.needs(s.policy.planApproval.min, s.policy.planApproval.average)}`
              : ""}
          </span>
        </div>
      )}
      {live && raters.length > 0 && (
        <div className="raters small faint">
          {raters.map(([id, x]) => (
            <span key={id}>
              {copy.plan.rated(name(id), x.rating)}
              {x.note ? ` · ${x.note}` : ""}
            </span>
          ))}
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
          <button type="button" className="btn ghost sm" onClick={() => decide("rejected")}>
            {copy.plan.reject}
          </button>
        </div>
      )}
    </section>
  );
}
