/**
 * The agent's arrival (welcome-agent, L2): the card at the top of a young session that says who
 * joined, what it is on, who holds its gate and what it hears; and the drawer "What <it> was
 * told", the welcome brief as a person reads it with the mono fold of what the model read.
 */
import { briefTokens, welcomeBrief } from "@henosis/fleet";
import { budgetStatus, compactTokens, type SessionState } from "@henosis/kernel";
import type { Actor } from "@henosis/protocol";
import { useEffect, useMemo } from "react";
import { api, type SessionRow, useFetch } from "../api.js";
import { copy } from "../copy.js";
import { clockOf } from "../reconnect.js";
import { Avatar, ICONS, Icon, Mark, Status, toast } from "../ui.js";
import { focusSoon } from "../useShortcuts.js";
import { arrivalFacts, circleOf, recordedWelcome, welcomeInputFromSession } from "../welcome.js";

/** The owner's "is in" toast shows once per session per page load. */
const welcomedOwners = new Set<string>();

export function ArrivalCard({
  s,
  rows,
  mine,
  projectId,
  at,
  me,
  onTold,
  openHref = null,
}: {
  s: SessionState;
  rows: SessionRow[];
  mine: SessionRow | null;
  projectId: string;
  /** When the session was created (the first event's clock), for the join line and the foot. */
  at: number | null;
  /** The viewer: the owner is told who holds the gate the moment the agent is in. */
  me: Actor;
  onTold: () => void;
  /** "Open session" when the card is shown away from the session itself. */
  openHref?: string | null;
}) {
  const f = arrivalFacts(s, rows);
  const title = s.title || s.sessionId;
  const circle = circleOf(s);
  // The owner's toast on navy ("Checkout is in. Bo and Cy hold its gate."), once per session,
  // naming the gate holders other than the owner.
  const owner = s.ownerId === me.id;
  const holders = circle
    .filter((p) => p.holdsGate && !p.owner)
    .map((p) => p.name)
    .join("\u0000");
  useEffect(() => {
    if (!owner || welcomedOwners.has(s.sessionId)) return;
    welcomedOwners.add(s.sessionId);
    toast(copy.arrival.isIn(title, holders ? holders.split("\u0000") : []));
  }, [owner, s.sessionId, title, holders]);
  const crew = mine?.crew ?? null;
  const mates = rows.filter(
    (r) => r.open && crew && r.crew === crew && r.sessionId !== s.sessionId,
  );
  const nameOf = (id: string) => s.participants[id]?.actor.name ?? id;
  const when = clockOf(at);
  const budget = budgetStatus(s);
  const sayHello = () => focusSoon(".composer textarea");
  return (
    <section className="arrival" aria-label={copy.arrival.label(title)}>
      <div className="joinline" role="status">
        <Mark size={30} joining once />
        <span>
          <i className="who">{title}</i>
          {copy.arrival.line(f.ownerName)}
        </span>
        {when && <span className="when">{when}</span>}
      </div>
      <div className="arrival-body">
        <div className="main-col">
          <div className="head">
            <Avatar id={s.sessionId} name={title} kind="agent" size="lg" status={s.status} />
            <div>
              <div className="name serif">{title}</div>
              <div className="sub small muted">
                <i>{copy.arrival.agentOf(f.ownerName)}</i> · {copy.arrival.project(projectId)}
                {f.crew ? (
                  <>
                    {" · "}
                    <i>{copy.arrival.crew(f.crew)}</i>
                  </>
                ) : null}
                {" · "}
                <span className="mono">{s.branch}</span>
                {" · "}
                {f.freshWorkspace
                  ? copy.arrival.freshWorkspace
                  : copy.arrival.carriedWorkspace(f.files)}
              </div>
            </div>
          </div>
          <p className="on serif">
            {f.goal ? (
              <>
                {copy.arrival.on}
                <i>{f.goal}</i>
              </>
            ) : (
              copy.arrival.noGoal
            )}
          </p>
          <dl className="facts">
            <div className="fact">
              <dt>{copy.arrival.status}</dt>
              <dd>
                {f.planning ? (
                  <span className="pill planning">{copy.plan.planning}</span>
                ) : (
                  <Status status={s.status} />
                )}
              </dd>
            </div>
            <div className="fact">
              <dt>{copy.arrival.mentionedBy}</dt>
              <dd>
                {f.mentionedBy.length ? f.mentionedBy.join(", ") : copy.arrival.anyoneOn(projectId)}
              </dd>
            </div>
            <div className="fact">
              <dt>{copy.arrival.gate}</dt>
              <dd title={f.gateRule}>{f.gate.length ? f.gate.join(" and ") : f.gateRule}</dd>
            </div>
            <div className="fact wide">
              <dt>{copy.arrival.budget}</dt>
              <dd>
                <span className="mono">
                  {copy.arrival.budgetLine(
                    compactTokens(budget.used),
                    budget.budget ? compactTokens(budget.budget) : null,
                  )}
                </span>
                {budget.budget ? ` ${copy.arrival.soft}` : ""}
                {budget.budget !== null && (
                  <span
                    className={`budget${budget.over ? " over" : budget.fraction >= 0.8 ? " warn" : ""}`}
                    aria-hidden="true"
                  >
                    <i style={{ width: `${Math.min(100, Math.round(budget.fraction * 100))}%` }} />
                  </span>
                )}
              </dd>
            </div>
          </dl>
          <p className="rule small">
            <Icon d={ICONS.chat} size={14} />
            <span>
              {copy.arrival.hearsBefore}
              <b>{copy.arrival.hearsMentions}</b>
              {copy.arrival.hearsMiddle}
              <b>{copy.arrival.agentOf(f.ownerName)}</b>
              {copy.arrival.hearsAfter(f.ownerName)}
            </span>
          </p>
          <div className="actions">
            <button type="button" className="btn primary sm" onClick={sayHello}>
              {copy.arrival.sayHello}
            </button>
            {openHref && (
              <a className="btn sm" href={openHref}>
                {copy.arrival.openSession}
              </a>
            )}
            <button type="button" className="tell linkish" onClick={onTold}>
              {copy.arrival.told} ›
            </button>
          </div>
        </div>
        <aside className="side">
          <h4>{copy.arrival.whoItJoined}</h4>
          {circle.map((p) => (
            <div className="who" key={p.id}>
              <Avatar id={p.id} name={p.name} size="sm" driver={s.driver === p.id} />
              <span className="grow ellipsis">{p.name}</span>
              <span className={`r small${p.holdsGate && !p.owner ? " gate" : " muted"}`}>
                {p.owner ? p.role : p.holdsGate ? copy.arrival.holdsGate : p.role}
              </span>
            </div>
          ))}
          {mates.length > 0 && <div className="seam" />}
          {mates.map((r) => (
            <div className="who" key={r.sessionId}>
              <Avatar
                id={r.sessionId}
                name={r.title || r.sessionId}
                kind="agent"
                size="sm"
                status={r.live ?? r.report?.status ?? null}
              />
              <span className="grow ellipsis">{r.title || r.sessionId}</span>
              <span className="r small muted">{copy.arrival.crewmate(nameOf(r.ownerId))}</span>
            </div>
          ))}
          <p className="foot small faint">{copy.arrival.foot(f.ownerName, projectId, when)}</p>
        </aside>
      </div>
    </section>
  );
}

