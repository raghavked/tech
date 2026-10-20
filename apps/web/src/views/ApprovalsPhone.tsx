/**
 * The approvals queue on a phone (SCREENS.md §21 "Approvals", mobile-approvals 8.8): one stack
 * of cards under the top block. Each card is the sentence with the agent and session in serif
 * and the call in a mono chip; a gate card carries the stripe as its only gradient, the plain
 * navy "Release gate" pill, the `irreversible` pill, the quorum meter and a chocolate consequence
 * phrase ("your 4 grants it", "waits for Ana or Bo"); an exec card a 44 px full-width Approve
 * beside a quiet Deny; a card where the vote is in the green check, the locked stars and "Change
 * to deny"; a driver-only call "Bo has the baton; this one is his call" with Nudge. The filter
 * bar sits at the thumb. Opening a gate lifts the one sheet (Sheet.tsx) over the dimmed queue
 * with the opened card ringed: "The release gate.", the held call in a navy mono bar, the rule in
 * plain words, the voices ledger, the star tiles, the note, the tally line and Approve with N.
 */
import { type ReactNode, useState } from "react";
import {
  askParts,
  consequenceOf,
  DEFAULT_RATING,
  type QueueFilter,
  type QueueRow,
  rowState,
} from "../approvalsQueue.js";
import { average, copy } from "../copy.js";
import { paths } from "../router.js";
import { Sheet } from "../Sheet.js";
import { StarTiles } from "../stream/StarTiles.js";
import { Avatar, ICONS, Icon, Stars } from "../ui.js";

export type Vote = (
  v: "approve" | "deny",
  rating: number | null,
  override?: boolean,
  note?: string,
) => void;

/** The two-segment quorum meter: apricot where a vote counts, amber under the bar. One width everywhere. */
export function Meter({ quorum }: { quorum: QueueRow["quorum"] }) {
  if (!quorum) return null;
  return (
    <span className={`quorum${quorum.low ? " low" : ""}`} aria-hidden="true">
      {Array.from({ length: quorum.min }, (_, i) => (
        <i
          // biome-ignore lint/suspicious/noArrayIndexKey: the segments are identical
          key={i}
          className={
            i < quorum.count ? (quorum.low ? "low" : "on") : i === quorum.count ? "next" : ""
          }
        />
      ))}
    </span>
  );
}

/** The sentence: "Bo's agent in Checkout proration on Payments wants to deploy `checkout` to production." */
function Sentence({ r }: { r: QueueRow }) {
  return (
    <>
      <span className="serif">{r.agentName}</span> {copy.queue.in}{" "}
      <a className="serif sess" href={paths.session(r.projectId, r.sessionId)}>
        {r.sessionTitle}
      </a>{" "}
      {copy.queue.wantsTo}{" "}
      {askParts(r.action).map((p, i) =>
        p.code ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts are positional
          <code key={i}>{p.code}</code>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts are positional
          <span key={i}>{p.text}</span>
        ),
      )}
      .
    </>
  );
}

export function QueueCard({
  r,
  pick,
  open,
  onOpen,
  onVote,
  onNudge,
}: {
  r: QueueRow;
  pick: number | null;
  /** The sheet is up for this card: the card is ringed under the scrim. */
  open: boolean;
  onOpen: () => void;
  onVote: Vote;
  onNudge: () => void;
}) {
  const state = rowState(r);
  const rating = state === "voted" ? r.myRating : pick;
  const consequence = consequenceOf(r, pick);
  return (
    <article
      className={`grow s-${state}${r.ratings ? " gate" : ""}${open ? " open" : ""}`}
      data-key={r.key}
      aria-label={copy.approval.label}
    >
      <div className="say">
        <span className="txt">
          <Sentence r={r} />
        </span>
        {r.ratings && state !== "driver-only" && (
          <button
            type="button"
            className="btn ghost icon sm openg"
            aria-label={copy.queue.openGate}
            onClick={onOpen}
          >
            <Icon d={ICONS.chevron} size={14} />
          </button>
        )}
      </div>
      <div className="tags">
        {r.ratings && <span className="pill gate sm">{copy.queue.gatePill}</span>}
        <span className={`pill risk ${r.risk} sm`}>{r.risk}</span>
        {!r.ratings && <span className="needs">{r.needs}</span>}
        <span className="ago mono">{copy.queue.turn(r.turn)}</span>
      </div>
      {r.quorum && (
        <div className="qm">
          <Meter quorum={r.quorum} />
          <span className="n mono">
            {copy.queue.quorum(r.quorum.count, r.quorum.min, r.quorum.bar, r.quorum.average)}
          </span>
          {consequence && state !== "voted" && <span className="cons">{consequence}</span>}
        </div>
      )}
      {state === "voted" ? (
        <div className="act voted">
          <span className="in">
            <Icon d={ICONS.check} size={14} className="ok" />
            {copy.queue.yourVoteInShort}
            {r.ratings && r.myRating !== null && (
              <Stars
                value={r.myRating}
                onChange={() => undefined}
                size="sm"
                word={false}
                readonly
              />
            )}
          </span>
          {r.myVote === "approve" ? (
            <button type="button" className="btn ghost sm" onClick={() => onVote("deny", null)}>
              {copy.queue.changeToDeny}
            </button>
          ) : (
            <span className="cons">{consequence}</span>
          )}
        </div>
      ) : state === "driver-only" ? (
        <div className="act theirs">
          <span className="cons">{consequence}</span>
          <button type="button" className="btn ghost sm" onClick={onNudge}>
            {copy.queue.nudge(r.waitsFor.who ?? `the ${r.waitsFor.role}`)}
          </button>
        </div>
      ) : (
        <div className="act">
          <button
            type="button"
            className="btn primary"
            onClick={() => onVote("approve", r.ratings ? (rating ?? DEFAULT_RATING) : null)}
          >
            {r.ratings ? (
              <>
                {copy.queue.approve} <span className="mono">with {rating ?? DEFAULT_RATING}</span>
              </>
            ) : (
              copy.queue.approve
            )}
          </button>
          <button type="button" className="btn ghost danger" onClick={() => onVote("deny", null)}>
            {copy.queue.deny}
          </button>
        </div>
      )}
    </article>
  );
}

