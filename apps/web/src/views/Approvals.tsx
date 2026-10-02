/**
 * The approvals queue (#/approvals): every pending approval across the team's projects as one
 * list of rows. Sessions with something waiting are found through /api/projects/:id/sessions
 * and joined over the websocket, so a vote here is the same vote as in the session, and a
 * decision anywhere collapses the row.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Shell, type ShellContext } from "../App.js";
import { api, type Me, type ProjectRef, type SessionRow } from "../api.js";
import {
  isTyping,
  moveCursor,
  pendingOf,
  type QueueRow,
  rowsOf,
  sortRows,
} from "../approvalsQueue.js";
import { FoldClient, wsUrl } from "../client.js";
import { actorOf, type Identity } from "../identity.js";
import { navigate, paths } from "../router.js";
import { ErrorLine } from "../ui.js";

interface Target {
  ref: ProjectRef;
  row: SessionRow;
}

/** One websocket per session with something to approve; every change bumps one version. */
class Hub {
  readonly joined = new Map<string, { client: FoldClient; ref: ProjectRef; row: SessionRow }>();
  private listeners = new Set<() => void>();
  private version = 0;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  read = () => this.version;
  private bump() {
    this.version += 1;
    for (const fn of this.listeners) fn();
  }
  join(t: Target, identity: Identity): void {
    const key = `${t.ref.projectId}/${t.row.sessionId}`;
    const have = this.joined.get(key);
    if (have) {
      have.row = t.row;
      return;
    }
    const client = new FoldClient();
    client.subscribe(() => this.bump());
    client.connect(wsUrl(), {
      sessionId: t.row.sessionId,
      actor: actorOf(identity),
      userId: identity.userId,
      projectId: t.ref.projectId,
      title: t.row.title || t.row.sessionId,
      ...(identity.token ? { token: identity.token } : {}),
    });
    this.joined.set(key, { client, ref: t.ref, row: t.row });
    this.bump();
  }
  close(): void {
    for (const j of this.joined.values()) j.client.disconnect();
    this.joined.clear();
  }
}

