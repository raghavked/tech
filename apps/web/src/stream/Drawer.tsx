/**
 * One 340 px drawer with two faces, Team | Details, on a segmented switch in its head
 * (team-panel). Section headers carry their summary ("2 here · 1 away", "25% · about 37.6k
 * left"). Team: the people in the session with the driving flag and Hand off only where the
 * driver can, the crew with the crewmate as a navy tile, the chat with its input pinned and the
 * one rule under it. Details: the intent with the Goal chip and the mono scope keys, usage (above
 * Branches once the budget is past the 80 % tick), branches with one labelled action and a menu
 * per row and the file list folded, the gates, then Memory and Catch-up folded, and Time travel.
 * The same `face` state drives the phone's bottom sheet.
 */
import {
  budgetStatus,
  compactTokens,
  describeRule,
  formatTokens,
  isRatingsRule,
  ruleFor,
  type SessionState,
} from "@henosis/kernel";
import type { Actor, PresenceEntry } from "@henosis/protocol";
import { type ReactNode, useEffect, useState } from "react";
import { api, type SessionRow, useFetch } from "../api.js";
import { ratingProgress } from "../approvalsQueue.js";
import type { HenosisClient } from "../client.js";
import { average, copy } from "../copy.js";
import { EmptyState } from "../empty.js";
import { isComposing, PRESENCE_COMPOSING_TEAM } from "../presence.js";
import type { TurnMark } from "../replay.js";
import { paths } from "../router.js";
import { AgentCard, Avatar, ErrorLine, ICONS, Icon } from "../ui.js";
import { ReplayToggle } from "../views/ReplayScrubber.js";
import { describeCall } from "./blocks.js";
import { BUDGET_WARN } from "./TokenMeter.js";

export type Face = "team" | "details";

export interface ReplayControls {
  marks: TurnMark[];
  viewSeq: number | null;
  pinned: boolean;
  onPin: () => void;
  onView: (seq: number | null) => void;
}

export function Drawer({
  face,
  onFace,
  onClose,
  s,
  me,
  client,
  presence,
  rows,
  reload,
  projectId,
  orgId,
  teamId,
  brief,
  errors,
  onCompare,
  onShare,
  onTold,
  replay,
}: {
  face: Face;
  onFace: (face: Face) => void;
  onClose: () => void;
  s: SessionState;
  me: Actor;
  client: HenosisClient;
  presence: PresenceEntry[];
  rows: SessionRow[];
  reload: () => void;
  projectId: string;
  orgId: string;
  teamId: string;
  brief: string | null;
  errors: string[];
  /** Show a branch beside this one in the column (views/BranchCompare.tsx). */
  onCompare: (branch: string) => void;
  /** Invite: the share sheet. */
  onShare: () => void;
  /** Open "What it was told": the welcome brief, the same text the handoff brief is written like. */
  onTold: () => void;
  replay: ReplayControls;
}) {
  const here = presence.filter((p) => p.online).length;
  const label = face === "team" ? copy.panel.title : copy.details.title;
  const closeLabel = face === "team" ? copy.panel.close : copy.details.close;
  return (
    <>
      <button
        type="button"
        className="scrim sheet-scrim"
        aria-label={closeLabel}
        onClick={onClose}
      />
      <aside className={`drawer ${face}`} aria-label={label}>
        <div className="drawer-head">
          <fieldset className="seg" aria-label={copy.panel.face}>
            <button
              type="button"
              className={face === "team" ? "on" : ""}
              aria-pressed={face === "team"}
              onClick={() => onFace("team")}
            >
              <i className={`dot xs${here > 1 ? " running" : ""}`} aria-hidden="true" />
              {copy.panel.title}
              <span className="n mono" aria-hidden="true">
                {here}
              </span>
            </button>
            <button
              type="button"
              className={face === "details" ? "on" : ""}
              aria-pressed={face === "details"}
              onClick={() => onFace("details")}
            >
              {copy.details.title}
            </button>
          </fieldset>
          <button
            type="button"
            className="btn ghost icon sm"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <Icon d={ICONS.close} size={14} />
          </button>
        </div>
        <ErrorLine errors={errors} />
        {face === "team" ? (
          <TeamFace
            s={s}
            me={me}
            client={client}
            presence={presence}
            rows={rows}
            reload={reload}
            projectId={projectId}
            onShare={onShare}
          />
        ) : (
          <DetailsFace
            s={s}
            me={me}
            client={client}
            orgId={orgId}
            teamId={teamId}
            projectId={projectId}
            brief={brief}
            onCompare={onCompare}
            replay={replay}
            onTold={onTold}
          />
        )}
      </aside>
    </>
  );
}

