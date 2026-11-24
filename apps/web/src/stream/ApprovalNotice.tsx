/**
 * The approval in the stream (approval-notice, release-gate, sig-approval-dial): one sentence a
 * person can answer with one press and the rule in plain words. Under a release gate the rating
 * is a dial: the rule's bar is the notch in its rim, the team's average so far its needle, your
 * pick its hand, resting at the rating a plain Approve sends. Beside the face stand the word,
 * the number and what the pick does to the gate; under both the ballots run as rows, each with
 * the same dial in miniature, then the tally and the one button that carries the number it
 * sends. The plan step the gate waits at ("step 3 of 3 · Deploy to production") is on the kicker
 * so the plan's row and the notice are one object. Decided, it thins to a divider: the result
 * line takes the buttons' place and says "(edited)", and a gate that opened closes its ring.
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
import { Avatar, ICONS, Icon, ratingLevel } from "../ui.js";
import { describeCall } from "./blocks.js";
import { isFresh } from "./clock.js";
import { Dial, type DialGate, MiniDial } from "./RatingDial.js";

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

type BallotKind = "rated" | "deny" | "voice" | "waiting";

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
  // A release gate: the person turns the dial (and may add a note) before approving.
  const [rating, setRating] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [note, setNote] = useState("");
  if (!a) return null;
  const name = (k: string) => s.participants[k]?.actor.name ?? k;
  const d = describeCall(a.call);
  const rule = ruleFor(s.policy.approvals, a.call.risk);
  const gate = ratingProgress(s, a);
  const step = stepOf(s, a);
  if (a.status !== "pending") return <Decided a={a} s={s} ask={d.ask} gate={gate} />;
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
  // Keys printed on the thing they act on: 1–5 rate and 0 clears while the notice has focus and nobody types.
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!gate || mine || !canVote) return;
    if (isTyping(e.target as HTMLElement) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!/^[0-5]$/.test(e.key)) return;
    setRating(e.key === "0" ? null : Number(e.key));
    e.preventDefault();
  };
  const kindOf = (k: string, b: ApprovalRecord["ballots"][string]): BallotKind =>
    b.vote === "deny"
      ? "deny"
      : rankOf(s, k) < min || (ratings && b.rating === null)
        ? "voice"
        : "rated";
  const pick = rating ?? DEFAULT_RATING;
  const rates = gate !== null && !mine && canVote;
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
      {gate ? (
        <>
          <div className="gate-face">
            <Dial
              value={mine ? mine.rating : rating}
              onChange={setRating}
              onClear={() => setRating(null)}
              onPreview={setPreview}
              gate={gate}
              rest={rates ? DEFAULT_RATING : null}
              readonly={!rates}
            />
            <Reading
              gate={gate}
              rating={rating}
              preview={preview}
              sent={mine ? (mine.vote === "approve" ? mine.rating : null) : undefined}
              voice={!canVote}
              onClear={() => setRating(null)}
              note={note}
              onNote={setNote}
            />
          </div>
          <div className="ballots">
            {ballots.map(([k, b]) => (
              <Ballot
                key={k}
                who={name(k)}
                id={k}
                role={s.participants[k]?.role ?? ""}
                me={k === me.id}
                driver={s.driver === k}
                note={b.note}
                rating={b.rating}
                kind={kindOf(k, b)}
                gate={gate}
              />
            ))}
            {waiting.length <= 4 &&
              waiting.map((p) => (
                <Ballot
                  key={p.actor.id}
                  who={name(p.actor.id)}
                  id={p.actor.id}
                  role={p.role}
                  me={p.actor.id === me.id}
                  driver={s.driver === p.actor.id}
                  rating={p.actor.id === me.id ? rating : null}
                  kind="waiting"
                  gate={gate}
                />
              ))}
          </div>
          <Tally gate={gate} decides={rates && gate.min - gate.count === 1} />
        </>
      ) : (
        <div className="ledger">
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
                kind={kindOf(k, b)}
              />
            ))}
          </div>
        </div>
      )}
      {!mine && (
        <div className="actions">
          <button type="button" className="btn primary sm" onClick={() => vote("approve")}>
            {gate ? (
              <>
                {copy.approval.approveWithLead} <span className="num">{pick}</span>
              </>
            ) : (
              copy.approval.approve
            )}
          </button>
          <button type="button" className="btn ghost sm danger" onClick={() => vote("deny")}>
            {copy.approval.deny}
          </button>
          <span className="note">
            {gate
              ? !canVote
                ? copy.approval.voice
                : rating === null
                  ? copy.approval.ifYouLeaveIt(DEFAULT_RATING)
                  : copy.approval.pickedWord(rating)
              : canVote
                ? copy.approval.youCan(me.name)
                : copy.approval.voiceHint}
          </span>
          <span className="keys mono" aria-hidden="true">
            <kbd>a</kbd> {copy.approval.keyApprove} <kbd>d</kbd> {copy.approval.keyDeny}
            {rates && (
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

/** One more rating of `n`: the average with it, how many are still missing, whether the gate opens. */
function withPick(gate: DialGate, n: number): { avg: number; need: number; opens: boolean } {
  const count = gate.count + 1;
  const avg = (gate.average * gate.count + n) / count;
  const need = Math.max(0, gate.min - count);
  return { avg, need, opens: need === 0 && avg + 1e-9 >= gate.bar };
}

