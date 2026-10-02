/**
 * The inbox: one shared poll of GET /api/notifications per user, read by the sidebar (unread
 * count) and the Inbox view; mark-read; and the inline actions, which join the session over the
 * websocket, vote or accept, and leave again. Every storage and network call is guarded.
 */
import type { SessionState } from "@fold/kernel";
import type { SessionEvent } from "@fold/protocol";
import { useEffect, useSyncExternalStore } from "react";
import { api, type Notification } from "./api.js";
import { FoldClient, wsUrl } from "./client.js";
import { actorOf, type Identity } from "./identity.js";
import { notifyIfHidden } from "./notify.js";
import { paths } from "./router.js";

export interface InboxSnapshot {
  userId: string | null;
  items: Notification[];
  unread: number;
  error: string | null;
  loaded: boolean;
}

const EMPTY: InboxSnapshot = { userId: null, items: [], unread: 0, error: null, loaded: false };
const EVERY_MS = 10_000;

let current: InboxSnapshot = EMPTY;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let interest = 0;
let seen: Set<string> | null = null;

function set(patch: Partial<InboxSnapshot>): void {
  current = {
    ...current,
    ...patch,
    unread: (patch.items ?? current.items).filter((n) => !n.read).length,
  };
  for (const fn of listeners) fn();
}

/** Fetch the inbox now; new unread items that arrive while the tab is hidden become browser notifications. */
export function refreshInbox(): void {
  const userId = current.userId;
  if (!userId) return;
  api
    .notifications(userId)
    .then((r) => {
      if (current.userId !== userId) return;
      const items = [...r.notifications].sort((a, b) => b.at - a.at);
      if (seen) {
        for (const n of items)
          if (!n.read && !seen.has(n.id)) notifyIfHidden(n.title, n.body, n.id);
      }
      seen = new Set(items.map((n) => n.id));
      set({ items, error: null, loaded: true });
    })
    .catch((e: unknown) =>
      set({ error: e instanceof Error ? e.message : String(e), loaded: true }),
    );
}

function start(userId: string): void {
  if (current.userId !== userId) {
    seen = null;
    current = { ...EMPTY, userId };
    for (const fn of listeners) fn();
  }
  refreshInbox();
  if (timer) return;
  timer = setInterval(refreshInbox, EVERY_MS);
  addEventListener("focus", refreshInbox);
  addEventListener("fold:inbox", refreshInbox);
}

function stop(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  removeEventListener("focus", refreshInbox);
  removeEventListener("fold:inbox", refreshInbox);
}

/** The inbox for `userId`, polled while any component holds it. */
export function useInbox(userId: string | null): InboxSnapshot {
  const snap = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => EMPTY,
  );
  useEffect(() => {
    if (!userId) return;
    interest += 1;
    start(userId);
    return () => {
      interest -= 1;
      if (interest === 0) stop();
    };
  }, [userId]);
  return userId && snap.userId === userId ? snap : EMPTY;
}

/** Mark items read: locally at once, then on the server. */
export function markRead(ids: string[]): void {
  const userId = current.userId;
  const todo = ids.filter((id) => current.items.some((n) => n.id === id && !n.read));
  if (!userId || todo.length === 0) return;
  set({ items: current.items.map((n) => (todo.includes(n.id) ? { ...n, read: true } : n)) });
  api.markRead(userId, todo).catch(() => undefined);
}

