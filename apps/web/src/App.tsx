import { describeRule, ruleFor, type SessionState } from "@atelier/kernel";
import type { Actor, DirectiveMode, SessionEvent } from "@atelier/protocol";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AtelierClient } from "./client.js";

const client = new AtelierClient();

function useSnapshot() {
  return useSyncExternalStore(
    (fn) => client.subscribe(fn),
    () => client.snapshot,
  );
}

const wsUrl = () => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

export function App() {
  const snap = useSnapshot();
  const [me, setMe] = useState<Actor | null>(null);
  if (!me || !snap.connected)
    return (
      <Join
        onJoin={(actor, session, token) => {
          setMe(actor);
          client.connect(wsUrl(), session, actor, token);
        }}
      />
    );
  const s = snap.state;
  if (!s) return <div className="join">Loading…</div>;
  return (
    <div className="app">
      <Header s={s} me={me} />
      <main>
        <Log events={snap.events} s={s} />
        <Composer />
      </main>
      <Sidebar s={s} me={me} brief={snap.brief} errors={snap.errors} />
    </div>
  );
}

function Join({ onJoin }: { onJoin: (a: Actor, session: string, token: string) => void }) {
  const [name, setName] = useState("");
  const [session, setSession] = useState("demo");
  const [token, setToken] = useState("");
  return (
    <form
      className="join"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name) return;
        onJoin(
          { id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), kind: "human", name },
          session,
          token,
        );
      }}
    >
      <h1>Atelier</h1>
      <p>Drop into a live agent session. The first person in becomes the owner.</p>
      <input placeholder="your name" value={name} onChange={(e) => setName(e.target.value)} />
      <input
        placeholder="session id"
        value={session}
        onChange={(e) => setSession(e.target.value)}
      />
      <input
        placeholder="token (if the server requires one)"
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      <button type="submit">Join</button>
    </form>
  );
}

function Header({ s, me }: { s: SessionState; me: Actor }) {
  const snap = useSnapshot();
  return (
    <header>
      <h1>{s.title || s.sessionId}</h1>
      <span>
        branch <b>{s.branch}</b>
      </span>
      <span className={`status ${s.status}`}>{s.status}</span>
      <span>turn {s.turn}</span>
      <div className="presence">
        {snap.presence.map((p) => (
          <span
            key={p.actor.id}
            className={`chip ${s.driver === p.actor.id ? "driver" : ""} ${p.online ? "" : "offline"}`}
            title={p.status}
          >
            {p.actor.name}
            {p.actor.id === me.id ? " (you)" : ""} · {p.role}
            {s.driver === p.actor.id ? " · driving" : ""}
          </span>
        ))}
      </div>
    </header>
  );
}

function Log({ events, s }: { events: SessionEvent[]; s: SessionState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, []);
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  return (
    <div className="log" ref={ref}>
      {events.map((e) => {
        const { text, cls } = render(e, name);
        if (!text) return null;
        return (
          <div key={e.id} className={`ev ${cls}`}>
            <span style={{ opacity: 0.5 }}>{String(e.seq).padStart(4, " ")} </span>
            {text}
          </div>
        );
      })}
    </div>
  );
}