/**
 * The drawer "What <Checkout> was told": the welcome brief as a person reads it. The navy
 * paragraph first (the card carries `flex: none`, so it renders inside the drawer's flex
 * column), then the ledger sections, the memory in its context attributed by name, the greyed
 * "Not told" line, and the mono fold "As the model reads it" with its token cost, from the
 * ledger's own record.
 */
export function ToldDrawer({
  s,
  rows,
  mine,
  projectName,
  orgId,
  teamId,
  projectId,
  at,
  me,
  onClose,
}: {
  s: SessionState;
  rows: SessionRow[];
  mine: SessionRow | null;
  projectName: string;
  orgId: string;
  teamId: string;
  projectId: string;
  at: number | null;
  me: Actor;
  onClose: () => void;
}) {
  const title = s.title || s.sessionId;
  const ctxMem = useFetch(
    () => api.memoryContext(orgId, { team: teamId, project: projectId, user: me.id }),
    `${orgId}/${teamId}/${projectId}/${me.id}`,
  );
  const brief = useMemo(
    () => welcomeBrief(welcomeInputFromSession(s, rows, projectName, ctxMem.data?.context ?? "")),
    [s, rows, projectName, ctxMem.data?.context],
  );
  const recorded = recordedWelcome(mine?.briefs);
  const ownerName = s.ownerId ? (s.participants[s.ownerId]?.actor.name ?? s.ownerId) : "nobody";
  return (
    <>
      <button
        type="button"
        className="scrim sheet-scrim"
        aria-label={copy.told.close}
        onClick={onClose}
      />
      <aside className="drawer told" aria-label={copy.told.title(title)}>
        <div className="drawer-head">
          <span>{copy.told.title(title)}</span>
          <button
            type="button"
            className="btn ghost icon sm"
            aria-label={copy.told.close}
            onClick={onClose}
          >
            <Icon d={ICONS.close} size={14} />
          </button>
        </div>
        <div className="brief-card">
          <div className="bh">
            <Mark size={22} />
            <span className="t">{copy.told.heading}</span>
            <span className="when mono">{copy.told.when(clockOf(at))}</span>
          </div>
          <p className="serif">{brief.paragraph}</p>
          <div className="bfoot small">
            <Icon d={ICONS.memory} size={13} />
            {copy.told.foot}
          </div>
        </div>
        {brief.sections.map((sec) => (
          <section className="group" key={sec.title} aria-label={sec.title}>
            <h3>
              {sec.title}
              {sec.note && <span className="n small faint"> {sec.note}</span>}
            </h3>
            {sec.lines.map((line) => (
              <p className={`line small${line.startsWith("Not told:") ? " off" : ""}`} key={line}>
                {line}
              </p>
            ))}
          </section>
        ))}
        <details className="group raw">
          <summary className="row">
            <Icon d={ICONS.terminal} size={14} />
            <span className="grow">{copy.told.asModel}</span>
            {recorded && (
              <span className="mono small faint">
                {copy.told.tokens(briefTokens(recorded.brief))}
              </span>
            )}
          </summary>
          {recorded ? (
            <pre className="brief">{recorded.brief}</pre>
          ) : (
            <p className="small muted">{copy.told.notRecorded}</p>
          )}
        </details>
        <p className="small faint">{copy.told.dfoot(ownerName)}</p>
      </aside>
    </>
  );
}
