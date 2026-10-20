/**
 * The council (docs/19_council.md): a team's models deliberate on one task inside a group.
 * Three rooms share this file. The convene sheet (task, member models from the org's agent
 * profiles, chair, rounds, budget); the council room (the task, the rounds as sections with
 * each model's answer as a card, the discussion as a stream with stance words, the chair's
 * plan as the plan card with owners and the team's ratings, the assignments as live agent
 * cards, the conclusion with its dissent, and a token meter); and the instruct room, a
 * one-to-one with one model whose words land as steers in that agent's session. Everything
 * renders from the chat reducer's `councils`; the ratings come from the chair's session.
 */
import {
  type Council,
  type CouncilMember,
  type CouncilRound,
  type CouncilSaid,
  type CouncilStep,
  councilsOf,
  type Group,
  memberName,
  owedIn,
  roundSequence,
  sameCouncilMember,
} from "@henosis/chat";
import { usageTotal } from "@henosis/protocol";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { api, type ChatDirectoryListing, type Me, type SessionRow, useFetch } from "../api.js";
import { HenosisClient, wsUrl } from "../client.js";
import { copy } from "../copy.js";
import {
  councilCard,
  councilSessionOf,
  councilWord,
  instructionsFor,
  memberModels,
  modelsOf,
  modelWord,
  outcomeWord,
  ownerWord,
  roundTitle,
  toMember,
} from "../council.js";
import { EmptyState } from "../empty.js";
import { actorOf, type Identity } from "../identity.js";
import { paths } from "../router.js";
import { PlanCard } from "../stream/PlanCard.js";
import { AgentCard, Avatar, Dot, ICONS, Icon, Pill, TokenMeter } from "../ui.js";

/** A person's name as the group or the directory knows it; null when neither does. */
function personName(group: Group, directory: ChatDirectoryListing | null, id: string) {
  const member = group.members.find((m) => m.kind === "human" && m.userId === id);
  return (
    (member ? memberName(member) : null) ?? directory?.people.find((p) => p.id === id)?.name ?? null
  );
}

export interface ConveneInput {
  groupId: string;
  task: string;
  members: CouncilMember[];
  chair: CouncilMember;
  rounds: CouncilRound[];
  discussionRounds: number;
  budget: number | null;
}

// ---- the convene sheet ----------------------------------------------------------------------