function render(e: SessionEvent, name: (id: string) => string): { text: string; cls: string } {
  const who = name(e.actor);
  switch (e.kind) {
    case "directive.submitted":
      return {
        text: `${who} [${e.payload.input.mode}/${e.payload.input.scope}] ${e.payload.input.text}`,
        cls: "human",
      };
    case "agent.model.completed":
      return { text: `agent: ${e.payload.text}`, cls: "agent" };
    case "agent.tool.requested":
      return {
        text: `agent → ${e.payload.call.name} ${JSON.stringify(e.payload.call.args).slice(0, 140)}`,
        cls: "agent",
      };
    case "agent.tool.completed":
      return {
        text: `   ${e.payload.result.ok ? "ok" : "failed"}: ${e.payload.result.output.split("\n")[0]?.slice(0, 140)}`,
        cls: "agent",
      };
    case "agent.turn.ended":
      return {
        text: `agent: turn ${e.payload.turn} ${e.payload.reason}. ${e.payload.summary}`,
        cls: "system",
      };
    case "agent.turn.started":
      return { text: `agent: turn ${e.payload.turn} started`, cls: "system" };
    case "approval.requested":
      return {
        text: `approval needed: ${e.payload.call.name} [${e.payload.call.risk}] ${JSON.stringify(e.payload.call.args)}`,
        cls: "alert",
      };
    case "approval.voted":
      return { text: `${who} voted ${e.payload.vote}`, cls: "human" };
    case "contention.resolved":
      return { text: `${who} resolved a contention`, cls: "human" };
    case "handoff.requested":
      return { text: `${who} offered the driver seat to ${name(e.payload.to)}`, cls: "alert" };
    case "handoff.accepted":
      return { text: `${who} is now driving`, cls: "human" };
    case "participant.joined":
      return { text: `${e.payload.actor.name} joined as ${e.payload.role}`, cls: "system" };
    case "participant.left":
      return { text: `${who} left`, cls: "system" };
    case "role.changed":
      return { text: `${name(e.payload.actorId)} is now ${e.payload.role}`, cls: "system" };
    case "workspace.changed":
      return { text: `workspace: ${Object.keys(e.payload.changes).join(", ")}`, cls: "system" };
    case "branch.created":
      return { text: `branch ${e.payload.branch} forked`, cls: "system" };
    case "branch.merged":
      return {
        text: `merged ${e.payload.source} (conflicts: ${e.payload.conflicts.join(", ") || "none"})`,
        cls: "system",
      };
    case "note.posted":
      return { text: `${who}: ${e.payload.text}`, cls: "human" };
    case "checkpoint.created":
      return { text: `checkpoint ${e.payload.label}`, cls: "system" };
    default:
      return { text: "", cls: "system" };
  }
}

