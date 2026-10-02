import { describeRule, ruleFor, type SessionState } from "@fold/kernel";
import type { Actor, DirectiveMode, SessionEvent } from "@fold/protocol";
import { type ReactNode, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Crumb, Sep, Shell } from "../App.js";
import { api, type Me, refOf, useFetch } from "../api.js";
import { FoldClient, wsUrl } from "../client.js";
import { actorOf, type Identity } from "../identity.js";
import { notifyIfHidden } from "../notify.js";
import { paths } from "../router.js";
import { reportPendingApprovals } from "../shell.js";
import {
  Avatar,
  Brief,
  CourseLine,
  ErrorLine,
  ICONS,
  Icon,
  Pill,
  Sec,
  useMediaQuery,
} from "../ui.js";

type Tab = "Intent" | "Team" | "Branches" | "Memory" | "Brief";
const TABS: Tab[] = ["Intent", "Team", "Branches", "Memory", "Brief"];

export function SessionView({
  projectId,
  sessionId,
  title,
  identity,
  me,
}: {
  projectId: string;
  sessionId: string;
  title: string | null;
  identity: Identity;
  me: Me | null;
}) {
  const client = useMemo(() => new FoldClient(), []);
  const snap = useSyncExternalStore(
    (fn) => client.subscribe(fn),
    () => client.snapshot,
  );
  const actor = useMemo(() => actorOf(identity), [identity]);
  useEffect(() => {
    client.connect(wsUrl(), {
      sessionId,
      actor,
      userId: identity.userId,
      projectId,
      title: title ?? sessionId,
      ...(identity.token ? { token: identity.token } : {}),
    });
    return () => client.disconnect();
  }, [client, sessionId, projectId, title, actor, identity.userId, identity.token]);

  // Notifications for things that need this person, only while the tab is hidden.
  useEffect(
    () =>
      client.onLiveEvent((e) => {
        const st = client.snapshot.state;
        const who = (id: string) => st?.participants[id]?.actor.name ?? id;
        if (e.kind === "approval.requested")
          notifyIfHidden(
            "Approval needed",
            `${e.payload.call.name} [${e.payload.call.risk}] in ${st?.title || sessionId}`,
            e.payload.approvalId,
          );
        else if (e.kind === "handoff.requested" && e.payload.to === identity.userId)
          notifyIfHidden(
            "You are offered the fold",
            `${who(e.actor)} wants to hand off ${st?.title || sessionId}`,
            e.payload.handoffId,
          );
        else if (e.kind === "fleet.contention.mirrored" && !e.payload.resolved)
          notifyIfHidden(
            "Fleet contention",
            `${e.payload.kind} on ${e.payload.resource}`,
            e.payload.contentionId,
          );
      }),
    [client, identity.userId, sessionId],
  );

  const ref = refOf(me, projectId);
  const mobile = useMediaQuery("(max-width: 640px)");
  const [tab, setTab] = useState<Tab | null>(null);
  const s = snap.state;
  const crumbs = (
    <>
      <Crumb>{ref.orgName}</Crumb>
      <Sep />
      <Crumb href={paths.management(ref.teamId)}>{ref.teamName}</Crumb>
      <Sep />
      <Crumb href={paths.fleet(projectId)}>{ref.name}</Crumb>
      <Sep />
      <b>{s?.title || title || sessionId}</b>
      {(s?.title || title) && (s?.title || title) !== sessionId && (
        <span className="mono muted hide-mobile" style={{ fontSize: 11 }}>
          {sessionId}
        </span>
      )}
    </>
  );
  const rail = { current: "sessions" as const, projectId, teamId: ref.teamId };
  if (!s)
    return (
      <Shell
        crumbs={crumbs}
        who={identity}
        rail={rail}
        bar={<span className="muted small">{snap.connected ? "joining…" : "connecting…"}</span>}
      >
        <div className="home">
          <ErrorLine errors={snap.errors} />
          <p className="muted">Joining {sessionId}…</p>
        </div>
      </Shell>
    );

  const pendingApprovals = Object.values(s.approvals).filter((a) => a.status === "pending");
  reportPendingApprovals(pendingApprovals.length);
  const epochs = s.turns
    .filter((t, i) => i === 0 || t.epoch !== s.turns[i - 1]?.epoch)
    .map((t) => t.turn);
  const memory = (
    <MemorySec orgId={ref.orgId} teamId={ref.teamId} projectId={projectId} user={identity.userId} />
  );
  const panels: Record<Tab, ReactNode> = {
    Intent: (
      <>
        <IntentSec s={s} />
        <ContentionSecs s={s} me={actor} client={client} />
        <ApprovalSecs s={s} client={client} />
        <HandoffSecs s={s} me={actor} client={client} />
      </>
    ),
    Team: <TeamSec s={s} me={actor} client={client} />,
    Branches: (
      <>
        <BranchesSec s={s} client={client} />
        <WorkspaceSec s={s} />
      </>
    ),
    Memory: memory,
    Brief: (
      <>
        <ErrorLine errors={snap.errors} />
        <BriefSec brief={snap.brief} client={client} />
      </>
    ),
  };

  return (
    <Shell
      crumbs={crumbs}
      who={identity}
      rail={rail}
      fill
      bar={
        <>
          <Pill status={s.status} suffix={`turn ${s.turn}`} />
          <span className="crew hide-mobile" title="Present">
            {snap.presence.map((p) => (
              <span
                key={p.actor.id}
                className={`${s.driver === p.actor.id ? "driver" : ""} ${p.online ? "" : "offline"}`}
                title={p.status || p.branch}
              >
                {p.actor.name}
                {p.actor.id === actor.id ? " (you)" : ""} · {p.role}
                {s.driver === p.actor.id ? " · driving" : ""}
              </span>
            ))}
          </span>
          <ControlButton s={s} client={client} />
        </>
      }
      course={
        <CourseLine
          turn={s.turn}
          epochs={epochs}
          label={`Course: ${s.turn} turns, ${s.epoch} epochs, now at turn ${s.turn}`}
        />
      }
    >
      <div className="session">
        <section className="centre" aria-label="Event stream">
          <div className="streamhead">
            <span>{s.branch}</span>
            <span>·</span>
            <span>{snap.events.length} events</span>
            <span>·</span>
            <span>epoch {s.epoch}</span>
            {!snap.connected && <span className="tag irr">disconnected</span>}
            <span className="grow" />
            <span className="hide-mobile">
              {snap.presence.filter((p) => p.online).length} watching
            </span>
          </div>
          <FleetStrip s={s} projectId={projectId} />
          <Stream events={snap.events} s={s} />
          {mobile && pendingApprovals[0] && (
            <div className="sticky">
              <Avatar id="agent" name="Agent" agent small />
              <div className="grow">
                <b>
                  Approval needed · {pendingApprovals[0].call.name}
                  {pendingApprovals.length > 1 ? ` +${pendingApprovals.length - 1}` : ""}
                </b>
                {pendingApprovals[0].call.risk} ·{" "}
                {describeRule(ruleFor(s.policy.approvals, pendingApprovals[0].call.risk))}
              </div>
              <button type="button" className="btn primary sm" onClick={() => setTab("Intent")}>
                Review
              </button>
            </div>
          )}
          {mobile && tab && (
            <Drawer tab={tab} onTab={setTab}>
              {panels[tab]}
            </Drawer>
          )}
          <Composer s={s} me={actor} client={client} />
          {mobile && (
            <nav className="drawer-tabs" aria-label="Session panels">
              {TABS.map((t) => (
                <button
                  type="button"
                  key={t}
                  className={t === tab ? "cur" : ""}
                  onClick={() => setTab(t === tab ? null : t)}
                >
                  {t}
                </button>
              ))}
            </nav>
          )}
        </section>
        {!mobile && (
          <aside className="inspector" aria-label="Inspector">
            <ErrorLine errors={snap.errors} />
            {panels.Intent}
            {panels.Team}
            {panels.Branches}
            {memory}
            <BriefSec brief={snap.brief} client={client} />
          </aside>
        )}
      </div>
    </Shell>
  );
}

