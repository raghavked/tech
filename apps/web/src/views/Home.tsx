import { useMemo, useState } from "react";
import { Shell, type ShellContext } from "../App.js";
import type { Me, ProjectRef } from "../api.js";
import { type Identity, saveIdentity, slugify } from "../identity.js";
import { navigate, paths } from "../router.js";
import { Mark } from "../ui.js";

export function Home({
  me,
  meError,
  identity,
  ctx,
}: {
  me: Me | null;
  meError: string | null;
  identity: Identity | null;
  ctx: ShellContext;
}) {
  const needsIdentity = ctx.route.name !== "home" && !identity;
  return (
    <Shell ctx={ctx} title={identity ? "Home" : "Fold"}>
      <div className="column page home">
        {!identity && (
          <div className="hero">
            <Mark size={40} />
            <h1>Several hands on the fold; one holds it at a time.</h1>
            <p className="muted">Watch the course, redirect, hand off.</p>
            {needsIdentity && <p className="small danger">Pick an identity to open that page.</p>}
          </div>
        )}
        <IdentityForm identity={identity} me={me} />
        {identity && <Projects me={me} error={meError} />}
      </div>
    </Shell>
  );
}

function IdentityForm({ identity, me }: { identity: Identity | null; me: Me | null }) {
  const [name, setName] = useState(identity?.name ?? "");
  const [userId, setUserId] = useState(identity?.userId ?? "");
  const [userTouched, setUserTouched] = useState(Boolean(identity));
  const [token, setToken] = useState(identity?.token ?? "");
  const [editing, setEditing] = useState(!identity);
  if (identity && !editing)
    return (
      <p className="row muted">
        <span className="grow">
          Signed in as {identity.name} <span className="mono">{identity.userId}</span>
          {me && !me.user && " · unknown to the server; first in owns a session"}
        </span>
        <button type="button" className="btn ghost sm" onClick={() => setEditing(true)}>
          Change
        </button>
      </p>
    );
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const id = (userId || slugify(name)).trim();
        if (!name.trim() || !id) return;
        saveIdentity({ name: name.trim(), userId: id, token: token.trim() });
        setEditing(false);
      }}
    >
      <label className="field">
        <span>Your name</span>
        <input
          className="input"
          value={name}
          autoComplete="name"
          onChange={(e) => {
            setName(e.target.value);
            if (!userTouched) setUserId(slugify(e.target.value));
          }}
        />
      </label>
      <label className="field">
        <span>User id</span>
        <input
          className="input mono"
          value={userId}
          placeholder="as in users.json"
          onChange={(e) => {
            setUserTouched(true);
            setUserId(slugify(e.target.value));
          }}
        />
      </label>
      <label className="field">
        <span>Token (optional)</span>
        <input
          className="input"
          type="password"
          value={token}
          autoComplete="off"
          placeholder="only if the server requires one"
          onChange={(e) => setToken(e.target.value)}
        />
      </label>
      <div className="row">
        <button type="submit" className="btn primary">
          Continue
        </button>
        {identity && (
          <button type="button" className="btn ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function Projects({ me, error }: { me: Me | null; error: string | null }) {
  const teams = useMemo(() => groupByTeam(me?.projects ?? []), [me]);
  const [sessionId, setSessionId] = useState("");
  const [project, setProject] = useState("default");
  const projects = me?.projects ?? [];
  const pid = projects.some((p) => p.projectId === project)
    ? project
    : (projects[0]?.projectId ?? project);
  return (
    <>
      <section className="group">
        <h2>Projects</h2>
        {error && <p className="small danger">Could not load /api/me: {error}</p>}
        {!error && !me && <p className="muted">Loading…</p>}
        {me && teams.length === 0 && (
          <p className="muted">No projects for you yet. Ask a lead to add you.</p>
        )}
        {teams.map((t) => (
          <div className="list" key={t.id}>
            {t.projects.map((p) => (
              <a className="rowitem" key={p.projectId} href={paths.fleet(p.projectId)}>
                <span className="ellipsis">
                  <span className="t">{p.name}</span>
                  <span className="s">
                    {p.orgName} · {p.teamName}
                  </span>
                </span>
                <span className="small muted">Open</span>
              </a>
            ))}
            <a className="rowitem" href={paths.management(t.id)}>
              <span className="ellipsis">
                <span className="t">{t.name}</span>
                <span className="s">team overview</span>
              </span>
              <span className="small muted">Open</span>
            </a>
          </div>
        ))}
      </section>
      <form
        className="row open-session"
        onSubmit={(e) => {
          e.preventDefault();
          const id = slugify(sessionId);
          if (!id) return;
          navigate(paths.session(pid, id));
        }}
      >
        {projects.length > 1 ? (
          <select
            className="select"
            aria-label="Project"
            value={pid}
            onChange={(e) => setProject(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.name}
              </option>
            ))}
          </select>
        ) : null}
        <input
          className="input mono grow"
          aria-label="Session id"
          placeholder="Open a session by id"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        />
        <button type="submit" className="btn sm">
          Open session
        </button>
      </form>
    </>
  );
}

function groupByTeam(projects: ProjectRef[]) {
  const teams = new Map<string, { id: string; name: string; projects: ProjectRef[] }>();
  for (const p of projects) {
    const t = teams.get(p.teamId) ?? { id: p.teamId, name: p.teamName, projects: [] };
    t.projects.push(p);
    teams.set(p.teamId, t);
  }
  return [...teams.values()];
}