/** Sessions across the given projects that are waiting on an approval; polled like the rail. */
function useTargets(projects: ProjectRef[]): {
  targets: Target[];
  loaded: boolean;
  error: string | null;
} {
  const [state, setState] = useState<{ targets: Target[]; loaded: boolean; error: string | null }>({
    targets: [],
    loaded: false,
    error: null,
  });
  const key = projects.map((p) => p.projectId).join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` names the projects
  useEffect(() => {
    let alive = true;
    const load = () =>
      Promise.all(
        projects.map((ref) =>
          api
            .sessions(ref.projectId)
            .then((rows) => ({ ref, rows, error: null as string | null }))
            .catch((e: unknown) => ({
              ref,
              rows: [] as SessionRow[],
              error: e instanceof Error ? e.message : String(e),
            })),
        ),
      ).then((pairs) => {
        if (!alive) return;
        const targets = pairs.flatMap(({ ref, rows }) =>
          rows.filter((row) => pendingOf(row) > 0).map((row) => ({ ref, row })),
        );
        setState({ targets, loaded: true, error: pairs.find((p) => p.error)?.error ?? null });
      });
    load();
    const soon = setTimeout(load, 1500);
    const every = setInterval(load, 8_000);
    addEventListener("focus", load);
    addEventListener("fold:fleet", load);
    return () => {
      alive = false;
      clearTimeout(soon);
      clearInterval(every);
      removeEventListener("focus", load);
      removeEventListener("fold:fleet", load);
    };
  }, [key]);
  return state;
}

export function Approvals({
  identity,
  me,
  ctx,
}: {
  identity: Identity;
  me: Me | null;
  ctx: ShellContext;
}) {
  const projects = me?.projects ?? [];
  const { targets, loaded, error } = useTargets(projects);
  const hub = useMemo(() => new Hub(), []);
  useEffect(() => () => hub.close(), [hub]);
  useSyncExternalStore(hub.subscribe, hub.read);
  useEffect(() => {
    for (const t of targets) hub.join(t, identity);
  }, [hub, targets, identity]);

  // Rows from every joined session. A decided approval is shown, collapsed, only when it
  // was pending while this page was open; the history of old decisions stays in the session.
  const seenPending = useRef(new Set<string>());
  const all: QueueRow[] = [];
  const errors: string[] = [];
  for (const j of hub.joined.values()) {
    const s = j.client.snapshot.state;
    const last = j.client.snapshot.errors.at(-1);
    if (last) errors.push(`${j.row.title || j.row.sessionId}: ${last}`);
    if (!s) continue;
    all.push(
      ...rowsOf(
        s,
        { projectId: j.ref.projectId, projectName: j.ref.name, fallbackTitle: j.row.title },
        identity.userId,
      ),
    );
  }
  for (const r of all) if (r.status === "pending") seenPending.current.add(r.key);
  const pending = sortRows(all.filter((r) => r.status === "pending"));
  const done = sortRows(
    all.filter((r) => r.status !== "pending" && seenPending.current.has(r.key)),
  );
  const sessionsWaiting = new Set(pending.map((r) => `${r.projectId}/${r.sessionId}`)).size;
  const projectsWaiting = new Set(pending.map((r) => r.projectId)).size;

  const [cursorKey, setCursorKey] = useState<string | null>(null);
  const keys = pending.map((r) => r.key);
  const cursor = cursorKey && keys.includes(cursorKey) ? cursorKey : (keys[0] ?? null);
  const vote = (r: QueueRow, v: "approve" | "deny") =>
    hub.joined
      .get(`${r.projectId}/${r.sessionId}`)
      ?.client.send({ type: "vote", approvalId: r.approvalId, vote: v });

  // j/k move, a/d decide, Enter opens the session. Never while typing somewhere.
  const latest = useRef({ keys, cursor, pending, vote });
  latest.current = { keys, cursor, pending, vote };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const { keys, cursor, pending, vote } = latest.current;
      const row = pending.find((r) => r.key === cursor) ?? null;
      switch (e.key) {
        case "j":
        case "ArrowDown":
          setCursorKey(moveCursor(keys, cursor, 1));
          break;
        case "k":
        case "ArrowUp":
          setCursorKey(moveCursor(keys, cursor, -1));
          break;
        case "a":
          if (row) vote(row, "approve");
          break;
        case "d":
          if (row) vote(row, "deny");
          break;
        case "Enter":
        case "o":
          if (row) navigate(paths.session(row.projectId, row.sessionId));
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!cursor) return;
    document
      .querySelector(`[data-key="${CSS.escape(cursor)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const summary =
    projects.length === 0
      ? me
        ? "No projects are visible to you."
        : "Loading…"
      : !loaded
        ? "Looking across your projects…"
        : pending.length === 0
          ? targets.length === 0
            ? "Nothing is waiting for approval."
            : "Joining the sessions that are waiting…"
          : `${pending.length} approval${pending.length === 1 ? "" : "s"} waiting in ${sessionsWaiting} session${sessionsWaiting === 1 ? "" : "s"} across ${projectsWaiting} project${projectsWaiting === 1 ? "" : "s"}.`;

  return (
    <Shell ctx={ctx} title="Approvals">
      <div className="column page queue">
        <h1>Approvals</h1>
        <p className="muted">{summary}</p>
        {error && <p className="small danger">{error}</p>}
        <ErrorLine errors={errors} />
        <section className="group">
          <div className="list">
            {pending.map((r) => (
              <QueueRowItem
                key={r.key}
                r={r}
                cursor={r.key === cursor}
                onFocus={() => setCursorKey(r.key)}
                onVote={(v) => vote(r, v)}
              />
            ))}
          </div>
          {pending.length > 0 && (
            <p className="small faint">j / k to move · a approves · d denies · Enter opens</p>
          )}
        </section>
        {done.length > 0 && (
          <section className="group">
            <h2>Done</h2>
            <div className="list quiet">
              {done.map((r) => (
                <DoneRow key={r.key} r={r} />
              ))}
            </div>
          </section>
        )}
      </div>
    </Shell>
  );
}

function QueueRowItem({
  r,
  cursor,
  onFocus,
  onVote,
}: {
  r: QueueRow;
  cursor: boolean;
  onFocus: () => void;
  onVote: (v: "approve" | "deny") => void;
}) {
  const voted =
    r.approvedBy.length || r.deniedBy.length
      ? [
          r.approvedBy.length ? `approved by ${r.approvedBy.join(", ")}` : "",
          r.deniedBy.length ? `denied by ${r.deniedBy.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : "no votes yet";
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the row only moves the keyboard cursor; its buttons and link are the controls
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handling lives on the window (j/k/a/d)
    <div
      className={`rowitem queuerow${cursor ? " cursor" : ""}`}
      data-key={r.key}
      aria-current={cursor ? "true" : undefined}
      onClick={onFocus}
    >
      <span className="ellipsis">
        <span className="t">
          {r.agentName} in{" "}
          <a className="serif" href={paths.session(r.projectId, r.sessionId)}>
            {r.sessionTitle}
          </a>{" "}
          wants to {r.action}
        </span>
        <span className="s">
          {r.projectName} · {r.risk} · {voted}
        </span>
      </span>
      <span className="row">
        <span className="status awaiting">needs {r.needs}</span>
        <button
          type="button"
          className="btn sm"
          disabled={r.myVote === "approve"}
          onClick={() => onVote("approve")}
        >
          Approve
        </button>
        <button
          type="button"
          className="btn sm"
          disabled={r.myVote === "deny"}
          onClick={() => onVote("deny")}
        >
          Deny
        </button>
      </span>
    </div>
  );
}

/** A decided row, folded to one quiet line. */
function DoneRow({ r }: { r: QueueRow }) {
  const by = r.status === "granted" ? r.approvedBy : r.deniedBy;
  return (
    <div className="rowitem queuerow done" data-key={r.key}>
      <span className="ellipsis">
        <span className="s">
          {r.status === "granted" ? "Approved" : "Denied"}: {r.action} in{" "}
          <a href={paths.session(r.projectId, r.sessionId)}>{r.sessionTitle}</a>
          {by.length ? ` · ${by.join(", ")}` : ""}
        </span>
      </span>
      <span className="status idle">{r.status === "granted" ? "Approved" : "Denied"}</span>
    </div>
  );
}