/** The tabbed, swipeable drawer that replaces the inspector on a phone. */
function Drawer({
  tab,
  onTab,
  children,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  children: ReactNode;
}) {
  const startX = useRef<number | null>(null);
  return (
    <section
      className="drawer-panel"
      aria-label={tab}
      onTouchStart={(e) => {
        startX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const x0 = startX.current;
        const x1 = e.changedTouches[0]?.clientX;
        startX.current = null;
        if (x0 === null || x1 === undefined || Math.abs(x1 - x0) < 50) return;
        const i = TABS.indexOf(tab);
        const next = TABS[x1 < x0 ? i + 1 : i - 1];
        if (next) onTab(next);
      }}
    >
      {children}
    </section>
  );
}

function ControlButton({ s, client }: { s: SessionState; client: FoldClient }) {
  const paused = s.intent.control === "paused";
  return (
    <button
      type="button"
      className="btn onchrome sm"
      onClick={() =>
        client.send({
          type: "directive",
          input: {
            text: paused ? "resume" : "pause",
            mode: paused ? "resume" : "pause",
            scope: "goal",
            supersedes: [],
            interrupt: false,
          },
        })
      }
    >
      <Icon d={paused ? ICONS.play : ICONS.pause} size={14} />
      {paused ? "Resume" : "Pause"}
    </button>
  );
}

