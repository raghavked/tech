/** The inbox: what needs you, grouped by project, with Approve / Deny / Accept inline. */
import { useMemo, useState } from "react";
import { Shell, type ShellContext } from "../App.js";
import type { Me, Notification } from "../api.js";
import type { Identity } from "../identity.js";
import { acceptFromInbox, linkOf, markRead, useInbox, voteFromInbox } from "../inbox.js";

interface Outcome {
  busy: boolean;
  word: string | null;
  error: string | null;
}

export function Inbox({
  identity,
  me,
  ctx,
}: {
  identity: Identity;
  me: Me | null;
  ctx: ShellContext;
}) {
  const inbox = useInbox(identity.userId);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const groups = useMemo(() => groupByProject(inbox.items), [inbox.items]);
  const nameOf = (projectId: string) =>
    me?.projects.find((p) => p.projectId === projectId)?.name ?? projectId;
  const act = (n: Notification, run: () => Promise<string>) => {
    setOutcomes((o) => ({ ...o, [n.id]: { busy: true, word: null, error: null } }));
    run()
      .then((word) => {
        setOutcomes((o) => ({ ...o, [n.id]: { busy: false, word, error: null } }));
        markRead([n.id]);
        dispatchEvent(new Event("fold:inbox"));
        dispatchEvent(new Event("fold:fleet"));
      })
      .catch((e: unknown) =>
        setOutcomes((o) => ({
          ...o,
          [n.id]: { busy: false, word: null, error: e instanceof Error ? e.message : String(e) },
        })),
      );
  };
  const summary = !inbox.loaded
    ? "Loading…"
    : inbox.items.length === 0
      ? "Nothing has needed you yet."
      : inbox.unread === 0
        ? "Nothing new."
        : `${inbox.unread} new thing${inbox.unread === 1 ? "" : "s"} need${inbox.unread === 1 ? "s" : ""} you.`;

  return (
    <Shell
      ctx={ctx}
      title="Inbox"
      right={
        inbox.unread > 0 ? (
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => markRead(inbox.items.map((n) => n.id))}
          >
            Mark all read
          </button>
        ) : null
      }
    >
      <div className="column page">
        <h1>Inbox</h1>
        <p className="muted">{summary}</p>
        {inbox.error && <p className="small danger">{inbox.error}</p>}
        {groups.map(([projectId, items]) => (
          <section className="group" key={projectId}>
            <h2>{nameOf(projectId)}</h2>
            <div className="list">
              {items.map((n) => (
                <InboxRow
                  key={n.id}
                  n={n}
                  outcome={outcomes[n.id]}
                  onOpen={() => markRead([n.id])}
                  onApprove={() => act(n, () => voteFromInbox(identity, n, "approve"))}
                  onDeny={() => act(n, () => voteFromInbox(identity, n, "deny"))}
                  onAccept={() => act(n, () => acceptFromInbox(identity, n))}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Shell>
  );
}

function InboxRow({
  n,
  outcome,
  onOpen,
  onApprove,
  onDeny,
  onAccept,
}: {
  n: Notification;
  outcome: Outcome | undefined;
  onOpen: () => void;
  onApprove: () => void;
  onDeny: () => void;
  onAccept: () => void;
}) {
  const { sessionId, href } = linkOf(n.link);
  const actionable = Boolean(n.ref && sessionId) && !n.read && !outcome;
  const text = (
    <>
      <span className="t">{n.title}</span>
      <span className="s">
        {n.body} · {ago(n.at)}
      </span>
    </>
  );
  return (
    <div className={`rowitem inbox${n.read ? " read" : ""}`}>
      {href ? (
        <a href={href} onClick={onOpen}>
          {text}
        </a>
      ) : (
        <span className="ellipsis">{text}</span>
      )}
      <span className="actions">
        {outcome?.busy && <span className="small muted">Joining…</span>}
        {outcome?.word && <span className="small muted">{outcome.word}</span>}
        {outcome?.error && <span className="small danger">{outcome.error}</span>}
        {actionable && n.kind === "approval" && (
          <>
            <button type="button" className="btn primary sm" onClick={onApprove}>
              Approve
            </button>
            <button type="button" className="btn sm" onClick={onDeny}>
              Deny
            </button>
          </>
        )}
        {actionable && n.kind === "handoff" && (
          <button type="button" className="btn primary sm" onClick={onAccept}>
            Accept
          </button>
        )}
        {!outcome && !n.read && n.kind !== "approval" && n.kind !== "handoff" && (
          <span className="small muted">New</span>
        )}
      </span>
    </div>
  );
}

/** Newest project first; items newest first inside it. */
function groupByProject(items: Notification[]): [string, Notification[]][] {
  const out = new Map<string, Notification[]>();
  for (const n of [...items].sort((a, b) => b.at - a.at)) {
    const { projectId } = linkOf(n.link);
    const key = projectId || "elsewhere";
    out.set(key, [...(out.get(key) ?? []), n]);
  }
  return [...out.entries()];
}

function ago(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(at).toLocaleDateString();
}
