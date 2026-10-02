import { type ClaimRecord, type ProjectState, resourceKey, type SessionSummary } from "@fold/fleet";
import type { DirectiveMode } from "@fold/protocol";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Crumb, Sep, Shell } from "../App.js";
import { api, type EntryRecord, type Me, type MemoryConflict, refOf, useFetch } from "../api.js";
import { wsUrl } from "../client.js";
import type { Identity } from "../identity.js";
import { ProjectClient } from "../projectClient.js";
import { navigate, paths } from "../router.js";
import { Avatar, Brief, ErrorLine, fmtResource, Panel, Pill, shortSha, toneOf } from "../ui.js";

export function Fleet({
  projectId,
  identity,
  me,
}: {
  projectId: string;
  identity: Identity;
  me: Me | null;
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
  const [showNew, setShowNew] = useState(false);

  const sessions = Object.values(s?.sessions ?? {}).sort(
    (a, b) => b.registeredSeq - a.registeredSeq,
  );
  const open = Object.values(s?.contentions ?? {}).filter((c) => !c.resolved);
  const counts = countBy(sessions.map(statusOf));
  const nameOf = (userId: string) => s?.members[userId]?.name ?? userId;
  const sessionOwner = (sessionId: string) => {
    const owner = s?.sessions[sessionId]?.ownerId;
    return owner ? `${nameOf(owner)}'s session` : sessionId;
  };

  return (
    <Shell
      crumbs={
        <>
          <Crumb>{ref.orgName}</Crumb>
          <Sep />
          <Crumb href={paths.management(teamId)}>{ref.teamName}</Crumb>
          <Sep />
          <b>{s?.name || ref.name}</b>
          <Sep />
          <Crumb>Fleet</Crumb>
        </>
      }
      bar={
        <>
          {!snap.connected && <span className="muted small">connecting…</span>}
          <span className="stack hide-mobile">
            {Object.values(s?.members ?? {})
              .filter((m) => m.present)
              .map((m) => (
                <Avatar
                  key={m.userId}
                  id={m.userId}
                  name={m.name}
                  title={`${m.name} · ${m.role}`}
                />
              ))}
          </span>
          <button type="button" className="btn onchrome sm" onClick={() => setShowNew((v) => !v)}>
            New session
          </button>
        </>
      }
      who={identity}
      rail={{ current: "fleet", projectId, teamId }}
    >
      <div className="projhead">
        <div>
          <p className="eyebrow">Project fleet</p>
          <h1>{s?.name || ref.name}</h1>
        </div>
        <span className="grow" />
        <div className="row">
          {(["running", "awaiting_approval", "blocked", "paused", "idle"] as const).map((k) =>
            counts[k] ? <Pill key={k} status={k} count={counts[k]} /> : null,
          )}
          {sessions.length === 0 && <span className="muted small">No sessions yet.</span>}
        </div>
      </div>
      <div className="board">
        <div className="col">
          <ErrorLine errors={snap.errors} />
          {showNew && (
            <NewSession
              projectId={projectId}
              onCreate={(id, title) => {
                client.send({ type: "session.create", sessionId: id, title });
                navigate(paths.session(projectId, id, title));
              }}
            />
          )}
          <DirectiveComposer
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
          <div className="sessions">
            {sessions.map((sess) => (
              <SessionCard
                key={sess.sessionId}
                s={sess}
                state={s}
                projectId={projectId}
                nameOf={nameOf}
                sessionOwner={sessionOwner}
              />
            ))}
          </div>
          <ClaimsMap state={s} nameOf={nameOf} />
        </div>
        <div className="col">
          <Panel title="Open fleet contentions" extra={<span className="chip">{open.length}</span>}>
            {open.length === 0 && <p className="muted small">None. Claims are disjoint.</p>}
            <ul className="list">
              {open.map((c) => (
                <li key={c.id}>
                  <div className="row between">
                    <b className="mono">{c.resource}</b>
                    <span className={`tag ${c.kind === "claim" ? "conf" : "open"}`}>{c.kind}</span>
                  </div>
                  <p className="muted small" style={{ margin: "4px 0 8px" }}>
                    {c.detail || c.sessionIds.map(sessionOwner).join(" vs ")}
                  </p>
                  <div className="row">
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
                        {sessionOwner(sid)} wins
                      </button>
                    ))}
                    <button
                      type="button"
                      className="btn quiet sm"
                      onClick={() =>
                        client.send({
                          type: "fleet.resolve",
                          contentionId: c.id,
                          winnerSessionId: null,
                          note: "dismissed from the fleet board",
                        })
                      }
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel
            title="Fleet brief"
            extra={
              <button
                type="button"
                className="btn quiet sm"
                onClick={() => client.send({ type: "fleet.brief" })}
              >
                Refresh
              </button>
            }
          >
            <Brief text={snap.brief} empty="Ask for a brief once sessions report." />
          </Panel>
          <MemoryFeed orgId={orgId} teamId={teamId} projectId={projectId} seq={s?.seq ?? -1} />
        </div>
      </div>
    </Shell>
  );
}

function statusOf(s: SessionSummary): string {
  if (!s.open) return "closed";
  return s.report?.status ?? "idle";
}

function countBy(xs: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
}

function SessionCard({
  s,
  state,
  projectId,
  nameOf,
  sessionOwner,
}: {
  s: SessionSummary;
  state: ProjectState | null;
  projectId: string;
  nameOf: (id: string) => string;
  sessionOwner: (id: string) => string;
}) {
  const status = statusOf(s);
  const claims = Object.values(state?.claims ?? {}).filter(
    (c) => c.sessionId === s.sessionId && c.status === "active",
  );
  const blockers = Object.values(state?.contentions ?? {}).filter(
    (c) => !c.resolved && c.sessionIds.includes(s.sessionId),
  );
  const contended = new Set(blockers.map((b) => b.resource));
  const pending = s.report?.pendingApprovals ?? 0;
  return (
    <article className={`card sess ${toneOf(status)}`}>
      <div className="row between">
        <span className="who">
          <Avatar id={s.ownerId} name={nameOf(s.ownerId)} />
          <span>
            <span className="name">{nameOf(s.ownerId)}'s agent</span>
            <div className="meta">
              {nameOf(s.ownerId)} · owner · {s.sessionId}
            </div>
          </span>
        </span>
        <Pill status={status} />
      </div>
      <p className="goal">{s.report?.goal ?? s.title}</p>
      {claims.length > 0 && (
        <div className="row">
          {claims.map((c) => (
            <span
              key={c.id}
              className="chip scope"
              style={isContended(c, contended) ? { color: "var(--danger)" } : {}}
            >
              {fmtResource(c.resource)}
            </span>
          ))}
        </div>
      )}
      <div className="meta">
        turn {s.report?.turn ?? 0} · {s.title}
        {s.report?.activePaths.length ? ` · ${s.report.activePaths.length} active paths` : ""}
      </div>
      {blockers.map((b) => (
        <div className="blk bad" key={b.id}>
          Blocked by fleet contention: <b>{b.resource}</b> with{" "}
          {b.sessionIds
            .filter((id) => id !== s.sessionId)
            .map(sessionOwner)
            .join(", ") || "another session"}
        </div>
      ))}
      {blockers.length === 0 && pending > 0 && (
        <div className="blk warn">
          {pending} approval{pending === 1 ? "" : "s"} waiting
        </div>
      )}
      {blockers.length === 0 && pending === 0 && s.report?.summary && (
        <div className="blk">{s.report.summary.slice(0, 160)}</div>
      )}
      <div className="foot">
        <a className="btn sm" href={paths.session(projectId, s.sessionId)}>
          Open
        </a>
      </div>
    </article>
  );
}

function isContended(c: ClaimRecord, contended: Set<string>): boolean {
  return contended.has(resourceKey(c.resource)) || contended.has(fmtResource(c.resource));
}

function ClaimsMap({
  state,
  nameOf,
}: {
  state: ProjectState | null;
  nameOf: (id: string) => string;
}) {
  const claims = Object.values(state?.claims ?? {})
    .filter((c) => c.status === "active" || c.status === "pending")
    .sort((a, b) => a.requestedSeq - b.requestedSeq);
  const open = Object.values(state?.contentions ?? {}).filter((c) => !c.resolved);
  const contended = new Set(open.map((c) => c.resource));
  const wantedBy = (c: ClaimRecord) =>
    open
      .filter(
        (o) => o.resource === resourceKey(c.resource) || o.resource === fmtResource(c.resource),
      )
      .flatMap((o) => o.sessionIds)
      .filter((sid) => sid !== c.sessionId)
      .map((sid) => nameOf(state?.sessions[sid]?.ownerId ?? sid));
  return (
    <section className="panel">
      <header>
        <span className="eyebrow">Claims map</span>
        <span className="muted small">files and services held by sessions</span>
      </header>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Path / service</th>
              <th>Holder</th>
              <th>Since</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {claims.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No claims held. Writes take an exclusive path claim automatically.
                </td>
              </tr>
            )}
            {claims.map((c) => {
              const owner = state?.sessions[c.sessionId]?.ownerId ?? c.ownerId;
              const others = wantedBy(c);
              return (
                <tr key={c.id}>
                  <td>
                    <span className="mono">{fmtResource(c.resource)}</span>
                    {c.mode === "shared" && <span className="muted"> · shared</span>}
                  </td>
                  <td>
                    <span className="who">
                      <Avatar id={owner} name={nameOf(owner)} small />
                      {nameOf(owner)}'s agent
                    </span>
                    {others.length > 0 && (
                      <span className="muted"> · wanted by {others.join(", ")}</span>
                    )}
                  </td>
                  <td className="mono">seq {c.requestedSeq}</td>
                  <td>
                    {isContended(c, contended) ? (
                      <span className="tag conf">contended</span>
                    ) : c.status === "pending" ? (
                      <span className="tag">pending</span>
                    ) : (
                      <span className="tag ok">held</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DirectiveComposer({
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
  const [scope, setScope] = useState("goal");
  const active = Object.values(state?.directives ?? {})
    .filter((d) => d.status === "active")
    .sort((a, b) => b.seq - a.seq);
  const role = state?.members[identity.userId]?.role ?? "member";
  return (
    <Panel title="Lead directive" extra={<span className="tag all">applies to all sessions</span>}>
      <textarea
        className="input"
        aria-label="Project directive"
        placeholder="Schema freeze until Thursday. No migrations, no column drops…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="row">
        <select
          className="select"
          style={{ width: 120 }}
          aria-label="Mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as DirectiveMode)}
        >
          <option value="steer">steer</option>
          <option value="constrain">constrain</option>
        </select>
        <input
          className="input mono"
          style={{ width: 120 }}
          aria-label="Scope"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          placeholder="scope"
        />
        <span className="grow" />
        <span className="muted small">
          As {identity.name} · {role} · rank above every session owner
        </span>
        <button
          type="button"
          className="btn primary"
          disabled={!text.trim()}
          onClick={() => {
            onPost(text.trim(), mode, scope.trim() || "goal");
            setText("");
          }}
        >
          Post to fleet
        </button>
      </div>
      {active.map((d) => (
        <div className="note info row" key={d.id}>
          <Avatar id={d.author} name={state?.members[d.author]?.name ?? d.author} small />
          <span className="grow">
            In force since seq {d.seq} · <b>{d.input.text}</b> · {d.input.mode} ·{" "}
            <span className="chip scope">{d.input.scope}</span>
            {d.targets === "all" ? " · all sessions" : ` · ${d.targets.length} sessions`}
          </span>
          {d.author === identity.userId && (
            <button type="button" className="btn quiet sm" onClick={() => onWithdraw(d.id)}>
              Withdraw
            </button>
          )}
        </div>
      ))}
    </Panel>
  );
}

function NewSession({
  projectId,
  onCreate,
}: {
  projectId: string;
  onCreate: (id: string, title: string) => void;
}) {
  const [id, setId] = useState(`s-${Date.now().toString(36)}`);
  const [title, setTitle] = useState("");
  return (
    <Panel title="New session" extra={<span className="muted small mono">in {projectId}</span>}>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!id.trim()) return;
          onCreate(id.trim(), title.trim() || id.trim());
        }}
      >
        <input
          className="input mono"
          style={{ width: 180 }}
          aria-label="Session id"
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
        <input
          className="input grow"
          aria-label="Title"
          placeholder="What is this session for?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="submit" className="btn primary">
          Create and open
        </button>
      </form>
    </Panel>
  );
}

function MemoryFeed({
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
  const byId = new Map(entries.map((e) => [e.id, e]));
  const conflicts = (feed.data?.conflicts ?? []).filter(
    (c) => !c.resolved && c.entryIds.some((id) => byId.has(id)),
  );
  const inConflict = new Set(conflicts.flatMap((c) => c.entryIds));
  const rest = entries.filter((e) => !inConflict.has(e.id));
  return (
    <Panel
      className="feed"
      title="Shared memory"
      extra={
        <span className="row">
          <span className="muted small">project · attributed</span>
          <button type="button" className="btn quiet sm" onClick={feed.reload}>
            Refresh
          </button>
        </span>
      }
    >
      {feed.error && <div className="note danger">{feed.error}</div>}
      {conflicts.map((c) => (
        <ConflictCard key={c.id} c={c} byId={byId} />
      ))}
      {rest.length === 0 && !feed.error && (
        <p className="muted small">Nothing remembered for this project yet.</p>
      )}
      {rest.map((e) => (
        <MemoryItem key={e.id} e={e} />
      ))}
    </Panel>
  );
}

function ConflictCard({ c, byId }: { c: MemoryConflict; byId: Map<string, EntryRecord> }) {
  return (
    <div className="card contention">
      <div className="row between">
        <span className="eyebrow">Memory conflict</span>
        <span className="chip scope">{c.key}</span>
      </div>
      {c.entryIds.map((id) => {
        const e = byId.get(id);
        if (!e) return null;
        const author = e.attribution.userName ?? e.attribution.userId;
        return (
          <div className="opt" key={id}>
            <Avatar id={e.attribution.userId} name={author} small />
            <span>
              {e.content}
              <small>{attribLine(e)}</small>
            </span>
            <button
              type="button"
              className="btn sm"
              disabled
              title="resolve from the management view"
            >
              {author} is right
            </button>
          </div>
        );
      })}
    </div>
  );
}

function attribLine(e: EntryRecord): string {
  const a = e.attribution;
  const parts = [`added by ${a.userName ?? a.userId}`];
  if (a.sessionId) parts.push(`session ${a.sessionId}`);
  const sha = shortSha(a.commitSha);
  if (sha) parts.push(`commit ${sha}`);
  return parts.join(" · ");
}

export function MemoryItem({ e }: { e: EntryRecord }) {
  return (
    <p className="mem">
      {e.key && <span className="mono">[{e.key}] </span>}
      {e.content}
      <span className="by">
        {attribLine(e)} · {e.trust}
      </span>
    </p>
  );
}
