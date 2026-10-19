/**
 * The project page (`#/p/:project`, SCREENS.md §9): the fleet board. The lede in the manager's
 * voice, the direction composer with its constrain / steer segment and the active directions as
 * chips, the agents by crew (hollow apricot ring, serif crew name, mono claims) with one row
 * grammar (dot · serif title · owner · the agent's italic line · token meter · status · the one
 * verb the row waits for), the contention notice in the contention-handoff grammar, and the
 * team's own column: spend by session in the hand, people with the joining wash, team chat and
 * team memory with a conflict asking for a Keep.
 */
import {
  activeClaims,
  type ClaimRecord,
  type FleetContention,
  type ProjectEvent,
  type ProjectState,
  projectBudget,
  resourceKey,
  type SessionSummary,
  usageOf,
} from "@henosis/fleet";
import { compactTokens, formatTokens } from "@henosis/kernel";
import {
  type DirectiveMode,
  type SessionPolicyPatch,
  type UsageReport,
  usageTotal,
} from "@henosis/protocol";
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
import { createSession, ProjectClient } from "../projectClient.js";
import { ReconnectLine } from "../reconnect.js";
import { navigate, paths } from "../router.js";
import {
  Avatar,
  doingOf,
  ErrorLine,
  ICONS,
  Icon,
  Loader,
  Mark,
  MemoryLine,
  Status,
  TeamPill,
  toast,
  useConnectionToasts,
} from "../ui.js";
import { BUDGET_WARN } from "../viz.js";
import { PolicyFields, policyOf } from "./FirstRun.js";
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
  // The usage report knows every session's budget (from its log); the ledger only what was reported.
  const usage = useFetch(() => api.usage({ project: projectId }), `${projectId}:u:${s?.seq ?? -1}`);
  const budgets = useMemo(
    () => new Map((usage.data?.bySession ?? []).map((r) => [r.sessionId, r.budget])),
    [usage.data],
  );
  const groups = groupSessions(sessions);
  const claims = s ? activeClaims(s) : [];
  const allContentions = Object.values(s?.contentions ?? {});
  const open = allContentions.filter((c) => !c.resolved);
  const resolved = allContentions
    .filter((c) => c.resolved)
    .slice(-3)
    .reverse();
  const myRole = s?.members[identity.userId]?.role ?? "member";
  const lead = myRole === "lead" || myRole === "admin";
  const openSessions = sessions.filter((x) => x.open);
  const tasks = new Set(openSessions.map((x) => x.crew ?? `solo:${x.sessionId}`)).size;
  const approvalsWaiting = openSessions.reduce(
    (n, x) =>
      n +
      (x.report?.pendingApprovals ||
        (rowOf.get(x.sessionId)?.live === "awaiting_approval" ? 1 : 0)),
    0,
  );
  // onboarding-empty-states: the new-session row's open state lives here so empty states can open it.
  const [newOpen, setNewOpen] = useState(() => location.hash.includes("new=1"));
  const inContention = new Set(open.flatMap((c) => c.sessionIds));

  return (
    <Shell
      ctx={ctx}
      title={name}
      below={
        <ReconnectLine
          reconnecting={snap.reconnecting}
          retry={snap.retry}
          onTryNow={() => client.reconnectNow()}
        />
      }
    >
      <div className="column page wide">
        <div className="lede">
          <h1>{name}</h1>
          {s && (
            <p className="lede-line">
              {copy.project.agentsOnTasks(openSessions.length, tasks)}{" "}
              {open.length > 0 ? (
                <b className="hot">{copy.project.contentionWaits(open.length)}</b>
              ) : approvalsWaiting > 0 ? (
                <b className="hot">{copy.project.approvalsWait(approvalsWaiting)}</b>
              ) : (
                copy.project.allQuiet
              )}{" "}
              <a href={paths.management(teamId)}>{copy.project.managerView}</a>
            </p>
          )}
        </div>
        <ErrorLine errors={snap.errors} />
        <div className="twocol">
          <div className="maincol">
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
              <div className="row group-head">
                <h2 className="grow">
                  {copy.project.agents}
                  {s && (
                    <span className="count-word">
                      {copy.project.board(
                        openSessions.length,
                        groups.filter(([c]) => c !== null).length,
                      )}
                    </span>
                  )}
                </h2>
              </div>
              {!s && !snap.errors.length && (
                <Loader kind="shimmer" label={copy.wait.project(name, null, null)} rows={3} />
              )}
              {s && sessions.length === 0 && (
                <EmptyState
                  spot="open"
                  title={copy.project.noSessionsOn(ref.name)}
                  text={copy.project.emptyLine}
                  action={{ label: copy.project.startOne, onClick: () => setNewOpen(true) }}
                  ghost={
                    <>
                      <span>
                        <span className="serif">{copy.project.ghostTitle}</span>
                        <span className="s">{copy.project.ghostLine(identity.name)}</span>
                      </span>
                      <span className="mono">{copy.project.ghostBudget}</span>
                    </>
                  }
                />
              )}
              <div className="board">
                {groups.map(([crew, members]) => (
                  <div key={crew ?? "_solo"} className="crewgroup">
                    <CrewHeader
                      crew={crew}
                      n={members.length}
                      claims={claims.filter((c) =>
                        members.some((m) => m.sessionId === c.sessionId),
                      )}
                    />
                    {members.map((sess) => (
                      <BoardRow
                        key={sess.sessionId}
                        s={sess}
                        row={rowOf.get(sess.sessionId) ?? null}
                        budget={budgets.get(sess.sessionId) ?? sess.report?.budget ?? null}
                        projectId={projectId}
                        nameOf={nameOf}
                        held={inContention.has(sess.sessionId)}
                        lead={lead}
                        canCrew={lead || sess.ownerId === identity.userId}
                        crews={groups.map(([c]) => c).filter((c): c is string => Boolean(c))}
                        onCrew={(crewName) => {
                          client.send({
                            type: "project.crew",
                            sessionId: sess.sessionId,
                            crew: crewName,
                          });
                          setTimeout(() => dispatchEvent(new Event("henosis:fleet")), 300);
                        }}
                      />
                    ))}
                  </div>
                ))}
                <NewSessionRow
                  open={newOpen}
                  onOpen={setNewOpen}
                  onCreate={(id, title, policy) => {
                    // A socket of its own that waits for the server's answer, so the session exists
                    // with its policy before the page opens it, even while this socket re-dials.
                    createSession(wsUrl(), {
                      projectId,
                      userId: identity.userId,
                      sessionId: id,
                      title,
                      policy,
                    }).finally(() => navigate(paths.session(projectId, id, title)));
                  }}
                />
              </div>
            </section>
            {(open.length > 0 || resolved.length > 0) && (
              <section className="group" id="contentions" aria-label={copy.project.contentions}>
                <h2>{copy.project.contentions}</h2>
                {open.map((c) => (
                  <ContentionNotice
                    key={c.id}
                    c={c}
                    state={s}
                    lead={lead}
                    leadName={leadNameOf(s)}
                    onResolve={(winner, note) =>
                      client.send({
                        type: "fleet.resolve",
                        contentionId: c.id,
                        winnerSessionId: winner,
                        note,
                      })
                    }
                  />
                ))}
                {resolved.map((c) => (
                  <div className="notice quiet folded" key={c.id}>
                    <span>
                      <span className="kind">{copy.project.resolvedWord}</span>{" "}
                      <span className="mono">{c.resource}</span>
                      {c.winnerSessionId
                        ? ` · ${copy.project.forWinner(ownerOf(c.winnerSessionId))}`
                        : c.note
                          ? ` · ${c.note}`
                          : ""}
                    </span>
                    {c.winnerSessionId && (
                      <a
                        className="btn ghost sm"
                        href={paths.session(projectId, c.winnerSessionId)}
                      >
                        {copy.project.replay}
                      </a>
                    )}
                  </div>
                ))}
              </section>
            )}
            {/* share-invite: the project id and the users.json membership instruction. */}
            <InviteRow projectId={projectId} state={s} me={identity.userId} />
            {snap.brief && (
              <details className="group fold">
                <summary>
                  <h2>{copy.project.brief}</h2>
                </summary>
                <pre className="brief">{snap.brief}</pre>
              </details>
            )}
          </div>
          <aside className="sidecol">
            <SpendCard
              state={s}
              usage={usage.data}
              budgets={budgets}
              projectId={projectId}
              nameOf={nameOf}
              lead={lead}
              onBudget={(tokenBudget) =>
                client.send({ type: "project.policy", policy: { tokenBudget } })
              }
            />
            <People
              state={s}
              rows={liveRows.data ?? []}
              events={snap.events}
              me={identity.userId}
            />
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
              me={identity}
              onStart={() => setNewOpen(true)}
            />
          </aside>
        </div>
      </div>
    </Shell>
  );
}

