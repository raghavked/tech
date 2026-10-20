/**
 * The approval in the stream (approval-notice, release-gate): one sentence a person can answer
 * with one press, the rule in plain words, the votes as rows, and under a release gate the tally
 * with its two segments, the stars with the default baked into "Approve with 4", and the plan
 * step the gate waits at ("step 3 of 3 · Deploy to production") so the plan's row and the notice
 * are one object. Decided, it thins to a divider with the check drawing itself: the result line
 * takes the buttons' place and says "(edited)", one message edited in place.
 */
import {
  type ApprovalRecord,
  describeRule,
  isRatingsRule,
  minimumRank,
  rankOf,
  ruleFor,
  type SessionState,
} from "@henosis/kernel";
import type { Actor } from "@henosis/protocol";
import { type KeyboardEvent, memo, useState } from "react";
import { DEFAULT_RATING, ratingProgress } from "../approvalsQueue.js";
import type { HenosisClient } from "../client.js";
import { average, copy } from "../copy.js";
import { isTyping } from "../shortcuts.js";
import { Avatar, ICONS, Icon, PHONE_QUERY, Stars, useMediaQuery } from "../ui.js";
import { describeCall } from "./blocks.js";
import { isFresh } from "./clock.js";
import { MiniStars } from "./PlanCard.js";
import { StarTiles } from "./StarTiles.js";

/** What an approval row shows, as one string: the state is cloned on every event, so compare by value. */
function approvalSig(s: SessionState, id: string, meId: string): string {
  const a = s.approvals[id];
  if (!a) return "";
  const name = (k: string) => s.participants[k]?.actor.name ?? k;
  const votes = Object.entries(a.ballots).map(
    ([k, b]) => `${name(k)}=${b.vote}:${b.rating ?? ""}:${b.note}`,
  );
  const gate = ratingProgress(s, a);
  const step = a.planId ? s.plans[a.planId]?.steps[a.stepIndex ?? -1]?.title : "";
  const people = Object.keys(s.participants).join(",");
  return [
    a.status,
    describeRule(ruleFor(s.policy.approvals, a.call.risk)),
    gate ? `${gate.count}/${gate.min}/${gate.average}` : "",
    step ?? "",
    people,
    rankOf(s, meId),
    ...votes,
  ].join("|");
}

export const ApprovalNotice = memo(ApprovalNoticeRow, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.client === next.client &&
    prev.me.id === next.me.id &&
    prev.lit === next.lit &&
    approvalSig(prev.s, prev.id, prev.me.id) === approvalSig(next.s, next.id, next.me.id)
  );
});

