import { describeRule, ruleFor, type SessionState } from "@fold/kernel";
import type { Actor, DirectiveMode, PresenceEntry, SessionEvent } from "@fold/protocol";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Shell, type ShellContext } from "../App.js";
import { api, type Me, refOf, type SessionRow, useFetch } from "../api.js";
import { FoldClient, wsUrl } from "../client.js";
import { copy } from "../copy.js";
import { actorOf, type Identity } from "../identity.js";
import { notifyIfHidden } from "../notify.js";
import { describeQueued, type QueuedMessage } from "../offlineQueue.js";
import { usePaletteActions } from "../palette.js";
import { rememberRecent } from "../recents.js";
import { ReconnectLine } from "../reconnect.js";
import { paths } from "../router.js";
import { reportPendingApprovals } from "../shell.js";
import { type Block, describeCall, estimateHeight, type Step } from "../stream/blocks.js";
import { useBlocks } from "../stream/useBlocks.js";
import { VirtualList } from "../stream/VirtualList.js";
import {
  AgentCard,
  Avatar,
  copyText,
  ErrorLine,
  ICONS,
  Icon,
  Status,
  TeamPill,
  toast,
  useConnectionToasts,
} from "../ui.js";
import { sessionCommands } from "./sessionCommands.js";

export function SessionView({
  projectId,
  sessionId,
  title,
  identity,
  me,
  ctx,
}: {
  projectId: string;
  sessionId: string;
  title: string | null;
  identity: Identity;
  me: Me | null;
  ctx: ShellContext;
}) {
  const client = useMemo(() => new FoldClient(), []);
  const snap = useSyncExternalStore(
    (fn) => client.subscribe(fn),
    () => client.snapshot,
  );
  const actor = useMemo(() => actorOf(identity), [identity]);
  useEffect(() => {
    client.connect(wsUrl(), {
      sessionId,
      actor,
      userId: identity.userId,
      projectId,
      title: title ?? sessionId,
      ...(identity.token ? { token: identity.token } : {}),
    });
    return () => client.disconnect();
  }, [client, sessionId, projectId, title, actor, identity.userId, identity.token]);
  // Hook point (error-boundary-toasts): server errors and a lost socket as quiet toasts.
  useConnectionToasts(snap.connected, snap.errors);

  // Notifications for things that need this person, only while the tab is hidden.
  useEffect(
    () =>
      client.onLiveEvent((e) => {
        const st = client.snapshot.state;
        const who = (id: string) => st?.participants[id]?.actor.name ?? id;
        const where = st?.title || sessionId;
        if (e.kind === "approval.requested")
          notifyIfHidden(
            copy.notify.approvalTitle,
            copy.notify.approvalBody(e.payload.call.name, e.payload.call.risk, where),
            e.payload.approvalId,
          );
        else if (e.kind === "handoff.requested" && e.payload.to === identity.userId)
          notifyIfHidden(
            copy.notify.handoffTitle,
            copy.notify.handoffBody(who(e.actor), where),
            e.payload.handoffId,
          );
        else if (e.kind === "note.posted" && e.actor !== identity.userId)
          notifyIfHidden(`${who(e.actor)} to the team`, e.payload.text, e.id);
        else if (e.kind === "fleet.contention.mirrored" && !e.payload.resolved)
          notifyIfHidden(
            copy.notify.contentionTitle,
            copy.notify.contentionBody(e.payload.kind, e.payload.resource),
            e.payload.contentionId,
          );
      }),
    [client, identity.userId, sessionId],
  );

  const ref = refOf(me, projectId);
  const s = snap.state;
  const shownTitle = s?.title || title || sessionId;
  useEffect(() => {
    rememberRecent({ projectId, sessionId, title: shownTitle });
  }, [projectId, sessionId, shownTitle]);
  const [panel, setPanel] = useState<"none" | "details" | "team">("none");
  const details = panel === "details";
  const setDetails = useCallback((v: boolean) => setPanel(v ? "details" : "none"), []);
  const rows = useFetch(() => api.sessions(projectId), `${projectId}:${s?.seq ?? -1}`);
  const mine = rows.data?.find((r) => r.sessionId === sessionId) ?? null;
  // hook point (command-palette): this page's actions, refreshed as the session changes
  usePaletteActions(
    "session",
    useMemo(
      () => sessionCommands({ s, me: actor, client, details, setDetails }),
      [s, actor, client, details, setDetails],
    ),
  );

  if (!s)
    return (
      <Shell ctx={ctx} title={shownTitle}>
        <div className="column">
          <ErrorLine errors={snap.errors} />
          <p className="muted">
            {snap.reconnecting
              ? copy.session.reconnecting
              : snap.connected
                ? copy.session.joining
                : copy.session.connecting}
          </p>
        </div>
      </Shell>
    );

  const pendingApprovals = Object.values(s.approvals).filter((a) => a.status === "pending");
  reportPendingApprovals(pendingApprovals.length);
  const online = snap.presence.filter((p) => p.online);
  const share = () => {
    const url = `${location.origin}${location.pathname}${paths.session(projectId, sessionId)}`;
    copyText(url).then((ok) => toast(ok ? copy.session.linkCopied : copy.session.copyFailed));
  };

  return (
    <Shell
      ctx={ctx}
      title={
        <>
          <span className="ellipsis serif">{shownTitle}</span>
          <Status status={s.status} />
          {mine && <TeamPill row={mine} />}
        </>
      }
      right={
        <>
          <fieldset
            className="stack"
            aria-label={copy.session.present(online.map((p) => p.actor.name))}
          >
            {online.slice(0, 4).map((p) => (
              <Avatar
                key={p.actor.id}
                id={p.actor.id}
                name={p.actor.name}
                driver={s.driver === p.actor.id}
                title={copy.session.avatarTitle(p.actor.name, p.role, s.driver === p.actor.id)}
              />
            ))}
            {online.length > 4 && (
              <span className="avatar">{copy.session.more(online.length - 4)}</span>
            )}
          </fieldset>
          <button type="button" className="btn ghost sm" onClick={share}>
            <Icon d={ICONS.link} size={14} />
            <span className="lbl">{copy.session.share}</span>
          </button>
          <button
            type="button"
            className={`btn sm${panel === "team" ? " on" : ""}`}
            aria-pressed={panel === "team"}
            onClick={() => setPanel((v) => (v === "team" ? "none" : "team"))}
          >
            Team
          </button>
          <button
            type="button"
            className={`btn sm${details ? " on" : ""}`}
            aria-pressed={details}
            onClick={() => setPanel((v) => (v === "details" ? "none" : "details"))}
          >
            {copy.session.details}
          </button>
        </>
      }
      below={<ReconnectLine reconnecting={snap.reconnecting} />}
      drawer={
        details ? (
          <Drawer
            s={s}
            me={actor}
            client={client}
            brief={snap.brief}
            errors={snap.errors}
            orgId={ref.orgId}
            teamId={ref.teamId}
            projectId={projectId}
            onClose={() => setPanel("none")}
          />
        ) : panel === "team" ? (
          <TeamPanel
            s={s}
            me={actor}
            client={client}
            presence={snap.presence}
            rows={rows.data ?? []}
            reload={rows.reload}
            projectId={projectId}
            errors={snap.errors}
            onClose={() => setPanel("none")}
          />
        ) : null
      }
    >
      <Stream events={snap.events} s={s} me={actor} client={client} showHandoff={!details} />
      <Composer s={s} me={actor} client={client} connected={snap.connected} queued={snap.queued} />
    </Shell>
  );
}

