import type { ProjectState, SessionSummary } from "@fold/fleet";
import type { DirectiveMode } from "@fold/protocol";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Shell, type ShellContext } from "../App.js";
import {
  api,
  type EntryRecord,
  type Me,
  type MemoryConflict,
  refOf,
  type SessionRow,
  useFetch,
} from "../api.js";
import { wsUrl } from "../client.js";
import { copy } from "../copy.js";
import { EmptyState } from "../empty.js";
import type { Identity } from "../identity.js";
import { ProjectClient } from "../projectClient.js";
import { ReconnectLine } from "../reconnect.js";
import { navigate, paths } from "../router.js";
import {
  doingOf,
  ErrorLine,
  ICONS,
  Icon,
  MemoryLine,
  Status,
  TeamPill,
  useConnectionToasts,
} from "../ui.js";
import { InviteRow } from "./ShareSheet.js";

export function Project({
  projectId,
  identity,
  me,
  ctx,
}: {
  projectId: string;
  identity: Identity;
  me: Me | null;
  ctx: ShellContext;
}) {
  const client = useMemo(() => new ProjectClient(), []);
  const snap = useSyncExternalStore(
    (fn) => client.subscribe(fn),
    () => client.snapshot,
  );
  useEffect(() => {
    client.connect(wsUrl(), projectId, identity.userId);
    return () => client.disconnect();
  }, [client, projectId, identity.userId]);
  // Hook point (error-boundary-toasts): server errors and a lost socket as quiet toasts.
  useConnectionToasts(snap.connected, snap.errors);
  const ref = refOf(me, projectId);
  const s = snap.state;
  const orgId = s?.orgId || ref.orgId;
  const teamId = s?.teamId || ref.teamId;
  const name = s?.name || ref.name;
  const nameOf = (userId: string) => s?.members[userId]?.name ?? userId;
  const ownerOf = (sessionId: string) => {
    const owner = s?.sessions[sessionId]?.ownerId;
    return owner ? nameOf(owner) : sessionId;
  };
  const sessions = Object.values(s?.sessions ?? {}).sort(
    (a, b) => b.registeredSeq - a.registeredSeq,
  );
  const liveRows = useFetch(() => api.sessions(projectId), `${projectId}:${s?.seq ?? -1}`);
  const rowOf = new Map<string, SessionRow>((liveRows.data ?? []).map((r) => [r.sessionId, r]));
  const live = new Map<string, SessionRow["live"]>(
    (liveRows.data ?? []).map((r) => [r.sessionId, r.live]),
  );
  const groups = groupSessions(sessions);
  const open = Object.values(s?.contentions ?? {}).filter((c) => !c.resolved);
  const myRole = s?.members[identity.userId]?.role ?? "member";
  const lead = myRole === "lead" || myRole === "admin";
  // onboarding-empty-states: the new-session row's open state lives here so empty states can open it.
  const [newOpen, setNewOpen] = useState(() => location.hash.includes("new=1"));

  return (
    <Shell ctx={ctx} title={name} below={<ReconnectLine reconnecting={snap.reconnecting} />}>
      <div className="column page">
        <h1>{name}</h1>
        <ErrorLine errors={snap.errors} />
        <Direction
          state={s}
          identity={identity}
          onPost={(text, mode, scope) =>
            client.send({
              type: "project.directive",
              input: { text, mode, scope, supersedes: [], interrupt: false },
              targets: "all",
            })
          }
          onWithdraw={(id) => client.send({ type: "project.withdraw", directiveId: id })}
        />
        <section className="group" aria-label={copy.project.agents}>
          <h2>{copy.project.agents}</h2>
          {sessions.length === 0 && (
            <EmptyState
              text={copy.project.emptySessions}
              action={{ label: copy.project.startOne, onClick: () => setNewOpen(true) }}
            />
          )}
          <div className="list">
            {groups.map(([crew, members]) => (
              <div key={crew ?? "_solo"}>
                {crew && (
                  <div className="crew">
                    <span className="serif">{crew}</span>
                    <span className="faint">
                      {members.length} agent{members.length === 1 ? "" : "s"} on one task
                    </span>
                  </div>
                )}
                {members.map((sess) => (
                  <SessionRowItem
                    key={sess.sessionId}
                    s={sess}
                    row={rowOf.get(sess.sessionId) ?? null}
                    live={live.get(sess.sessionId) ?? null}
                    projectId={projectId}
                    nameOf={nameOf}
                    state={s}
                    canCrew={lead || sess.ownerId === identity.userId}
                    crews={groups.map(([c]) => c).filter((c): c is string => Boolean(c))}
                    onCrew={(crewName) => {
                      client.send({
                        type: "project.crew",
                        sessionId: sess.sessionId,
                        crew: crewName,
                      });
                      setTimeout(() => dispatchEvent(new Event("fold:fleet")), 300);
                    }}
                  />
                ))}
              </div>
            ))}
            <NewSessionRow
              open={newOpen}
              onOpen={setNewOpen}
              onCreate={(id, title) => {
                client.send({ type: "session.create", sessionId: id, title });
                navigate(paths.session(projectId, id, title));
              }}
            />
          </div>
        </section>
        {/* share-invite: the project id and the users.json membership instruction. */}
        <InviteRow projectId={projectId} state={s} me={identity.userId} />
        {open.length > 0 && (
          <section className="group">
            <h2>{copy.project.contentions}</h2>
            {open.map((c) => (
              <div className="notice contention" key={c.id}>
                <span>
                  {c.kind === "claim"
                    ? copy.project.bothWant
                    : c.kind === "merge-conflict"
                      ? copy.project.mergeConflictOn
                      : copy.project.overlapOn}{" "}
                  <span className="mono">{c.resource}</span>:{" "}
                  {c.sessionIds.map(ownerOf).join(copy.project.and)}
                  {c.detail ? ` · ${c.detail}` : ""}
                </span>
                {lead && (
                  <div className="actions">
                    {c.sessionIds.map((sid) => (
                      <button
                        key={sid}
                        type="button"
                        className="btn sm"
                        onClick={() =>
                          client.send({
                            type: "fleet.resolve",
                            contentionId: c.id,
                            winnerSessionId: sid,
                            note: "",
                          })
                        }
                      >
                        {copy.project.wins(ownerOf(sid))}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() =>
                        client.send({
                          type: "fleet.resolve",
                          contentionId: c.id,
                          winnerSessionId: null,
                          note: copy.project.dismissed,
                        })
                      }
                    >
                      {copy.project.dismiss}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}
        <TeamChat
          notes={s?.notes ?? []}
          me={identity.userId}
          nameOf={nameOf}
          onSay={(text) => client.send({ type: "project.note", text })}
        />
        <TeamMemory
          orgId={orgId}
          teamId={teamId}
          projectId={projectId}
          seq={s?.seq ?? -1}
          onStart={() => setNewOpen(true)}
        />
        {snap.brief && (
          <details className="group fold">
            <summary>
              <h2>{copy.project.brief}</h2>
            </summary>
            <pre className="brief">{snap.brief}</pre>
          </details>
        )}
      </div>
    </Shell>
  );
}

function statusOf(s: SessionSummary, live: SessionRow["live"], state: ProjectState | null): string {
  if (!s.open) return "closed";
  if (live) return live;
  const blocked = Object.values(state?.contentions ?? {}).some(
    (c) => !c.resolved && c.sessionIds.includes(s.sessionId),
  );
  if (blocked) return "blocked";
  return s.report?.status ?? "idle";
}

/** Crewed sessions first under their crew name, then the solo ones. Open before closed. */
function groupSessions(sessions: SessionSummary[]): [string | null, SessionSummary[]][] {
  const crews = new Map<string, SessionSummary[]>();
  const solo: SessionSummary[] = [];
  for (const s of sessions) {
    if (s.open && s.crew) crews.set(s.crew, [...(crews.get(s.crew) ?? []), s]);
    else solo.push(s);
  }
  const out: [string | null, SessionSummary[]][] = [...crews.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  if (solo.length) out.push([null, solo]);
  return out;
}

function SessionRowItem({
  s,
  row,
  live,
  projectId,
  nameOf,
  state,
  canCrew,
  crews,
  onCrew,
}: {
  s: SessionSummary;
  row: SessionRow | null;
  live: SessionRow["live"];
  projectId: string;
  nameOf: (id: string) => string;
  state: ProjectState | null;
  canCrew: boolean;
  crews: string[];
  onCrew: (crew: string | null) => void;
}) {
  const status = statusOf(s, live, state);
  const pending = s.report?.pendingApprovals ?? 0;
  const [naming, setNaming] = useState(false);
  const [crewName, setCrewName] = useState("");
  const online = (row?.people ?? []).filter((p) => p.online);
  const others = online.filter((p) => p.id !== s.ownerId).map((p) => p.name);
  const doing = row ? doingOf(row) : null;
  return (
    <div className="rowitem agentrow">
      <a className="ellipsis" href={paths.session(projectId, s.sessionId)}>
        <span className="t serif">{s.title || s.sessionId}</span>
        <span className="s">
          {nameOf(s.ownerId)}
          {others.length ? copy.project.withOthers(others) : ""}
          {doing ? ` · ${doing.lead} ${doing.text}` : s.report?.goal ? ` · ${s.report.goal}` : ""}
          {pending > 0 ? copy.project.approvalsWaiting(pending) : ""}
        </span>
      </a>
      <span className="row">
        {row && <TeamPill row={row} />}
        <Status status={status} />
        {canCrew && s.open && !naming && (
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => (s.crew ? onCrew(null) : setNaming(true))}
          >
            {s.crew ? "Leave crew" : "Team up"}
          </button>
        )}
      </span>
      {naming && (
        <form
          className="row crewform"
          onSubmit={(e) => {
            e.preventDefault();
            if (!crewName.trim()) return;
            onCrew(crewName.trim());
            setNaming(false);
            setCrewName("");
          }}
        >
          <input
            className="input grow"
            list={`crews-${s.sessionId}`}
            aria-label="Crew name"
            placeholder="Name the shared task"
            value={crewName}
            onChange={(e) => setCrewName(e.target.value)}
          />
          <datalist id={`crews-${s.sessionId}`}>
            {crews.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <button type="submit" className="btn sm" disabled={!crewName.trim()}>
            Team up
          </button>
          <button type="button" className="btn ghost sm" onClick={() => setNaming(false)}>
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}

/** The project's own channel: short messages between the people on it, kept in the ledger. */
function TeamChat({
  notes,
  me,
  nameOf,
  onSay,
}: {
  notes: { actor: string; text: string; seq: number }[];
  me: string;
  nameOf: (id: string) => string;
  onSay: (text: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <section className="group">
      <h2>Team chat</h2>
      <div className="chat">
        {notes.length === 0 && <p className="muted">Nothing said on this project yet.</p>}
        {notes.slice(-40).map((n) => (
          <div className={`line${n.actor === me ? " mine" : ""}`} key={n.seq}>
            <span className="who">{n.actor === me ? "You" : nameOf(n.actor)}</span>
            <span className="what">{n.text}</span>
          </div>
        ))}
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          onSay(t);
          setText("");
        }}
      >
        <input
          className="input grow"
          aria-label="Say to the project"
          placeholder="Say something to everyone on this project"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn sm" disabled={!text.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}

function NewSessionRow({
  open,
  onOpen: setOpen,
  onCreate,
}: {
  open: boolean;
  onOpen: (open: boolean) => void;
  onCreate: (id: string, title: string) => void;
}) {
  const [id, setId] = useState(`s-${Date.now().toString(36)}`);
  const [title, setTitle] = useState("");
  if (!open)
    return (
      <button type="button" className="rowitem new" onClick={() => setOpen(true)}>
        <span className="row">
          <Icon d={ICONS.plus} size={14} />
          {copy.project.newSession}
        </span>
      </button>
    );
  return (
    <form
      className="rowitem form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!id.trim()) return;
        onCreate(id.trim(), title.trim() || id.trim());
      }}
    >
      <input
        className="input grow"
        aria-label={copy.project.title}
        placeholder={copy.project.titleHint}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        className="input mono"
        style={{ width: 150 }}
        aria-label={copy.project.sessionId}
        value={id}
        onChange={(e) => setId(e.target.value)}
      />
      <button type="submit" className="btn primary sm">
        {copy.project.open}
      </button>
    </form>
  );
}

function Direction({
  state,
  identity,
  onPost,
  onWithdraw,
}: {
  state: ProjectState | null;
  identity: Identity;
  onPost: (text: string, mode: DirectiveMode, scope: string) => void;
  onWithdraw: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<DirectiveMode>("constrain");
  const active = Object.values(state?.directives ?? {})
    .filter((d) => d.status === "active")
    .sort((a, b) => b.seq - a.seq);
  return (
    <section className="group">
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onPost(text.trim(), mode, "goal");
          setText("");
        }}
      >
        <input
          type="text"
          aria-label={copy.project.direction}
          placeholder={copy.project.directionHint}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="bar">
          <button
            type="button"
            className={`chip${mode === "constrain" ? " on" : ""}`}
            aria-pressed={mode === "constrain"}
            title={mode === "constrain" ? copy.project.constrainHint : copy.project.steerHint}
            onClick={() => setMode(mode === "constrain" ? "steer" : "constrain")}
          >
            {mode}
          </button>
          <div className="right">
            <button
              type="submit"
              className="send"
              aria-label={copy.project.setDirection}
              disabled={!text.trim()}
            >
              <Icon d={ICONS.send} />
            </button>
          </div>
        </div>
      </form>
      {active.length > 0 && (
        <div className="chips">
          {active.map((d) => (
            <span
              className="chip"
              key={d.id}
              title={`${d.input.mode} · ${state?.members[d.author]?.name ?? d.author}`}
            >
              {d.input.text}
              {d.author === identity.userId && (
                <button
                  type="button"
                  className="x"
                  aria-label={copy.project.withdraw(d.input.text)}
                  onClick={() => onWithdraw(d.id)}
                >
                  <Icon d={ICONS.close} size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function TeamMemory({
  orgId,
  teamId,
  projectId,
  seq,
  onStart,
}: {
  orgId: string;
  teamId: string;
  projectId: string;
  seq: number;
  /** The empty state's one action: open the new-session row. */
  onStart?: () => void;
}) {
  const feed = useFetch(() => api.memory(orgId), `${orgId}:${seq}`);
  const entries = useMemo(() => {
    const all = (feed.data?.entries ?? []).filter(
      (e) =>
        e.status === "active" &&
        e.kind !== "retraction" &&
        e.kind !== "conflict" &&
        (!e.scope.projectId || e.scope.projectId === projectId) &&
        (!e.scope.teamId || e.scope.teamId === teamId),
    );
    return all.sort((a, b) => b.seq - a.seq);
  }, [feed.data, projectId, teamId]);
  const byId = new Map<string, EntryRecord>(entries.map((e) => [e.id, e]));
  const conflicts: MemoryConflict[] = (feed.data?.conflicts ?? []).filter(
    (c) => !c.resolved && c.entryIds.some((id) => byId.has(id)),
  );
  const inConflict = new Set(conflicts.flatMap((c) => c.entryIds));
  const rest = entries.filter((e) => !inConflict.has(e.id));
  return (
    <section className="group" aria-label={copy.project.teamMemory}>
      <div className="row">
        <h2 className="grow">{copy.project.teamMemory}</h2>
        <a className="small" href={paths.memory(orgId, { team: teamId, project: projectId })}>
          {copy.project.allMemory}
        </a>
      </div>
      {feed.error && <p className="small danger">{feed.error}</p>}
      {conflicts.map((c) => (
        <div className="notice contention" key={c.id}>
          <span>
            {copy.project.disagree}
            <span className="mono">{c.key}</span>.
          </span>
          {c.entryIds.map((id) => {
            const e = byId.get(id);
            return e ? <MemoryLine key={id} e={e} conflict /> : null;
          })}
        </div>
      ))}
      {rest.length === 0 && !feed.error && feed.loading && <p className="muted">{copy.loading}</p>}
      {rest.length === 0 && !feed.error && !feed.loading && (
        <EmptyState
          text={copy.project.memoryEmptyHint}
          action={onStart ? { label: copy.project.startSession, onClick: onStart } : null}
        />
      )}
      <div className="memlist">
        {rest.map((e) => (
          <MemoryLine key={e.id} e={e} />
        ))}
      </div>
    </section>
  );
}