function Composer() {
  const [text, setText] = useState("");
  const [scope, setScope] = useState("goal");
  const [mode, setMode] = useState<DirectiveMode>("steer");
  const [interrupt, setInterrupt] = useState(false);
  const submit = () => {
    if (!text.trim() && mode === "steer") return;
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
    <div className="composer">
      <select value={mode} onChange={(e) => setMode(e.target.value as DirectiveMode)}>
        {["steer", "constrain", "pause", "resume", "cancel"].map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>
      <input
        type="text"
        style={{ flex: "0 0 110px" }}
        value={scope}
        onChange={(e) => setScope(e.target.value)}
        placeholder="scope"
      />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="steer the agent…"
      />
      <label>
        <input
          type="checkbox"
          checked={interrupt}
          onChange={(e) => setInterrupt(e.target.checked)}
        />{" "}
        interrupt
      </label>
      <button type="button" onClick={submit}>
        Send
      </button>
    </div>
  );
}

function Sidebar({
  s,
  me,
  brief,
  errors,
}: {
  s: SessionState;
  me: Actor;
  brief: string | null;
  errors: string[];
}) {
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const [forkName, setForkName] = useState("");
  const pendingApprovals = Object.values(s.approvals).filter((a) => a.status === "pending");
  const contentions = Object.values(s.contentions).filter((c) => !c.resolved);
  const handoffs = Object.values(s.handoffs).filter(
    (h) => h.status === "pending" && h.to === me.id,
  );
  const humans = useMemo(
    () =>
      Object.values(s.participants).filter((p) => p.actor.kind === "human" && p.actor.id !== me.id),
    [s.participants, me.id],
  );
  return (
    <aside>
      {errors.length > 0 && (
        <section style={{ color: "#f85149" }}>{errors[errors.length - 1]}</section>
      )}
      <section>
        <h2>Intent</h2>
        <div>
          <b>Goal:</b> {s.intent.goal?.text ?? "not set"}
        </div>
        <ul>
          {Object.entries(s.intent.steers).map(([k, v]) => (
            <li key={k}>
              <b>[{k}]</b> {v.text} <i>({name(v.author)})</i>
            </li>
          ))}
        </ul>
        {s.intent.constraints.length > 0 && (
          <div>
            <b>Constraints</b>
            <ul>
              {s.intent.constraints.map((c) => (
                <li key={c.directiveId}>{c.text}</li>
              ))}
            </ul>
          </div>
        )}
        {s.intent.contendedScopes.length > 0 && (
          <div style={{ color: "#d29922" }}>
            Under discussion: {s.intent.contendedScopes.join(", ")}
          </div>
        )}
      </section>
      {contentions.length > 0 && (
        <section>
          <h2>Contentions</h2>
          {contentions.map((c) => (
            <div className="card" key={c.id}>
              <div>
                scope <b>{c.scope}</b>
              </div>
              {c.directiveIds.map((id) => (
                <div key={id}>
                  {name(s.directives[id]?.author ?? "")}: “{s.directives[id]?.input.text}”
                  <button
                    type="button"
                    className="small"
                    onClick={() => client.send({ type: "resolve", contentionId: c.id, winner: id })}
                  >
                    pick
                  </button>
                  {s.directives[id]?.author === me.id && (
                    <button
                      type="button"
                      className="small"
                      onClick={() => client.send({ type: "withdraw", directiveId: id })}
                    >
                      withdraw mine
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </section>
      )}
      {pendingApprovals.length > 0 && (
        <section>
          <h2>Approvals</h2>
          {pendingApprovals.map((a) => (
            <div className="card" key={a.id}>
              <div>
                <b>{a.call.name}</b> [{a.call.risk}] needs{" "}
                {describeRule(ruleFor(s.policy.approvals, a.call.risk))}
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 11 }}>
                {JSON.stringify(a.call.args).slice(0, 200)}
              </div>
              <div>
                votes:{" "}
                {Object.entries(a.votes)
                  .map(([k, v]) => `${name(k)}:${v}`)
                  .join(", ") || "none"}
              </div>
              <button
                type="button"
                className="small"
                onClick={() => client.send({ type: "vote", approvalId: a.id, vote: "approve" })}
              >
                approve
              </button>
              <button
                type="button"
                className="small"
                onClick={() => client.send({ type: "vote", approvalId: a.id, vote: "deny" })}
              >
                deny
              </button>
            </div>
          ))}
        </section>
      )}
      {handoffs.map((h) => (
        <section key={h.id} className="card">
          {name(h.from)} wants you to drive.
          <button
            type="button"
            className="small"
            onClick={() => client.send({ type: "handoff.accept", handoffId: h.id })}
          >
            accept
          </button>
          <button
            type="button"
            className="small"
            onClick={() => client.send({ type: "handoff.decline", handoffId: h.id })}
          >
            decline
          </button>
        </section>
      ))}
      <section>
        <h2>Team</h2>
        <ul>
          {Object.values(s.participants)
            .filter((p) => p.actor.kind === "human")
            .map((p) => (
              <li key={p.actor.id}>
                {p.actor.name} · {p.role}
                {s.driver === p.actor.id ? " · driving" : ""}
                {p.present ? "" : " · away"}
                {p.actor.id !== me.id && s.driver === me.id && (
                  <button
                    type="button"
                    className="small"
                    onClick={() => client.send({ type: "handoff.request", to: p.actor.id })}
                  >
                    hand off
                  </button>
                )}
                {p.actor.id !== me.id && s.participants[me.id]?.role === "owner" && (
                  <select
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
              </li>
            ))}
        </ul>
        {humans.length === 0 && (
          <div style={{ opacity: 0.6 }}>Nobody else here yet. Share the session id.</div>
        )}
      </section>
      <section>
        <h2>Branches</h2>
        <ul>
          {["main", ...Object.keys(s.branches)].map((b) => (
            <li key={b}>
              {b}
              {b === s.branch ? " (here)" : ""}
              {b !== s.branch && (
                <button
                  type="button"
                  className="small"
                  onClick={() => client.send({ type: "switch", branch: b })}
                >
                  switch
                </button>
              )}
              {b !== s.branch && (
                <button
                  type="button"
                  className="small"
                  onClick={() => client.send({ type: "merge", source: b })}
                >
                  merge in
                </button>
              )}
            </li>
          ))}
        </ul>
        <input
          placeholder="new branch name"
          value={forkName}
          onChange={(e) => setForkName(e.target.value)}
        />
        <button
          type="button"
          className="small"
          onClick={() => {
            if (forkName) client.send({ type: "fork", branch: forkName });
            setForkName("");
          }}
        >
          fork
        </button>
        <button
          type="button"
          className="small"
          onClick={() => client.send({ type: "checkpoint", label: "manual" })}
        >
          checkpoint
        </button>
      </section>
      <section>
        <h2>Workspace</h2>
        <ul>
          {Object.keys(s.workspace)
            .sort()
            .map((p) => (
              <li key={p}>
                {p}
                {s.openConflicts.includes(p) ? " ⚠ conflict" : ""}
              </li>
            ))}
        </ul>
      </section>
      <section>
        <h2>Catch up</h2>
        <button type="button" className="small" onClick={() => client.send({ type: "brief" })}>
          generate handoff brief
        </button>
        {brief && <pre className="brief">{brief}</pre>}
      </section>
    </aside>
  );
}
