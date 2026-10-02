import { describeRule, ruleFor, type SessionState } from "@fold/kernel";
import type { Actor, DirectiveMode, SessionEvent, ToolCall } from "@fold/protocol";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Shell, type ShellContext } from "../App.js";
import { api, type Me, refOf, useFetch } from "../api.js";
import { FoldClient, wsUrl } from "../client.js";
import { actorOf, type Identity } from "../identity.js";
import { notifyIfHidden } from "../notify.js";
import { rememberRecent } from "../recents.js";
import { paths } from "../router.js";
import { reportPendingApprovals } from "../shell.js";
import { Avatar, copyText, ErrorLine, ICONS, Icon, Status } from "../ui.js";

export function SessionView({
  projectId,
  sessionId,
  title,
  identity,
  me,
  ctx,
}: {
  projectId: string;
  sessionId: string;
  title: string | null;
  identity: Identity;
  me: Me | null;
  ctx: ShellContext;
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
  const s = snap.state;
  const shownTitle = s?.title || title || sessionId;
  useEffect(() => {
    rememberRecent({ projectId, sessionId, title: shownTitle });
  }, [projectId, sessionId, shownTitle]);
  const [details, setDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!s)
    return (
      <Shell ctx={ctx} title={shownTitle}>
        <div className="column">
          <ErrorLine errors={snap.errors} />
          <p className="muted">{snap.connected ? "Joining…" : "Connecting…"}</p>
        </div>
      </Shell>
    );

  const pendingApprovals = Object.values(s.approvals).filter((a) => a.status === "pending");
  reportPendingApprovals(pendingApprovals.length);
  const online = snap.presence.filter((p) => p.online);
  const share = () => {
    const url = `${location.origin}${location.pathname}${paths.session(projectId, sessionId)}`;
    copyText(url).then((ok) => {
      setCopied(ok);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Shell
      ctx={ctx}
      title={
        <>
          <span className="ellipsis">{shownTitle}</span>
          <Status status={s.status} />
        </>
      }
      right={
        <>
          <fieldset
            className="stack"
            aria-label={`Present: ${online.map((p) => p.actor.name).join(", ")}`}
          >
            {online.slice(0, 4).map((p) => (
              <Avatar
                key={p.actor.id}
                id={p.actor.id}
                name={p.actor.name}
                driver={s.driver === p.actor.id}
                title={`${p.actor.name} · ${p.role}${s.driver === p.actor.id ? " · driving" : ""}`}
              />
            ))}
            {online.length > 4 && <span className="avatar">+{online.length - 4}</span>}
          </fieldset>
          <button type="button" className="btn ghost sm" onClick={share}>
            <Icon d={ICONS.link} size={14} />
            <span className="lbl">{copied ? "Copied" : "Share"}</span>
          </button>
          <button
            type="button"
            className={`btn sm${details ? " on" : ""}`}
            aria-pressed={details}
            onClick={() => setDetails((v) => !v)}
          >
            Details
          </button>
        </>
      }
      drawer={
        details ? (
          <Drawer
            s={s}
            me={actor}
            client={client}
            brief={snap.brief}
            errors={snap.errors}
            orgId={ref.orgId}
            teamId={ref.teamId}
            projectId={projectId}
            onClose={() => setDetails(false)}
          />
        ) : null
      }
    >
      <Stream events={snap.events} s={s} me={actor} client={client} showHandoff={!details} />
      <Composer s={s} me={actor} client={client} connected={snap.connected} />
    </Shell>
  );
}

// ---- stream ----------------------------------------------------------------------------

interface Step {
  id: string;
  name: string;
  doing: string;
  done: string;
  icon: string;
  args: string;
  ok: boolean | null;
  output: string;
}

type Block =
  | { kind: "human"; id: string; who: string; text: string; sub: string }
  | { kind: "agent"; id: string; text: string; steps: Step[] }
  | { kind: "divider"; id: string; text: string; danger?: boolean }
  | { kind: "approval"; id: string; approvalId: string };

/** What a tool call does, in words: `ask` for the approval sentence, `doing`/`done` for the step. */
function describeCall(call: ToolCall): { ask: string; doing: string; done: string; icon: string } {
  const a = call.args as Record<string, unknown>;
  const str = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : "");
  const list = (k: string) => (Array.isArray(a[k]) ? (a[k] as unknown[]).map(String) : []);
  switch (call.name) {
    case "workspace.read":
      return {
        ask: `read ${str("path")}`,
        doing: `Reading ${str("path")}`,
        done: `Read ${str("path")}`,
        icon: ICONS.file,
      };
    case "workspace.write":
      return {
        ask: `write ${str("path")}`,
        doing: `Writing ${str("path")}`,
        done: `Wrote ${str("path")}`,
        icon: ICONS.pen,
      };
    case "workspace.delete":
      return {
        ask: `delete ${str("path")}`,
        doing: `Deleting ${str("path")}`,
        done: `Deleted ${str("path")}`,
        icon: ICONS.file,
      };
    case "workspace.list":
      return {
        ask: "list the workspace",
        doing: "Listing files",
        done: "Listed files",
        icon: ICONS.file,
      };
    case "shell.run": {
      const cmd = [str("command"), ...list("args")].join(" ").trim();
      return {
        ask: `run \`${cmd}\``,
        doing: `Running shell: ${cmd}`,
        done: `Ran shell: ${cmd}`,
        icon: ICONS.terminal,
      };
    }
    case "deploy":
      return {
        ask: `deploy to ${str("env")}`,
        doing: `Deploying to ${str("env")}`,
        done: `Deployed to ${str("env")}`,
        icon: ICONS.rocket,
      };
    case "memory.remember":
      return {
        ask: `remember ${str("key")}`,
        doing: `Remembering ${str("key")}`,
        done: `Remembered ${str("key")}`,
        icon: ICONS.memory,
      };
    case "memory.recall":
      return {
        ask: "recall team memory",
        doing: "Recalling memory",
        done: "Recalled memory",
        icon: ICONS.memory,
      };
    case "fleet.claim":
      return { ask: "claim a resource", doing: "Claiming", done: "Claimed", icon: ICONS.tool };
    case "fleet.release":
      return { ask: "release a claim", doing: "Releasing", done: "Released", icon: ICONS.tool };
    default: {
      const short = JSON.stringify(call.args).slice(0, 60);
      return {
        ask: `${call.name} ${short}`,
        doing: `${call.name}`,
        done: `${call.name}`,
        icon: ICONS.tool,
      };
    }
  }
}

function blocksOf(events: SessionEvent[], s: SessionState, meId: string): Block[] {
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const out: Block[] = [];
  const steps = new Map<string, Step>();
  let agent: Extract<Block, { kind: "agent" }> | null = null;
  const divider = (e: SessionEvent, text: string, danger = false) =>
    out.push({ kind: "divider", id: e.id, text, danger });
  const human = (e: SessionEvent, text: string, sub = "") =>
    out.push({ kind: "human", id: e.id, who: name(e.actor), text, sub });
  for (const e of events) {
    switch (e.kind) {
      case "directive.submitted": {
        const i = e.payload.input;
        const parts = [
          i.mode !== "steer" ? i.mode : "",
          i.scope !== "goal" ? i.scope : "",
          i.interrupt ? "interrupt" : "",
        ];
        human(e, i.text, parts.filter(Boolean).join(" · "));
        agent = null;
        break;
      }
      case "note.posted":
        human(e, e.payload.text, "note");
        break;
      case "agent.model.completed":
        agent = { kind: "agent", id: e.id, text: e.payload.text, steps: [] };
        out.push(agent);
        break;
      case "agent.tool.requested": {
        const d = describeCall(e.payload.call);
        const step: Step = {
          id: e.payload.call.id,
          name: e.payload.call.name,
          doing: d.doing,
          done: d.done,
          icon: d.icon,
          args: JSON.stringify(e.payload.call.args, null, 1),
          ok: null,
          output: "",
        };
        steps.set(step.id, step);
        if (!agent) {
          agent = { kind: "agent", id: e.id, text: "", steps: [] };
          out.push(agent);
        }
        agent.steps.push(step);
        break;
      }
      case "agent.tool.completed": {
        const step = steps.get(e.payload.result.callId);
        if (step) {
          step.ok = e.payload.result.ok;
          step.output = e.payload.result.output;
        }
        break;
      }
      case "agent.turn.ended":
        if (e.payload.reason !== "done")
          divider(
            e,
            `Turn ${e.payload.turn} ${e.payload.reason}${e.payload.summary ? ` · ${e.payload.summary}` : ""}`,
          );
        break;
      case "approval.requested":
        out.push({ kind: "approval", id: e.id, approvalId: e.payload.approvalId });
        break;
      case "project.directive.applied":
        divider(e, `${name(e.payload.author)} set a project direction: ${e.payload.input.text}`);
        break;
      case "contention.resolved":
        divider(e, `${name(e.actor)} picked a direction`);
        break;
      case "directive.withdrawn":
        divider(e, `${name(e.actor)} withdrew a directive`);
        break;
      case "handoff.requested":
        divider(
          e,
          `${name(e.actor)} offers the fold to ${e.payload.to === meId ? "you" : name(e.payload.to)}`,
        );
        break;
      case "handoff.accepted":
        divider(e, `${name(e.actor)} has the fold`);
        break;
      case "handoff.declined":
        divider(e, `${name(e.actor)} declined the fold`);
        break;
      case "participant.joined":
        divider(e, `${e.payload.actor.name} joined as ${e.payload.role}`);
        break;
      case "participant.left":
        divider(e, `${name(e.actor)} left`);
        break;
      case "role.changed":
        divider(e, `${name(e.payload.actorId)} is now ${e.payload.role}`);
        break;
      case "checkpoint.created":
        divider(e, `Checkpoint ${e.payload.label}`);
        break;
      case "branch.created":
        divider(e, `Branch ${e.payload.branch} forked from ${e.payload.fromBranch}`);
        break;
      case "branch.merged":
        divider(
          e,
          `Folded ${e.payload.source} into ${e.payload.base}${e.payload.conflicts.length ? ` · ${e.payload.conflicts.length} conflict${e.payload.conflicts.length === 1 ? "" : "s"}` : ""}`,
          e.payload.conflicts.length > 0,
        );
        break;
      case "workspace.blocked":
        divider(
          e,
          `Write to ${e.payload.path} refused: held by ${e.payload.holderSessionId}`,
          true,
        );
        break;
      case "fleet.contention.mirrored":
        divider(
          e,
          `${e.payload.resolved ? "Resolved: " : "Fleet contention: "}${e.payload.kind} on ${e.payload.resource} with ${e.payload.sessionIds.filter((id) => id !== s.sessionId).join(", ") || "another session"}`,
          !e.payload.resolved,
        );
        break;
      default:
        break;
    }
  }
  return out;
}

function Stream({
  events,
  s,
  me,
  client,
  showHandoff,
}: {
  events: SessionEvent[];
  s: SessionState;
  me: Actor;
  client: FoldClient;
  showHandoff: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const blocks = useMemo(() => blocksOf(events, s, me.id), [events, s, me.id]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keep the end in view as events arrive
  useEffect(() => {
    const scroller = endRef.current?.closest(".scroll");
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight });
  }, [events.length]);
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const contentions = Object.values(s.contentions).filter((c) => !c.resolved);
  const handoffs = Object.values(s.handoffs).filter(
    (h) => h.status === "pending" && h.to === me.id,
  );
  const canPick = s.driver === me.id || s.participants[me.id]?.role === "owner";
  return (
    <section className="column" aria-label="Conversation">
      {blocks.length === 0 && (
        <p className="muted" style={{ textAlign: "center", padding: "48px 0" }}>
          Set a goal to start the agent.
        </p>
      )}
      {blocks.map((b) => {
        switch (b.kind) {
          case "human":
            return (
              <div className="msg human" key={b.id}>
                <div className="meta">
                  {b.who}
                  {b.sub && <span className="faint">{b.sub}</span>}
                </div>
                <div className="text">{b.text}</div>
              </div>
            );
          case "agent":
            return (
              <div className="msg agent" key={b.id}>
                {b.text && <div className="text">{b.text}</div>}
                {b.steps.length > 0 && (
                  <div className="steps">
                    {b.steps.map((st) => (
                      <StepLine key={st.id} step={st} />
                    ))}
                  </div>
                )}
              </div>
            );
          case "divider":
            return (
              <div className={`divider${b.danger ? " danger" : ""}`} key={b.id}>
                {b.text}
              </div>
            );
          case "approval":
            return <ApprovalNotice key={b.id} s={s} id={b.approvalId} client={client} />;
          default:
            return null;
        }
      })}
      {contentions.map((c) => (
        <div className="notice contention" key={c.id}>
          <span>
            Two directions for <b>{c.scope}</b>. The agent holds this scope until{" "}
            {s.driver === me.id ? "you pick one" : `${name(s.driver ?? "")} picks one`}.
          </span>
          {c.directiveIds.map((id) => {
            const d = s.directives[id];
            if (!d) return null;
            return (
              <div className="option" key={id}>
                <span>
                  {d.input.text} <span className="faint">{name(d.author)}</span>
                </span>
                <span className="actions">
                  {canPick && (
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() =>
                        client.send({ type: "resolve", contentionId: c.id, winner: id })
                      }
                    >
                      Pick
                    </button>
                  )}
                  {d.author === me.id && (
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => client.send({ type: "withdraw", directiveId: id })}
                    >
                      Withdraw
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ))}
      {showHandoff &&
        handoffs.map((h) => (
          <div className="notice" key={h.id}>
            <span>{name(h.from)} offers you the fold.</span>
            <div className="actions">
              <button
                type="button"
                className="btn primary sm"
                onClick={() => client.send({ type: "handoff.accept", handoffId: h.id })}
              >
                Accept
              </button>
              <button
                type="button"
                className="btn sm"
                onClick={() => client.send({ type: "handoff.decline", handoffId: h.id })}
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      <div ref={endRef} />
    </section>
  );
}

function StepLine({ step }: { step: Step }) {
  const [open, setOpen] = useState(false);
  const shell = step.name === "shell.run";
  const suffix =
    step.ok === null
      ? ""
      : step.ok
        ? shell
          ? " · exit 0"
          : ""
        : shell
          ? " · failed"
          : " · failed";
  return (
    <div className={`step${step.ok === false ? " fail" : ""}`}>
      <button
        type="button"
        className="step-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon d={step.icon} size={14} />
        <span className="ellipsis">
          {step.ok === null ? step.doing : step.done}
          {suffix}
        </span>
        <Icon d={ICONS.chevron} size={12} className={`chev${open ? " open" : ""}`} />
      </button>
      {open && (
        <pre className="step-out">
          {step.args}
          {step.output ? `\n\n${step.output.split("\n").slice(0, 20).join("\n")}` : ""}
        </pre>
      )}
    </div>
  );
}

function ApprovalNotice({ s, id, client }: { s: SessionState; id: string; client: FoldClient }) {
  const a = s.approvals[id];
  if (!a) return null;
  const name = (k: string) => s.participants[k]?.actor.name ?? k;
  const votes = Object.entries(a.votes);
  const d = describeCall(a.call);
  if (a.status !== "pending") {
    const by = votes
      .filter(([, v]) => v === (a.status === "granted" ? "approve" : "deny"))
      .map(([k]) => name(k));
    return (
      <div className="divider">
        {a.status === "granted" ? "Approved" : "Denied"}: {d.ask}
        {by.length ? ` · ${by.join(", ")}` : ""}
      </div>
    );
  }
  return (
    <div className="notice">
      <span>
        The agent wants to {d.ask} ({a.call.risk}); needs{" "}
        {describeRule(ruleFor(s.policy.approvals, a.call.risk))}.
      </span>
      {votes.length > 0 && (
        <span className="small muted">
          {votes
            .map(([k, v]) => `${name(k)} ${v === "approve" ? "approved" : "denied"}`)
            .join(" · ")}
        </span>
      )}
      <div className="actions">
        <button
          type="button"
          className="btn primary sm"
          onClick={() => client.send({ type: "vote", approvalId: a.id, vote: "approve" })}
        >
          Approve
        </button>
        <button
          type="button"
          className="btn sm"
          onClick={() => client.send({ type: "vote", approvalId: a.id, vote: "deny" })}
        >
          Deny
        </button>
      </div>
    </div>
  );
}

// ---- composer --------------------------------------------------------------------------

const MODES: DirectiveMode[] = ["steer", "constrain", "pause", "resume", "cancel"];

function Composer({
  s,
  me,
  client,
  connected,
}: {
  s: SessionState;
  me: Actor;
  client: FoldClient;
  connected: boolean;
}) {
  const [text, setText] = useState("");
  const [scope, setScope] = useState("goal");
  const [mode, setMode] = useState<DirectiveMode>("steer");
  const [interrupt, setInterrupt] = useState(false);
  const [more, setMore] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const role = s.participants[me.id]?.role ?? "observer";
  const needsText = mode === "steer" || mode === "constrain";
  const submit = () => {
    if (needsText && !text.trim()) return;
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
    setMore(false);
    if (ta.current) ta.current.style.height = "auto";
  };
  const grow = () => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };
  return (
    <div className="composer-wrap">
      <form
        className="composer"
        aria-label="Steer the agent"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={ta}
          rows={1}
          aria-label="Directive"
          placeholder={needsText ? "Steer the agent" : `Send "${mode}"`}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            grow();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="bar">
          <button
            type="button"
            className="btn ghost icon"
            aria-label="Mode and scope"
            aria-expanded={more}
            onClick={() => setMore((v) => !v)}
          >
            <Icon d={more ? ICONS.close : ICONS.plus} />
          </button>
          <button
            type="button"
            className={`chip${mode !== "steer" ? " on" : ""}`}
            onClick={() => setMore((v) => !v)}
          >
            {mode !== "steer" ? `${mode} · ` : ""}
            {scope}
            {interrupt ? " · interrupt" : ""}
          </button>
          <div className="right">
            <button
              type="submit"
              className="send"
              aria-label="Send"
              disabled={needsText && !text.trim()}
            >
              <Icon d={ICONS.send} />
            </button>
          </div>
        </div>
        {more && (
          <div className="popover">
            <div className="group">
              <span className="small muted">Mode</span>
              <div className="row">
                {MODES.map((m) => (
                  <button
                    type="button"
                    key={m}
                    className={`chip${mode === m ? " on" : ""}`}
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="group">
              <label className="small muted" htmlFor="scope-input">
                Scope
              </label>
              <input
                id="scope-input"
                className="input mono"
                value={scope}
                placeholder="goal"
                onChange={(e) => setScope(e.target.value)}
              />
            </div>
            <label className="row small">
              <input
                type="checkbox"
                checked={interrupt}
                onChange={(e) => setInterrupt(e.target.checked)}
              />
              Interrupt now
            </label>
          </div>
        )}
      </form>
      <p className="hint small faint">
        {connected ? "" : "Reconnecting · "}
        Enter to send · Shift+Enter for a new line · as {me.name}, {role}
        {s.driver === me.id ? ", driving" : ""}
      </p>
    </div>
  );
}

// ---- details drawer --------------------------------------------------------------------

function Drawer({
  s,
  me,
  client,
  brief,
  errors,
  orgId,
  teamId,
  projectId,
  onClose,
}: {
  s: SessionState;
  me: Actor;
  client: FoldClient;
  brief: string | null;
  errors: string[];
  orgId: string;
  teamId: string;
  projectId: string;
  onClose: () => void;
}) {
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const humans = Object.values(s.participants).filter((p) => p.actor.kind === "human");
  const iOwn = s.participants[me.id]?.role === "owner";
  const myHandoffs = Object.values(s.handoffs).filter(
    (h) => h.status === "pending" && h.to === me.id,
  );
  const [forkName, setForkName] = useState("");
  const branches = ["main", ...Object.keys(s.branches)];
  const files = Object.keys(s.workspace).sort();
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
  return (
    <>
      <button
        type="button"
        className="scrim sheet-scrim"
        aria-label="Close details"
        onClick={onClose}
      />
      <aside className="drawer" aria-label="Details">
        <div className="drawer-head">
          <span>Details</span>
          <button
            type="button"
            className="btn ghost icon sm"
            aria-label="Close details"
            onClick={onClose}
          >
            <Icon d={ICONS.close} size={14} />
          </button>
        </div>
        <ErrorLine errors={errors} />
        <section className="group">
          <h3>Intent</h3>
          {s.intent.goal ? (
            <p>
              {s.intent.goal.text} <span className="faint">{name(s.intent.goal.author)}</span>
            </p>
          ) : (
            <p className="muted">No goal yet.</p>
          )}
          {Object.entries(s.intent.steers).map(([k, v]) => (
            <p key={k}>
              <span className="muted">{k}</span> {v.text}{" "}
              <span className="faint">{name(v.author)}</span>
            </p>
          ))}
          {s.intent.constraints.map((c) => (
            <p key={c.directiveId}>
              <span className="muted">always</span> {c.text}{" "}
              <span className="faint">
                {name(c.author)}
                {c.origin === "project" ? " · project" : ""}
              </span>
            </p>
          ))}
          {s.intent.contendedScopes.length > 0 && (
            <p className="muted">Held until a pick: {s.intent.contendedScopes.join(", ")}</p>
          )}
          <p className="row">
            <span className="muted">
              {s.intent.control}
              {s.intent.interrupt ? " · interrupt pending" : ""} · turn {s.turn}
            </span>
            <button
              type="button"
              className="btn sm"
              onClick={() => control(paused ? "resume" : "pause")}
            >
              {paused ? "Resume" : "Pause"}
            </button>
          </p>
        </section>
        <section className="group">
          <h3>People</h3>
          {humans.map((p) => (
            <div className="person" key={p.actor.id}>
              <Avatar id={p.actor.id} name={p.actor.name} driver={s.driver === p.actor.id} />
              <span className="grow ellipsis">
                {p.actor.name}
                {p.actor.id === me.id ? " (you)" : ""}
              </span>
              <span className="muted small">
                {s.driver === p.actor.id ? "driving" : p.role}
                {p.present ? "" : " · away"}
              </span>
              {p.actor.id !== me.id && s.driver === me.id && (
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => client.send({ type: "handoff.request", to: p.actor.id })}
                >
                  Hand off
                </button>
              )}
              {p.actor.id !== me.id && iOwn && s.driver !== me.id && (
                <select
                  className="select sm"
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
          {myHandoffs.map((h) => (
            <div className="row" key={h.id}>
              <span className="grow small">{name(h.from)} offers you the fold.</span>
              <button
                type="button"
                className="btn primary sm"
                onClick={() => client.send({ type: "handoff.accept", handoffId: h.id })}
              >
                Accept
              </button>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => client.send({ type: "handoff.decline", handoffId: h.id })}
              >
                Decline
              </button>
            </div>
          ))}
          {humans.length <= 1 && (
            <p className="muted small">Nobody else here yet. Share the link.</p>
          )}
        </section>
        <section className="group">
          <h3>Branches</h3>
          {branches.map((b) => (
            <div className="row" key={b}>
              <span className={`grow${b === s.branch ? "" : " mono"}`}>
                {b}
                {b === s.branch && <span className="muted"> · here</span>}
              </span>
              {b !== s.branch && (
                <>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => client.send({ type: "switch", branch: b })}
                  >
                    Switch
                  </button>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => client.send({ type: "merge", source: b })}
                  >
                    Fold into {s.branch}
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
              placeholder="try/idea"
              value={forkName}
              onChange={(e) => setForkName(e.target.value)}
            />
            <button type="submit" className="btn sm">
              Fork
            </button>
          </form>
          <p className="row small muted">
            <span className="grow">
              {files.length} file{files.length === 1 ? "" : "s"}
              {s.openConflicts.length > 0 && (
                <span className="danger">
                  {" "}
                  · {s.openConflicts.length} conflict{s.openConflicts.length === 1 ? "" : "s"}
                </span>
              )}
              {s.checkpoints.length > 0 && ` · ${s.checkpoints.length} checkpoints`}
            </span>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => client.send({ type: "checkpoint", label: "manual" })}
            >
              Checkpoint
            </button>
          </p>
          {files.slice(0, 12).map((p) => (
            <div className="mono small ellipsis" key={p}>
              {p}
              {s.openConflicts.includes(p) && <span className="danger"> · conflict</span>}
            </div>
          ))}
        </section>
        <section className="group">
          <h3>Memory</h3>
          {ctxMem.error && <p className="small danger">{ctxMem.error}</p>}
          <MemoryContext text={ctxMem.data?.context ?? ""} loading={ctxMem.loading} />
          <button type="button" className="btn ghost sm" onClick={ctxMem.reload}>
            Refresh
          </button>
        </section>
        <section className="group">
          <h3>Catch-up</h3>
          {brief ? (
            <pre className="brief">{brief}</pre>
          ) : (
            <p className="muted small">A brief of what happened since you were last here.</p>
          )}
          <button type="button" className="btn sm" onClick={() => client.send({ type: "brief" })}>
            Ask for brief
          </button>
        </section>
      </aside>
    </>
  );
}

/** The memory context arrives as text; show each remembered line with its author beneath. */
function MemoryContext({ text, loading }: { text: string; loading: boolean }) {
  const lines = text
    .split("\n")
    .filter((l) => /^\s+[-!]\s/.test(l))
    .map((l) => {
      const conflict = /^\s+!/.test(l);
      const body = l.replace(/^\s+[-!]\s/, "");
      const m = body.match(/^(.*)\s\(([^()]*)\)$/);
      const text = m ? (m[1] ?? body) : body;
      const km = text.match(/^\[([^\]]+)\]\s(.*)$/s);
      return {
        conflict,
        key: km ? (km[1] ?? "") : "",
        text: km ? (km[2] ?? text) : text,
        who: m ? (m[2] ?? "") : "",
      };
    });
  if (lines.length === 0)
    return (
      <p className="muted small">
        {loading ? "Loading…" : "Nothing remembered for this project yet."}
      </p>
    );
  return (
    <div className="memlist">
      {lines.map((l) => (
        <div className={`memline${l.conflict ? " conflict" : ""}`} key={`${l.who}:${l.text}`}>
          <span>
            {l.conflict && <span className="muted">Conflict · </span>}
            {l.key && <span className="mono muted">{l.key} </span>}
            {l.text}
          </span>
          {l.who && <span className="small faint">{l.who}</span>}
        </div>
      ))}
    </div>
  );
}