function leadNameOf(s: ProjectState | null): string | null {
  const l = Object.values(s?.members ?? {}).find((m) => m.role === "lead" || m.role === "admin");
  return l?.name ?? null;
}

function statusOf(s: SessionSummary, live: SessionRow["live"], held: boolean): string {
  if (!s.open) return "closed";
  if (live) return live;
  if (held) return "blocked";
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
  if (solo.length) out.push([null, solo.sort((a, b) => Number(b.open) - Number(a.open))]);
  return out;
}

/** The crew header as the rail draws it: hollow apricot ring, serif name, the crew's claims in mono. */
function CrewHeader({
  crew,
  n,
  claims,
}: {
  crew: string | null;
  n: number;
  claims: ClaimRecord[];
}) {
  return (
    <div className={`crewhead${crew ? "" : " solo"}`}>
      <span className="ring" aria-hidden="true" />
      <span className="serif name">{crew ?? copy.project.solo}</span>
      <span className="faint small">
        {crew ? copy.project.crewOnTask(n) : copy.project.soloLine}
      </span>
      {claims.slice(0, 3).map((c) => (
        <span className="claim mono" key={c.id}>
          {resourceKey(c.resource).replace(/^path:/, "")}
        </span>
      ))}
    </div>
  );
}

/** "48.2k of 120k" · "no budget" · "spent": mono number, a 3 px hairline with the 80 % tick. */
function RowMeter({
  used,
  budget,
  closed,
}: {
  used: number;
  budget: number | null;
  closed: boolean;
}) {
  const fraction = budget ? used / budget : null;
  const tone =
    fraction === null ? "none" : fraction > 1 ? "over" : fraction >= BUDGET_WARN ? "warn" : "live";
  return (
    <span className={`rowmeter ${tone}`}>
      <span className="figures">
        <span className="mono used">{compactTokens(used)}</span>
        <span className="faint small">
          {closed
            ? copy.project.spent
            : budget
              ? copy.project.ofBudget(compactTokens(budget))
              : copy.project.noBudget}
        </span>
      </span>
      {budget !== null && budget > 0 && (
        // biome-ignore lint/a11y/useSemanticElements: a <meter> cannot be drawn as the 3 px hairline with the 80 % tick
        <span
          className="track"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={budget}
          aria-valuenow={Math.min(used, budget)}
          aria-label={copy.viz.ofBudget(formatTokens(used), formatTokens(budget))}
        >
          <span className="fill" style={{ width: `${Math.min(100, (fraction ?? 0) * 100)}%` }} />
          <span className="tick" />
        </span>
      )}
    </span>
  );
}