/** What the gate still needs once the ratings in are counted, in the tally's words. */
function stillNeeds(gate: DialGate): string {
  const low = gate.count > 0 && gate.average < gate.bar;
  const need = Math.max(0, gate.min - gate.count);
  // The lowest next rating that still clears the bar once `need` more are in (or one more when
  // the count is met but the average is short).
  const more = need > 0 ? need : 1;
  const lift = Math.ceil((gate.bar * (gate.count + more) - gate.average * gate.count) / more);
  const r = Math.min(5, Math.max(1, lift));
  if (need > 0) return lift > 5 ? copy.approval.cannotLift(need) : copy.approval.oneMore(need, r);
  if (low) return lift > 5 ? copy.approval.cannotLift(1) : copy.approval.lifts(r);
  return "";
}

/**
 * Beside the dial: the word in italic serif coloured by level, the number in mono, and what the
 * pick does to the gate in the tally's arithmetic. `sent` is your rating once it is in (null for
 * a deny); `voice` is a reader whose vote the rule does not count.
 */
function Reading({
  gate,
  rating,
  preview,
  sent,
  voice,
  onClear,
  note,
  onNote,
}: {
  gate: DialGate;
  rating: number | null;
  preview: number | null;
  sent: number | null | undefined;
  voice: boolean;
  onClear: () => void;
  note: string;
  onNote: (v: string) => void;
}) {
  if (sent !== undefined || voice) {
    const need = Math.max(0, gate.min - gate.count);
    return (
      <div className="say">
        <span className="lbl">{copy.plan.yourRating}</span>
        {sent != null && (
          <div className={`word ${ratingLevel(sent)}`}>
            <span className="w">{copy.rating.word(sent)}</span>
            <span className="n">{copy.approval.sent(sent)}</span>
          </div>
        )}
        {sent != null && !voice ? (
          <p className="then">
            {copy.approval.reading.yours} <b>{sent}</b>
            {copy.approval.reading.isIn} <span className="mono">{average(gate.average)}</span>
            {need > 0
              ? copy.approval.reading.more(need)
              : gate.average + 1e-9 < gate.bar
                ? copy.approval.reading.under(gate.bar)
                : "."}
          </p>
        ) : (
          <p className="then">
            {voice ? copy.approval.voiceHint : copy.approval.yourVoteIn(false, null)}
          </p>
        )}
        <p className="next">{copy.approval.anyDeny}</p>
      </div>
    );
  }
  const resting = rating === null && preview === null;
  const shown = preview ?? rating ?? DEFAULT_RATING;
  const then = withPick(gate, shown);
  let lowest: number | null = null;
  for (let n = 5; n >= 1; n--) if (withPick(gate, n).opens) lowest = n;
  const lastOne = gate.min - gate.count <= 1;
  return (
    <div className={`say${resting ? " rest" : ""}`}>
      <span className="lbl">{copy.plan.yourRating}</span>
      <div className={`word${resting ? "" : ` ${ratingLevel(shown)}`}`}>
        <span className="w" key={shown}>
          {copy.rating.word(shown)}
        </span>
        <span className="n">
          {preview !== null && preview !== rating
            ? copy.rating.previewing(preview)
            : rating === null
              ? copy.approval.ifYouLeaveIt(DEFAULT_RATING)
              : copy.approval.picked(rating)}
        </span>
        {rating !== null && (
          <button
            type="button"
            className="clear"
            aria-label={copy.rating.clearLabel}
            onClick={onClear}
          >
            {copy.rating.clear} <kbd>0</kbd>
          </button>
        )}
      </div>
      <p className="then" aria-live="polite">
        {resting ? copy.approval.reading.plain : copy.approval.reading.withYour} <b>{shown}</b>
        {resting ? copy.approval.reading.wouldBe : copy.approval.reading.is}{" "}
        <span className="mono">{average(then.avg)}</span>
        {then.need > 0
          ? copy.approval.reading.more(then.need)
          : then.opens
            ? copy.approval.reading.opens
            : copy.approval.reading.under(gate.bar)}
      </p>
      <p className="next">
        {lastOne && (lowest === null ? copy.approval.noneOpens : copy.approval.lowestOpens(lowest))}
        {!(lastOne && lowest !== null && lowest <= 1) && ` ${copy.approval.anyDeny}`}
      </p>
      <input
        className="input sm note"
        aria-label={copy.approval.noteHint}
        placeholder={copy.approval.noteHint}
        value={note}
        onChange={(e) => onNote(e.target.value)}
      />
    </div>
  );
}

