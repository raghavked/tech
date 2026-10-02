import type { FleetContention, ProjectState } from "@fold/fleet";
import { useEffect, useMemo, useState } from "react";
import { Crumb, Sep, Shell } from "../App.js";
import { api, type CuratorReport, type Me, type ProjectRef, type SessionRow } from "../api.js";
import type { Identity } from "../identity.js";
import { paths } from "../router.js";
import { Brief, Panel, Pill } from "../ui.js";

interface ProjectData {
  ref: ProjectRef;
  sessions: SessionRow[];
  brief: string | null;
  state: ProjectState | null;
  error: string | null;
}

type Counts = Record<"running" | "awaiting_approval" | "blocked" | "paused" | "idle", number>;
const ZERO: Counts = { running: 0, awaiting_approval: 0, blocked: 0, paused: 0, idle: 0 };

function countsOf(rows: SessionRow[]): Counts {
  const c = { ...ZERO };
  for (const r of rows) {
    if (!r.open) continue;
    const k = r.live ?? "idle";
    if (k === "running" || k === "awaiting_approval" || k === "blocked" || k === "paused")
      c[k] += 1;
    else c.idle += 1;
  }
  return c;
}

export function Management({
  teamId,
  identity,
  me,
}: {
  teamId: string;
  identity: Identity;
  me: Me | null;
}) {
  const projects = useMemo(
    () => (me?.projects ?? []).filter((p) => p.teamId === teamId),
    [me, teamId],
  );
  const first = projects[0];
  const [data, setData] = useState<ProjectData[]>([]);
  const [tick, setTick] = useState(0);
  const key = projects.map((p) => p.projectId).join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the identity of `projects`; `tick` forces a refresh
  useEffect(() => {
    let alive = true;
    Promise.all(
      projects.map(async (ref): Promise<ProjectData> => {
        try {
          const [sessions, brief, state] = await Promise.all([
            api.sessions(ref.projectId),
            api.brief(ref.projectId),
            api.project(ref.projectId),
          ]);
          return { ref, sessions, brief: brief.markdown, state, error: null };
        } catch (e) {
          return {
            ref,
            sessions: [],
            brief: null,
            state: null,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }),
    ).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [key, tick]);

  const totals = data.reduce<Counts>(
    (acc, d) => {
      const c = countsOf(d.sessions);
      for (const k of Object.keys(acc) as (keyof Counts)[]) acc[k] += c[k];
      return acc;
    },
    { ...ZERO },
  );
  const openContentions = data.flatMap((d) =>
    Object.values(d.state?.contentions ?? {})
      .filter((c) => !c.resolved)
      .map((c) => ({ c, d })),
  );
  const orgs = [...new Set(projects.map((p) => p.orgId))];
  const openSessions = data.reduce((n, d) => n + d.sessions.filter((s) => s.open).length, 0);

  return (
    <Shell
      crumbs={
        <>
          <Crumb>{first?.orgName ?? "Org"}</Crumb>
          <Sep />
          <b>{first?.teamName ?? teamId}</b>
          <Sep />
          <Crumb>Management</Crumb>
        </>
      }
      bar={
        <span className="muted small hide-mobile">
          {openSessions} sessions · {projects.length} projects
        </span>
      }
      who={identity}
      rail={{ current: "mgmt", teamId, ...(first ? { projectId: first.projectId } : {}) }}
    >
      <div className="dash">
        <div className="dashhead">
          <div>
            <p className="eyebrow">Team management</p>
            <h1>{first?.teamName ?? teamId}</h1>
          </div>
          <span className="grow" />
          <button type="button" className="btn sm" onClick={() => setTick((t) => t + 1)}>
            Refresh
          </button>
        </div>
        {me && projects.length === 0 && (
          <div className="note warn">No projects in this team are visible to you.</div>
        )}
        <div className="tiles">
          <Kpi cls="running" label="Running" n={totals.running} />
          <Kpi cls="awaiting" label="Awaiting approval" n={totals.awaiting_approval} />
          <Kpi cls="blocked" label="Blocked" n={totals.blocked} />
          <Kpi cls="paused" label="Paused" n={totals.paused} />
          <Kpi cls="idle" label="Idle" n={totals.idle} />
        </div>
        <p className="eyebrow">Fleet brief per project</p>
        <div className="briefs">
          {data.map((d) => (
            <ProjectBrief key={d.ref.projectId} d={d} />
          ))}
        </div>
        <div className="two">
          <Panel
            title="Open contentions"
            extra={<span className="chip">{openContentions.length} open</span>}
          >
            {openContentions.length === 0 && <p className="muted small">None across the team.</p>}
            <ul className="list">
              {openContentions.map(({ c, d }) => (
                <li key={`${d.ref.projectId}:${c.id}`}>
                  <div className="row between">
                    <b className="mono">{c.resource}</b>
                    <Pill status="blocked" suffix="open" />
                  </div>
                  <div className="muted small">
                    {d.ref.name} · {c.kind} · {sessionNames(c, d.state)} ·{" "}
                    <a href={paths.fleet(d.ref.projectId)}>resolve on the board</a>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
          {orgs.map((org) => (
            <CuratorCard key={org} orgId={org} />
          ))}
        </div>
      </div>
    </Shell>
  );
}

function sessionNames(c: FleetContention, state: ProjectState | null): string {
  return c.sessionIds
    .map((sid) => {
      const owner = state?.sessions[sid]?.ownerId;
      return owner ? `${state?.members[owner]?.name ?? owner}'s agent` : sid;
    })
    .join(" vs ");
}

function Kpi({ cls, label, n }: { cls: string; label: string; n: number }) {
  return (
    <div className={`kpi ${cls}`}>
      <span className="eyebrow">{label}</span>
      <div className="n">{n}</div>
    </div>
  );
}

function ProjectBrief({ d }: { d: ProjectData }) {
  const c = countsOf(d.sessions);
  const open = Object.values(d.state?.contentions ?? {}).filter((x) => !x.resolved).length;
  const lead = Object.values(d.state?.members ?? {}).find((m) => m.role === "lead");
  return (
    <section className={`card ${open > 0 ? "contention" : ""}`}>
      <div className="row between">
        <h3>{d.ref.name}</h3>
        <span className="muted small">{lead ? `lead ${lead.name}` : d.ref.projectId}</span>
      </div>
      <div className="row">
        {(Object.keys(c) as (keyof Counts)[]).map((k) =>
          c[k] ? <Pill key={k} status={k} count={c[k]} /> : null,
        )}
        {d.sessions.length === 0 && <span className="muted small">no sessions</span>}
      </div>
      {d.error && <div className="note danger">{d.error}</div>}
      <Brief text={d.brief} empty="No brief: no sessions have reported yet." />
      <div className="row">
        <a className="btn sm" href={paths.fleet(d.ref.projectId)}>
          Open fleet
        </a>
        <span className="grow" />
        <span className="muted small">
          {open > 0 ? `${open} open contention${open === 1 ? "" : "s"}` : "healthy"}
        </span>
      </div>
    </section>
  );
}

function CuratorCard({ orgId }: { orgId: string }) {
  const [report, setReport] = useState<CuratorReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Panel
      title={`Curator · ${orgId}`}
      extra={
        <button
          type="button"
          className="btn primary sm"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            api
              .curate(orgId)
              .then((r) => {
                setReport(r);
                setError(null);
              })
              .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Running…" : "Curator report"}
        </button>
      }
    >
      {error && <div className="note danger">{error}</div>}
      {!report && !error && (
        <p className="muted small">
          Runs one curator pass over the organisation memory: compacts grown scopes, flags stale
          agent-written entries and lists open conflicts.
        </p>
      )}
      {report && (
        <div className="col">
          <div>
            <span className="eyebrow">Compacted</span>
            {report.compacted.length === 0 && <p className="muted small">nothing to fold</p>}
            <ul className="list">
              {report.compacted.map((c) => (
                <li key={c.summaryId}>
                  <span className="mono">{c.scope}</span> · level {c.level} · folded {c.folded} into{" "}
                  <span className="mono">{c.summaryId}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="eyebrow">Stale</span>
            {report.stale.length === 0 && <p className="muted small">nothing stale</p>}
            <ul className="list">
              {report.stale.map((s) => (
                <li key={s.id}>
                  <span className="mono">{s.key ?? s.id}</span> by {s.author} · unread for{" "}
                  {s.unreadFor} events
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="eyebrow">Conflicts</span>
            {report.conflicts.length === 0 && <p className="muted small">no open conflicts</p>}
            {report.conflicts.map((c) => (
              <div className="card contention" key={c.id} style={{ marginTop: 6 }}>
                <span className="chip scope">{c.key}</span>
                {c.entries.map((e) => (
                  <div className="opt" key={e.id}>
                    <span />
                    <span>
                      {e.content}
                      <small>{e.author}</small>
                    </span>
                    <span />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