export function ConveneSheet({
  group,
  meId,
  directory,
  onClose,
  onConvene,
}: {
  group: Group;
  meId: string;
  directory: ChatDirectoryListing | null;
  onClose: () => void;
  onConvene: (input: ConveneInput) => void;
}) {
  const models = useMemo(() => memberModels(directory), [directory]);
  const mine = models.find((m) => m.ownerId === meId);
  const [task, setTask] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(mine ? [mine.profileId] : []));
  const [chair, setChair] = useState<string>(mine?.profileId ?? "");
  const [individual, setIndividual] = useState(true);
  const [discussion, setDiscussion] = useState(true);
  const [discussionRounds, setDiscussionRounds] = useState("1");
  const [synthesis, setSynthesis] = useState(true);
  const [vote, setVote] = useState(true);
  const [budget, setBudget] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The profiles arrive a moment after the sheet opens: the convener's own model is in by default.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the list first lands
  useEffect(() => {
    if (!mine) return;
    setPicked((prev) => (prev.size ? prev : new Set([mine.profileId])));
    setChair((prev) => prev || mine.profileId);
  }, [mine?.profileId]);
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const nameOf = (id: string) => directory?.people.find((p) => p.id === id)?.name ?? id;
  const chosen = models.filter((m) => picked.has(m.profileId));
  const chairRow = models.find((m) => m.profileId === chair) ?? chosen[0];
  const submit = () => {
    const t = task.trim();
    if (!t) return setError(copy.council.needsTask);
    if (chosen.length === 0 || !chairRow) return setError(copy.council.needsMembers);
    const rounds: CouncilRound[] = [];
    if (individual) rounds.push("individual");
    if (discussion) rounds.push("discussion");
    if (synthesis) rounds.push("synthesis");
    if (synthesis && vote) rounds.push("vote");
    if (rounds.length === 0) rounds.push("individual");
    const n = Math.max(0, Math.min(5, Number.parseInt(discussionRounds, 10) || 0));
    const b = Number.parseInt(budget, 10);
    onConvene({
      groupId: group.id,
      task: t,
      members: chosen.map(toMember),
      chair: toMember(chairRow),
      rounds,
      discussionRounds: discussion ? Math.max(1, n) : 0,
      budget: Number.isFinite(b) && b > 0 ? b : null,
    });
    onClose();
  };
  return (
    <div className="sheet-wrap">
      <button
        type="button"
        className="sheet-dim"
        aria-label={copy.council.cancel}
        onClick={onClose}
      />
      <form
        className="sheet convene"
        aria-label={copy.council.sheet}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="row">
          <span className="serif grow">{copy.council.sheet}</span>
          <button
            type="button"
            className="btn ghost icon sm"
            aria-label={copy.council.cancel}
            onClick={onClose}
          >
            <Icon d={ICONS.close} size={14} />
          </button>
        </div>
        <p className="small muted">{copy.council.intro}</p>
        <label className="field">
          {copy.council.task}
          <textarea
            className="input"
            rows={3}
            aria-label={copy.council.task}
            placeholder={copy.council.taskHint}
            value={task}
            onChange={(e) => setTask(e.target.value)}
          />
        </label>
        <h3>{copy.council.members}</h3>
        <p className="small faint">{copy.council.membersHint}</p>
        <fieldset className="picks" aria-label={copy.council.members}>
          {models.map((m) => (
            <label className="pick" key={m.profileId}>
              <input
                type="checkbox"
                aria-label={m.name}
                checked={picked.has(m.profileId)}
                onChange={() => toggle(m.profileId)}
              />
              <Avatar id={m.profileId} name={m.name} agent />
              <span className="serif">{m.name}</span>
              <span className="small faint ellipsis">
                {m.ownerId ? copy.council.modelOf(nameOf(m.ownerId)) : copy.council.shared}
                {modelWord(m) ? ` · ${modelWord(m)}` : ""}
              </span>
            </label>
          ))}
          {directory && models.length === 0 && (
            <span className="small faint">{copy.council.noModels}</span>
          )}
        </fieldset>
        <label className="field">
          {copy.council.chair}
          <select
            className="select"
            aria-label={copy.council.chair}
            value={chairRow?.profileId ?? ""}
            onChange={(e) => setChair(e.target.value)}
          >
            {chosen.map((m) => (
              <option key={m.profileId} value={m.profileId}>
                {m.name}
              </option>
            ))}
          </select>
          <span className="small faint">{copy.council.chairHint}</span>
        </label>
        <h3>{copy.council.rounds}</h3>
        <fieldset className="picks rounds" aria-label={copy.council.rounds}>
          <label className="pick">
            <input
              type="checkbox"
              checked={individual}
              onChange={(e) => setIndividual(e.target.checked)}
            />
            {copy.council.roundIndividual}
          </label>
          <label className="pick">
            <input
              type="checkbox"
              checked={discussion}
              onChange={(e) => setDiscussion(e.target.checked)}
            />
            {copy.council.roundDiscussion}
            <input
              className="input sm n"
              type="number"
              min={1}
              max={5}
              aria-label={copy.council.discussionRounds}
              value={discussionRounds}
              disabled={!discussion}
              onChange={(e) => setDiscussionRounds(e.target.value)}
            />
          </label>
          <label className="pick">
            <input
              type="checkbox"
              checked={synthesis}
              onChange={(e) => setSynthesis(e.target.checked)}
            />
            {copy.council.roundSynthesis}
          </label>
          <label className="pick">
            <input
              type="checkbox"
              checked={synthesis && vote}
              disabled={!synthesis}
              onChange={(e) => setVote(e.target.checked)}
            />
            {copy.council.roundVote}
          </label>
        </fieldset>
        <label className="field">
          {copy.council.budget}
          <input
            className="input"
            type="number"
            min={1}
            aria-label={copy.council.budget}
            placeholder={copy.council.budgetHint}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </label>
        {error && (
          <p className="small danger" role="alert">
            {error}
          </p>
        )}
        <div className="row" style={{ justifyContent: "flex-end", paddingTop: 8 }}>
          <button type="button" className="btn sm" onClick={onClose}>
            {copy.council.cancel}
          </button>
          <button
            type="submit"
            className="btn primary sm"
            disabled={!task.trim() || chosen.length === 0}
          >
            {copy.council.start}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---- the group's strip of councils ----------------------------------------------------------

/** The councils convened in a group, newest first, each a row into its room. */
export function CouncilStrip({
  orgId,
  group,
  councils,
}: {
  orgId: string;
  group: Group;
  councils: Record<string, Council>;
}) {
  const rows = councilsOf(councils, group.id);
  if (rows.length === 0) return null;
  return (
    <section className="council-strip" aria-label={copy.council.inGroup}>
      {rows.slice(0, 4).map((c) => (
        <a className="council-row" key={c.id} href={paths.council(orgId, group.id, c.id)}>
          <Dot status={c.status === "concluded" ? "closed" : "running"} label="" />
          <span className="t serif ellipsis">{c.task}</span>
          <span className="s small faint">{councilCard(c)}</span>
        </a>
      ))}
    </section>
  );
}

// ---- the council room -----------------------------------------------------------------------

/** Open sessions of the projects the assignments live in, polled while the room is open. */
function useAssignmentRows(projectIds: string[]): Map<string, SessionRow> {
  const [rows, setRows] = useState<Map<string, SessionRow>>(() => new Map());
  const key = projectIds.join(",");
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const load = () =>
      Promise.all(
        key.split(",").map((id) =>
          api
            .sessions(id)
            .then((rs) => rs.map((r) => [`${id}/${r.sessionId}`, r] as const))
            .catch(() => []),
        ),
      ).then((pairs) => alive && setRows(new Map(pairs.flat())));
    load();
    const every = setInterval(load, 4_000);
    return () => {
      alive = false;
      clearInterval(every);
    };
  }, [key]);
  return rows;
}

