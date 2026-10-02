import type { FleetContention, ProjectState } from "@fold/fleet";
import { useEffect, useMemo, useState } from "react";
import { Shell, type ShellContext } from "../App.js";
import {
  api,
  type CuratorReport,
  type Me,
  type Notification,
  type ProjectRef,
  routeOfLink,
  type SessionRow,
} from "../api.js";
import type { Identity } from "../identity.js";
import { paths } from "../router.js";
import { Status } from "../ui.js";

interface ProjectData {
  ref: ProjectRef;
  sessions: SessionRow[];
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

function countLine(c: Counts): string {
  const parts: string[] = [];
  if (c.running) parts.push(`${c.running} running`);
  if (c.awaiting_approval) parts.push(`${c.awaiting_approval} waiting on approval`);
  if (c.blocked) parts.push(`${c.blocked} blocked`);
  if (c.paused) parts.push(`${c.paused} paused`);
  if (c.idle) parts.push(`${c.idle} idle`);
  return parts.join(", ");
}

export function Team({
  teamId,
  identity,
  me,
  ctx,
}: {
  teamId: string;
  identity: Identity;
  me: Me | null;
  ctx: ShellContext;
}) {
  const projects = useMemo(
    () => (me?.projects ?? []).filter((p) => p.teamId === teamId),
    [me, teamId],
  );
  const first = projects[0];
  const teamName = first?.teamName ?? teamId;
  const [data, setData] = useState<ProjectData[]>([]);
  const [inbox, setInbox] = useState<Notification[]>([]);
  const [tick, setTick] = useState(0);
  const key = projects.map((p) => p.projectId).join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the identity of `projects`; `tick` forces a refresh
  useEffect(() => {
    let alive = true;
    Promise.all(
      projects.map(async (ref): Promise<ProjectData> => {
        try {
          const [sessions, state] = await Promise.all([
            api.sessions(ref.projectId),
            api.project(ref.projectId),
          ]);
          return { ref, sessions, state, error: null };
        } catch (e) {
          return {
            ref,
            sessions: [],
            state: null,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }),
    ).then((d) => alive && setData(d));
    api
      .notifications(identity.userId)
      .then((r) => alive && setInbox(r.notifications))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [key, tick, identity.userId]);

  const totals = data.reduce<Counts>(
    (acc, d) => {
      const c = countsOf(d.sessions);
      for (const k of Object.keys(acc) as (keyof Counts)[]) acc[k] += c[k];
      return acc;
    },
    { ...ZERO },
  );
  const openSessions = data.reduce((n, d) => n + d.sessions.filter((s) => s.open).length, 0);
  const approvals = data.flatMap((d) =>
    d.sessions
      .map((s) => ({
        d,
        s,
        n: s.report?.pendingApprovals || (s.live === "awaiting_approval" ? 1 : 0),
      }))
      .filter(({ s, n }) => s.open && n > 0),
  );
  const contentions = data.flatMap((d) =>
    Object.values(d.state?.contentions ?? {})
      .filter((c) => !c.resolved)
      .map((c) => ({ c, d })),
  );
  const handoffs = inbox
    .filter((n) => n.kind === "handoff")
    .sort((a, b) => b.at - a.at)
    .slice(0, 8);
  const orgs = [...new Set(projects.map((p) => p.orgId))];
  const needs = approvals.length + contentions.length;
  const summary =
    projects.length === 0
      ? me
        ? "No projects in this team are visible to you."
        : "Loading…"
      : `${openSessions} open session${openSessions === 1 ? "" : "s"} across ${projects.length} project${projects.length === 1 ? "" : "s"}${
          totals.running + totals.awaiting_approval + totals.blocked + totals.paused + totals.idle >
          0
            ? `: ${countLine(totals)}`
            : ""
        }. ${needs === 0 ? "Nothing needs you right now." : `${needs} thing${needs === 1 ? "" : "s"} need${needs === 1 ? "s" : ""} you.`}`;

  return (
    <Shell
      ctx={ctx}
      title={teamName}
      right={
        <button type="button" className="btn ghost sm" onClick={() => setTick((t) => t + 1)}>
          Refresh
        </button>
      }
    >
      <div className="column page">
        <h1>{teamName}</h1>
        <p className="muted">{summary}</p>
        <section className="group">
          <h2>Needs you</h2>
          {needs === 0 && <p className="muted">Nothing waiting.</p>}
          <div className="list">
            {approvals.map(({ d, s, n }) => (
              <a
                className="rowitem"
                key={s.sessionId}
                href={paths.session(d.ref.projectId, s.sessionId)}
              >
                <span className="ellipsis">
                  <span className="t">
                    {n} approval{n === 1 ? "" : "s"} waiting in {s.title || s.sessionId}
                  </span>
                  <span className="s">{d.ref.name}</span>
                </span>
                <span className="small muted">Open</span>
              </a>
            ))}
            {contentions.map(({ c, d }) => (
              <a
                className="rowitem"
                key={`${d.ref.projectId}:${c.id}`}
                href={paths.fleet(d.ref.projectId)}
              >
                <span className="ellipsis">
                  <span className="t">
                    {c.kind} on <span className="mono">{c.resource}</span>
                  </span>
                  <span className="s">
                    {d.ref.name} · {sessionNames(c, d.state)}
                  </span>
                </span>
                <span className="small muted">Resolve</span>
              </a>
            ))}
          </div>
        </section>
        <section className="group">
          <h2>Projects</h2>
          <div className="list">
            {data.map((d) => {
              const c = countsOf(d.sessions);
              const open = d.sessions.filter((s) => s.open).length;
              return (
                <a className="rowitem" key={d.ref.projectId} href={paths.fleet(d.ref.projectId)}>
                  <span className="ellipsis">
                    <span className="t">{d.ref.name}</span>
                    <span className="s">
                      {d.error ? d.error : open === 0 ? "no open sessions" : countLine(c)}
                    </span>
                  </span>
                  <Status
                    status={
                      c.blocked
                        ? "blocked"
                        : c.awaiting_approval
                          ? "awaiting_approval"
                          : c.running
                            ? "running"
                            : c.paused
                              ? "paused"
                              : "idle"
                    }
                  />
                </a>
              );
            })}
          </div>
        </section>
        <section className="group">
          <h2>Recent handoffs</h2>
          {handoffs.length === 0 && <p className="muted">None offered to you yet.</p>}
          <div className="list">
            {handoffs.map((n) => {
              const href = routeOfLink(n.link);
              const inner = (
                <>
                  <span className="ellipsis">
                    <span className="t">{n.body}</span>
                    <span className="s">{new Date(n.at).toLocaleString()}</span>
                  </span>
                  <span className="small muted">{n.read ? "" : "New"}</span>
                </>
              );
              return href ? (
                <a className="rowitem" key={n.id} href={href}>
                  {inner}
                </a>
              ) : (
                <div className="rowitem" key={n.id}>
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
        {orgs.map((org) => (
          <Housekeeping key={org} orgId={org} />
        ))}
      </div>
    </Shell>
  );
}

function sessionNames(c: FleetContention, state: ProjectState | null): string {
  return c.sessionIds
    .map((sid) => {
      const owner = state?.sessions[sid]?.ownerId;
      return owner ? (state?.members[owner]?.name ?? owner) : sid;
    })
    .join(" and ");
}

function Housekeeping({ orgId }: { orgId: string }) {
  const [report, setReport] = useState<CuratorReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true);
    api
      .curate(orgId)
      .then((r) => {
        setReport(r);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };
  return (
    <section className="group">
      <h2>Memory housekeeping</h2>
      {error && <p className="small danger">{error}</p>}
      {!report && (
        <p className="row">
          <span className="muted grow">
            One curator pass over {orgId}: fold grown scopes, flag stale entries, list conflicts.
          </span>
          <button type="button" className="btn sm" disabled={busy} onClick={run}>
            {busy ? "Running…" : "Run"}
          </button>
        </p>
      )}
      {report && (
        <div className="list quiet">
          {report.compacted.length === 0 &&
            report.stale.length === 0 &&
            report.conflicts.length === 0 && <p className="muted">Nothing to tidy.</p>}
          {report.compacted.map((c) => (
            <div className="rowitem" key={c.summaryId}>
              <span className="ellipsis">
                <span className="t">
                  Folded {c.folded} entries in <span className="mono">{c.scope}</span>
                </span>
                <span className="s">level {c.level}</span>
              </span>
            </div>
          ))}
          {report.stale.map((s) => (
            <div className="rowitem" key={s.id}>
              <span className="ellipsis">
                <span className="t">
                  Stale: <span className="mono">{s.key ?? s.id}</span>
                </span>
                <span className="s">
                  by {s.author} · unread for {s.unreadFor} events
                </span>
              </span>
            </div>
          ))}
          {report.conflicts.map((c) => (
            <div className="rowitem" key={c.id}>
              <span className="ellipsis">
                <span className="t">
                  Conflict on <span className="mono">{c.key}</span>
                </span>
                <span className="s">
                  {c.entries.map((e) => `${e.author}: ${e.content}`).join(" · ")}
                </span>
              </span>
            </div>
          ))}
          <p className="row">
            <span className="grow" />
            <button type="button" className="btn ghost sm" disabled={busy} onClick={run}>
              Run again
            </button>
          </p>
        </div>
      )}
    </section>
  );
}