function BoardRow({
  s,
  row,
  budget,
  projectId,
  nameOf,
  held,
  lead,
  canCrew,
  crews,
  onCrew,
}: {
  s: SessionSummary;
  row: SessionRow | null;
  budget: number | null;
  projectId: string;
  nameOf: (id: string) => string;
  held: boolean;
  lead: boolean;
  canCrew: boolean;
  crews: string[];
  onCrew: (crew: string | null) => void;
}) {
  const status = statusOf(s, row?.live ?? null, held);
  const pending = s.report?.pendingApprovals ?? 0;
  const [naming, setNaming] = useState(false);
  const [crewName, setCrewName] = useState("");
  const online = (row?.people ?? []).filter((p) => p.online);
  const others = online.filter((p) => p.id !== s.ownerId).map((p) => p.name);
  const doing = row ? doingOf(row) : null;
  const tokens = usageTotal(usageOf(s));
  const href = paths.session(projectId, s.sessionId);
  // The one verb the row waits for; nothing on a running row.
  const verb: { label: string; href: string } | null = !s.open
    ? { label: copy.project.replay, href }
    : s.report?.plan?.status === "proposed"
      ? { label: copy.project.rate, href }
      : held && lead
        ? { label: copy.project.pickForLead, href: "#contentions" }
        : status === "awaiting_approval" || pending > 0
          ? { label: copy.team.approve, href }
          : null;
  return (
    <div
      className={`rowitem agentrow${held ? " held" : ""}${!s.open ? " closed" : ""}`}
      data-status={status}
    >
      <span className={`dot ${status === "awaiting_approval" ? "awaiting" : status}`} />
      <a className="what" href={href}>
        <span className="t serif">
          {s.title || s.sessionId}
          {row && <TeamPill row={row} />}
        </span>
        <span className="s">
          <span className="owner">
            {nameOf(s.ownerId)}
            {others.length ? copy.project.withOthers(others) : ""}
          </span>
          {doing ? (
            <>
              {" · "}
              <span className="serif i">
                {doing.lead} {doing.text}
              </span>
            </>
          ) : s.report?.goal ? (
            <>
              {" · "}
              <span className="serif i">{s.report.goal}</span>
            </>
          ) : null}
          {pending > 0 && (
            <span className="warn-ink">{copy.project.approvalsWaiting(pending)}</span>
          )}
          {held && <span className="warn-ink"> · {copy.project.inContention}</span>}
        </span>
      </a>
      <RowMeter used={tokens} budget={budget} closed={!s.open} />
      <Status status={status} />
      <span className="act">
        {verb && (
          <a className="btn ghost sm" href={verb.href}>
            {verb.label}
          </a>
        )}
        {canCrew && s.open && (
          <details className="overflow">
            <summary className="btn ghost sm icon" aria-label={copy.project.more}>
              <span aria-hidden="true">⋯</span>
            </summary>
            <div className="menu">
              <button
                type="button"
                className="btn ghost sm"
                onClick={(e) => {
                  (
                    e.currentTarget.closest("details") as HTMLDetailsElement | null
                  )?.removeAttribute("open");
                  if (s.crew) onCrew(null);
                  else setNaming(true);
                }}
              >
                {s.crew ? copy.project.leaveCrew : copy.project.teamUp}
              </button>
            </div>
          </details>
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
            aria-label={copy.project.crewName}
            placeholder={copy.project.crewNameHint}
            value={crewName}
            onChange={(e) => setCrewName(e.target.value)}
          />
          <datalist id={`crews-${s.sessionId}`}>
            {crews.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <button type="submit" className="btn primary sm" disabled={!crewName.trim()}>
            {copy.project.teamUp}
          </button>
          <button type="button" className="btn ghost sm" onClick={() => setNaming(false)}>
            {copy.project.cancel}
          </button>
        </form>
      )}
    </div>
  );
}

/**
 * The contention notice in the contention-handoff grammar: the stripe in `--warn`, a serif
 * sentence naming the resource, the rule line ("Both owners see this too · the lead picks"),
 * two numbered sides with the agent's one-line read, and the lead's "Cy wins / Bo wins / Dismiss".
 */
function ContentionNotice({
  c,
  state,
  lead,
  leadName,
  onResolve,
}: {
  c: FleetContention;
  state: ProjectState | null;
  lead: boolean;
  leadName: string | null;
  onResolve: (winner: string | null, note: string) => void;
}) {
  const ownerOf = (sid: string) => {
    const owner = state?.sessions[sid]?.ownerId;
    return owner ? (state?.members[owner]?.name ?? owner) : sid;
  };
  const lead_ =
    c.kind === "claim"
      ? copy.project.twoWant
      : c.kind === "merge-conflict"
        ? `${copy.project.mergeConflictOn} `
        : `${copy.project.overlapOn} `;
  return (
    <div className="notice contention">
      <span className="kind">{copy.project.contentions}</span>
      <p className="serif sentence">
        {lead_}
        <span className="mono">{c.resource}</span>.
      </p>
      <p className="rule small">
        {copy.project.bothSee} · {copy.project.leadPicks(leadName)}
        {c.detail ? ` · ${c.detail}` : ""}
      </p>
      <ol className="sides">
        {c.sessionIds.map((sid) => {
          const ss = state?.sessions[sid];
          return (
            <li key={sid}>
              <span className="serif">{ss?.title ?? sid}</span>
              <span className="small muted"> · {copy.team.agentOf(ownerOf(sid))}</span>
              {ss?.report?.summary && (
                <span className="small faint i serif"> · {ss.report.summary.slice(0, 120)}</span>
              )}
            </li>
          );
        })}
      </ol>
      {lead && (
        <div className="actions">
          {c.sessionIds.map((sid) => (
            <button key={sid} type="button" className="btn sm" onClick={() => onResolve(sid, "")}>
              {copy.project.wins(ownerOf(sid))}
            </button>
          ))}
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => onResolve(null, copy.project.dismissed)}
          >
            {copy.project.dismiss}
          </button>
        </div>
      )}
    </div>
  );
}

