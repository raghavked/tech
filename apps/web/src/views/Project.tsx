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
import type { Identity } from "../identity.js";
import { ProjectClient } from "../projectClient.js";
import { navigate, paths } from "../router.js";
import { ErrorLine, ICONS, Icon, MemoryLine, Status } from "../ui.js";

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
  const live = new Map<string, SessionRow["live"]>(
    (liveRows.data ?? []).map((r) => [r.sessionId, r.live]),
  );
  const open = Object.values(s?.contentions ?? {}).filter((c) => !c.resolved);
  const myRole = s?.members[identity.userId]?.role ?? "member";
  const lead = myRole === "lead" || myRole === "admin";

  return (
    <Shell ctx={ctx} title={name}>
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
        <section className="group">
          <h2>Sessions</h2>
          {sessions.length === 0 && <p className="muted">No sessions yet.</p>}
          <div className="list">
            {sessions.map((sess) => (
              <SessionRowItem
                key={sess.sessionId}
                s={sess}
                live={live.get(sess.sessionId) ?? null}
                projectId={projectId}
                nameOf={nameOf}
                state={s}
              />
            ))}
            <NewSessionRow
              startOpen={location.hash.includes("new=1")}
              onCreate={(id, title) => {
                client.send({ type: "session.create", sessionId: id, title });
                navigate(paths.session(projectId, id, title));
              }}
            />
          </div>
        </section>
        {open.length > 0 && (
          <section className="group">
            <h2>Contentions</h2>
            {open.map((c) => (
              <div className="notice contention" key={c.id}>
                <span>
                  {c.kind === "claim"
                    ? "Both want"
                    : c.kind === "merge-conflict"
                      ? "Merge conflict on"
                      : "Overlapping work on"}{" "}
                  <span className="mono">{c.resource}</span>:{" "}
                  {c.sessionIds.map(ownerOf).join(" and ")}
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
                        {ownerOf(sid)} wins
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
                          note: "dismissed",
                        })
                      }
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}
        <TeamMemory orgId={orgId} teamId={teamId} projectId={projectId} seq={s?.seq ?? -1} />
        {snap.brief && (
          <details className="group fold">
            <summary>
              <h2>Brief</h2>
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

function SessionRowItem({
  s,
  live,
  projectId,
  nameOf,
  state,
}: {
  s: SessionSummary;
  live: SessionRow["live"];
  projectId: string;
  nameOf: (id: string) => string;
  state: ProjectState | null;
}) {
  const status = statusOf(s, live, state);
  const pending = s.report?.pendingApprovals ?? 0;
  return (
    <a className="rowitem" href={paths.session(projectId, s.sessionId)}>
      <span className="ellipsis">
        <span className="t">{s.title || s.sessionId}</span>
        <span className="s">
          {nameOf(s.ownerId)}
          {s.report?.goal ? ` · ${s.report.goal}` : ""}
          {pending > 0 ? ` · ${pending} approval${pending === 1 ? "" : "s"} waiting` : ""}
        </span>
      </span>
      <Status status={status} />
    </a>
  );
}

function NewSessionRow({
  startOpen,
  onCreate,
}: {
  startOpen: boolean;
  onCreate: (id: string, title: string) => void;
}) {
  const [open, setOpen] = useState(startOpen);
  const [id, setId] = useState(`s-${Date.now().toString(36)}`);
  const [title, setTitle] = useState("");
  if (!open)
    return (
      <button type="button" className="rowitem new" onClick={() => setOpen(true)}>
        <span className="row">
          <Icon d={ICONS.plus} size={14} />
          New session
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
        aria-label="Title"
        placeholder="What is this session for?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        className="input mono"
        style={{ width: 150 }}
        aria-label="Session id"
        value={id}
        onChange={(e) => setId(e.target.value)}
      />
      <button type="submit" className="btn primary sm">
        Open
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
          aria-label="Project direction"
          placeholder="Set direction for everyone in this project"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="bar">
          <button
            type="button"
            className={`chip${mode === "constrain" ? " on" : ""}`}
            aria-pressed={mode === "constrain"}
            title={
              mode === "constrain"
                ? "A standing constraint for every session"
                : "A steer every session follows"
            }
            onClick={() => setMode(mode === "constrain" ? "steer" : "constrain")}
          >
            {mode}
          </button>
          <div className="right">
            <button
              type="submit"
              className="send"
              aria-label="Set direction"
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
                  aria-label={`Withdraw: ${d.input.text}`}
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
}: {
  orgId: string;
  teamId: string;
  projectId: string;
  seq: number;
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
    <section className="group">
      <h2>Team memory</h2>
      {feed.error && <p className="small danger">{feed.error}</p>}
      {conflicts.map((c) => (
        <div className="notice contention" key={c.id}>
          <span>
            Two entries disagree on <span className="mono">{c.key}</span>.
          </span>
          {c.entryIds.map((id) => {
            const e = byId.get(id);
            return e ? <MemoryLine key={id} e={e} conflict /> : null;
          })}
        </div>
      ))}
      {rest.length === 0 && !feed.error && (
        <p className="muted">
          {feed.loading ? "Loading…" : "Nothing remembered for this project yet."}
        </p>
      )}
      <div className="memlist">
        {rest.map((e) => (
          <MemoryLine key={e.id} e={e} />
        ))}
      </div>
    </section>
  );
}