/**
 * The chair's plan session: looked up once the synthesis is in (and again until the host
 * names it), then joined so the plan card is live and the person's rating goes through.
 */
function usePlanSession(orgId: string, council: Council, identity: Identity) {
  const planned = council.synthesis !== null;
  const [tick, setTick] = useState(0);
  const lookup = useFetch(
    planned ? () => api.council(orgId, council.id) : null,
    `${council.id}/${council.synthesis?.seq ?? -1}/${tick}`,
  );
  const session = councilSessionOf(lookup.data);
  const looking = lookup.loading;
  useEffect(() => {
    if (!planned || session || looking || council.status === "concluded") return;
    const t = setTimeout(() => setTick((n) => n + 1), 2_000);
    return () => clearTimeout(t);
  }, [planned, session, looking, council.status]);
  const client = useMemo(() => new HenosisClient(), []);
  const snap = useSyncExternalStore(
    (fn) => client.subscribe(fn),
    () => client.snapshot,
  );
  const actor = useMemo(() => actorOf(identity), [identity]);
  const projectId = session?.projectId ?? null;
  const sessionId = session?.sessionId ?? null;
  useEffect(() => {
    if (!projectId || !sessionId) return;
    client.connect(wsUrl(), {
      sessionId,
      actor,
      userId: identity.userId,
      projectId,
      title: sessionId,
      ...(identity.token ? { token: identity.token } : {}),
    });
    return () => client.disconnect();
  }, [client, projectId, sessionId, actor, identity.userId, identity.token]);
  return { session, client, snap, actor };
}

