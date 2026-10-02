import { useMemo, useState } from "react";
import { Crumb, Shell } from "../App.js";
import type { Me, ProjectRef } from "../api.js";
import { clearIdentity, type Identity, saveIdentity, slugify } from "../identity.js";
import { navigate, paths, type Route } from "../router.js";
import { Avatar, Panel } from "../ui.js";

export function Home({
  me,
  meError,
  route,
  identity,
}: {
  me: Me | null;
  meError: string | null;
  route: Route;
  identity: Identity | null;
}) {
  const needsIdentity = route.name !== "home" && !identity;
  return (
    <Shell
      crumbs={<Crumb>Sessions</Crumb>}
      who={identity}
      rail={identity ? { current: "sessions" } : null}
    >
      <div className="home">
        <div className="hero">
          <p className="eyebrow">Fold</p>
          <h1>Several hands on the fold; one holds it at a time.</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Watch the course, redirect, hand off. The first person into a session owns it; leads own
            every session in their team.
          </p>
        </div>
        <div className="col">
          {needsIdentity && <div className="note warn">Pick an identity to open that page.</div>}
          <IdentityCard identity={identity} me={me} />
          {identity && <OpenSession me={me} />}
        </div>
        <div className="col">
          {identity ? (
            <Tree me={me} error={meError} />
          ) : (
            <Panel title="Your projects">
              <p className="muted small">Sign in to see your organisations and teams.</p>
            </Panel>
          )}
        </div>
      </div>
    </Shell>
  );
}

function IdentityCard({ identity, me }: { identity: Identity | null; me: Me | null }) {
  const [name, setName] = useState(identity?.name ?? "");
  const [userId, setUserId] = useState(identity?.userId ?? "");
  const [userTouched, setUserTouched] = useState(Boolean(identity));
  const [token, setToken] = useState(identity?.token ?? "");
  const [editing, setEditing] = useState(!identity);
  if (identity && !editing)
    return (
      <Panel
        title="You"
        extra={
          <button type="button" className="btn quiet sm" onClick={() => setEditing(true)}>
            Change
          </button>
        }
      >
        <div className="who">
          <Avatar id={identity.userId} name={identity.name} />
          <span>
            <span className="name">{identity.name}</span>
            <div className="muted small mono">
              {identity.userId}
              {me && !me.user && " · not in users.json: first in owns a session"}
              {me?.user && " · known to the server"}
            </div>
          </span>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn quiet sm"
            onClick={() => {
              clearIdentity();
              setEditing(true);
            }}
          >
            Sign out
          </button>
        </div>
      </Panel>
    );
  return (
    <Panel title="Who are you?">
      <form
        className="col"
        onSubmit={(e) => {
          e.preventDefault();
          const id = (userId || slugify(name)).trim();
          if (!name.trim() || !id) return;
          saveIdentity({ name: name.trim(), userId: id, token: token.trim() });
          setEditing(false);
        }}
      >
        <div className="field-group">
          <label htmlFor="id-name">Your name</label>
          <input
            id="id-name"
            className="input"
            value={name}
            autoComplete="name"
            onChange={(e) => {
              setName(e.target.value);
              if (!userTouched) setUserId(slugify(e.target.value));
            }}
          />
        </div>
        <div className="field-group">
          <label htmlFor="id-user">User id</label>
          <input
            id="id-user"
            className="input mono"
            value={userId}
            placeholder="as in users.json"
            onChange={(e) => {
              setUserTouched(true);
              setUserId(slugify(e.target.value));
            }}
          />
        </div>
        <div className="field-group">
          <label htmlFor="id-token">Token (optional)</label>
          <input
            id="id-token"
            className="input"
            type="password"
            value={token}
            autoComplete="off"
            placeholder="only if the server requires one"
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
        <div className="row">
          <button type="submit" className="btn primary">
            Continue
          </button>
          {identity && (
            <button type="button" className="btn quiet" onClick={() => setEditing(false)}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </Panel>
  );
}

function OpenSession({ me }: { me: Me | null }) {
  const projects = me?.projects ?? [];
  const [project, setProject] = useState("default");
  const [sessionId, setSessionId] = useState("");
  const [title, setTitle] = useState("");
  const pid = projects.some((p) => p.projectId === project)
    ? project
    : (projects[0]?.projectId ?? project);
  return (
    <Panel title="Open or create a session">
      <form
        className="col"
        onSubmit={(e) => {
          e.preventDefault();
          const id = slugify(sessionId);
          if (!id) return;
          navigate(paths.session(pid, id, title.trim() || undefined));
        }}
      >
        <div className="field-group">
          <label htmlFor="open-project">Project</label>
          {projects.length > 0 ? (
            <select
              id="open-project"
              className="select"
              value={pid}
              onChange={(e) => setProject(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.orgName} › {p.teamName} › {p.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="open-project"
              className="input mono"
              value={project}
              onChange={(e) => setProject(e.target.value)}
            />
          )}
        </div>
        <div className="field-group">
          <label htmlFor="open-session">Session id</label>
          <input
            id="open-session"
            className="input mono"
            value={sessionId}
            placeholder="billing-42"
            onChange={(e) => setSessionId(e.target.value)}
          />
        </div>
        <div className="field-group">
          <label htmlFor="open-title">Title (for a new session)</label>
          <input
            id="open-title"
            className="input"
            value={title}
            placeholder="Invoice PDF + tax lines"
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="row">
          <button type="submit" className="btn primary">
            Open session
          </button>
        </div>
      </form>
    </Panel>
  );
}

function Tree({ me, error }: { me: Me | null; error: string | null }) {
  const orgs = useMemo(() => groupTree(me?.projects ?? []), [me]);
  return (
    <Panel title="Organisations › teams › projects">
      {error && <div className="note danger">Could not load /api/me: {error}</div>}
      {!error && !me && <p className="muted small">Loading…</p>}
      {me && orgs.length === 0 && (
        <p className="muted small">No projects for you yet. Ask a lead to add you.</p>
      )}
      <div className="tree">
        {orgs.map((o) => (
          <div className="org" key={o.id}>
            <h2>{o.name}</h2>
            {o.teams.map((t) => (
              <div className="team" key={t.id}>
                <div className="row between">
                  <h3>{t.name}</h3>
                  <a className="btn sm" href={paths.management(t.id)}>
                    Management
                  </a>
                </div>
                {t.projects.map((p) => (
                  <div className="project" key={p.projectId}>
                    <a href={paths.fleet(p.projectId)}>{p.name}</a>
                    <span className="mono faint">{p.projectId}</span>
                    <a className="btn sm" href={paths.fleet(p.projectId)}>
                      Fleet board
                    </a>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function groupTree(projects: ProjectRef[]) {
  const orgs = new Map<
    string,
    {
      id: string;
      name: string;
      teams: Map<string, { id: string; name: string; projects: ProjectRef[] }>;
    }
  >();
  for (const p of projects) {
    const o = orgs.get(p.orgId) ?? { id: p.orgId, name: p.orgName, teams: new Map() };
    orgs.set(p.orgId, o);
    const t = o.teams.get(p.teamId) ?? { id: p.teamId, name: p.teamName, projects: [] };
    o.teams.set(p.teamId, t);
    t.projects.push(p);
  }
  return [...orgs.values()].map((o) => ({ ...o, teams: [...o.teams.values()] }));
}
