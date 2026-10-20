/**
 * The manager overview (`#/m/:team`, SCREENS.md §10): the sentence first and the page as its
 * proof. Serif title, the range control top right driving every number, the lede in the
 * manager's voice, three needs-you cards with a stripe by kind, the stat tiles, three stacked
 * in + out charts and the area over turns from one component (viz.tsx), the crews, and the
 * roster where people and agents share one grid.
 */
import type { FleetContention, ProjectState } from "@henosis/fleet";
import { compactTokens } from "@henosis/kernel";
import type { UsageReport } from "@henosis/protocol";
import { type ReactNode, useEffect, useMemo, useState } from "react";
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
import { copy } from "../copy.js";
import { EmptyState, openDemoSession } from "../empty.js";
import { foldedSentence, needsYouOf, useGlance } from "../glance.js";
import { type Identity, initials } from "../identity.js";
import { notifyPermission, requestNotifications } from "../notify.js";
import { paths } from "../router.js";
import { Avatar, Loader, Status, toast } from "../ui.js";
import { Area, type BarRow, Bars, StatTile } from "../viz.js";

interface ProjectData {
  ref: ProjectRef;
  sessions: SessionRow[];
  state: ProjectState | null;
  error: string | null;
}

type Counts = Record<"running" | "awaiting_approval" | "blocked" | "paused" | "idle", number>;
const ZERO: Counts = { running: 0, awaiting_approval: 0, blocked: 0, paused: 0, idle: 0 };

/** The range control's steps: the store keeps a logical clock, so the unit is agent turns. */
const RANGES: { key: string; turns: number | null }[] = [
  { key: "all", turns: null },
  { key: "20", turns: 20 },
  { key: "5", turns: 5 },
];

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
  for (const k of Object.keys(ZERO) as (keyof Counts)[])
    if (c[k]) parts.push(copy.team.counts[k](c[k]));
  return parts.join(", ");
}

