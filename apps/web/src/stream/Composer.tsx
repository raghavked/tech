/**
 * The composer (composer, session-view): one field with two listeners. The Agent | Team segment
 * decides who hears you; a mono chip beside it always says how the next send lands ("steer ·
 * goal"); the popover only edits what the chip says. Team mode washes the field apricot and
 * says "to the team" in italic serif. The hint line under the field names the keys and who you
 * are; while a plan waits it says what is refused; while the reader looks back the field goes
 * read-only with one chocolate "Return to now". Keys are printed on the field while nobody types.
 */
import type { SessionState } from "@henosis/kernel";
import type { Actor, DirectiveMode, PresenceEntry } from "@henosis/protocol";
import { useCallback, useRef, useState } from "react";
import type { HenosisClient } from "../client.js";
import { copy } from "../copy.js";
import { describeQueued, type QueuedMessage } from "../offlineQueue.js";
import { hotkeyLabel } from "../palette.js";
import { composingLine, PRESENCE_COMPOSING_TEAM, useComposing } from "../presence.js";
import { closeHint } from "../shell.js";
import { helpChordLabel } from "../shortcuts.js";
import { Avatar, ICONS, Icon } from "../ui.js";

const MODES: DirectiveMode[] = ["steer", "constrain", "pause", "resume", "cancel"];