export function CouncilRoom({
  orgId,
  group,
  council,
  identity,
  me,
  directory,
  onEnd,
}: {
  orgId: string;
  group: Group;
  council: Council;
  identity: Identity;
  me: Me | null;
  directory: ChatDirectoryListing | null;
  onEnd: () => void;
}) {
  const meId = identity.userId;
  const nameOf = (id: string) =>
    personName(group, directory, id) ?? (me?.user?.id === id ? me.user.name : id);
  const models = useMemo(() => memberModels(directory), [directory]);
  const rowOf = (m: CouncilMember) => models.find((x) => x.profileId === m.profileId);
  const plan = usePlanSession(orgId, council, identity);
  const assignmentProjects = useMemo(
    () => [...new Set(Object.values(council.assignments).map((a) => a.projectId))].sort(),
    [council.assignments],
  );
  const sessionRows = useAssignmentRows(assignmentProjects);
  const sequence = roundSequence(council);
  const started = council.rounds;
  const owners = useMemo(() => {
    const out: Record<string, string> = {};
    for (const st of council.synthesis?.steps ?? []) out[st.id] = st.owner.name;
    return out;
  }, [council.synthesis]);
  const planState = plan.snap.state;
  const planRecord =
    planState && council.synthesis ? (planState.plans[council.synthesis.planId] ?? null) : null;
  const steps = council.synthesis?.steps ?? [];
  const assigned = steps.filter((st) => council.assignments[st.id]);
  return (
    <section className="column page council" aria-label={copy.council.room}>
      <header className="council-head">
        <div className="row wrap">
          <a className="small" href={paths.chat(orgId, group.id)}>
            <Icon d={ICONS.back} size={14} /> {copy.council.backToGroup}
          </a>
          <Pill kind="status" status={council.status === "concluded" ? "closed" : "running"}>
            {copy.council.status[council.status]}
          </Pill>
          <span className="small muted">{councilWord(council)}</span>
          <span className="grow" />
          <TokenMeter usage={council.usage} budget={council.budget} />
        </div>
        <h1 className="serif task">{council.task}</h1>
        <p className="small muted">
          {copy.council.convenedBy(nameOf(council.by), modelsOf(council).length)} ·{" "}
          {copy.council.chairIs(council.chair.name)}
        </p>
        {council.status !== "concluded" && council.by === meId && (
          <div className="row">
            <button
              type="button"
              className="btn ghost sm danger"
              onClick={() => {
                if (confirm(copy.council.endConfirm)) onEnd();
              }}
            >
              {copy.council.end}
            </button>
          </div>
        )}
      </header>

      {sequence.map((ref) => {
        const r = started.find((x) => x.round === ref.round && x.index === ref.index);
        if (ref.round === "vote") return null; // the ratings sit on the plan card
        if (ref.round === "synthesis") {
          if (!r && !council.synthesis) return null;
          return (
            <section
              className="group council-round synthesis"
              aria-label={copy.council.roundTitle.synthesis}
              key={`${ref.round}/${ref.index}`}
            >
              <h2>
                {copy.council.roundTitle.synthesis}
                <span className="small faint">{copy.council.synthesis}</span>
              </h2>
              {!council.synthesis && <p className="muted">{copy.council.synthesisWaiting}</p>}
              {council.synthesis && planRecord && planState && (
                <PlanCard
                  s={planState}
                  planId={council.synthesis.planId}
                  me={plan.actor}
                  client={plan.client}
                  owners={owners}
                />
              )}
              {council.synthesis && !planRecord && (
                <SynthesisCard
                  steps={council.synthesis.steps}
                  opening={plan.session === null && council.status !== "concluded"}
                  session={plan.session}
                />
              )}
              {council.synthesis && council.synthesis.dissent.length > 0 && (
                <Dissent council={council} />
              )}
            </section>
          );
        }
        if (!r) return null;
        const owed = owedIn(council, ref);
        const title = roundTitle(ref.round, ref.index, council.discussionRounds);
        return (
          <section
            className={`group council-round ${ref.round}`}
            aria-label={title}
            key={`${ref.round}/${ref.index}`}
          >
            <h2>
              {title}
              <span className="small faint">
                {owed.length && council.status !== "concluded"
                  ? copy.council.roundWaiting(owed.length)
                  : copy.council.roundAllIn}
              </span>
            </h2>
            {ref.round === "individual" ? (
              <div className="council-answers">
                {r.said.map((s) => (
                  <AnswerCard
                    key={`${s.member.profileId}/${s.seq}`}
                    said={s}
                    model={modelWord(rowOf(s.member))}
                    owner={ownerWord(s.member, nameOf)}
                    nameOf={nameOf}
                  />
                ))}
                {owed.map((m) => (
                  <div className="answercard waiting" key={m.profileId} aria-busy="true">
                    <div className="meta">
                      <Avatar id={m.profileId} name={m.name} agent />
                      <span className="who serif">{m.name}</span>
                    </div>
                    <span className="small faint">{ownerWord(m, nameOf)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="council-stream">
                {r.said.map((s) => (
                  <DiscussionLine
                    key={`${s.member.profileId}/${s.seq}`}
                    said={s}
                    owner={ownerWord(s.member, nameOf)}
                    nameOf={nameOf}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {assigned.length > 0 && (
        <section className="group council-round assignments" aria-label={copy.council.assignments}>
          <h2>{copy.council.assignments}</h2>
          <div className="council-agents">
            {assigned.map((st) => {
              const a = council.assignments[st.id];
              if (!a) return null;
              const row = sessionRows.get(`${a.projectId}/${a.sessionId}`);
              const report = council.reports[st.id];
              return (
                <div className="assignment" key={st.id}>
                  <div className="meta small">
                    <span className="serif t">{st.title}</span>
                    <span className="faint">{copy.council.assigned(st.owner.name)}</span>
                    {report && (
                      <Pill
                        kind="status"
                        status={report.status === "done" ? "done" : "blocked"}
                        size="sm"
                      >
                        {copy.council.report[report.status]}
                      </Pill>
                    )}
                  </div>
                  {row ? (
                    <AgentCard
                      row={row}
                      href={paths.session(a.projectId, a.sessionId)}
                      active={false}
                      nameOf={(id) => (id === meId ? "you" : nameOf(id))}
                    />
                  ) : (
                    <a className="agent enter" href={paths.session(a.projectId, a.sessionId)}>
                      <span className="head">
                        <Dot status="idle" />
                        <span className="t">{a.sessionId}</span>
                      </span>
                      <span className="doing">{copy.council.assignmentOpening}</span>
                    </a>
                  )}
                  {report?.text && <p className="small muted report">{report.text}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {council.status === "concluded" && (
        <section className="group council-round conclusion" aria-label={copy.council.conclusion}>
          <h2>{copy.council.conclusion}</h2>
          <div className={`notice${council.outcome === "done" ? "" : " quiet"}`}>
            <div className="head">
              <span className="serif">
                {copy.council.concluded(outcomeWord(council.outcome ?? "abandoned"))}
              </span>
              <span className="small faint">
                {copy.usage.chip(usageTotal(council.usage).toLocaleString("en-US"))}
              </span>
            </div>
            {council.summary && <p>{council.summary}</p>}
            {council.synthesis && council.synthesis.dissent.length > 0 ? (
              <Dissent council={council} />
            ) : (
              <p className="small faint">{copy.council.noDissent}</p>
            )}
          </div>
        </section>
      )}
    </section>
  );
}

function AnswerCard({
  said,
  model,
  owner,
  nameOf,
}: {
  said: CouncilSaid;
  model: string;
  owner: string;
  nameOf: (id: string) => string;
}) {
  return (
    <article className="answercard" aria-label={said.member.name}>
      <div className="meta">
        <Avatar id={said.member.profileId} name={said.member.name} agent />
        <span className="who serif">{said.member.name}</span>
      </div>
      <span className="small faint">
        {owner}
        {model ? ` · ${model}` : ""}
      </span>
      <p className="text">{said.text}</p>
      <Cites said={said} nameOf={nameOf} />
    </article>
  );
}

function DiscussionLine({
  said,
  owner,
  nameOf,
}: {
  said: CouncilSaid;
  owner: string;
  nameOf: (id: string) => string;
}) {
  // The stance opens the reply on its own line; the word beside the name carries it.
  const text = said.stance
    ? said.text.replace(/^(agree|differ|add)(?:[\s:.!,-]+|$)/i, "").trim() || said.text
    : said.text;
  return (
    <div className={`msg agent council-line${said.stance ? ` ${said.stance}` : ""}`}>
      <div className="meta">
        <Avatar id={said.member.profileId} name={said.member.name} agent />
        <span className="who serif">{said.member.name}</span>
        {said.stance && (
          <span className={`stance ${said.stance}`}>{copy.council.stance[said.stance]}</span>
        )}
        <span className="faint small">{owner}</span>
      </div>
      <div className="text">{text}</div>
      <Cites said={said} nameOf={nameOf} />
    </div>
  );
}

function Cites({ said, nameOf }: { said: CouncilSaid; nameOf: (id: string) => string }) {
  if (said.cites.length === 0) return null;
  const names = [...new Set(said.cites.map((c) => nameOf(c.by)))];
  return <span className="cite small">{copy.council.instructedBy(names.join(", "))}</span>;
}

/** The plan as the log records it, shown until the chair's session is open for the ratings. */
function SynthesisCard({
  steps,
  opening,
  session,
}: {
  steps: CouncilStep[];
  opening: boolean;
  session: { projectId: string; sessionId: string } | null;
}) {
  return (
    <section className="notice plan" aria-label={copy.plan.title}>
      <div className="head">
        <span className="serif">{copy.plan.heading(steps.length)}</span>
        <span className="small faint">
          {opening ? copy.council.planOpening : copy.council.planElsewhere}
        </span>
      </div>
      <ol className="plansteps">
        {steps.map((st) => (
          <li className="planstep pending" key={st.id}>
            <span className="step-dot" aria-hidden="true" />
            <span className="body">
              <span className="title">{st.title}</span>
              {st.detail && <span className="d small muted">{st.detail}</span>}
              <span className="owner small">{copy.council.owner(st.owner.name)}</span>
            </span>
            <span className="meta small faint">
              {st.risk} · {copy.plan.est(st.estTokens)}
            </span>
          </li>
        ))}
      </ol>
      {session && (
        <a className="small" href={paths.session(session.projectId, session.sessionId)}>
          {copy.council.planSession}
        </a>
      )}
    </section>
  );
}

function Dissent({ council }: { council: Council }) {
  const dissent = council.synthesis?.dissent ?? [];
  if (dissent.length === 0) return null;
  return (
    <section className="dissent" aria-label={copy.council.dissent}>
      <span className="kind">{copy.council.dissent}</span>
      {dissent.map((d) => (
        <div className="dissent-line" key={d.member.profileId}>
          <Avatar id={d.member.profileId} name={d.member.name} agent />
          <span>
            <span className="serif">{copy.council.dissentBy(d.member.name)}</span>
            <span className="small muted"> · {d.text}</span>
          </span>
        </div>
      ))}
    </section>
  );
}

// ---- the members panel (the drawer) ---------------------------------------------------------

export function CouncilMembersPanel({
  orgId,
  group,
  council,
  meId,
  directory,
  onInstruct,
  onClose,
}: {
  orgId: string;
  group: Group;
  council: Council;
  meId: string;
  directory: ChatDirectoryListing | null;
  onInstruct: (member: CouncilMember, text: string) => void;
  onClose: () => void;
}) {
  const models = memberModels(directory);
  const nameOf = (id: string) => personName(group, directory, id) ?? id;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const closed = council.status === "concluded";
  return (
    <>
      <button
        type="button"
        className="scrim sheet-scrim"
        aria-label={copy.council.closeMembers}
        onClick={onClose}
      />
      <aside className="drawer council-members" aria-label={copy.council.panel}>
        <div className="drawer-head">
          <span>{copy.council.panel}</span>
          <button
            type="button"
            className="btn ghost icon sm"
            aria-label={copy.council.closeMembers}
            onClick={onClose}
          >
            <Icon d={ICONS.close} size={14} />
          </button>
        </div>
        <section className="group">
          <h3>{copy.council.members}</h3>
          {modelsOf(council).map((m) => {
            const row = models.find((x) => x.profileId === m.profileId);
            const draft = drafts[m.profileId] ?? "";
            const chair = sameCouncilMember(m, council.chair);
            return (
              <div className="member" key={m.profileId}>
                <div className="person">
                  <Avatar id={m.profileId} name={m.name} agent />
                  <span className="name">
                    <span className="serif">{m.name}</span>
                    <span className="small faint">
                      {" "}
                      · {ownerWord(m, nameOf)}
                      {modelWord(row) ? ` · ${modelWord(row)}` : ""}
                    </span>
                  </span>
                  {chair && <Pill size="sm">{copy.council.chair}</Pill>}
                </div>
                {!closed && (
                  <form
                    className="row instruct-box"
                    aria-label={copy.council.instructRoom(m.name)}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const t = draft.trim();
                      if (!t) return;
                      onInstruct(m, t);
                      setDrafts((d) => ({ ...d, [m.profileId]: "" }));
                    }}
                  >
                    <input
                      className="input sm grow"
                      aria-label={copy.council.instructRoom(m.name)}
                      placeholder={copy.council.instructPlaceholder(m.name)}
                      value={draft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [m.profileId]: e.target.value }))}
                    />
                    <button type="submit" className="btn sm" disabled={!draft.trim()}>
                      {copy.council.instruct}
                    </button>
                  </form>
                )}
                <a
                  className="small"
                  href={paths.instruct(orgId, group.id, council.id, m.profileId)}
                >
                  {copy.council.instructRoom(m.name)}
                </a>
                <span className="small faint">
                  {instructionsFor(council, m, meId).length
                    ? `${instructionsFor(council, m, meId).length} · ${copy.council.privateTo(ownerWord(m, nameOf))}`
                    : ""}
                </span>
              </div>
            );
          })}
        </section>
      </aside>
    </>
  );
}

// ---- the instruct room ----------------------------------------------------------------------

export function InstructRoom({
  orgId,
  group,
  council,
  member,
  meId,
  directory,
  onInstruct,
}: {
  orgId: string;
  group: Group;
  council: Council;
  member: CouncilMember;
  meId: string;
  directory: ChatDirectoryListing | null;
  onInstruct: (member: CouncilMember, text: string) => void;
}) {
  const nameOf = (id: string) => personName(group, directory, id) ?? id;
  const owner = member.userId ? nameOf(member.userId) : copy.council.shared;
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  // The private words and the model's replies that cite this person, in the order they fell.
  const lines = useMemo(() => {
    const out: { seq: number; kind: "instruction" | "reply"; by: string; text: string }[] = [];
    for (const i of instructionsFor(council, member, meId))
      out.push({ seq: i.seq, kind: "instruction", by: i.by, text: i.text });
    for (const r of council.rounds)
      for (const s of r.said)
        if (
          sameCouncilMember(s.member, member) &&
          s.cites.some(
            (c) => c.by === meId || member.userId === meId || council.chair.userId === meId,
          )
        )
          out.push({ seq: s.seq, kind: "reply", by: member.name, text: s.text });
    return out.sort((a, b) => a.seq - b.seq);
  }, [council, member, meId]);
  const last = lines[lines.length - 1]?.seq;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when a line lands
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [last]);
  const closed = council.status === "concluded";
  const submit = () => {
    const t = text.trim();
    if (!t || closed) return;
    onInstruct(member, t);
    setText("");
  };
  return (
    <>
      <section
        className="column chatcol instruct"
        aria-label={copy.council.instructRoom(member.name)}
      >
        <div className="row wrap">
          <a className="small" href={paths.council(orgId, group.id, council.id)}>
            <Icon d={ICONS.back} size={14} /> {copy.council.backToCouncil}
          </a>
          <span className="small faint">{copy.council.privateTo(owner)}</span>
        </div>
        <div className="council-intro">
          <Avatar id={member.profileId} name={member.name} agent />
          <span>
            <span className="serif">{member.name}</span>
            <span className="small muted"> · {copy.council.instructIntro(member.name, owner)}</span>
          </span>
        </div>
        {lines.length === 0 && (
          <EmptyState text={copy.council.instructEmpty} className="council-empty" />
        )}
        {lines.map((l) =>
          l.kind === "instruction" ? (
            <div className={`msg human${l.by === meId ? " mine" : ""}`} key={l.seq}>
              <div className="meta">
                <span className="who">{nameOf(l.by)}</span>
                <span className="faint small">{copy.council.instructLabel}</span>
              </div>
              <div className="text">{l.text}</div>
            </div>
          ) : (
            <div className="msg agent" key={l.seq}>
              <div className="meta">
                <Avatar id={member.profileId} name={member.name} agent />
                <span className="who serif">{member.name}</span>
                <span className="faint small">{copy.council.instructedCited}</span>
              </div>
              <div className="text">{l.text}</div>
            </div>
          ),
        )}
        <div ref={end} />
      </section>
      <div className="composer-wrap">
        <form
          className="composer to-team"
          aria-label={copy.council.instructRoom(member.name)}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <textarea
            rows={1}
            aria-label={copy.council.instructLabel}
            placeholder={copy.council.instructPlaceholder(member.name)}
            value={text}
            disabled={closed}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div className="bar">
            <span className="small faint">{copy.council.privateTo(owner)}</span>
            <div className="right">
              <button
                type="submit"
                className="send"
                aria-label={copy.council.instructSend}
                disabled={!text.trim() || closed}
              >
                <Icon d={ICONS.send} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