/** The filter bar at the thumb: Needs you / Gates / Others / All with the counts as discs. */
export function ThumbFilters({
  filters,
  active,
  counts,
  onPick,
}: {
  filters: QueueFilter[];
  active: QueueFilter;
  counts: Record<QueueFilter, number>;
  onPick: (f: QueueFilter) => void;
}) {
  return (
    <div className="thumb">
      <fieldset className="seg" aria-label={copy.queue.filterLabel}>
        {filters.map((f) => (
          <button
            type="button"
            key={f}
            className={active === f ? "on" : ""}
            aria-pressed={active === f}
            onClick={() => onPick(f)}
          >
            {copy.queue.phoneFilters[f]}
            <span className="n">{counts[f]}</span>
          </button>
        ))}
      </fieldset>
    </div>
  );
}

/**
 * The gate sheet (mobile-approvals; the rating sheet on the manager page is this sheet): the
 * held call in a navy mono bar with a lock and "held", the rule in plain words, the voices
 * ledger with dashed rings for people still to act, the star tiles, the note, the tally line
 * "Your 4 grants it", Approve with N beside a quiet Deny, and the fine print.
 */
export function GateSheet({
  r,
  pick,
  onPick,
  onVote,
  onClose,
}: {
  r: QueueRow;
  pick: number | null;
  onPick: (n: number) => void;
  onVote: Vote;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const state = rowState(r);
  const mine = state === "voted";
  const rating = mine ? r.myRating : pick;
  const n = rating ?? DEFAULT_RATING;
  const consequence = consequenceOf(r, pick);
  const tally: ReactNode = r.quorum ? (
    <>
      <b>{r.quorum.count}</b> {copy.approval.ofRaters(r.quorum.min)}
      {r.quorum.count ? (
        <>
          {" · "}
          <b>{average(r.quorum.average)}</b> {copy.approval.average}
        </>
      ) : (
        <> · {copy.approval.noneYet}</>
      )}
    </>
  ) : null;
  return (
    <Sheet
      onClose={onClose}
      label={copy.approval.gateKicker}
      closeLabel={copy.queue.later}
      detent="full"
      className="gatesheet"
      head={
        <span className="ttl">
          <span className="serif">{copy.queue.gateSheet}</span>
          <span className="sub">
            {r.agentName} · {r.sessionTitle}
          </span>
        </span>
      }
      primary={
        mine ? undefined : (
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              onVote("approve", n, false, note.trim());
              onClose();
            }}
          >
            {copy.queue.approve} <span className="mono">with {n}</span>
          </button>
        )
      }
      quiet={
        mine ? (
          r.myVote === "approve" ? (
            <button
              type="button"
              className="btn ghost danger"
              onClick={() => {
                onVote("deny", null, false, note.trim());
                onClose();
              }}
            >
              {copy.queue.changeToDeny}
            </button>
          ) : undefined
        ) : (
          <button
            type="button"
            className="btn ghost danger"
            onClick={() => {
              onVote("deny", null, false, note.trim());
              onClose();
            }}
          >
            {copy.queue.deny}
          </button>
        )
      }
      fine={mine ? copy.queue.yourVoteIn : copy.queue.fine(DEFAULT_RATING)}
    >
      <p className="ask">
        <Sentence r={r} />
      </p>
      <div className="held" title={copy.queue.heldCall}>
        <Icon d={ICONS.gate} size={14} />
        <code>{r.code ?? r.action.replace(/`/g, "")}</code>
        <span className="tag">{copy.queue.held}</span>
      </div>
      <p className="rule">
        <span className={`pill risk ${r.risk} sm`}>{r.risk}</span> {r.needs}.{" "}
        {copy.approval.anyDeny}
      </p>
      <section className="voices" aria-label={copy.queue.voices}>
        {r.votes.map((v) => (
          <div key={v.who} className={`vote ${v.vote === "deny" ? "deny" : "rated"}`}>
            <Avatar id={v.who} name={v.who} />
            <span className="who serif">{v.who}</span>
            <span className="st">{copy.approval.voted(v.vote === "approve", v.rating)}</span>
            {v.note && <q className="q">{v.note}</q>}
          </div>
        ))}
        {r.waitingFor.map((who) => (
          <div key={who} className="vote waiting">
            <i className="ring" aria-hidden="true" />
            <span className="who serif">{who}</span>
            <span className="st">{copy.approval.notYet}</span>
          </div>
        ))}
        {r.votes.length === 0 && r.waitingFor.length === 0 && (
          <p className="small faint">{copy.queue.noVotes}</p>
        )}
      </section>
      {r.ratings && state !== "driver-only" && (
        <section className="rate" aria-label={copy.queue.yourRating}>
          <span className="lbl">{copy.queue.yourRating}</span>
          <StarTiles value={rating} onChange={onPick} readonly={mine} />
          {!mine && (
            <input
              className="input note"
              aria-label={copy.approval.noteHint}
              placeholder={copy.approval.noteHint}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </section>
      )}
      <p className="tline">
        {tally}
        {consequence && (
          <>
            {" · "}
            <span className="cons">{consequence}</span>
          </>
        )}
      </p>
    </Sheet>
  );
}
