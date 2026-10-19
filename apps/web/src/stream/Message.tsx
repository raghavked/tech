/**
 * The stream: the three message shapes (session-view), the step grid with its navy output
 * block, the join line with the mark closing once, the quiet dividers, and the edge of the past
 * when the reader looks back. Rows come from `useBlocks` and are windowed by `VirtualList`.
 *
 * Right-hand meta rule: people carry a time (when the client saw the message), the agent
 * carries "turn N · step k of m", and the viewed turn in replay carries "you are here".
 */
import { isRatingsRule, ruleFor, type SessionState } from "@henosis/kernel";
import type { Actor, SessionEvent } from "@henosis/protocol";
import { memo, useCallback, useEffect, useState } from "react";
import type { HenosisClient } from "../client.js";
import { copy } from "../copy.js";
import type { TurnMark } from "../replay.js";
import { Avatar, ICONS, Icon, Mark } from "../ui.js";
import { ApprovalNotice } from "./ApprovalNotice.js";
import { type Block, estimateHeight, type Step } from "./blocks.js";
import { isFresh, timeOf } from "./clock.js";
import { PlanCard } from "./PlanCard.js";
import { useBlocks } from "./useBlocks.js";
import { VirtualList } from "./VirtualList.js";

/** A padlock on the 16-grid for the step held at a release gate (not in ICONS: the set is shared). */
const LOCK = "M3.5 7.5h9v6h-9zM5.5 7.5V5.5a2.5 2.5 0 0 1 5 0v2";

/**
 * Plays an entrance once for a row that just arrived, then drops the class so re-renders and
 * remounts (the list windows its rows) never replay `card-in`.
 */
export function useEnter(eventId: string): boolean {
  const [enter, setEnter] = useState(() => isFresh(eventId));
  useEffect(() => {
    if (!enter) return;
    const t = setTimeout(() => setEnter(false), 500);
    return () => clearTimeout(t);
  }, [enter]);
  return enter;
}