function ApprovalNoticeRow({
  s,
  id,
  client,
  me,
  lit = false,
}: {
  s: SessionState;
  id: string;
  client: HenosisClient;
  me: Actor;
  /** The approval that ended the tour: it wears the halo for a while. */
  lit?: boolean;
}) {
  const a = s.approvals[id];
  // A release gate: the person picks a rating (and may add a note) before approving.
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState("");
  // The phone's rating control is the five star tiles (mobile-session); a second tap clears.
  const phone = useMediaQuery(PHONE_QUERY);
  if (!a) return null;
  const name = (k: string) => s.participants[k]?.actor.name ?? k;
  const d = describeCall(a.call);
  const rule = ruleFor(s.policy.approvals, a.call.risk);
  const gate = ratingProgress(s, a);
  const step = stepOf(s, a);
  if (a.status !== "pending") return <Decided a={a} s={s} ask={d.ask} gate={gate !== null} />;
  const ratings = isRatingsRule(rule);
  const min = minimumRank(rule);
  const ballots = Object.entries(a.ballots);
  const humans = Object.values(s.participants).filter((p) => p.actor.kind === "human");
  const eligible = humans.filter((p) => rankOf(s, p.actor.id) >= min);
  const waiting = eligible.filter((p) => !a.ballots[p.actor.id]);
  const mine = a.ballots[me.id] ?? null;
  const canVote = rankOf(s, me.id) >= min;
  const vote = (v: "approve" | "deny") =>
    client.send({
      type: "vote",
      approvalId: a.id,
      vote: v,
      note: note.trim(),
      ...(gate && v === "approve" ? { rating: rating ?? DEFAULT_RATING } : {}),
    });
  // Keys printed on the thing they act on: 1–5 rate while the notice has focus and nobody types.
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!gate || isTyping(e.target as HTMLElement) || e.metaKey || e.ctrlKey || e.altKey) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 5) {
      setRating(n);
      e.preventDefault();
    }
  };
  const othersIn = ballots.filter(([k]) => k !== me.id).map(([k]) => name(k));
  const pick = rating ?? DEFAULT_RATING;
  return (
    <section
      className={`notice ${gate ? "gate" : a.call.risk}${isFresh(a.id) ? " enter" : ""}${lit ? " lit" : ""}`}
      aria-label={copy.approval.label}
      data-approval={a.id}
      onKeyDown={onKeyDown}
    >
      <span className="kind">
        {gate ? copy.approval.gateKicker : copy.approval.kicker}
        {step && (
          <>
            {" · "}
            {copy.approval.stepKicker(step.k, step.m)} · <i className="serif i">{step.title}</i>
          </>
        )}
      </span>
      <div className="ask">
        {gate && <span className="serif lead">{copy.approval.theGate} </span>}
        {copy.approval.wantsTo}
        {d.verb} <span className="command">{d.object}</span>{" "}
        <span className={`pill risk ${a.call.risk}`}>{a.call.risk}</span>
        {"; "}
        {copy.approval.needs(describeRule(rule))}.
      </div>
      <div className={`ledger${gate ? " gated" : ""}`}>
        <div className="votes">
          {ballots.map(([k, b]) => (
            <VoteRow
              key={k}
              who={name(k)}
              id={k}
              role={s.participants[k]?.role ?? ""}
              me={k === me.id}
              driver={s.driver === k}
              note={b.note}
              rating={b.rating}
              kind={
                b.vote === "deny"
                  ? "deny"
                  : ratings && (b.rating === null || rankOf(s, k) < min)
                    ? "voice"
                    : rankOf(s, k) < min
                      ? "voice"
                      : "rated"
              }
            />
          ))}
          {gate &&
            !mine &&
            waiting.length <= 4 &&
            waiting.map((p) => (
              <VoteRow
                key={p.actor.id}
                who={name(p.actor.id)}
                id={p.actor.id}
                role={p.role}
                me={p.actor.id === me.id}
                driver={s.driver === p.actor.id}
                rating={null}
                kind="waiting"
                decides={gate !== null && gate.min - gate.count === 1}
              />
            ))}
        </div>
        {gate && <Tally gate={gate} ballots={a.ballots} />}
      </div>
      {gate && !mine && canVote && (
        <div className={`rating${phone ? " tiles" : ""}`}>
          <span className="lbl">{copy.plan.yourRating}</span>
          {phone ? (
            <StarTiles value={rating} onChange={(n) => setRating(n || null)} />
          ) : (
            <Stars value={rating} onChange={setRating} />
          )}
          {!phone && (
            <span className="mono picked">{rating ? copy.approval.picked(rating) : ""}</span>
          )}
          <input
            className="input sm note"
            aria-label={copy.approval.noteHint}
            placeholder={copy.approval.noteHint}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}
      {!mine && (
        <div className="actions">
          <button type="button" className="btn primary sm" onClick={() => vote("approve")}>
            {gate ? copy.approval.approveWith(pick) : copy.approval.approve}
          </button>
          <button type="button" className="btn ghost sm danger" onClick={() => vote("deny")}>
            {copy.approval.deny}
          </button>
          <span className="note">
            {gate
              ? rating === null
                ? copy.approval.withoutPick(DEFAULT_RATING)
                : othersIn.length
                  ? copy.approval.countsOnce(othersIn[0] ?? "")
                  : ""
              : canVote
                ? copy.approval.youCan(me.name)
                : copy.approval.voiceHint}
          </span>
          <span className="keys mono" aria-hidden="true">
            <kbd>a</kbd> {copy.approval.keyApprove} <kbd>d</kbd> {copy.approval.keyDeny}
            {gate && (
              <>
                {" "}
                <kbd>1–5</kbd> {copy.approval.keyRate}
              </>
            )}
          </span>
        </div>
      )}
      {mine && (
        <div className="actions">
          <span className="note">
            <Icon d={ICONS.check} size={14} className="ok" />{" "}
            {copy.approval.yourVoteIn(mine.vote === "approve", mine.rating)}
          </span>
          {mine.vote === "approve" && (
            <button type="button" className="btn ghost sm danger" onClick={() => vote("deny")}>
              {copy.approval.changeToDeny}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** The plan step the call waits at, one-based with the plan's length. */
function stepOf(
  s: SessionState,
  a: ApprovalRecord,
): { k: number; m: number; title: string } | null {
  if (!a.planId || a.stepIndex === null) return null;
  const plan = s.plans[a.planId];
  const st = plan?.steps[a.stepIndex];
  return plan && st ? { k: a.stepIndex + 1, m: plan.steps.length, title: st.title } : null;
}

function VoteRow({
  who,
  id,
  role,
  me,
  driver,
  note = "",
  rating,
  kind,
  decides = false,
}: {
  who: string;
  id: string;
  role: string;
  me: boolean;
  driver: boolean;
  note?: string;
  rating: number | null;
  kind: "rated" | "deny" | "voice" | "waiting";
  decides?: boolean;
}) {
  return (
    <div className={`vote ${kind}${me ? " me" : ""}`}>
      {kind === "waiting" ? (
        <i className="ring" aria-hidden="true" />
      ) : (
        <Avatar id={id} name={who} driver={driver} />
      )}
      <span className="who">{who}</span>{" "}
      {kind === "rated" && rating !== null && <MiniStars n={rating} />}
      <span className="st">
        {kind === "waiting"
          ? me
            ? decides
              ? copy.approval.decides
              : copy.approval.ratingNow
            : copy.approval.notYet
          : kind === "voice"
            ? `${copy.approval.voted(true, null)} · ${copy.approval.voice}`
            : copy.approval.voted(kind !== "deny", rating)}
      </span>{" "}
      <span className="role">
        {me ? `${copy.roles.you} · ` : ""}
        {driver ? copy.roles.driving : role}
      </span>
      {note && <q className="q">{note}</q>}
    </div>
  );
}

/** "1 of 2 raters · 3 average", two segments, and what one more rating does. */
function Tally({
  gate,
  ballots,
}: {
  gate: { count: number; min: number; average: number; bar: number };
  ballots: ApprovalRecord["ballots"];
}) {
  const low = gate.count > 0 && gate.average < gate.bar;
  const need = Math.max(0, gate.min - gate.count);
  const sum = Object.values(ballots).reduce(
    (n, b) => n + (b.vote === "approve" && b.rating !== null ? b.rating : 0),
    0,
  );
  // The lowest next rating that still clears the bar once `need` more are in (or one more when
  // the count is met but the average is short).
  const more = need > 0 ? need : 1;
  const lift = Math.ceil((gate.bar * (gate.count + more) - sum) / more);
  const r = Math.min(5, Math.max(1, lift));
  const consequence =
    need > 0
      ? lift > 5
        ? copy.approval.cannotLift(need)
        : copy.approval.oneMore(need, r)
      : low
        ? lift > 5
          ? copy.approval.cannotLift(1)
          : copy.approval.lifts(r)
        : "";
  const segments = Array.from({ length: gate.min }, (_, i) =>
    i < gate.count ? "on" : i === gate.count ? "next" : "",
  );
  return (
    <div className={`tally${low ? " low" : ""}`}>
      <span className="big">
        <b>{gate.count}</b> {copy.approval.ofRaters(gate.min)}
        <span className="sr-only"> ·</span>
      </span>
      <span className="avg">
        {gate.count ? (
          <>
            {" "}
            <b>{average(gate.average)}</b> {copy.approval.average}
          </>
        ) : (
          copy.approval.noneYet
        )}
      </span>
      <span className="quorum segs" aria-hidden="true">
        {segments.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional
          <i key={i} className={c} />
        ))}
      </span>
      <span className="need">
        {consequence} {copy.approval.anyDeny}
      </span>
    </div>
  );
}

/** Granted or denied: a divider; the check draws itself when the decision just landed. */
function Decided({
  a,
  s,
  ask,
  gate,
}: {
  a: ApprovalRecord;
  s: SessionState;
  ask: string;
  gate: boolean;
}) {
  const name = (k: string) => s.participants[k]?.actor.name ?? k;
  const granted = a.status === "granted";
  const by = Object.entries(a.votes)
    .filter(([, v]) => v === (granted ? "approve" : "deny"))
    .map(([k]) => name(k));
  const rated = Object.values(a.ballots).filter((b) => b.vote === "approve" && b.rating !== null);
  const avg = rated.length ? rated.reduce((n, b) => n + (b.rating ?? 0), 0) / rated.length : 0;
  // The draw plays only when the decision just arrived; history shows the finished check.
  const [fresh] = useState(() => isFresh(a.id) || Object.keys(a.ballots).length > 0);
  return (
    <div className={`divider decided${granted ? " ok" : " danger"}`}>
      {granted && <Icon d={ICONS.check} size={14} className={fresh ? "draw" : ""} />}
      <span>
        {granted ? copy.approval.approved : copy.approval.denied}: {ask}
        {by.length ? ` · ${by.join(", ")}` : ""}
        {gate && granted && rated.length
          ? copy.approval.gateSummary(rated.length, average(avg))
          : ""}
      </span>
      <span className="edited">{copy.stream.edited}</span>
    </div>
  );
}