/**
 * A ballot under a gate, as a row: the serif name with "you", the role in faint sans, the note
 * in italic serif, and the same dial in miniature beside the number and the word. A rater still
 * to come is an empty dashed rim; your own row mirrors the big dial while you turn it. The
 * sentence a reader hears ("Bo approved · 3 of 5") follows the name; the drawing is hidden.
 */
function Ballot({
  who,
  id,
  role,
  me,
  driver,
  note = "",
  rating,
  kind,
  gate,
}: {
  who: string;
  id: string;
  role: string;
  me: boolean;
  driver: boolean;
  note?: string;
  rating: number | null;
  kind: BallotKind;
  gate: DialGate;
}) {
  const live = kind === "waiting" && me;
  return (
    <div className={`ballot ${kind}${me ? " mine" : ""}`}>
      <Avatar id={id} name={who} driver={driver} />
      <span className="who">
        <span className="name">
          {who}
          <span className="sr-only">
            {" "}
            {kind === "waiting"
              ? me
                ? copy.approval.ratingNow
                : copy.approval.notYet
              : `${copy.approval.voted(kind !== "deny", rating)}${kind === "voice" ? ` · ${copy.approval.voice}` : ""}`}
          </span>
          {me && <span className="you"> {copy.roles.you}</span>}
        </span>
        <span className="role">{driver ? copy.roles.driving : role}</span>
      </span>
      {kind === "waiting" ? (
        <span className={`said state${live ? " live" : ""}`} aria-hidden="true">
          {live ? copy.approval.ratingNow : copy.approval.waiting}
        </span>
      ) : (
        <span className="said">{note && <q>{note}</q>}</span>
      )}
      <span className="cast" aria-hidden="true">
        {kind === "deny" ? (
          <span className="no">{copy.approval.voted(false, null)}</span>
        ) : (
          <>
            {kind === "voice" && <span className="voice-note">{copy.approval.voice}</span>}
            <MiniDial
              value={rating}
              gate={gate}
              rest={live ? DEFAULT_RATING : null}
              kind={kind === "voice" ? "voice" : kind === "waiting" && !me ? "waiting" : ""}
            />
            <span className="n">{rating ?? (live ? "" : "–")}</span>
            {kind !== "voice" && (
              <span className={`w${rating ? ` ${ratingLevel(rating)}` : ""}`}>
                {rating ? copy.rating.word(rating) : ""}
              </span>
            )}
          </>
        )}
      </span>
    </div>
  );
}