/** Spend by session: bars in the hand (one series), the project budget line, Edit budget for a lead. */
function SpendCard({
  state,
  usage,
  budgets,
  projectId,
  nameOf,
  lead,
  onBudget,
}: {
  state: ProjectState | null;
  usage: UsageReport | null;
  budgets: Map<string, number | null>;
  projectId: string;
  nameOf: (id: string) => string;
  lead: boolean;
  onBudget: (tokenBudget: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const rows = (usage?.bySession ?? [])
    .map((r) => ({ ...r, total: r.usage.input + r.usage.output }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
  const max = Math.max(...rows.map((r) => r.total), 1);
  const total = usage ? usage.totals.input + usage.totals.output : 0;
  const b = state ? projectBudget(state, budgets) : null;
  const fraction = b?.budget ? total / b.budget : null;
  const tone =
    fraction === null ? "" : fraction > 1 ? " over" : fraction >= BUDGET_WARN ? " warn" : "";
  // Plans: did the agents come in under their estimates?
  const plans = Object.values(state?.sessions ?? {})
    .map((s) => s.report?.plan)
    .filter((p): p is NonNullable<typeof p> => Boolean(p && p.estTokens > 0 && p.actualTokens > 0));
  const est = plans.reduce((n, p) => n + p.estTokens, 0);
  const act = plans.reduce((n, p) => n + p.actualTokens, 0);
  return (
    <section className={`card spend${tone}`} aria-label={copy.project.spend}>
      <div className="row">
        <span className="kicker grow">{copy.project.spend}</span>
        {b?.budget ? (
          <span className="small faint">
            {copy.project.budgetWord} <span className="mono">{compactTokens(b.budget)}</span>
          </span>
        ) : null}
      </div>
      <div className="row figure">
        <span className="stat-value">
          {compactTokens(total)}
          <small>{copy.project.spendSessions(usage?.bySession.length ?? 0)}</small>
        </span>
        {fraction !== null && <span className="mono pct">{Math.round(fraction * 100)}%</span>}
      </div>
      {b?.budget ? (
        // biome-ignore lint/a11y/useSemanticElements: a <meter> cannot be drawn as the 3 px hairline with the 80 % tick
        <span
          className="stat-meter"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={b.budget}
          aria-valuenow={Math.min(total, b.budget)}
          aria-label={copy.viz.ofBudget(formatTokens(total), formatTokens(b.budget))}
        >
          <span className="fill" style={{ width: `${Math.min(100, (fraction ?? 0) * 100)}%` }} />
          <span className="tick" />
        </span>
      ) : null}
      <ul className="handbars">
        {rows.map((r) => (
          <li key={r.sessionId}>
            <a className="bar-row" href={paths.session(projectId, r.sessionId)}>
              <span className="bar-label ellipsis">
                <span className="owner">{nameOf(r.ownerId)}</span>{" "}
                <span className="faint">{r.title || r.sessionId}</span>
              </span>
              <span className="bar-track" aria-hidden="true">
                <span className="bar-seg seg-hand" style={{ width: `${(r.total / max) * 100}%` }} />
              </span>
              <span className="bar-value mono">{compactTokens(r.total)}</span>
            </a>
          </li>
        ))}
        {rows.length === 0 && <li className="muted small">{copy.viz.nothingYet}</li>}
      </ul>
      <p className="small foot">
        {b?.budget ? (
          <>
            {b.source === "project" ? copy.project.budgetSet : copy.project.budgetSum} ·{" "}
            {copy.project.nothingCutOff}
          </>
        ) : (
          copy.project.budgetNone
        )}
        {plans.length > 0 && est !== act && (
          <>
            <br />
            <span className={est > act ? "ok-ink" : "warn-ink"}>
              {est > act
                ? copy.project.underPlans(compactTokens(est - act))
                : copy.project.overPlans(compactTokens(act - est))}
            </span>
          </>
        )}
      </p>
      {lead && !editing && (
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => {
            setDraft(b?.source === "project" && b.budget ? String(b.budget) : "");
            setEditing(true);
          }}
        >
          {copy.project.editBudget}
        </button>
      )}
      {lead && editing && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            const n = draft.trim() ? Number(draft.replace(/[^0-9]/g, "")) : null;
            if (n !== null && !(n > 0)) return;
            onBudget(n);
            setEditing(false);
          }}
        >
          <input
            className="input mono grow"
            inputMode="numeric"
            aria-label={copy.project.projectBudget}
            placeholder={copy.project.projectBudgetHint}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="btn primary sm">
            {copy.project.save}
          </button>
          <button type="button" className="btn ghost sm" onClick={() => setEditing(false)}>
            {copy.project.cancel}
          </button>
        </form>
      )}
    </section>
  );
}