export function Stream({
  events,
  s,
  me,
  client,
  agentName,
  showHandoff,
  past = null,
}: {
  events: SessionEvent[];
  s: SessionState;
  me: Actor;
  client: HenosisClient;
  /** "Ana's agent": the stream's name for the agent. */
  agentName: string;
  showHandoff: boolean;
  /** replay-scrubber: the marks ahead of the viewed turn, for the edge of the past. */
  past?: { marks: TurnMark[]; at: number } | null;
}) {
  const { blocks, version } = useBlocks(events, s, me.id);
  // Which tool steps are expanded lives here, so a row keeps it when it is unmounted off-screen.
  const [openSteps, setOpenSteps] = useState<ReadonlySet<string>>(() => new Set());
  const toggleStep = useCallback(
    (id: string) =>
      setOpenSteps((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const lastAgent = [...blocks].reverse().find((b) => b.kind === "agent")?.id ?? null;
  const renderBlock = useCallback(
    (b: Block) => {
      switch (b.kind) {
        case "human":
          return <HumanMessage b={b} s={s} meId={me.id} />;
        case "agent":
          return (
            <AgentMessage
              b={b}
              s={s}
              agentName={agentName}
              latest={b.id === lastAgent}
              here={past !== null && b.id === lastAgent}
              openSteps={openSteps}
              onToggle={toggleStep}
            />
          );
        case "join":
          return <JoinLine b={b} />;
        case "divider":
          return <div className={`divider${b.danger ? " danger" : ""}`}>{b.text}</div>;
        case "approval":
          return <ApprovalNotice s={s} id={b.approvalId} client={client} me={me} />;
        case "plan":
          return <PlanCard s={s} planId={b.planId} me={me} client={client} />;
        default:
          return null;
      }
    },
    [s, me, client, openSteps, toggleStep, agentName, lastAgent, past],
  );
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const contentions = Object.values(s.contentions).filter((c) => !c.resolved);
  const handoffs = Object.values(s.handoffs).filter(
    (h) => h.status === "pending" && h.to === me.id,
  );
  const canPick = s.driver === me.id || s.participants[me.id]?.role === "owner";
  return (
    <section className="column stream" aria-label={copy.stream.label}>
      {blocks.length === 0 && <p className="muted stream-empty">{copy.stream.empty}</p>}
      <VirtualList
        items={blocks}
        version={version}
        keyOf={blockKey}
        estimate={estimateHeight}
        render={renderBlock}
      />
      {contentions.map((c) => (
        <section className="notice contention" key={c.id} aria-label={copy.stream.contention}>
          <span className="kind">{copy.stream.contention}</span>
          <span className="ask">
            {copy.stream.contentionBefore}
            <b className="mono">{c.scope}</b>
            {copy.stream.contentionAfter}
            {s.driver === me.id ? copy.stream.youPick : copy.stream.theyPick(name(s.driver ?? ""))}.
          </span>
          {c.directiveIds.map((id, i) => {
            const d = s.directives[id];
            if (!d) return null;
            return (
              <div className={`option${d.author === me.id ? " mine" : ""}`} key={id}>
                <span className="n mono" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="what">
                  {d.input.text}{" "}
                  <span className="faint serif i">
                    {d.author === me.id ? copy.stream.yours : name(d.author)}
                  </span>
                </span>
                <span className="actions">
                  {canPick && (
                    <button
                      type="button"
                      className="btn sm"
                      aria-label={`Pick: ${d.input.text}`}
                      onClick={() =>
                        client.send({ type: "resolve", contentionId: c.id, winner: id })
                      }
                    >
                      {copy.stream.pick}
                    </button>
                  )}
                  {d.author === me.id && (
                    <button
                      type="button"
                      className="btn ghost sm"
                      aria-label={`Withdraw: ${d.input.text}`}
                      onClick={() => client.send({ type: "withdraw", directiveId: id })}
                    >
                      {copy.stream.withdraw}
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </section>
      ))}
      {showHandoff &&
        handoffs.map((h) => (
          <section className="notice handoff" key={h.id} aria-label={copy.stream.baton}>
            <span className="kind">{copy.stream.baton}</span>
            <span className="ask">
              <b className="serif">{name(h.from)}</b> {copy.stream.offersYou}
            </span>
            <span className="small muted">{copy.stream.acceptMeans}</span>
            <div className="actions">
              <button
                type="button"
                className="btn primary sm"
                onClick={() => client.send({ type: "handoff.accept", handoffId: h.id })}
              >
                {copy.stream.accept}
              </button>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => client.send({ type: "handoff.decline", handoffId: h.id })}
              >
                {copy.stream.decline}
              </button>
            </div>
          </section>
        ))}
      {past && <EdgeOfThePast marks={past.marks} at={past.at} />}
    </section>
  );
}

const blockKey = (b: Block) => b.id;

// ---- the three shapes ----------------------------------------------------------------------

const HumanMessage = memo(function HumanMessage({
  b,
  s,
  meId,
}: {
  b: Extract<Block, { kind: "human" }>;
  s: SessionState;
  meId: string;
}) {
  const enter = useEnter(b.id);
  const when = timeOf(b.id);
  const mine = b.actorId === meId;
  return (
    <div
      className={`msg ${b.team ? "team" : "human"}${mine ? " mine" : ""}${enter ? " enter" : ""}`}
    >
      <div className="meta">
        <Avatar id={b.actorId} name={b.who} driver={s.driver === b.actorId} />
        <span className="who">{b.who}</span>
        {b.team ? (
          <span className="to">{copy.stream.toTheTeam}</span>
        ) : (
          <>
            {b.scope && <span className="scope mono">{b.scope}</span>}
            {b.sub && <span className="scope mono sub">{b.sub}</span>}
          </>
        )}
        <span className="when">{when ?? copy.stream.turn(b.turn)}</span>
      </div>
      <div className="text">
        {b.goal && !b.team && <span className="goal">{copy.stream.goal}</span>}
        {b.text}
      </div>
    </div>
  );
});

const AgentMessage = memo(function AgentMessage({
  b,
  s,
  agentName,
  latest,
  here,
  openSteps,
  onToggle,
}: {
  b: Extract<Block, { kind: "agent" }>;
  s: SessionState;
  agentName: string;
  /** The newest agent block: its unfinished step is live (or held at a gate). */
  latest: boolean;
  /** Replay: the viewed turn. */
  here: boolean;
  openSteps: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  const enter = useEnter(b.id);
  const running = s.status === "running";
  const when = timeOf(b.id);
  return (
    <div className={`msg agent${enter ? " enter" : ""}`}>
      <div className="meta">
        <span className="who">
          <span className="avatar agent sm" aria-hidden="true" />
          {agentName}
        </span>
        <span className="turn">
          {copy.stream.turn(b.turn)}
          {b.step ? ` · ${copy.stream.stepOf(b.step.k, b.step.m)}` : ""}
          {here ? ` · ${when ?? ""}${when ? " · " : ""}${copy.stream.youAreHere}` : ""}
        </span>
      </div>
      {b.text && <div className="text">{b.text}</div>}
      {b.steps.length > 0 && (
        <div className="steps">
          {b.steps.map((st) => (
            <StepLine
              key={st.id}
              step={st}
              state={stepState(st, s, latest && running)}
              open={openSteps.has(st.id)}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/** `gate`: held at a release gate (a ratings rule); `held`: held for an ordinary approval. */
type StepState = "done" | "fail" | "live" | "held" | "gate" | "pending";

/** A step that has not finished is live while the turn runs, held while its approval waits. */
function stepState(st: Step, s: SessionState, live: boolean): StepState {
  if (st.ok === true) return "done";
  if (st.ok === false) return "fail";
  const waits = Object.values(s.approvals).find(
    (a) => a.status === "pending" && a.call.id === st.id,
  );
  if (waits) return isRatingsRule(ruleFor(s.policy.approvals, waits.call.risk)) ? "gate" : "held";
  return live ? "live" : "pending";
}

export function StepLine({
  step,
  state,
  open,
  onToggle,
}: {
  step: Step;
  state: StepState;
  open: boolean;
  onToggle: (id: string) => void;
}) {
  const line = state === "done" || state === "fail" ? step.done : step.doing;
  const held = state === "held" || state === "gate";
  const result =
    state === "live"
      ? copy.steps.now
      : held
        ? copy.steps.waiting
        : state === "pending"
          ? ""
          : step.result;
  return (
    <div className={`step ${held ? "held" : state}${open ? " open" : ""}`}>
      <button
        type="button"
        className="step-head"
        aria-expanded={open}
        onClick={() => onToggle(step.id)}
      >
        {state === "live" ? (
          <i className="livedot" aria-hidden="true" />
        ) : (
          <Icon d={held ? LOCK : state === "done" ? ICONS.check : step.icon} size={14} />
        )}
        <span className="line mono">
          {line}
          {held && <b> · {state === "gate" ? copy.steps.heldAtGate : copy.steps.held}</b>}
        </span>
        <span className="result mono">{result}</span>
        <Icon d={ICONS.chevron} size={12} className={`chev${open ? " open" : ""}`} />
      </button>
      {open && (
        <pre className="out">
          {step.args}
          {step.output ? `\n\n${step.output.split("\n").slice(0, 20).join("\n")}` : ""}
        </pre>
      )}
    </div>
  );
}

/** "Cy joins the circle · as contributor · 09:14": the 30 px mark closes once when it is new. */
export function JoinLine({ b }: { b: Extract<Block, { kind: "join" }> }) {
  const enter = useEnter(b.id);
  const when = timeOf(b.id);
  return (
    <div className={`divider join${enter ? " enter" : ""}`}>
      <Mark size={30} joining={enter} className={enter ? "once" : ""} />
      <span>
        <b className="serif">{b.who}</b> {copy.stream.joinsTheCircle}
      </span>
      <span className="sub">
        {b.agent ? copy.stream.asAgent : copy.stream.asRole(b.role)}
        {when ? ` · ${when}` : ""}
      </span>
    </div>
  );
}

/** The dashed edge where the viewed turn ends: what comes next, as quiet chips. */
export function EdgeOfThePast({ marks, at }: { marks: TurnMark[]; at: number }) {
  const ahead = marks.slice(at + 1);
  if (ahead.length === 0) return null;
  const chips = [...ahead.filter((m) => m.gate), ...ahead.filter((m) => !m.gate)]
    .sort((a, b) => a.turn - b.turn)
    .slice(0, 4);
  return (
    <section className="edge" aria-label={copy.replay.edgeLabel}>
      <div className="divider">
        <span>
          <Icon d={ICONS.handoff} size={13} />
          <b>{copy.replay.goesOn}</b> · {copy.replay.moreTurns(ahead.length)}
        </span>
      </div>
      <div className="next">
        {chips.map((m) => (
          <span className="chip mono" key={m.turn}>
            {copy.stream.turn(m.turn)} · {m.what}
          </span>
        ))}
      </div>
    </section>
  );
}