export function Composer({
  s,
  me,
  client,
  connected,
  queued,
  presence,
  planWaits = false,
  readonly = null,
  liveStep = null,
}: {
  s: SessionState;
  me: Actor;
  client: HenosisClient;
  connected: boolean;
  /** Offline queue: what waits for the socket (see offlineQueue.ts). */
  queued: QueuedMessage[];
  presence: PresenceEntry[];
  /** Plan first: a proposed plan waits for the team's ratings. */
  planWaits?: boolean;
  /** replay-scrubber: the composer is read-only; the one action returns to now. */
  readonly?: { onReturn: () => void } | null;
  /** "The agent is running tests": what you send now reaches it when the step ends. */
  liveStep?: string | null;
}) {
  const [text, setText] = useState("");
  const [scope, setScope] = useState("goal");
  const [mode, setMode] = useState<DirectiveMode>("steer");
  const [interrupt, setInterrupt] = useState(false);
  const [more, setMore] = useState(false);
  const [to, setTo] = useState<"agent" | "team">("agent");
  const [showQueue, setShowQueue] = useState(false);
  const [focused, setFocused] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const role = s.participants[me.id]?.role ?? "observer";
  const driving = s.driver === me.id;
  const needsText = to === "team" || mode === "steer" || mode === "constrain";
  const past = readonly !== null;
  // presence-composing: tell the others while this person types; cleared on send, blur, idle.
  const sendPresence = useCallback(
    (status: string) => client.send({ type: "presence", status }),
    [client],
  );
  const composing = useComposing(sendPresence);
  const writing = composingLine(presence, me.id);
  const people = presence.filter((p) => p.online && p.actor.id !== me.id);
  // The send button presses: a glow ring leaves it for half a second after each send.
  const [pressed, setPressed] = useState(0);
  const submit = () => {
    composing.clear();
    if (needsText && !text.trim()) return;
    setPressed((n) => n + 1);
    if (to === "team") {
      client.send({ type: "note", text: text.trim() });
      setText("");
      if (ta.current) ta.current.style.height = "auto";
      return;
    }
    client.send({
      type: "directive",
      input: {
        text: text.trim() || mode,
        mode,
        scope: scope.trim() || "goal",
        supersedes: [],
        interrupt,
      },
    });
    setText("");
    setMore(false);
    if (ta.current) ta.current.style.height = "auto";
  };
  const grow = () => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };
  const typing = focused || text.length > 0;
  const hint = past
    ? null
    : to === "team"
      ? copy.composer.hintTeam(me.name)
      : planWaits
        ? copy.composer.hintPlan(me.name, role, driving)
        : liveStep
          ? copy.composer.hintLive(liveStep)
          : copy.composer.hint(
              me.name,
              role,
              driving,
              copy.composer.keys(hotkeyLabel(), helpChordLabel()),
              closeHint(),
            );
  return (
    <div className="composer-wrap">
      {planWaits && !past && (
        <p className="plan-waits small muted" role="status">
          <i className="dot awaiting xs" aria-hidden="true" />
          {copy.composer.planWaits}
        </p>
      )}
      <p className="composing small faint" aria-live="polite">
        {writing ?? ""}
      </p>
      <form
        className={`composer${to === "team" ? " to-team" : ""}${past ? " readonly" : ""}${typing ? " typing" : ""}`}
        aria-label={to === "team" ? copy.composer.labelTeam : copy.composer.label}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="field">
          <textarea
            ref={ta}
            rows={1}
            aria-label={copy.composer.directive}
            placeholder={
              past
                ? copy.composer.nothingSent
                : to === "team"
                  ? copy.composer.placeholderTeam
                  : needsText
                    ? copy.composer.placeholder
                    : copy.composer.placeholderFor(mode)
            }
            value={text}
            disabled={past}
            onFocus={() => setFocused(true)}
            onChange={(e) => {
              setText(e.target.value);
              grow();
              if (e.target.value.trim())
                composing.typing(to === "team" ? PRESENCE_COMPOSING_TEAM : undefined);
              else composing.clear();
            }}
            onBlur={() => {
              setFocused(false);
              composing.clear();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          {!typing && !past && (
            <span className="kbd key" aria-hidden="true">
              /
            </span>
          )}
        </div>
        <div className="bar">
          <fieldset className="seg" aria-label={copy.composer.sendTo} disabled={past}>
            <label className={to === "agent" ? "on" : ""}>
              <input
                type="radio"
                name="to"
                className="sr-only"
                checked={to === "agent"}
                onChange={() => setTo("agent")}
              />
              {copy.composer.toAgent}
            </label>
            <label className={to === "team" ? "on" : ""}>
              <input
                type="radio"
                name="to"
                className="sr-only"
                checked={to === "team"}
                onChange={() => {
                  setTo("team");
                  setMore(false);
                }}
              />
              {copy.composer.toTeam}
            </label>
          </fieldset>
          {to === "agent" && !past && (
            <button
              type="button"
              className={`chip mono how${mode !== "steer" || interrupt ? " on" : ""}`}
              aria-label={copy.composer.modeAndScope}
              aria-expanded={more}
              onClick={() => setMore((v) => !v)}
            >
              {mode} · <b>{scope}</b>
              {interrupt ? ` · ${copy.stream.interrupt}` : ""}
              <Icon d={ICONS.chevron} size={11} className="chev" />
            </button>
          )}
          {to === "team" && (
            <span className="to serif i">
              {copy.stream.toTheTeam}
              {people.length > 0 && (
                <span className="stack" aria-hidden="true">
                  {people.slice(0, 3).map((p) => (
                    <Avatar key={p.actor.id} id={p.actor.id} name={p.actor.name} />
                  ))}
                </span>
              )}
            </span>
          )}
          <div className="right">
            {!past && (
              <span className={`mode${typing ? " typing" : ""}`} aria-hidden="true">
                {typing ? copy.composer.typing : copy.composer.keysLive}
              </span>
            )}
            {past ? (
              <button type="button" className="btn primary sm" onClick={readonly.onReturn}>
                {copy.composer.returnToNow}
              </button>
            ) : (
              <button
                type="submit"
                key={pressed}
                className={`send${pressed ? " pressed" : ""}`}
                aria-label={to === "team" ? copy.composer.sendTeam : copy.composer.send}
                disabled={needsText && !text.trim()}
              >
                <Icon d={ICONS.send} />
              </button>
            )}
          </div>
        </div>
        {more && to === "agent" && !past && (
          <div className="popover">
            <div className="group">
              <span className="small muted">{copy.composer.mode}</span>
              <div className="row">
                {MODES.map((m) => (
                  <button
                    type="button"
                    key={m}
                    className={`chip${mode === m ? " on" : ""}`}
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="group">
              <label className="small muted" htmlFor="scope-input">
                {copy.composer.scope}
              </label>
              <input
                id="scope-input"
                className="input mono"
                value={scope}
                placeholder={copy.composer.scopeDefault}
                onChange={(e) => setScope(e.target.value)}
              />
            </div>
            <label className="row small">
              <input
                type="checkbox"
                checked={interrupt}
                onChange={(e) => setInterrupt(e.target.checked)}
              />
              {copy.composer.interruptNow}
            </label>
            <label className="row small">
              <input
                type="checkbox"
                checked={showQueue}
                onChange={(e) => setShowQueue(e.target.checked)}
              />
              {copy.composer.showQueue}
              {queued.length > 0 && <span className="faint">{queued.length}</span>}
            </label>
          </div>
        )}
      </form>
      {/* Decision 4 (error-states), the honest copy: what was typed under a dead socket is not
          sent; it is kept here, in order, until the person is back and presses Resend. */}
      {(!connected || queued.length > 0) && !readonly && (
        <p className="queue-note held small" role="status">
          <span className="chip warn">
            <Icon d={ICONS.clock} size={13} />
            {connected ? copy.composer.heldCount(queued.length) : copy.composer.held}
          </span>
          <button
            type="button"
            className="btn sm"
            disabled={!connected || queued.length === 0}
            title={connected ? undefined : copy.composer.resendWhenBack}
            onClick={() => client.resend()}
          >
            {copy.composer.resend}
          </button>
        </p>
      )}
      {showQueue && <QueueList queued={queued} s={s} client={client} />}
      <p className="hint small faint">
        {past ? (
          <>
            {copy.composer.viewingPast}
            <button type="button" className="linkish" onClick={readonly.onReturn}>
              {copy.composer.returnToNow}
            </button>
            {copy.composer.toSteer}
          </>
        ) : (
          <>
            {connected ? "" : copy.composer.reconnecting}
            {hint}
          </>
        )}
      </p>
    </div>
  );
}

/** The offline queue as quiet rows under the composer; each can be dropped before it sends. */
function QueueList({
  queued,
  s,
  client,
}: {
  queued: QueuedMessage[];
  s: SessionState;
  client: HenosisClient;
}) {
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const when = (at: number) =>
    new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return (
    <section className="queue small" aria-label={copy.composer.queueLabel}>
      {queued.length === 0 && <span className="faint">{copy.composer.nothingQueued}</span>}
      {queued.map((q, i) => (
        <div className="row" key={q.id}>
          <span className="faint mono">{i + 1}</span>
          <span className="grow ellipsis">{describeQueued(q.msg, name)}</span>
          <span className="faint">{when(q.at)}</span>
          <button
            type="button"
            className="btn ghost icon sm"
            aria-label={copy.composer.unqueue}
            onClick={() => client.unqueue(q.id)}
          >
            <Icon d={ICONS.close} size={12} />
          </button>
        </div>
      ))}
    </section>
  );
}