/** People on the project: role, who is here, and the joining wash for whoever just joined the circle. */
function People({
  state,
  rows,
  events,
  me,
}: {
  state: ProjectState | null;
  rows: SessionRow[];
  events: ProjectEvent[];
  me: string;
}) {
  const members = Object.values(state?.members ?? {}).filter((m) => m.present);
  const online = new Set(rows.flatMap((r) => r.people.filter((p) => p.online).map((p) => p.id)));
  // The joining wash: a join at the tail of the ledger (its last dozen events) is "just joined".
  const tail = events.slice(-12);
  let joined: { userId: string; name: string } | null = null;
  for (const e of [...tail].reverse())
    if (e.kind === "project.member.joined") {
      joined = e.payload;
      break;
    }
  const roleWord = (role: string) =>
    role === "lead"
      ? copy.project.leadWord
      : role === "admin"
        ? copy.project.adminWord
        : copy.project.memberWord;
  return (
    <section className="card" aria-label={copy.project.people}>
      <div className="row">
        <span className="kicker grow">{copy.project.people}</span>
        <span className="small faint">
          {copy.project.membersHere(members.length, [...online].length)}
        </span>
      </div>
      {joined && (
        <div className="wash">
          <Mark size={24} />
          <span className="serif">{copy.project.joinedCircle(joined.name)}</span>
        </div>
      )}
      <ul className="people">
        {members.map((m) => (
          <li key={m.userId}>
            <span className={`ring${online.has(m.userId) ? " on" : ""}`}>
              <Avatar id={m.userId} name={m.name} />
            </span>
            <span className="who">
              <span className="n">
                {m.name}
                {m.userId === me && <span className="faint"> {copy.project.you}</span>}
              </span>
              <span className="r">
                {roleWord(m.role)}
                {online.has(m.userId) ? ` · ${copy.team.online}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
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
    <section className="card" aria-label="Team chat">
      <div className="row">
        <h2 className="grow kicker">Team chat</h2>
        <span className="small faint">{copy.project.keptInLedger}</span>
      </div>
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
  onCreate: (id: string, title: string, policy: SessionPolicyPatch) => void;
}) {
  const [id, setId] = useState(`s-${Date.now().toString(36)}`);
  const [title, setTitle] = useState("");
  const [planFirst, setPlanFirst] = useState(true);
  const [budget, setBudget] = useState("");
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
        onCreate(id.trim(), title.trim() || id.trim(), policyOf(planFirst, budget));
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
      <PolicyFields
        planFirst={planFirst}
        budget={budget}
        onPlanFirst={setPlanFirst}
        onBudget={setBudget}
        idPrefix="project"
      />
    </form>
  );
}

/**
 * The direction composer: a field, the constrain / steer segment, the hint that it enters every
 * session above owner rank, a chocolate send; the active directions as chips under it (italic
 * serif mode tag on apricot wash for constrain, plain for steer; author and Withdraw on your own).
 */
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
    <section className="group direction">
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
          <fieldset className="seg" aria-label={copy.project.directionMode}>
            {(["constrain", "steer"] as DirectiveMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={mode === m ? "on" : ""}
                aria-pressed={mode === m}
                title={m === "constrain" ? copy.project.constrainHint : copy.project.steerHint}
                onClick={() => setMode(m)}
              >
                {m === "constrain" ? copy.project.constrain : copy.project.steer}
              </button>
            ))}
          </fieldset>
          <span className="hint small faint">{copy.project.directionNote}</span>
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
        <div className="chips directions">
          {active.map((d) => {
            const mine = d.author === identity.userId;
            const author = state?.members[d.author]?.name ?? d.author;
            return (
              <span className={`chip dirchip${mine ? " mine" : ""}`} key={d.id}>
                <span className={`mode serif i ${d.input.mode}`}>{d.input.mode}</span>
                <span className="text">{d.input.text}</span>
                <Avatar id={d.author} name={author} />
                <span className="faint small">{mine ? copy.project.you : author}</span>
                {mine && (
                  <button
                    type="button"
                    className="x withdraw"
                    aria-label={copy.project.withdraw(d.input.text)}
                    onClick={() => onWithdraw(d.id)}
                  >
                    {copy.project.withdrawWord}
                  </button>
                )}
              </span>
            );
          })}
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
  me,
  onStart,
}: {
  orgId: string;
  teamId: string;
  projectId: string;
  seq: number;
  me: Identity;
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
  const keep = (c: MemoryConflict, winnerId: string) =>
    api
      .memoryKeep(orgId, me.userId, c.id, winnerId)
      .then(() => feed.reload())
      .catch((e: unknown) => toast(copy.memory.failed(e instanceof Error ? e.message : String(e))));
  return (
    <section className="card" aria-label={copy.project.teamMemory}>
      <div className="row">
        <h2 className="grow kicker">{copy.project.teamMemory}</h2>
        <a className="small" href={paths.memory(orgId, { team: teamId, project: projectId })}>
          {copy.project.allMemory}
        </a>
      </div>
      {feed.error && <p className="small danger">{feed.error}</p>}
      {conflicts.map((c) => (
        <div className="notice contention memconflict" key={c.id}>
          <span>
            {copy.project.disagree}
            <span className="mono">{c.key}</span>.
          </span>
          {c.entryIds.map((id) => {
            const e = byId.get(id);
            return e ? (
              <div className="side" key={id}>
                <MemoryLine e={e} conflict />
                <button type="button" className="btn sm" onClick={() => keep(c, id)}>
                  {copy.memory.keepThis}
                </button>
              </div>
            ) : null;
          })}
        </div>
      ))}
      {rest.length === 0 && !feed.error && feed.loading && (
        <Loader kind="shimmer" label={copy.wait.rows} rows={2} />
      )}
      {rest.length === 0 && !feed.error && !feed.loading && (
        <EmptyState
          spot="memory"
          text={copy.project.memoryEmptyHint}
          action={onStart ? { label: copy.project.startSession, onClick: onStart } : null}
        />
      )}
      <div className="memlist">
        {rest.slice(0, 6).map((e) => (
          <MemoryLine key={e.id} e={e} />
        ))}
      </div>
    </section>
  );
}