function FleetStrip({ s, projectId }: { s: SessionState; projectId: string }) {
  const blocked = s.blockedWrites.slice(-3);
  const contentions = Object.values(s.fleetContentions).filter((c) => !c.resolved);
  if (blocked.length === 0 && contentions.length === 0) return null;
  return (
    <div className="fleet-strip">
      {contentions.map((c) => (
        <div className="note accent small" key={c.id}>
          <b>Fleet contention</b> · {c.kind} · <span className="mono">{c.resource}</span> · with{" "}
          {c.sessionIds.filter((id) => id !== s.sessionId).join(", ") || "another session"} ·{" "}
          <a href={paths.fleet(projectId)}>resolve on the board</a>
        </div>
      ))}
      {blocked.map((w) => (
        <div className="note warn small" key={`${w.claimId}:${w.seq}`}>
          <b>Write refused</b> · <span className="mono">{w.path}</span> is held by session{" "}
          <span className="mono">{w.holderSessionId}</span>
        </div>
      ))}
      {s.blockedWrites.length > blocked.length && (
        <span className="muted small">
          {s.blockedWrites.length - blocked.length} earlier refused writes
        </span>
      )}
    </div>
  );
}

// ---- stream ----------------------------------------------------------------------------

interface Rendered {
  kind: "human" | "agent" | "system" | "alert" | "contention";
  who: string;
  meta: string;
  body: string;
  tool?: { k: string; v: string; r: string; ok: boolean | null };
}