// ---- stream ----------------------------------------------------------------------------

// Step, Block, describeCall and blocksOf moved to ../stream/blocks.ts (folded incrementally
// there); the column is windowed by ../stream/VirtualList.tsx.

function Stream({
  events,
  s,
  me,
  client,
  showHandoff,
}: {
  events: SessionEvent[];
  s: SessionState;
  me: Actor;
  client: FoldClient;
  showHandoff: boolean;
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
  const renderBlock = useCallback(
    (b: Block) => {
      switch (b.kind) {
        case "human":
          return (
            <div className={`msg human${b.team ? " team" : ""}`}>
              <div className="meta">
                <span className="who">{b.who}</span>
                {b.team && <span className="to">to the team</span>}
                {b.sub && <span className="faint">{b.sub}</span>}
              </div>
              <div className="text">{b.text}</div>
            </div>
          );
        case "agent":
          return (
            <div className="msg agent">
              {b.text && <div className="text">{b.text}</div>}
              {b.steps.length > 0 && (
                <div className="steps">
                  {b.steps.map((st) => (
                    <StepLine
                      key={st.id}
                      step={st}
                      open={openSteps.has(st.id)}
                      onToggle={toggleStep}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        case "divider":
          return <div className={`divider${b.danger ? " danger" : ""}`}>{b.text}</div>;
        case "approval":
          return <ApprovalNotice s={s} id={b.approvalId} client={client} />;
        default:
          return null;
      }
    },
    [s, client, openSteps, toggleStep],
  );
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const contentions = Object.values(s.contentions).filter((c) => !c.resolved);
  const handoffs = Object.values(s.handoffs).filter(
    (h) => h.status === "pending" && h.to === me.id,
  );
  const canPick = s.driver === me.id || s.participants[me.id]?.role === "owner";
  return (
    <section className="column" aria-label={copy.stream.label}>
      {blocks.length === 0 && (
        <p className="muted" style={{ textAlign: "center", padding: "48px 0" }}>
          {copy.stream.empty}
        </p>
      )}
      <VirtualList
        items={blocks}
        version={version}
        keyOf={blockKey}
        estimate={estimateHeight}
        render={renderBlock}
      />
      {contentions.map((c) => (
        <div className="notice contention" key={c.id}>
          <span>
            {copy.stream.contentionBefore}
            <b>{c.scope}</b>
            {copy.stream.contentionAfter}
            {s.driver === me.id ? copy.stream.youPick : copy.stream.theyPick(name(s.driver ?? ""))}.
          </span>
          {c.directiveIds.map((id) => {
            const d = s.directives[id];
            if (!d) return null;
            return (
              <div className="option" key={id}>
                <span>
                  {d.input.text} <span className="faint">{name(d.author)}</span>
                </span>
                <span className="actions">
                  {canPick && (
                    <button
                      type="button"
                      className="btn sm"
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
                      onClick={() => client.send({ type: "withdraw", directiveId: id })}
                    >
                      {copy.stream.withdraw}
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ))}
      {showHandoff &&
        handoffs.map((h) => (
          <div className="notice" key={h.id}>
            <span>{copy.stream.offeredYou(name(h.from))}</span>
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
                className="btn sm"
                onClick={() => client.send({ type: "handoff.decline", handoffId: h.id })}
              >
                {copy.stream.decline}
              </button>
            </div>
          </div>
        ))}
    </section>
  );
}

const blockKey = (b: Block) => b.id;

function StepLine({
  step,
  open: openProp,
  onToggle,
}: {
  step: Step;
  /** Controlled when the stream owns the state; otherwise the line keeps its own. */
  open?: boolean;
  onToggle?: (id: string) => void;
}) {
  const [openOwn, setOpenOwn] = useState(false);
  const open = openProp ?? openOwn;
  const setOpen = () => (onToggle ? onToggle(step.id) : setOpenOwn((v) => !v));
  const shell = step.name === "shell.run";
  const suffix =
    step.ok === null ? "" : step.ok ? (shell ? copy.steps.exitOk : "") : copy.steps.failed;
  return (
    <div className={`step${step.ok === false ? " fail" : ""}`}>
      <button type="button" className="step-head" aria-expanded={open} onClick={setOpen}>
        <Icon d={step.icon} size={14} />
        <span className="ellipsis">
          {step.ok === null ? step.doing : step.done}
          {suffix}
        </span>
        <Icon d={ICONS.chevron} size={12} className={`chev${open ? " open" : ""}`} />
      </button>
      {open && (
        <pre className="step-out">
          {step.args}
          {step.output ? `\n\n${step.output.split("\n").slice(0, 20).join("\n")}` : ""}
        </pre>
      )}
    </div>
  );
}

function ApprovalNotice({ s, id, client }: { s: SessionState; id: string; client: FoldClient }) {
  const a = s.approvals[id];
  if (!a) return null;
  const name = (k: string) => s.participants[k]?.actor.name ?? k;
  const votes = Object.entries(a.votes);
  const d = describeCall(a.call);
  if (a.status !== "pending") {
    const by = votes
      .filter(([, v]) => v === (a.status === "granted" ? "approve" : "deny"))
      .map(([k]) => name(k));
    return (
      <div className="divider">
        {a.status === "granted" ? copy.approval.approved : copy.approval.denied}: {d.ask}
        {by.length ? ` · ${by.join(", ")}` : ""}
      </div>
    );
  }
  return (
    <div className="notice">
      <span>
        {copy.approval.wants(
          d.ask,
          a.call.risk,
          describeRule(ruleFor(s.policy.approvals, a.call.risk)),
        )}
      </span>
      {votes.length > 0 && (
        <span className="small muted">
          {votes.map(([k, v]) => copy.approval.vote(name(k), v === "approve")).join(" · ")}
        </span>
      )}
      <div className="actions">
        <button
          type="button"
          className="btn primary sm"
          onClick={() => client.send({ type: "vote", approvalId: a.id, vote: "approve" })}
        >
          {copy.approval.approve}
        </button>
        <button
          type="button"
          className="btn sm"
          onClick={() => client.send({ type: "vote", approvalId: a.id, vote: "deny" })}
        >
          {copy.approval.deny}
        </button>
      </div>
    </div>
  );
}

// ---- composer --------------------------------------------------------------------------

const MODES: DirectiveMode[] = ["steer", "constrain", "pause", "resume", "cancel"];

function Composer({
  s,
  me,
  client,
  connected,
  queued,
}: {
  s: SessionState;
  me: Actor;
  client: FoldClient;
  connected: boolean;
  /** Offline queue: what waits for the socket (see offlineQueue.ts). */
  queued: QueuedMessage[];
}) {
  const [text, setText] = useState("");
  const [scope, setScope] = useState("goal");
  const [mode, setMode] = useState<DirectiveMode>("steer");
  const [interrupt, setInterrupt] = useState(false);
  const [more, setMore] = useState(false);
  const [to, setTo] = useState<"agent" | "team">("agent");
  const [showQueue, setShowQueue] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const role = s.participants[me.id]?.role ?? "observer";
  const needsText = to === "team" || mode === "steer" || mode === "constrain";
  const submit = () => {
    if (needsText && !text.trim()) return;
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
  return (
    <div className="composer-wrap">
      <form
        className={`composer${to === "team" ? " to-team" : ""}`}
        aria-label={to === "team" ? copy.composer.labelTeam : copy.composer.label}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={ta}
          rows={1}
          aria-label={copy.composer.directive}
          placeholder={
            to === "team"
              ? copy.composer.placeholderTeam
              : needsText
                ? copy.composer.placeholder
                : copy.composer.placeholderFor(mode)
          }
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            grow();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="bar">
          <fieldset className="seg" aria-label={copy.composer.sendTo}>
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
          {to === "agent" && (
            <>
              <button
                type="button"
                className="btn ghost icon"
                aria-label={copy.composer.modeAndScope}
                aria-expanded={more}
                onClick={() => setMore((v) => !v)}
              >
                <Icon d={more ? ICONS.close : ICONS.plus} />
              </button>
              <button
                type="button"
                className={`chip${mode !== "steer" ? " on" : ""}`}
                onClick={() => setMore((v) => !v)}
              >
                {mode !== "steer" ? `${mode} · ` : ""}
                {scope}
                {interrupt ? ` · ${copy.stream.interrupt}` : ""}
              </button>
            </>
          )}
          <div className="right">
            <button
              type="submit"
              className="send"
              aria-label={copy.composer.send}
              disabled={needsText && !text.trim()}
            >
              <Icon d={ICONS.send} />
            </button>
          </div>
        </div>
        {more && to === "agent" && (
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
              Show queue
              {queued.length > 0 && <span className="faint">{queued.length}</span>}
            </label>
          </div>
        )}
      </form>
      {queued.length > 0 && (
        <p className="queue-note small muted" role="status">
          <Icon d={ICONS.clock} size={13} />
          Queued · will send when back online
        </p>
      )}
      {showQueue && <QueueList queued={queued} s={s} client={client} />}
      <p className="hint small faint">
        {connected ? "" : copy.composer.reconnecting}
        {copy.composer.hint(me.name, role, s.driver === me.id)}
      </p>
    </div>
  );
}

// ---- team panel ------------------------------------------------------------------------

/** Who is in this session, which crew it works in, and a chat line to the people here. */
function TeamPanel({
  s,
  me,
  client,
  presence,
  rows,
  reload,
  projectId,
  errors,
  onClose,
}: {
  s: SessionState;
  me: Actor;
  client: FoldClient;
  presence: PresenceEntry[];
  rows: SessionRow[];
  reload: () => void;
  projectId: string;
  errors: string[];
  onClose: () => void;
}) {
  const [crewName, setCrewName] = useState("");
  // Crew changes live in the project ledger, not this session's log: look again now and then.
  useEffect(() => {
    const every = setInterval(reload, 5_000);
    return () => clearInterval(every);
  }, [reload]);
  const [text, setText] = useState("");
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const mine = rows.find((r) => r.sessionId === s.sessionId) ?? null;
  const crew = mine?.crew ?? null;
  const mates = rows.filter(
    (r) => r.open && crew && r.crew === crew && r.sessionId !== s.sessionId,
  );
  const crewNames = [...new Set(rows.map((r) => r.crew).filter((c): c is string => Boolean(c)))];
  const people = [...presence].sort((a, b) => Number(b.online) - Number(a.online));
  const iOwn = s.ownerId === me.id || s.participants[me.id]?.role === "owner";
  const setCrew = (value: string | null) => {
    client.sendProject({ type: "project.crew", sessionId: s.sessionId, crew: value });
    // The rail and the panel both read the project listing; tell them the fleet changed.
    const tell = () => {
      reload();
      dispatchEvent(new Event("fold:fleet"));
    };
    setTimeout(tell, 250);
    setTimeout(tell, 1500);
  };
  const say = () => {
    const t = text.trim();
    if (!t) return;
    client.send({ type: "note", text: t });
    setText("");
  };
  return (
    <>
      <button
        type="button"
        className="scrim sheet-scrim"
        aria-label="Close team"
        onClick={onClose}
      />
      <aside className="drawer" aria-label="Team">
        <div className="drawer-head">
          <span>Team</span>
          <button
            type="button"
            className="btn ghost icon sm"
            aria-label="Close team"
            onClick={onClose}
          >
            <Icon d={ICONS.close} size={14} />
          </button>
        </div>
        <ErrorLine errors={errors} />
        <section className="group">
          <h3>In this session</h3>
          {people.length === 0 && <p className="muted">Only you so far.</p>}
          {people.map((p) => (
            <div className={`person${p.online ? "" : " off"}`} key={p.actor.id}>
              <Avatar id={p.actor.id} name={p.actor.name} driver={s.driver === p.actor.id} />
              <span className="name">
                {p.actor.name}
                {p.actor.id === me.id ? " (you)" : ""}
              </span>
              <span className="role">
                {s.driver === p.actor.id ? "driving" : p.role}
                {p.online ? "" : " · away"}
              </span>
            </div>
          ))}
          <p className="small faint">
            {mine && mine.people.filter((p) => p.online).length > 1
              ? "A team: more than one person is steering this agent."
              : "Solo: one person is steering this agent. Share the link to team up."}
          </p>
        </section>
        <section className="group">
          <h3>Crew</h3>
          {crew ? (
            <>
              <p>
                Working on <span className="serif">{crew}</span> with{" "}
                {mates.length
                  ? `${mates.length} other agent${mates.length === 1 ? "" : "s"}`
                  : "no one else yet"}
                .
              </p>
              {mates.map((r) => (
                <AgentCard
                  key={r.sessionId}
                  row={r}
                  href={paths.session(projectId, r.sessionId)}
                  active={false}
                  nameOf={name}
                />
              ))}
              {iOwn && (
                <button type="button" className="btn ghost sm" onClick={() => setCrew(null)}>
                  Leave crew
                </button>
              )}
            </>
          ) : (
            <>
              <p className="muted">
                Solo. Put this agent in a crew to share one task with other agents in {projectId}.
              </p>
              {iOwn && (
                <form
                  className="row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (crewName.trim()) setCrew(crewName.trim());
                  }}
                >
                  <input
                    className="input grow"
                    list="crew-names"
                    aria-label="Crew name"
                    placeholder="Name the task"
                    value={crewName}
                    onChange={(e) => setCrewName(e.target.value)}
                  />
                  <datalist id="crew-names">
                    {crewNames.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  <button type="submit" className="btn sm" disabled={!crewName.trim()}>
                    Team up
                  </button>
                </form>
              )}
            </>
          )}
        </section>
        <section className="group">
          <h3>Chat</h3>
          <div className="chat">
            {s.notes.length === 0 && <p className="muted">Nothing said yet.</p>}
            {s.notes.slice(-30).map((n) => (
              <div className={`line${n.actor === me.id ? " mine" : ""}`} key={n.seq}>
                <span className="who">{n.actor === me.id ? "You" : name(n.actor)}</span>
                <span className="what">{n.text}</span>
              </div>
            ))}
          </div>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              say();
            }}
          >
            <input
              className="input grow"
              aria-label="Say to the team"
              placeholder="Say to the team"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" className="btn sm" disabled={!text.trim()}>
              Send
            </button>
          </form>
        </section>
      </aside>
    </>
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
  client: FoldClient;
}) {
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const when = (at: number) =>
    new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return (
    <section className="queue small" aria-label="Queued messages">
      {queued.length === 0 && <span className="faint">Nothing queued.</span>}
      {queued.map((q, i) => (
        <div className="row" key={q.id}>
          <span className="faint mono">{i + 1}</span>
          <span className="grow ellipsis">{describeQueued(q.msg, name)}</span>
          <span className="faint">{when(q.at)}</span>
          <button
            type="button"
            className="btn ghost icon sm"
            aria-label="Remove from queue"
            onClick={() => client.unqueue(q.id)}
          >
            <Icon d={ICONS.close} size={12} />
          </button>
        </div>
      ))}
    </section>
  );
}

// ---- details drawer --------------------------------------------------------------------

function Drawer({
  s,
  me,
  client,
  brief,
  errors,
  orgId,
  teamId,
  projectId,
  onClose,
}: {
  s: SessionState;
  me: Actor;
  client: FoldClient;
  brief: string | null;
  errors: string[];
  orgId: string;
  teamId: string;
  projectId: string;
  onClose: () => void;
}) {
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const humans = Object.values(s.participants).filter((p) => p.actor.kind === "human");
  const iOwn = s.participants[me.id]?.role === "owner";
  const myHandoffs = Object.values(s.handoffs).filter(
    (h) => h.status === "pending" && h.to === me.id,
  );
  const [forkName, setForkName] = useState("");
  const branches = ["main", ...Object.keys(s.branches)];
  const files = Object.keys(s.workspace).sort();
  const paused = s.intent.control === "paused";
  const ctxMem = useFetch(
    () => api.memoryContext(orgId, { team: teamId, project: projectId, user: me.id }),
    `${orgId}/${teamId}/${projectId}/${me.id}`,
  );
  const control = (mode: "pause" | "resume") =>
    client.send({
      type: "directive",
      input: { text: mode, mode, scope: "goal", supersedes: [], interrupt: false },
    });
  return (
    <>
      <button
        type="button"
        className="scrim sheet-scrim"
        aria-label={copy.details.close}
        onClick={onClose}
      />
      <aside className="drawer" aria-label={copy.details.title}>
        <div className="drawer-head">
          <span>{copy.details.title}</span>
          <button
            type="button"
            className="btn ghost icon sm"
            aria-label={copy.details.close}
            onClick={onClose}
          >
            <Icon d={ICONS.close} size={14} />
          </button>
        </div>
        <ErrorLine errors={errors} />
        <section className="group">
          <h3>{copy.details.intent}</h3>
          {s.intent.goal ? (
            <p>
              {s.intent.goal.text} <span className="faint">{name(s.intent.goal.author)}</span>
            </p>
          ) : (
            <p className="muted">{copy.details.noGoal}</p>
          )}
          {Object.entries(s.intent.steers).map(([k, v]) => (
            <p key={k}>
              <span className="muted">{k}</span> {v.text}{" "}
              <span className="faint">{name(v.author)}</span>
            </p>
          ))}
          {s.intent.constraints.map((c) => (
            <p key={c.directiveId}>
              <span className="muted">{copy.details.always}</span> {c.text}{" "}
              <span className="faint">
                {name(c.author)}
                {c.origin === "project" ? copy.details.fromProject : ""}
              </span>
            </p>
          ))}
          {s.intent.contendedScopes.length > 0 && (
            <p className="muted">{copy.details.held(s.intent.contendedScopes)}</p>
          )}
          <p className="row">
            <span className="muted">
              {copy.details.control(s.intent.control, s.intent.interrupt, s.turn)}
            </span>
            <button
              type="button"
              className="btn sm"
              onClick={() => control(paused ? "resume" : "pause")}
            >
              {paused ? copy.details.resume : copy.details.pause}
            </button>
          </p>
        </section>
        <section className="group">
          <h3>{copy.details.people}</h3>
          {humans.map((p) => (
            <div className="person" key={p.actor.id}>
              <Avatar id={p.actor.id} name={p.actor.name} driver={s.driver === p.actor.id} />
              <span className="grow ellipsis">
                {p.actor.name}
                {p.actor.id === me.id ? copy.details.you : ""}
              </span>
              <span className="muted small">
                {s.driver === p.actor.id ? copy.roles.driving : p.role}
                {p.present ? "" : copy.details.away}
              </span>
              {p.actor.id !== me.id && s.driver === me.id && (
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => client.send({ type: "handoff.request", to: p.actor.id })}
                >
                  {copy.details.handOff}
                </button>
              )}
              {p.actor.id !== me.id && iOwn && s.driver !== me.id && (
                <select
                  className="select sm"
                  aria-label={copy.details.roleOf(p.actor.name)}
                  value={p.role}
                  onChange={(e) =>
                    client.send({
                      type: "role",
                      actorId: p.actor.id,
                      role: e.target.value as "observer" | "contributor" | "driver" | "owner",
                    })
                  }
                >
                  {["observer", "contributor", "driver", "owner"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
          {myHandoffs.map((h) => (
            <div className="row" key={h.id}>
              <span className="grow small">{copy.stream.offeredYou(name(h.from))}</span>
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
          ))}
          {humans.length <= 1 && <p className="muted small">{copy.details.alone}</p>}
        </section>
        <section className="group">
          <h3>{copy.details.branches}</h3>
          {branches.map((b) => (
            <div className="row" key={b}>
              <span className={`grow${b === s.branch ? "" : " mono"}`}>
                {b}
                {b === s.branch && <span className="muted">{copy.details.here}</span>}
              </span>
              {b !== s.branch && (
                <>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => client.send({ type: "switch", branch: b })}
                  >
                    {copy.details.switch}
                  </button>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => client.send({ type: "merge", source: b })}
                  >
                    {copy.details.foldInto(s.branch)}
                  </button>
                </>
              )}
            </div>
          ))}
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (forkName.trim()) client.send({ type: "fork", branch: forkName.trim() });
              setForkName("");
            }}
          >
            <input
              className="input mono grow"
              aria-label={copy.details.branchName}
              placeholder={copy.details.branchHint}
              value={forkName}
              onChange={(e) => setForkName(e.target.value)}
            />
            <button type="submit" className="btn sm">
              {copy.details.fork}
            </button>
          </form>
          <p className="row small muted">
            <span className="grow">
              {copy.details.files(files.length)}
              {s.openConflicts.length > 0 && (
                <span className="danger">{copy.details.conflicts(s.openConflicts.length)}</span>
              )}
              {s.checkpoints.length > 0 && copy.details.checkpoints(s.checkpoints.length)}
            </span>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => client.send({ type: "checkpoint", label: "manual" })}
            >
              {copy.details.checkpoint}
            </button>
          </p>
          {files.slice(0, 12).map((p) => (
            <div className="mono small ellipsis" key={p}>
              {p}
              {s.openConflicts.includes(p) && (
                <span className="danger">{copy.details.conflict}</span>
              )}
            </div>
          ))}
        </section>
        <section className="group">
          <h3>{copy.details.memory}</h3>
          {ctxMem.error && <p className="small danger">{ctxMem.error}</p>}
          <MemoryContext text={ctxMem.data?.context ?? ""} loading={ctxMem.loading} />
          <button type="button" className="btn ghost sm" onClick={ctxMem.reload}>
            {copy.details.refresh}
          </button>
        </section>
        <section className="group">
          <h3>{copy.details.catchUp}</h3>
          {brief ? (
            <pre className="brief">{brief}</pre>
          ) : (
            <p className="muted small">{copy.details.briefHint}</p>
          )}
          <button type="button" className="btn sm" onClick={() => client.send({ type: "brief" })}>
            {copy.details.askBrief}
          </button>
        </section>
      </aside>
    </>
  );
}

/** The memory context arrives as text; show each remembered line with its author beneath. */
function MemoryContext({ text, loading }: { text: string; loading: boolean }) {
  const lines = text
    .split("\n")
    .filter((l) => /^\s+[-!]\s/.test(l))
    .map((l) => {
      const conflict = /^\s+!/.test(l);
      const body = l.replace(/^\s+[-!]\s/, "");
      const m = body.match(/^(.*)\s\(([^()]*)\)$/);
      const text = m ? (m[1] ?? body) : body;
      const km = text.match(/^\[([^\]]+)\]\s(.*)$/s);
      return {
        conflict,
        key: km ? (km[1] ?? "") : "",
        text: km ? (km[2] ?? text) : text,
        who: m ? (m[2] ?? "") : "",
      };
    });
  if (lines.length === 0)
    return <p className="muted small">{loading ? copy.loading : copy.details.memoryEmpty}</p>;
  return (
    <div className="memlist">
      {lines.map((l) => (
        <div className={`memline${l.conflict ? " conflict" : ""}`} key={`${l.who}:${l.text}`}>
          <span>
            {l.conflict && <span className="muted">{copy.details.memoryConflict}</span>}
            {l.key && <span className="mono muted">{l.key} </span>}
            {l.text}
          </span>
          {l.who && <span className="small faint">{l.who}</span>}
        </div>
      ))}
    </div>
  );
}