/** A vote on a plain approval, as a chip row: who, what they said, their role, their note. */
function VoteRow({
  who,
  id,
  role,
  me,
  driver,
  note = "",
  kind,
}: {
  who: string;
  id: string;
  role: string;
  me: boolean;
  driver: boolean;
  note?: string;
  kind: BallotKind;
}) {
  return (
    <div className={`vote ${kind}${me ? " me" : ""}`}>
      <Avatar id={id} name={who} driver={driver} />
      <span className="who">{who}</span>{" "}
      <span className="st">
        {kind === "voice"
          ? `${copy.approval.voted(true, null)} · ${copy.approval.voice}`
          : copy.approval.voted(kind !== "deny", null)}
      </span>{" "}
      <span className="role">
        {me ? `${copy.roles.you} · ` : ""}
        {driver ? copy.roles.driving : role}
      </span>
      {note && <q className="q">{note}</q>}
    </div>
  );
}

/**
 * "1 of 2 raters · 3 average" under the ballots: the quorum as segments, the counts in mono, and
 * the verdict in sans: what one more rating does, or that yours is the one that decides.
 */
function Tally({ gate, decides }: { gate: DialGate; decides: boolean }) {
  const low = gate.count > 0 && gate.average < gate.bar;
  const segments = Array.from({ length: gate.min }, (_, i) =>
    i < gate.count ? "on" : i === gate.count ? "next" : "",
  );
  return (
    <div className={`tally${low ? " low" : ""}`}>
      {/* biome-ignore lint/a11y/useSemanticElements: a <meter> cannot be drawn as one segment per rating the rule needs */}
      <span
        className="quorum"
        role="meter"
        aria-label={copy.approval.ratingsIn}
        aria-valuemin={0}
        aria-valuemax={gate.min}
        aria-valuenow={Math.min(gate.count, gate.min)}
      >
        {segments.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional
          <i key={i} className={c} />
        ))}
      </span>
      <span className="progress">
        <span className="mono">
          {gate.count} of {gate.min}
        </span>{" "}
        {copy.approval.ratersWord} ·{" "}
        {gate.count ? (
          <>
            <span className="mono avg">{average(gate.average)}</span> {copy.approval.average}
          </>
        ) : (
          copy.approval.noneYet
        )}
      </span>
      <span className="verdict">{decides ? copy.approval.yoursDecides : stillNeeds(gate)}</span>
    </div>
  );
}

/**
 * Granted or denied: a divider. The check draws itself when the decision just landed; a gate
 * that opened shows its dial instead, the hand at the average and the rim's two ends closed
 * into a ring.
 */
function Decided({
  a,
  s,
  ask,
  gate,
}: {
  a: ApprovalRecord;
  s: SessionState;
  ask: string;
  gate: DialGate | null;
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
    <div className={`divider decided${granted ? " ok" : " danger"}${fresh ? " fresh" : ""}`}>
      {granted &&
        (gate && rated.length ? (
          <MiniDial value={avg} gate={gate} kind="closed" />
        ) : (
          <Icon d={ICONS.check} size={14} className={fresh ? "draw" : ""} />
        ))}
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