/** The project and session a deep link points at, and the client route for it. */
export function linkOf(link: string): {
  projectId: string;
  sessionId: string | null;
  href: string | null;
} {
  const m = link.match(/^fold:\/\/p\/([^/?#]+)(?:\/s\/([^/?#]+))?/);
  if (!m) return { projectId: "", sessionId: null, href: null };
  const projectId = decodeURIComponent(m[1] as string);
  const sessionId = m[2] ? decodeURIComponent(m[2]) : null;
  return {
    projectId,
    sessionId,
    href: sessionId ? paths.session(projectId, sessionId) : paths.fleet(projectId),
  };
}

// ---- acting from the inbox: join, act, leave --------------------------------------------

const JOIN_MS = 8_000;
const ACT_MS = 5_000;

/** Join a session as this person, run `fn` against its folded state, then leave. */
async function inSession<T>(
  identity: Identity,
  projectId: string,
  sessionId: string,
  fn: (client: FoldClient, state: SessionState) => Promise<T>,
): Promise<T> {
  const client = new FoldClient();
  try {
    const state = await new Promise<SessionState>((resolve, reject) => {
      let opened = false;
      const timer = setTimeout(() => {
        unsub();
        reject(new Error("The session did not answer"));
      }, JOIN_MS);
      const unsub = client.subscribe(() => {
        const s = client.snapshot;
        if (s.connected) opened = true;
        const err = s.errors[s.errors.length - 1];
        if (s.state) {
          clearTimeout(timer);
          unsub();
          resolve(s.state);
        } else if (err || (opened && !s.connected)) {
          clearTimeout(timer);
          unsub();
          reject(new Error(err ?? "Connection closed"));
        }
      });
      client.connect(wsUrl(), {
        sessionId,
        actor: actorOf(identity),
        userId: identity.userId,
        projectId,
        title: sessionId,
        ...(identity.token ? { token: identity.token } : {}),
      });
    });
    return await fn(client, state);
  } finally {
    client.disconnect();
  }
}

/** Resolve with the first live event `match` accepts, or reject on a server error or timeout. */
function awaitEvent(
  client: FoldClient,
  match: (e: SessionEvent) => boolean,
): Promise<SessionEvent> {
  return new Promise((resolve, reject) => {
    const seenErrors = client.snapshot.errors.length;
    const offs: (() => void)[] = [];
    const done = (fn: () => void) => {
      for (const off of offs) off();
      fn();
    };
    const timer = setTimeout(
      () => done(() => reject(new Error("No answer from the session"))),
      ACT_MS,
    );
    offs.push(() => clearTimeout(timer));
    offs.push(
      client.onLiveEvent((e) => {
        if (match(e)) done(() => resolve(e));
      }),
    );
    offs.push(
      client.subscribe(() => {
        const errs = client.snapshot.errors;
        if (errs.length > seenErrors)
          done(() => reject(new Error(errs[errs.length - 1] ?? "error")));
      }),
    );
  });
}

/** Vote on an approval from the inbox; the words that come back are what the row shows. */
export async function voteFromInbox(
  identity: Identity,
  n: Notification,
  vote: "approve" | "deny",
): Promise<string> {
  const { projectId, sessionId } = linkOf(n.link);
  if (!sessionId || !n.ref) throw new Error("Open the session to vote on this");
  const approvalId = n.ref;
  return inSession(identity, projectId, sessionId, async (client, state) => {
    const a = state.approvals[approvalId];
    if (!a) return "No longer pending";
    if (a.status !== "pending")
      return a.status === "granted" ? "Already approved" : "Already denied";
    if (a.votes[identity.userId])
      return a.votes[identity.userId] === "approve" ? "You approved" : "You denied";
    client.send({ type: "vote", approvalId, vote });
    await awaitEvent(
      client,
      (e) =>
        e.kind === "approval.voted" &&
        e.payload.approvalId === approvalId &&
        e.actor === identity.userId,
    );
    const after = client.snapshot.state?.approvals[approvalId];
    const word = vote === "approve" ? "Approved" : "Denied";
    if (after?.status === "pending") return `${word} · waiting on others`;
    return word;
  });
}

/** Accept a handoff from the inbox. */
export async function acceptFromInbox(identity: Identity, n: Notification): Promise<string> {
  const { projectId, sessionId } = linkOf(n.link);
  if (!sessionId || !n.ref) throw new Error("Open the session to accept this");
  const handoffId = n.ref;
  return inSession(identity, projectId, sessionId, async (client, state) => {
    const h = state.handoffs[handoffId];
    if (!h) return "No longer offered";
    if (h.status !== "pending") return h.status === "accepted" ? "Already accepted" : "Declined";
    if (h.to !== identity.userId) return "Offered to someone else";
    client.send({ type: "handoff.accept", handoffId });
    await awaitEvent(
      client,
      (e) => e.kind === "handoff.accepted" && e.payload.handoffId === handoffId,
    );
    return "You have the fold";
  });
}