function Stream({ events, s }: { events: SessionEvent[]; s: SessionState }) {
  const ref = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to the end on every new event
  useEffect(() => {
    if (follow) ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [events.length, follow]);
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  return (
    <div
      className="stream"
      ref={ref}
      onScroll={() => {
        const el = ref.current;
        if (el) setFollow(el.scrollTop + el.clientHeight >= el.scrollHeight - 40);
      }}
    >
      {events.map((e) => {
        const r = render(e, name);
        if (!r) return null;
        return (
          <div key={e.id} className={`ev ${r.kind}`}>
            <span className={`who ${r.kind === "human" || r.kind === "agent" ? r.kind : ""}`}>
              {r.who}
              {r.meta && <span className="meta">{r.meta}</span>}
            </span>
            <div>
              {r.body}
              {r.tool && (
                <div className="tool">
                  <span className="k">{r.tool.k}</span>
                  <span>{r.tool.v}</span>
                  <span
                    className={`r ${r.tool.ok === true ? "ok" : r.tool.ok === false ? "fail" : ""}`}
                  >
                    {r.tool.r}
                  </span>
                </div>
              )}
            </div>
            <span className="time" title={`seq ${e.seq}`}>
              #{e.seq}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function render(e: SessionEvent, name: (id: string) => string): Rendered | null {
  const who = name(e.actor);
  switch (e.kind) {
    case "directive.submitted":
      return {
        kind: "human",
        who,
        meta: `${e.payload.input.mode} · ${e.payload.input.scope}${e.payload.input.interrupt ? " · interrupt" : ""}`,
        body: e.payload.input.text,
      };
    case "project.directive.applied":
      return {
        kind: "alert",
        who: "lead",
        meta: `${e.payload.input.scope} · all sessions`,
        body: `Directive from ${name(e.payload.author)}: ${e.payload.input.text}`,
      };
    case "agent.model.completed":
      return { kind: "agent", who: "agent", meta: `turn ${e.payload.turn}`, body: e.payload.text };
    case "agent.tool.requested":
      return {
        kind: "agent",
        who: "agent",
        meta: `turn ${e.payload.turn}`,
        body: "",
        tool: {
          k: e.payload.call.name,
          v: JSON.stringify(e.payload.call.args).slice(0, 200),
          r: e.payload.call.risk,
          ok: null,
        },
      };
    case "agent.tool.completed":
      return {
        kind: "agent",
        who: "agent",
        meta: "",
        body: "",
        tool: {
          k: e.payload.result.ok ? "result" : "failed",
          v: e.payload.result.output.split("\n").slice(0, 3).join("\n").slice(0, 300),
          r: e.payload.result.ok ? "ok" : "fail",
          ok: e.payload.result.ok,
        },
      };
    case "agent.turn.ended":
      return {
        kind: "system",
        who: "agent",
        meta: `turn ${e.payload.turn} ${e.payload.reason}`,
        body: e.payload.summary,
      };
    case "agent.turn.started":
      return {
        kind: "system",
        who: "system",
        meta: "",
        body: `turn ${e.payload.turn} started · epoch ${e.payload.epoch}`,
      };
    case "approval.requested":
      return {
        kind: "alert",
        who: "approval",
        meta: e.payload.call.risk,
        body: `${e.payload.call.name} ${JSON.stringify(e.payload.call.args).slice(0, 200)} · needs a vote`,
      };
    case "approval.voted":
      return { kind: "human", who, meta: "vote", body: `voted ${e.payload.vote}` };
    case "contention.resolved":
      return { kind: "human", who, meta: "", body: "resolved a contention" };
    case "directive.withdrawn":
      return { kind: "human", who, meta: "", body: "withdrew a directive" };
    case "handoff.requested":
      return {
        kind: "system",
        who: "system",
        meta: "",
        body: `Handoff requested: ${who} → ${name(e.payload.to)}`,
      };
    case "handoff.accepted":
      return { kind: "system", who: "system", meta: "", body: `${who} has the fold` };
    case "handoff.declined":
      return { kind: "system", who: "system", meta: "", body: `${who} declined the fold` };
    case "participant.joined":
      return {
        kind: "system",
        who: "system",
        meta: "",
        body: `${e.payload.actor.name} joined as ${e.payload.role}`,
      };
    case "participant.left":
      return { kind: "system", who: "system", meta: "", body: `${who} left` };
    case "role.changed":
      return {
        kind: "system",
        who: "system",
        meta: "",
        body: `${name(e.payload.actorId)} is now ${e.payload.role}`,
      };
    case "workspace.changed":
      return {
        kind: "system",
        who: "workspace",
        meta: "",
        body: Object.keys(e.payload.changes).join(", "),
      };
    case "workspace.blocked":
      return {
        kind: "alert",
        who: "fleet",
        meta: "write refused",
        body: `${e.payload.path} is held by session ${e.payload.holderSessionId}`,
      };
    case "fleet.contention.mirrored":
      return {
        kind: "contention",
        who: "contention",
        meta: e.payload.kind,
        body: `${e.payload.resolved ? "Resolved: " : ""}${e.payload.resource} · with ${e.payload.sessionIds.join(", ")}`,
      };
    case "branch.created":
      return { kind: "system", who: "system", meta: "", body: `branch ${e.payload.branch} forked` };
    case "branch.merged":
      return {
        kind: "system",
        who: "system",
        meta: "",
        body: `merged ${e.payload.source} (conflicts: ${e.payload.conflicts.join(", ") || "none"})`,
      };
    case "note.posted":
      return { kind: "human", who, meta: "note", body: e.payload.text };
    case "checkpoint.created":
      return { kind: "system", who: "system", meta: "", body: `checkpoint ${e.payload.label}` };
    case "session.created":
      return {
        kind: "system",
        who: "system",
        meta: "",
        body: `Session ${e.payload.title} created in ${e.payload.projectId}`,
      };
    default:
      return null;
  }
}

// ---- composer --------------------------------------------------------------------------

function Composer({ s, me, client }: { s: SessionState; me: Actor; client: FoldClient }) {
  const [text, setText] = useState("");
  const [scope, setScope] = useState("goal");
  const [mode, setMode] = useState<DirectiveMode>("steer");
  const [interrupt, setInterrupt] = useState(false);
  const role = s.participants[me.id]?.role ?? "observer";
  const submit = () => {
    if (!text.trim() && (mode === "steer" || mode === "constrain")) return;
    client.send({
      type: "directive",
      input: {
        text: text.trim() || mode,
        mode,
        scope: scope.trim() || "goal",
        supersedes: [],
        interrupt,
      },
    });
    setText("");
  };
  return (
    <form
      className="composer"
      aria-label="Steer the agent"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <select
        aria-label="Mode"
        value={mode}
        onChange={(e) => setMode(e.target.value as DirectiveMode)}
      >
        {["steer", "constrain", "pause", "resume", "cancel"].map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>
      <input
        type="text"
        className="scope mono"
        aria-label="Scope"
        value={scope}
        onChange={(e) => setScope(e.target.value)}
        placeholder="scope"
      />
      <input
        type="text"
        className="text"
        aria-label="Directive"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Steer the agent… arbitrated against everyone else and applied at the next safe point."
      />
      <label className="switch">
        <input
          type="checkbox"
          checked={interrupt}
          onChange={(e) => setInterrupt(e.target.checked)}
        />
        interrupt now
      </label>
      <button type="submit" className="btn primary">
        Send
        <Icon d={ICONS.send} size={14} />
      </button>
      <div className="footline">
        <span>
          As {me.name} · {role}
          {s.driver === me.id ? " · you have the fold" : ""}
        </span>
      </div>
    </form>
  );
}

// ---- inspector sections ----------------------------------------------------------------

function IntentSec({ s }: { s: SessionState }) {
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  return (
    <Sec title="Intent" extra={<span className="cnt">epoch {s.epoch}</span>}>
      <dl className="kv">
        <dt>Goal</dt>
        <dd>
          {s.intent.goal ? (
            <>
              {s.intent.goal.text} <span className="faint">{name(s.intent.goal.author)}</span>
            </>
          ) : (
            <span className="muted">not set</span>
          )}
        </dd>
        {Object.keys(s.intent.steers).length > 0 && (
          <>
            <dt>Scopes</dt>
            <dd className="row" style={{ gap: 4 }}>
              {Object.entries(s.intent.steers).map(([k, v]) => (
                <span className="chip scope" key={k} title={`${v.text} · ${name(v.author)}`}>
                  {k}
                </span>
              ))}
            </dd>
          </>
        )}
        {s.intent.constraints.length > 0 && (
          <>
            <dt>Constraints</dt>
            <dd>
              {s.intent.constraints.map((c) => (
                <div key={c.directiveId}>
                  {c.text}{" "}
                  <span className="faint">
                    {name(c.author)}
                    {c.origin === "project" ? " · project" : ""}
                  </span>
                </div>
              ))}
            </dd>
          </>
        )}
        {s.intent.contendedScopes.length > 0 && (
          <>
            <dt>Discussing</dt>
            <dd>
              {s.intent.contendedScopes.map((c) => (
                <span className="chip scope" key={c} style={{ color: "var(--danger)" }}>
                  {c}
                </span>
              ))}{" "}
              <span className="muted small">agent must not act</span>
            </dd>
          </>
        )}
        <dt>Control</dt>
        <dd>
          {s.intent.control}
          {s.intent.interrupt ? " · interrupt pending" : ""}
        </dd>
      </dl>
    </Sec>
  );
}

function ContentionSecs({ s, me, client }: { s: SessionState; me: Actor; client: FoldClient }) {
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const contentions = Object.values(s.contentions).filter((c) => !c.resolved);
  return (
    <>
      {contentions.map((c) => (
        <Sec
          key={c.id}
          className="contention"
          title="Contention"
          extra={<span className="tag open">open · {c.scope}</span>}
        >
          {c.directiveIds.map((id) => {
            const d = s.directives[id];
            if (!d) return null;
            return (
              <div className="opt" key={id}>
                <Avatar id={d.author} name={name(d.author)} small />
                <span>
                  {d.input.text}
                  <small>{name(d.author)}</small>
                </span>
                <span className="acts">
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => client.send({ type: "resolve", contentionId: c.id, winner: id })}
                  >
                    Pick
                  </button>
                  {d.author === me.id && (
                    <button
                      type="button"
                      className="btn quiet sm"
                      onClick={() => client.send({ type: "withdraw", directiveId: id })}
                    >
                      Withdraw
                    </button>
                  )}
                </span>
              </div>
            );
          })}
          <span className="muted small">
            {s.driver === me.id
              ? "You have the fold: pick one."
              : `${name(s.driver ?? "")} has the fold and picks.`}
          </span>
        </Sec>
      ))}
    </>
  );
}

function ApprovalSecs({ s, client }: { s: SessionState; client: FoldClient }) {
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const pending = Object.values(s.approvals).filter((a) => a.status === "pending");
  return (
    <>
      {pending.map((a) => {
        const votes = Object.entries(a.votes);
        const approvals = votes.filter(([, v]) => v === "approve").length;
        return (
          <Sec
            key={a.id}
            className="approval"
            title="Approval"
            extra={
              <>
                <span className={`tag ${a.call.risk}`}>{a.call.risk}</span>
                <span className="cnt">turn {a.turn}</span>
              </>
            }
          >
            <b>{a.call.name}</b>
            <span className="muted small">
              needs {describeRule(ruleFor(s.policy.approvals, a.call.risk))}
            </span>
            <span className="mono small" style={{ overflowWrap: "anywhere" }}>
              {JSON.stringify(a.call.args).slice(0, 240)}
            </span>
            <div className="drivers">
              {votes.map(([k, v]) => (
                <Avatar key={k} id={k} name={name(k)} small title={`${name(k)} · ${v}`} />
              ))}
              <div className="bar">
                <i style={{ width: `${Math.min(100, approvals * 50)}%` }} />
              </div>
              <span className="mono small">
                {votes.map(([k, v]) => `${name(k)} ${v}`).join(", ") || "no votes yet"}
              </span>
            </div>
            <div className="row">
              <button
                type="button"
                className="btn primary sm"
                onClick={() => client.send({ type: "vote", approvalId: a.id, vote: "approve" })}
              >
                Approve
              </button>
              <button
                type="button"
                className="btn danger sm"
                onClick={() => client.send({ type: "vote", approvalId: a.id, vote: "deny" })}
              >
                Deny
              </button>
            </div>
          </Sec>
        );
      })}
    </>
  );
}

function HandoffSecs({ s, me, client }: { s: SessionState; me: Actor; client: FoldClient }) {
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const handoffs = Object.values(s.handoffs).filter(
    (h) => h.status === "pending" && h.to === me.id,
  );
  return (
    <>
      {handoffs.map((h) => (
        <Sec
          key={h.id}
          className="handoff"
          title="Handoff"
          extra={<span className="tag open">offered</span>}
        >
          <div className="person">
            <Avatar id={h.from} name={name(h.from)} small driver />
            {name(h.from)}
            <Icon d={ICONS.handoff} />
            <Avatar id={me.id} name={me.name} small />
            {me.name}
          </div>
          <span className="muted small">{name(h.from)} offers you the fold.</span>
          <div className="row">
            <button
              type="button"
              className="btn primary sm"
              onClick={() => client.send({ type: "handoff.accept", handoffId: h.id })}
            >
              Accept
            </button>
            <button
              type="button"
              className="btn quiet sm"
              onClick={() => client.send({ type: "handoff.decline", handoffId: h.id })}
            >
              Decline
            </button>
          </div>
        </Sec>
      ))}
    </>
  );
}

function TeamSec({ s, me, client }: { s: SessionState; me: Actor; client: FoldClient }) {
  const humans = Object.values(s.participants).filter((p) => p.actor.kind === "human");
  const present = humans.filter((p) => p.present).length;
  const iOwn = s.participants[me.id]?.role === "owner";
  return (
    <Sec title="Team" extra={<span className="cnt">{present} present</span>}>
      {humans.map((p) => (
        <div className="person" key={p.actor.id}>
          <Avatar id={p.actor.id} name={p.actor.name} small driver={s.driver === p.actor.id} />
          {p.actor.name}
          {p.actor.id === me.id ? " (you)" : ""}
          <span className="role">
            {p.role}
            {s.driver === p.actor.id ? " · driver" : ""}
            {p.present ? "" : " · away"}
          </span>
          {p.actor.id !== me.id && s.driver === me.id && (
            <button
              type="button"
              className="btn sm"
              onClick={() => client.send({ type: "handoff.request", to: p.actor.id })}
            >
              <Icon d={ICONS.handoff} size={14} />
              Hand off
            </button>
          )}
          {p.actor.id !== me.id && iOwn && (
            <select
              className="select"
              style={{ width: 110, minHeight: 26 }}
              aria-label={`Role of ${p.actor.name}`}
              value={p.role}
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
      ))}
      {humans.length <= 1 && (
        <span className="muted small">Nobody else here yet. Share the link.</span>
      )}
    </Sec>
  );
}

function BranchesSec({ s, client }: { s: SessionState; client: FoldClient }) {
  const [forkName, setForkName] = useState("");
  const branches = ["main", ...Object.keys(s.branches)];
  return (
    <Sec title="Branches" extra={<span className="cnt">{branches.length}</span>}>
      {branches.map((b) => (
        <div className="branch" key={b}>
          <i className={b === s.branch ? "cur" : ""} />
          <span className="grow">
            {b === "main" ? <b>{b}</b> : <span className="mono">{b}</span>}
            {b === s.branch ? <span className="muted"> · you are here</span> : null}
          </span>
          {b !== s.branch && (
            <>
              <button
                type="button"
                className="btn quiet sm"
                onClick={() => client.send({ type: "switch", branch: b })}
              >
                Switch
              </button>
              <button
                type="button"
                className="btn quiet sm"
                onClick={() => client.send({ type: "merge", source: b })}
              >
                Merge
              </button>
            </>
          )}
        </div>
      ))}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (forkName.trim()) client.send({ type: "fork", branch: forkName.trim() });
          setForkName("");
        }}
      >
        <input
          className="input mono grow"
          aria-label="New branch name"
          placeholder="try/stripe-tax"
          value={forkName}
          onChange={(e) => setForkName(e.target.value)}
        />
        <button type="submit" className="btn sm">
          Fork
        </button>
        <button
          type="button"
          className="btn sm"
          onClick={() => client.send({ type: "checkpoint", label: "manual" })}
        >
          Checkpoint
        </button>
      </form>
      {s.checkpoints.length > 0 && (
        <span className="muted small">
          {s.checkpoints.length} checkpoints · latest{" "}
          {s.checkpoints[s.checkpoints.length - 1]?.label}
        </span>
      )}
    </Sec>
  );
}

function WorkspaceSec({ s }: { s: SessionState }) {
  const files = Object.keys(s.workspace).sort();
  const conflicts = s.openConflicts.length;
  return (
    <Sec
      title="Workspace"
      extra={
        <>
          {conflicts > 0 && (
            <span className="tag conf">
              {conflicts} conflict{conflicts === 1 ? "" : "s"}
            </span>
          )}
          <span className="cnt">{files.length} files</span>
        </>
      }
    >
      {files.length === 0 && <span className="muted small">Nothing written yet.</span>}
      {files.map((p) => (
        <div className="file" key={p}>
          <span>{p}</span>
          {s.openConflicts.includes(p) ? (
            <span className="tag conf">conflict</span>
          ) : (
            <span className="tag ok">written</span>
          )}
        </div>
      ))}
    </Sec>
  );
}

function MemorySec({
  orgId,
  teamId,
  projectId,
  user,
}: {
  orgId: string;
  teamId: string;
  projectId: string;
  user: string;
}) {
  const ctx = useFetch(
    () => api.memoryContext(orgId, { team: teamId, project: projectId, user }),
    `${orgId}/${teamId}/${projectId}/${user}`,
  );
  return (
    <Sec
      title="Project memory"
      extra={
        <>
          <span className="cnt">{projectId}</span>
          <button type="button" className="btn quiet sm" onClick={ctx.reload}>
            Refresh
          </button>
        </>
      }
    >
      {ctx.error && <div className="note danger">{ctx.error}</div>}
      {ctx.data?.context ? (
        <pre className="brief">{ctx.data.context}</pre>
      ) : (
        <span className="muted small">
          {ctx.loading ? "Loading…" : "Nothing remembered for this project yet."}
        </span>
      )}
    </Sec>
  );
}

function BriefSec({ brief, client }: { brief: string | null; client: FoldClient }) {
  return (
    <Sec
      className="brief"
      title="Catch-up brief"
      extra={
        <button
          type="button"
          className="btn quiet sm"
          onClick={() => client.send({ type: "brief" })}
        >
          Ask for brief
        </button>
      }
    >
      <Brief text={brief} empty="Ask for a brief to catch up on what happened." />
    </Sec>
  );
}