/** An agent in the roster or a chart: the agent shape with two-letter initials, never a bare "A". */
export function AgentAvatar({ title, size }: { title: string; size?: "sm" }) {
  return (
    <span className={`avatar agent initials${size ? ` ${size}` : ""}`} title={title}>
      {initials(title)}
    </span>
  );
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
  const [usage, setUsage] = useState<UsageReport | null>(null);
  const [range, setRange] = useState<string>("all");
  // The weave under the top row while housekeeping runs or the project rows load.
  const [housekeeping, setHousekeeping] = useState(false);
  // onboarding-empty-states: the inbox's empty state offers to turn notifications on.
  const [perm, setPerm] = useState(notifyPermission());
  const key = projects.map((p) => p.projectId).join(",");
  // No Refresh control (pages polish): the page refetches when it is looked at again and when
  // the fleet changes (the project page's `henosis:fleet` event).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const again = () => setTick((t) => t + 1);
    const seen = () => {
      if (document.visibilityState === "visible") again();
    };
    document.addEventListener("visibilitychange", seen);
    addEventListener("henosis:fleet", again);
    return () => {
      document.removeEventListener("visibilitychange", seen);
      removeEventListener("henosis:fleet", again);
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the identity of `projects`; `tick` forces a refetch
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
  }, [key, identity.userId, tick]);
  // The range control drives every number: the usage report is re-read per range.
  const turns = RANGES.find((r) => r.key === range)?.turns ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `tick` forces a refetch
  useEffect(() => {
    let alive = true;
    api
      .usage({ team: teamId, ...(turns ? { turns: String(turns) } : {}) })
      .then((u) => alive && setUsage(u))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [teamId, turns, tick]);

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
  const plans = data.flatMap((d) =>
    d.sessions
      .filter((s) => s.open && s.report?.plan?.status === "proposed")
      .map((s) => ({ d, s })),
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
  // The sentence's figure is the glance's needs-you number (approvals I can still vote on plus
  // handoffs offered to me), the same one the phone's Approvals tab and the push badge show;
  // the local sum stands in until the server has answered once.
  const glance = useGlance(identity.userId);
  const needs = needsYouOf(glance) ?? approvals.length + contentions.length + plans.length;

  // The manager's view: people and agents as one roster, crews, and where the tokens went.
  const people = new Map<
    string,
    { id: string; name: string; role: string; projects: string[]; online: boolean }
  >();
  for (const d of data)
    for (const m of Object.values(d.state?.members ?? {})) {
      const cur = people.get(m.userId) ?? {
        id: m.userId,
        name: m.name,
        role: m.role,
        projects: [],
        online: false,
      };
      cur.projects.push(d.ref.name);
      if (m.role !== "member") cur.role = m.role;
      if (d.sessions.some((s) => s.people.some((p) => p.id === m.userId && p.online)))
        cur.online = true;
      people.set(m.userId, cur);
    }
  const agents = data.flatMap((d) =>
    d.sessions
      .filter((s) => s.open)
      .map((s) => ({ d, s, owner: d.state?.members[s.ownerId]?.name ?? s.ownerId })),
  );
  const teamAgents = agents.filter(
    ({ s }) => s.crew || s.people.filter((p) => p.online).length > 1,
  ).length;
  const crews = new Map<
    string,
    { project: string; projectId: string; owners: Set<string>; n: number; tokens: number }
  >();
  for (const { d, s, owner } of agents) {
    if (!s.crew) continue;
    const c = crews.get(`${d.ref.projectId}:${s.crew}`) ?? {
      project: d.ref.name,
      projectId: d.ref.projectId,
      owners: new Set<string>(),
      n: 0,
      tokens: 0,
    };
    c.owners.add(owner);
    c.n += 1;
    c.tokens += (s.report?.usage?.input ?? 0) + (s.report?.usage?.output ?? 0);
    crews.set(`${d.ref.projectId}:${s.crew}`, c);
  }
  const planCounts = data
    .flatMap((d) => d.sessions.map((s) => s.report?.plan?.status).filter(Boolean))
    .reduce(
      (acc, st) => {
        if (st === "approved" || st === "done") acc.approved += 1;
        else if (st === "revise" || st === "rejected") acc.revised += 1;
        else if (st === "proposed") acc.waiting += 1;
        return acc;
      },
      { approved: 0, revised: 0, waiting: 0 },
    );
  const ratedPlans = planCounts.approved + planCounts.revised;
  const liveIds = new Set(
    agents.filter(({ s }) => s.live === "running").map(({ s }) => s.sessionId),
  );
  const byProject: BarRow[] = (usage?.byProject ?? [])
    .map((r) => ({
      key: r.projectId,
      label: r.name || r.projectId,
      input: r.usage.input,
      output: r.usage.output,
      href: paths.fleet(r.projectId),
    }))
    .sort((a, b) => b.input + b.output - (a.input + a.output));
  const byPerson: BarRow[] = (usage?.byUser ?? [])
    .map((r) => ({
      key: r.userId,
      label: r.name || r.userId,
      input: r.usage.input,
      output: r.usage.output,
      avatar: <Avatar id={r.userId} name={r.name || r.userId} />,
    }))
    .sort((a, b) => b.input + b.output - (a.input + a.output));
  const byAgent: BarRow[] = (usage?.bySession ?? [])
    .map((r) => ({
      key: `${r.projectId}/${r.sessionId}`,
      label: r.title || r.sessionId,
      sub: copy.team.agentOf(people.get(r.ownerId)?.name ?? r.ownerId),
      input: r.usage.input,
      output: r.usage.output,
      href: paths.session(r.projectId, r.sessionId),
      live: liveIds.has(r.sessionId),
      avatar: <AgentAvatar title={r.title || r.sessionId} />,
    }))
    .sort((a, b) => b.input + b.output - (a.input + a.output))
    .slice(0, 8);
  const overTurns = (usage?.byTurnBucket ?? []).map((b) => ({
    label: copy.team.turnBucket(b.from, b.to),
    value: b.usage.input + b.usage.output,
    detail: copy.team.calls(b.calls),
  }));
  const totalTokens = usage ? usage.totals.input + usage.totals.output : 0;
  const budgeted = (usage?.byProject ?? []).filter((p) => p.budget !== null);
  const budget = budgeted.length ? budgeted.reduce((n, p) => n + (p.budget ?? 0), 0) : null;
  const budgetSource = budgeted.some((p) => p.budgetSource === "project") ? "project" : "sessions";
  const loading = projects.length > 0 && data.length === 0;
  const turnsCounted = usage?.forecast.turns ?? 0;
  // The phone's titlebar (mobile-manager): the sentence in 23 px serif on navy, counts in white,
  // the needs clause in apricot with a pulsing dot, green when quiet; it folds to the subtitle.
  const sentence =
    projects.length === 0 ? null : (
      <p className={`sentence${needs === 0 ? " quiet" : ""}`}>
        <span className="n">{copy.team.openSessions(openSessions)}</span>
        {copy.team.across}
        <span className="n">{copy.team.projectsN(projects.length)}</span>.{" "}
        <b>
          {copy.team.needsN(needs)}
          <i className="dot" aria-hidden="true" />
        </b>
      </p>
    );
  const folded = foldedSentence(
    openSessions,
    needs,
    totalTokens,
    turns === null ? copy.team.thisWeek : copy.team.inRange(turns),
  );

  return (
    <Shell
      ctx={ctx}
      title={teamName}
      subtitle={copy.team.phoneLine(people.size, projects.length)}
      foldedSubtitle={folded}
      sentence={sentence}
      busy={housekeeping || loading}
    >
      <div className="column page">
        <div className="lede">
          <div className="lede-head">
            <h1>{teamName}</h1>
            <fieldset className="seg range" aria-label={copy.team.since}>
              <span className="faint small">{copy.team.since}</span>
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  className={range === r.key ? "on" : ""}
                  aria-pressed={range === r.key}
                  onClick={() => setRange(r.key)}
                >
                  {r.turns === null ? copy.team.rangeAll : copy.team.rangeTurns(r.turns)}
                </button>
              ))}
            </fieldset>
          </div>
          <p className="lede-line">
            {projects.length === 0 ? (
              <span className="muted">{me ? copy.team.noProjects : copy.loading}</span>
            ) : (
              <>
                <b>{copy.team.openSessions(openSessions)}</b>
                {copy.team.across}
                <b>{copy.team.projectsN(projects.length)}</b>
                {countLine(totals) ? `: ${countLine(totals)}` : ""}.{" "}
                <b className="hot">{copy.team.needsN(needs)}</b>
                {usage && totalTokens > 0 && (
                  <>
                    {copy.team.spentLead}
                    <span className="mono">{compactTokens(totalTokens)}</span>
                    {turns === null
                      ? copy.team.spentTail(ratedPlans, turnsCounted)
                      : copy.team.spentTailRange}
                  </>
                )}
              </>
            )}
          </p>
        </div>

        <section className="group" aria-label={copy.team.needsYou}>
          <div className="row group-head">
            <h2 className="grow">
              {copy.team.needsYou}
              {needs > 0 && <span className="count-word mono">{needs}</span>}
            </h2>
            {needs > 0 && (
              <a className="small" href={paths.approvals()}>
                {copy.team.openQueue}
              </a>
            )}
          </div>
          {needs === 0 && <p className="quiet-line ok-ink">{copy.team.nothingWaiting}</p>}
          <div className="needs">
            {approvals.map(({ d, s, n }) => (
              <NeedsYouCard
                key={`a-${s.sessionId}`}
                kind="approval"
                age={s.report ? copy.team.turnAge(s.report.turn) : null}
                sentence={
                  <>
                    {copy.team.approvalLead(n)}
                    <i>{s.title || s.sessionId}</i>.
                  </>
                }
                rule={copy.team.approvalRule(d.state?.members[s.ownerId]?.name ?? s.ownerId)}
                who={
                  <>
                    <Avatar id={s.ownerId} name={d.state?.members[s.ownerId]?.name ?? s.ownerId} />
                    <span>
                      {copy.team.agentOf(d.state?.members[s.ownerId]?.name ?? s.ownerId)} ·{" "}
                      {d.ref.name}
                    </span>
                  </>
                }
                action={{
                  label: copy.team.approve,
                  href: paths.session(d.ref.projectId, s.sessionId),
                  name: copy.team.approvalsIn(n, s.title || s.sessionId),
                }}
              />
            ))}
            {plans.map(({ d, s }) => (
              <NeedsYouCard
                key={`p-${s.sessionId}`}
                kind="plan"
                age={s.report ? copy.team.turnAge(s.report.turn) : null}
                sentence={
                  <>
                    {copy.team.planLead}
                    <i>{s.report?.goal || s.title || s.sessionId}</i>.
                  </>
                }
                rule={copy.team.planRule(compactTokens(s.report?.plan?.estTokens ?? 0))}
                who={
                  <>
                    <Avatar id={s.ownerId} name={d.state?.members[s.ownerId]?.name ?? s.ownerId} />
                    <span>
                      {copy.team.agentOf(d.state?.members[s.ownerId]?.name ?? s.ownerId)} ·{" "}
                      {d.ref.name}
                    </span>
                  </>
                }
                action={{
                  label: copy.team.readPlan,
                  href: paths.session(d.ref.projectId, s.sessionId),
                }}
              />
            ))}
            {contentions.map(({ c, d }) => (
              <NeedsYouCard
                key={`c-${d.ref.projectId}:${c.id}`}
                kind="contention"
                age={copy.team.turnAge(c.openedSeq)}
                sentence={
                  <>
                    {copy.team.contentionLead}
                    <i className="mono">{c.resource}</i>.
                  </>
                }
                rule={copy.team.contentionRule(sessionNames(c, d.state))}
                who={
                  <>
                    {c.sessionIds.map((sid) => {
                      const owner = d.state?.sessions[sid]?.ownerId ?? sid;
                      return (
                        <Avatar
                          key={sid}
                          id={owner}
                          name={d.state?.members[owner]?.name ?? owner}
                        />
                      );
                    })}
                    <span>{d.ref.name}</span>
                  </>
                }
                action={{ label: copy.team.resolve, href: paths.fleet(d.ref.projectId) }}
              />
            ))}
          </div>
        </section>

        <section className="group" aria-label={copy.team.overview}>
          <h2>{copy.team.overview}</h2>
          <div className="stats five">
            <StatTile
              label={copy.team.tokensTotal}
              value={compactTokens(totalTokens)}
              unit={copy.team.tokensUnit}
              detail={
                usage ? (
                  <>
                    {copy.team.tokensDetail(
                      compactTokens(usage.totals.input),
                      compactTokens(usage.totals.output),
                    )}
                    {usage.cache.read > 0 && (
                      <>
                        <br />
                        {copy.team.cacheDetail(compactTokens(usage.cache.read))}
                      </>
                    )}
                  </>
                ) : (
                  copy.loading
                )
              }
              trend={overTurns.map((p) => p.value)}
            />
            <StatTile
              label={copy.team.agentsOpen}
              value={String(openSessions)}
              unit={copy.team.agentsUnit}
              detail={copy.team.agentsDetail(teamAgents, openSessions - teamAgents)}
            />
            <StatTile
              label={copy.team.plansTile}
              value={String(ratedPlans)}
              unit={copy.team.plansUnit}
              detail={copy.team.plansDetail(
                planCounts.approved,
                planCounts.revised,
                planCounts.waiting,
              )}
            />
            {budget !== null ? (
              <StatTile
                label={copy.team.budgetTile}
                value={compactTokens(totalTokens)}
                unit={copy.team.budgetUnit(compactTokens(budget))}
                meter={{ used: totalTokens, budget }}
                detail={copy.team.budgetDetail(
                  Math.round((totalTokens / budget) * 100),
                  budgetSource,
                )}
              />
            ) : (
              <StatTile
                label={copy.team.budgetTile}
                value="—"
                detail={usage ? copy.team.noBudgetDetail : copy.loading}
              />
            )}
            <StatTile
              label={copy.team.membersTile}
              value={String(people.size + openSessions)}
              detail={copy.team.membersDetail(people.size, openSessions)}
            />
          </div>
          <div className="charts">
            <Bars title={copy.team.tokensByProject} rows={byProject} />
            <Bars title={copy.team.tokensByPerson} rows={byPerson} />
            <Bars title={copy.team.tokensByAgent} rows={byAgent} />
            <Area title={copy.team.tokensOverTurns} points={overTurns} />
          </div>
        </section>

        {crews.size > 0 && (
          <section className="group">
            <h2>{copy.team.crews}</h2>
            <div className="list">
              {[...crews.entries()].map(([key, c]) => (
                <a className="rowitem" key={key} href={paths.fleet(c.projectId)}>
                  <span className="ellipsis">
                    <span className="t serif crew-name">{key.slice(key.indexOf(":") + 1)}</span>
                    <span className="s">
                      {c.project} · {copy.team.crewLine(c.n, [...c.owners].join(", "))}
                    </span>
                  </span>
                  <span className="small mono muted">{compactTokens(c.tokens)}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="group">
          <div className="row group-head">
            <h2 className="grow">{copy.team.membersAndAgents}</h2>
            <span className="small muted">{copy.team.rosterLine(people.size, openSessions)}</span>
          </div>
          <div className="roster">
            {[...people.values()].map((m) => (
              <div className="member" key={m.id}>
                <span className={`ring${m.online ? " on" : ""}`}>
                  <Avatar id={m.id} name={m.name} />
                </span>
                <span className="who">
                  <span className="n">{m.name}</span>
                  <span className="r">
                    {m.role}
                    {m.online ? ` · ${copy.team.online}` : ""} · {m.projects.join(", ")}
                  </span>
                </span>
              </div>
            ))}
            {agents.map(({ d, s, owner }) => (
              <a
                className="member"
                key={s.sessionId}
                href={paths.session(d.ref.projectId, s.sessionId)}
              >
                <AgentAvatar title={s.title || s.sessionId} />
                <span className="who">
                  <span className="n">{s.title || s.sessionId}</span>
                  <span className="r">
                    {copy.team.agentOf(owner)} · {copy.team.inProject(d.ref.name)}
                    {s.crew ? ` · ${s.crew}` : ""}
                  </span>
                </span>
                <Status status={s.live ?? s.report?.status ?? "idle"} />
              </a>
            ))}
          </div>
        </section>

        <section className="group">
          <h2>{copy.team.projects}</h2>
          {loading && (
            <Loader kind="shimmer" label={copy.wait.team(teamName)} rows={projects.length} />
          )}
          {me && projects.length === 0 && (
            <EmptyState
              spot="open"
              text={copy.team.noProjectsYet}
              action={{
                label: copy.team.tryDemo,
                onClick: () => openDemoSession(identity.userId),
              }}
            />
          )}
          <div className="list">
            {data.map((d) => {
              const c = countsOf(d.sessions);
              const open = d.sessions.filter((s) => s.open).length;
              return (
                <a className="rowitem" key={d.ref.projectId} href={paths.fleet(d.ref.projectId)}>
                  <span className="ellipsis">
                    <span className="t">{d.ref.name}</span>
                    <span className="s">
                      {d.error ? d.error : open === 0 ? copy.team.noOpenSessions : countLine(c)}
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
          <h2>{copy.team.recentHandoffs}</h2>
          {handoffs.length === 0 && (
            <EmptyState
              spot="baton"
              text={copy.team.noHandoffsYet}
              action={
                perm === "default"
                  ? {
                      label: copy.team.turnOnNotifications,
                      onClick: () => {
                        requestNotifications().then(setPerm);
                      },
                    }
                  : first
                    ? { label: copy.team.openProject, href: paths.fleet(first.projectId) }
                    : null
              }
            />
          )}
          <div className="list">
            {handoffs.map((n) => {
              const href = routeOfLink(n.link);
              const inner = (
                <>
                  <span className="ellipsis">
                    <span className="t">{n.body}</span>
                    <span className="s">{new Date(n.at).toLocaleString()}</span>
                  </span>
                  <span className="small muted">{n.read ? "" : copy.team.new}</span>
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
          <Housekeeping key={org} orgId={org} onBusy={setHousekeeping} />
        ))}
      </div>
    </Shell>
  );
}

/**
 * A needs-you card (COMPONENTS.md 5.5): a 4 px stripe by kind (apricot plan, the gate stripe for
 * an approval, `--warn` for a contention), the kind label with the age in mono, a serif sentence
 * naming the thing in italic, the rule in one line, who, and one verb.
 */
function NeedsYouCard({
  kind,
  age,
  sentence,
  rule,
  who,
  action,
}: {
  kind: "approval" | "plan" | "contention";
  age: string | null;
  sentence: ReactNode;
  rule: string;
  who: ReactNode;
  action: { label: string; href: string; name?: string };
}) {
  return (
    <article className={`needcard ${kind}`}>
      <div className="row">
        <span className="kind">{copy.team.kind[kind]}</span>
        {age && <span className="age mono">{age}</span>}
      </div>
      <p className="serif sentence">{sentence}</p>
      <p className="rule">{rule}</p>
      <div className="foot">
        <span className="who">{who}</span>
        <a
          className={`btn sm${kind === "approval" ? " primary" : ""}`}
          href={action.href}
          aria-label={action.name}
        >
          {action.label}
        </a>
      </div>
    </article>
  );
}

function sessionNames(c: FleetContention, state: ProjectState | null): string {
  return c.sessionIds
    .map((sid) => {
      const owner = state?.sessions[sid]?.ownerId;
      return owner ? (state?.members[owner]?.name ?? owner) : sid;
    })
    .join(copy.project.and);
}

function Housekeeping({ orgId, onBusy }: { orgId: string; onBusy?: (busy: boolean) => void }) {
  const [report, setReport] = useState<CuratorReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true);
    onBusy?.(true);
    api
      .curate(orgId)
      .then((r) => {
        setReport(r);
        setError(null);
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        toast(`Housekeeping did not run: ${message}`);
      })
      .finally(() => {
        setBusy(false);
        onBusy?.(false);
      });
  };
  return (
    <section className="group">
      <div className="row">
        <h2 className="grow">{copy.team.housekeeping}</h2>
        <a className="small" href={paths.memory(orgId)}>
          {copy.team.browseMemory}
        </a>
      </div>
      {error && <p className="small danger">{error}</p>}
      {!report && (
        <p className="row">
          <span className="muted grow">{copy.team.curatorHint(orgId)}</span>
          <button type="button" className="btn sm" disabled={busy} onClick={run}>
            {busy ? copy.team.running : copy.team.run}
          </button>
        </p>
      )}
      {report && (
        <div className="list quiet">
          {report.compacted.length === 0 &&
            report.stale.length === 0 &&
            report.conflicts.length === 0 && <p className="muted">{copy.team.nothingToTidy}</p>}
          {report.compacted.map((c) => (
            <div className="rowitem" key={c.summaryId}>
              <span className="ellipsis">
                <span className="t">
                  {copy.team.foldedIn(c.folded)}
                  <span className="mono">{c.scope}</span>
                </span>
                <span className="s">{copy.team.level(c.level)}</span>
              </span>
            </div>
          ))}
          {report.stale.map((s) => (
            <div className="rowitem" key={s.id}>
              <span className="ellipsis">
                <span className="t">
                  {copy.team.stale}
                  <span className="mono">{s.key ?? s.id}</span>
                </span>
                <span className="s">{copy.team.staleLine(s.author, s.unreadFor)}</span>
              </span>
            </div>
          ))}
          {report.conflicts.map((c) => (
            <div className="rowitem" key={c.id}>
              <span className="ellipsis">
                <span className="t">
                  {copy.team.conflictOn}
                  <span className="mono">{c.key}</span>
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
              {copy.team.runAgain}
            </button>
          </p>
        </div>
      )}
    </section>
  );
}