/** A section that opens on its header; Memory and Catch-up start folded. */
function Fold({
  label,
  sum,
  open,
  onToggle,
  children,
}: {
  label: string;
  sum?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className={`group fold${open ? " open" : ""}`} aria-label={label}>
      <h3>
        <button type="button" className="foldhead" aria-expanded={open} onClick={onToggle}>
          {label}
          {sum !== undefined && sum !== null && sum !== "" && <span className="sum">{sum}</span>}
          <Icon d={ICONS.chevron} size={12} className={`chev${open ? " open" : ""}`} />
        </button>
      </h3>
      {open && children}
    </section>
  );
}

// ---- Team --------------------------------------------------------------------------------

function TeamFace({
  s,
  me,
  client,
  presence,
  rows,
  reload,
  projectId,
  onShare,
}: {
  s: SessionState;
  me: Actor;
  client: HenosisClient;
  presence: PresenceEntry[];
  rows: SessionRow[];
  reload: () => void;
  projectId: string;
  onShare: () => void;
}) {
  const [crewName, setCrewName] = useState("");
  // Crew changes live in the project ledger, not this session's log: look again now and then.
  useEffect(() => {
    const every = setInterval(reload, 5_000);
    return () => clearInterval(every);
  }, [reload]);
  const [text, setText] = useState("");
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const mine = rows.find((r) => r.sessionId === s.sessionId) ?? null;
  const crew = mine?.crew ?? null;
  const mates = rows.filter(
    (r) => r.open && crew && r.crew === crew && r.sessionId !== s.sessionId,
  );
  const crewNames = [...new Set(rows.map((r) => r.crew).filter((c): c is string => Boolean(c)))];
  // Everyone who was ever here: presence first (online before away), then participants with no socket.
  const byId = new Map(presence.map((p) => [p.actor.id, p]));
  const people = [
    ...presence.filter((p) => p.actor.kind === "human"),
    ...Object.values(s.participants)
      .filter((p) => p.actor.kind === "human" && !byId.has(p.actor.id))
      .map((p) => ({ actor: p.actor, role: p.role, branch: s.branch, status: "", online: false })),
  ].sort((a, b) => Number(b.online) - Number(a.online));
  const here = people.filter((p) => p.online).length;
  const away = people.length - here;
  const iOwn = s.ownerId === me.id || s.participants[me.id]?.role === "owner";
  const driving = s.driver === me.id;
  const offers = Object.values(s.handoffs).filter((h) => h.status === "pending" && h.to === me.id);
  const setCrew = (value: string | null) => {
    client.sendProject({ type: "project.crew", sessionId: s.sessionId, crew: value });
    // The rail and the panel both read the project listing; tell them the fleet changed.
    const tell = () => {
      reload();
      dispatchEvent(new Event("henosis:fleet"));
    };
    setTimeout(tell, 250);
    setTimeout(tell, 1500);
  };
  const say = () => {
    const t = text.trim();
    if (!t) return;
    client.send({ type: "note", text: t });
    setText("");
  };
  const writing = presence.filter(
    (p) => p.online && p.actor.id !== me.id && p.status === PRESENCE_COMPOSING_TEAM,
  );
  return (
    <>
      <p className="sub">
        <span className="serif">{s.title || s.sessionId}</span>
        {crew && (
          <>
            <span className="sep">·</span>
            <span>{crew}</span>
          </>
        )}
        <span className="sep">·</span>
        <span>{projectId}</span>
      </p>
      <section className="group" aria-label={copy.panel.inSession}>
        <h3>
          {copy.panel.inSession}
          <span className="sum">{copy.panel.hereAway(here, away)}</span>
        </h3>
        {people.length === 0 && <p className="muted">{copy.panel.onlyYou}</p>}
        {people.map((p) => {
          const isMe = p.actor.id === me.id;
          const drives = s.driver === p.actor.id;
          const role = s.participants[p.actor.id]?.role ?? p.role;
          return (
            <div className={`person${p.online ? "" : " off"}`} key={p.actor.id}>
              <Avatar id={p.actor.id} name={p.actor.name} driver={drives} />
              <span className="who">
                <span className="name">
                  {p.actor.name}
                  {isMe && <span className="you">{copy.roles.you}</span>}
                </span>
                <span className="role">
                  {role}
                  {drives && (
                    <>
                      {" · "}
                      <span className="driving">{copy.roles.driving}</span>
                    </>
                  )}
                  {p.online && !isMe && isComposing(p.status) && (
                    <>
                      {" · "}
                      <span className="writing">
                        {p.status === PRESENCE_COMPOSING_TEAM
                          ? copy.panel.writingTeam
                          : copy.panel.writingAgent}
                      </span>
                    </>
                  )}
                  {!p.online && ` · ${copy.panel.away}`}
                </span>
              </span>
              {!isMe && driving && p.online && (
                <button
                  type="button"
                  className="btn ghost sm"
                  data-shortcut="handoff"
                  onClick={() => client.send({ type: "handoff.request", to: p.actor.id })}
                >
                  {copy.details.handOff}
                </button>
              )}
              {!isMe && iOwn && !drives && (
                <select
                  className="select sm"
                  aria-label={copy.details.roleOf(p.actor.name)}
                  value={role}
                  onChange={(e) =>
                    client.send({
                      type: "role",
                      actorId: p.actor.id,
                      role: e.target.value as "observer" | "contributor" | "driver" | "owner",
                    })
                  }
                >
                  {["observer", "contributor", "driver", "owner"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
        {offers.map((h) => (
          <div className="offer" key={h.id}>
            <span className="grow">
              <em>{name(h.from)}</em> {copy.panel.offersBaton}
              <span className="small faint"> {copy.stream.acceptMeans}</span>
            </span>
            <button
              type="button"
              className="btn primary sm"
              onClick={() => client.send({ type: "handoff.accept", handoffId: h.id })}
            >
              {copy.stream.accept}
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => client.send({ type: "handoff.decline", handoffId: h.id })}
            >
              {copy.stream.decline}
            </button>
          </div>
        ))}
        <p className="teamline">
          <span className="grow">{here > 1 ? copy.panel.aTeam(here) : copy.panel.solo}</span>
          <button type="button" className="btn ghost sm" onClick={onShare}>
            {copy.panel.invite}
          </button>
        </p>
      </section>
      <section className="group" aria-label={copy.panel.crew}>
        <h3>
          {copy.panel.crew}
          <span className="sum">
            {crew ? copy.panel.otherAgents(mates.length) : copy.panel.soloCrew}
          </span>
        </h3>
        {crew ? (
          <>
            <p>
              {copy.panel.workingOn}
              <span className="serif crewname">{crew}</span>
              {copy.panel.withAgents(mates.length)}
            </p>
            {mates.map((r) => (
              <div className="tile" key={r.sessionId}>
                <AgentCard
                  row={r}
                  href={paths.session(projectId, r.sessionId)}
                  active={false}
                  nameOf={name}
                />
              </div>
            ))}
            <p className="row">
              {iOwn && (
                <button type="button" className="btn ghost sm" onClick={() => setCrew(null)}>
                  {copy.panel.leaveCrew}
                </button>
              )}
              <span className="grow" />
              <span className="small faint">{copy.panel.shareBrief}</span>
            </p>
          </>
        ) : (
          <>
            <p className="muted small">{copy.panel.soloHint(projectId)}</p>
            {iOwn && (
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (crewName.trim()) setCrew(crewName.trim());
                }}
              >
                <input
                  className="input grow"
                  list="crew-names"
                  aria-label={copy.panel.crewName}
                  placeholder={copy.panel.crewHint}
                  value={crewName}
                  onChange={(e) => setCrewName(e.target.value)}
                />
                <datalist id="crew-names">
                  {crewNames.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <button type="submit" className="btn sm" disabled={!crewName.trim()}>
                  {copy.panel.teamUp}
                </button>
              </form>
            )}
          </>
        )}
      </section>
      <section className="group chat" aria-label={copy.panel.chat}>
        <h3>
          {copy.panel.chat}
          <span className="sum">{copy.panel.said(s.notes.length)}</span>
        </h3>
        <div className="lines">
          {s.notes.length === 0 && <p className="muted small">{copy.panel.nothingSaid}</p>}
          {s.notes.slice(-30).map((n) => (
            <div className={`line${n.actor === me.id ? " mine" : ""}`} key={n.seq}>
              <span className="who serif">
                {n.actor === me.id ? copy.panel.youSaid : name(n.actor)}
              </span>
              <span className="what">{n.text}</span>
            </div>
          ))}
          {writing.length > 0 && (
            <p className="typing">
              <i />
              <i />
              <i /> {copy.panel.isWriting(writing.map((p) => p.actor.name))}
            </p>
          )}
        </div>
        <div className="chatfoot">
          <form
            className="input-row"
            onSubmit={(e) => {
              e.preventDefault();
              say();
            }}
          >
            <input
              className="input grow"
              aria-label={copy.panel.sayLabel}
              placeholder={copy.panel.sayHint}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              type="submit"
              className="send sm"
              aria-label={copy.panel.send}
              disabled={!text.trim()}
            >
              <Icon d={ICONS.send} size={14} />
            </button>
          </form>
          <p className="fine">{copy.panel.neverSent}</p>
        </div>
      </section>
    </>
  );
}

// ---- Details -----------------------------------------------------------------------------

function DetailsFace({
  s,
  me,
  client,
  orgId,
  teamId,
  projectId,
  brief,
  onCompare,
  onTold,
  replay,
}: {
  s: SessionState;
  me: Actor;
  client: HenosisClient;
  orgId: string;
  teamId: string;
  projectId: string;
  brief: string | null;
  onCompare: (branch: string) => void;
  /** Open "What it was told" (stream/Arrival.tsx ToldDrawer). */
  onTold: () => void;
  replay: ReplayControls;
}) {
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const [forkName, setForkName] = useState("");
  const [files, setFiles] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [memOpen, setMemOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const branches = ["main", ...Object.keys(s.branches)];
  const paths_ = Object.keys(s.workspace).sort();
  const paused = s.intent.control === "paused";
  const ctxMem = useFetch(
    () => api.memoryContext(orgId, { team: teamId, project: projectId, user: me.id }),
    `${orgId}/${teamId}/${projectId}/${me.id}`,
  );
  const control = (mode: "pause" | "resume") =>
    client.send({
      type: "directive",
      input: { text: mode, mode, scope: "goal", supersedes: [], interrupt: false },
    });
  const b = budgetStatus(s);
  const hot = b.budget !== null && b.fraction >= BUDGET_WARN;
  const held = s.intent.contendedScopes;
  const plan = s.activePlanId ? s.plans[s.activePlanId] : undefined;
  const usage = <UsageSection s={s} />;
  const approvals = Object.values(s.approvals).sort((a, z) => z.requestedSeq - a.requestedSeq);
  const pendingGates = approvals.filter((a) => a.status === "pending").length;
  const memLines = ctxMem.data?.context ? parseMemory(ctxMem.data.context) : [];
  const conflicts = memLines.filter((l) => l.conflict).length;
  return (
    <>
      <section className="group" aria-label={copy.details.intent}>
        <h3>
          {copy.details.intent}
          <span className="sum">
            {held.length
              ? copy.details.heldCount(held.length)
              : copy.usage.turn(s.turn).toLowerCase()}
          </span>
        </h3>
        <div className="intent">
          {s.intent.goal ? (
            <div className="line">
              <span className="k goal">{copy.stream.goal}</span>
              <span className="goal-t">
                {s.intent.goal.text} <span className="by">{name(s.intent.goal.author)}</span>
              </span>
            </div>
          ) : (
            <p className="muted">{copy.details.noGoal}</p>
          )}
          {Object.entries(s.intent.steers).map(([k, v]) => (
            <div className="line" key={k}>
              <span className="k">{k}</span>
              <span>
                {v.text} <span className="by">{name(v.author)}</span>
              </span>
            </div>
          ))}
          {s.intent.constraints.map((c) => (
            <div className="line" key={c.directiveId}>
              <span className="k">{copy.details.always}</span>
              <span>
                {c.text}{" "}
                <span className="by">
                  {name(c.author)}
                  {c.origin === "project" ? copy.details.fromProject : ""}
                </span>
              </span>
            </div>
          ))}
        </div>
        {held.length > 0 && (
          <p className="held">
            <Icon d={ICONS.clock} size={13} />
            {copy.details.held(held)}
          </p>
        )}
        <p className="control">
          <span className="muted">
            {copy.details.control(s.intent.control, s.intent.interrupt, s.turn)}
          </span>
          <button
            type="button"
            className="btn sm"
            onClick={() => control(paused ? "resume" : "pause")}
          >
            {paused ? copy.details.resume : copy.details.pause}
          </button>
        </p>
      </section>
      {hot && usage}
      <section className="group" aria-label={copy.details.branches}>
        <h3>
          {copy.details.branches}
          <span className="sum">
            <span className="mono">{s.branch}</span>
            {s.openConflicts.length > 0 && (
              <span className="danger">{copy.details.conflicts(s.openConflicts.length)}</span>
            )}
          </span>
        </h3>
        {branches.map((br) => {
          const here = br === s.branch;
          return (
            <div className={`branch${here ? " here" : ""}`} key={br}>
              <span className="name">
                {!here && <Icon d={ICONS.branch} size={13} />}
                {br}
                {here && <span className="here">{copy.details.here}</span>}
              </span>
              {!here && (
                <span className="acts">
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => client.send({ type: "switch", branch: br })}
                  >
                    {copy.details.switch}
                  </button>
                  <button
                    type="button"
                    className="btn ghost icon sm"
                    aria-label={copy.details.moreFor(br)}
                    aria-expanded={menu === br}
                    onClick={() => setMenu((v) => (v === br ? null : br))}
                  >
                    <Icon d={ICONS.dots} size={14} />
                  </button>
                </span>
              )}
              {menu === br && (
                <span className="menu-row">
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => {
                      setMenu(null);
                      onCompare(br);
                    }}
                  >
                    {copy.details.compare}
                  </button>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => {
                      setMenu(null);
                      client.send({ type: "merge", source: br });
                    }}
                  >
                    {copy.details.foldInto(s.branch)}
                  </button>
                </span>
              )}
            </div>
          );
        })}
        <form
          className="row fork"
          onSubmit={(e) => {
            e.preventDefault();
            if (forkName.trim()) client.send({ type: "fork", branch: forkName.trim() });
            setForkName("");
          }}
        >
          <input
            className="input mono grow"
            aria-label={copy.details.branchName}
            placeholder={copy.details.branchHint}
            value={forkName}
            onChange={(e) => setForkName(e.target.value)}
          />
          <button type="submit" className="btn sm">
            {copy.details.fork}
          </button>
        </form>
        <p className="row fileline">
          <button
            type="button"
            className="linkish small"
            aria-expanded={files}
            onClick={() => setFiles((v) => !v)}
          >
            {copy.details.files(paths_.length)}
            {s.openConflicts.length > 0 && (
              <span className="danger">{copy.details.conflicts(s.openConflicts.length)}</span>
            )}
            {s.checkpoints.length > 0 && copy.details.checkpoints(s.checkpoints.length)}
          </button>
          <span className="grow" />
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => client.send({ type: "checkpoint", label: "manual" })}
          >
            {copy.details.checkpoint}
          </button>
        </p>
        {files && (
          <div className="files">
            {paths_.slice(0, 20).map((p) => (
              <div className={`f${s.openConflicts.includes(p) ? " hot" : ""}`} key={p}>
                <span>{p}</span>
                {s.openConflicts.includes(p) && (
                  <span className="mark-c">{copy.details.conflict}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      {!hot && usage}
      <section className="group" aria-label={copy.details.gates}>
        <h3>
          {copy.details.gates}
          <span className="sum">
            {pendingGates ? copy.details.gatesWaiting(pendingGates) : copy.details.gatesNone}
          </span>
        </h3>
        {approvals.length === 0 && <p className="muted small">{copy.details.noGates}</p>}
        {approvals.slice(0, 4).map((a) => {
          const d = describeCall(a.call);
          const rule = ruleFor(s.policy.approvals, a.call.risk);
          const gate = ratingProgress(s, a);
          const raters = Object.entries(a.ballots)
            .filter(([, v]) => v.vote === "approve")
            .map(([k, v]) => `${name(k)}${v.rating ? ` ${v.rating}` : ""}`);
          return (
            <div className={`gaterow ${a.status}`} key={a.id}>
              <Icon
                d={
                  a.status === "granted"
                    ? ICONS.check
                    : a.status === "denied"
                      ? ICONS.close
                      : ICONS.clock
                }
                size={13}
              />
              <span className="t">
                <span className="what">
                  {d.verb} <b className="mono">{d.object}</b>
                </span>
                <span className="s">
                  {a.status === "pending"
                    ? gate
                      ? copy.approval.progress(gate.count, gate.min, gate.average)
                      : copy.approval.needs(describeRule(rule))
                    : `${copy.approval[a.status]}${raters.length ? ` · ${raters.join(", ")}` : ""}${
                        gate?.count ? ` · ${average(gate.average)} ${copy.approval.average}` : ""
                      }`}
                  {isRatingsRule(rule) && a.status === "pending"
                    ? ` · ${copy.details.releaseGate}`
                    : ""}
                </span>
              </span>
            </div>
          );
        })}
      </section>
      <Fold
        label={copy.details.memory}
        sum={
          memLines.length
            ? `${copy.details.lines(memLines.length)}${conflicts ? ` · ${copy.details.conflicts(conflicts).replace(/^ · /, "")}` : ""}`
            : ""
        }
        open={memOpen}
        onToggle={() => setMemOpen((v) => !v)}
      >
        {ctxMem.error && <p className="small danger">{ctxMem.error}</p>}
        <MemoryContext lines={memLines} loading={ctxMem.loading} />
        <button type="button" className="btn ghost sm" onClick={ctxMem.reload}>
          {copy.details.refresh}
        </button>
      </Fold>
      <Fold
        label={copy.details.catchUp}
        sum={brief ? copy.details.briefReady : ""}
        open={briefOpen}
        onToggle={() => setBriefOpen((v) => !v)}
      >
        {brief ? (
          <pre className="brief">{brief}</pre>
        ) : (
          <p className="muted small">{copy.details.briefHint}</p>
        )}
        <p className="row">
          <button type="button" className="btn sm" onClick={() => client.send({ type: "brief" })}>
            {copy.details.askBrief}
          </button>
          <button type="button" className="btn ghost sm" onClick={onTold}>
            {copy.details.whatItWasTold}
          </button>
        </p>
      </Fold>
      <ReplayToggle
        pinned={replay.pinned}
        onToggle={replay.onPin}
        marks={replay.marks}
        viewSeq={replay.viewSeq}
        onView={replay.onView}
        steps={plan ? plan.steps.map((st) => st.title) : []}
        turnTokens={(turn) => {
          const t = s.turns.find((x) => x.turn === turn);
          return t ? compactTokens(t.usage.input + t.usage.output) : "";
        }}
      />
    </>
  );
}

/** token-usage: the big number, the four-way split, the budget, and the last turns on one scale. */
export function UsageSection({ s }: { s: SessionState }) {
  const b = budgetStatus(s);
  const pct = b.budget === null ? null : Math.round(b.fraction * 100);
  const turns = [...s.turns].slice(-8).reverse();
  const heaviest = Math.max(1, ...s.turns.map((t) => t.usage.input + t.usage.output));
  const u = s.usage;
  const all = u.input + u.output + u.cacheRead + u.cacheWrite;
  const share = (n: number) => `${all > 0 ? (n / all) * 100 : 0}%`;
  const tone = b.over ? " over" : pct !== null && b.fraction >= BUDGET_WARN ? " warn" : "";
  const left = b.budget === null ? 0 : Math.max(0, b.budget - b.used);
  return (
    <section className={`group usage${tone}`} aria-label={copy.details.usage}>
      <h3>
        {copy.details.usage}
        <span className="sum">
          {b.budget === null
            ? copy.usage.noBudget
            : b.over
              ? copy.usage.over
              : `${pct}% · ${copy.usage.left(compactTokens(left))}`}
        </span>
      </h3>
      <div className="big">
        <b>{formatTokens(b.used)}</b>
        {b.budget !== null ? (
          <span>{copy.usage.of(formatTokens(b.budget))}</span>
        ) : (
          <span>{copy.usage.tokens}</span>
        )}
        {pct !== null && <span className="pct">{pct}%</span>}
      </div>
      {b.budget !== null && (
        <div className={`budget${tone}`} aria-hidden="true">
          <i style={{ width: `${Math.min(100, Math.round(b.fraction * 100))}%` }} />
        </div>
      )}
      <div className="stacked" aria-hidden="true">
        <i className="k-in" style={{ width: share(u.input) }} />
        <i className="k-out" style={{ width: share(u.output) }} />
        <i className="k-cache" style={{ width: share(u.cacheRead) }} />
        <i className="k-write" style={{ width: share(u.cacheWrite) }} />
      </div>
      <div className="split">
        <span>
          <i className="sw k-in" />
          {copy.usage.input}
          <b>{compactTokens(u.input)}</b>
        </span>
        <span>
          <i className="sw k-out" />
          {copy.usage.output}
          <b>{compactTokens(u.output)}</b>
        </span>
        <span>
          <i className="sw k-cache" />
          {copy.usage.cacheRead}
          <b>{compactTokens(u.cacheRead)}</b>
        </span>
        <span>
          <i className="sw k-write" />
          {copy.usage.cacheWrite}
          <b>{compactTokens(u.cacheWrite)}</b>
        </span>
      </div>
      <p className="small muted">
        {b.budget === null ? copy.usage.softNone : b.over ? copy.usage.overLine : copy.usage.soft}
      </p>
      {turns.length === 0 && <p className="muted small">{copy.usage.noTurns}</p>}
      {turns.length > 0 && (
        <div className="turns">
          {turns.map((t, i) => {
            const total = t.usage.input + t.usage.output;
            return (
              <div
                className={`t${i === 0 && s.status === "running" ? " now" : ""}`}
                key={t.turn}
                title={`${copy.usage.input} ${formatTokens(t.usage.input)} · ${copy.usage.output} ${formatTokens(t.usage.output)}`}
              >
                <span className="lbl">
                  {copy.usage.turn(t.turn)}
                  <small>{firstWords(t.summary)}</small>
                </span>
                <span className="bar" aria-hidden="true">
                  <i className="k-in" style={{ width: `${(t.usage.input / heaviest) * 100}%` }} />
                  <i className="k-out" style={{ width: `${(t.usage.output / heaviest) * 100}%` }} />
                </span>
                <span className="mono">{compactTokens(total)}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function firstWords(summary: string): string {
  const s = summary
    .replace(/^(DONE|continuing|done):?\s*/i, "")
    .replace(/\.$/, "")
    .trim();
  const words = s.split(/\s+/).slice(0, 4).join(" ");
  return words.length < s.length ? `${words}…` : words;
}

interface MemLine {
  conflict: boolean;
  key: string;
  text: string;
  who: string;
}

/** The memory context arrives as text; each remembered line with its author beneath. */
function parseMemory(text: string): MemLine[] {
  return text
    .split("\n")
    .filter((l) => /^\s+[-!]\s/.test(l))
    .map((l) => {
      const conflict = /^\s+!/.test(l);
      const body = l.replace(/^\s+[-!]\s/, "");
      const m = body.match(/^(.*)\s\(([^()]*)\)$/);
      const t = m ? (m[1] ?? body) : body;
      const km = t.match(/^\[([^\]]+)\]\s(.*)$/s);
      return {
        conflict,
        key: km ? (km[1] ?? "") : "",
        text: km ? (km[2] ?? t) : t,
        who: m ? (m[2] ?? "") : "",
      };
    });
}

function MemoryContext({ lines, loading }: { lines: MemLine[]; loading: boolean }) {
  if (lines.length === 0 && loading) return <p className="muted small">{copy.loading}</p>;
  if (lines.length === 0)
    return (
      <EmptyState
        className="small"
        text={copy.details.memoryEmptyHint}
        action={{
          label: copy.details.writeToAgent,
          onClick: () => document.querySelector<HTMLTextAreaElement>(".composer textarea")?.focus(),
        }}
      />
    );
  return (
    <div className="memlist">
      {lines.map((l) => (
        <div className={`memline${l.conflict ? " conflict" : ""}`} key={`${l.who}:${l.text}`}>
          <span>
            {l.conflict && <span className="cf">{copy.details.memoryConflict}</span>}
            {l.key && <span className="mono muted">{l.key} </span>}
            {l.text}
          </span>
          {l.who && <span className="small faint by">{l.who}</span>}
        </div>
      ))}
    </div>
  );
}
