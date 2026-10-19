/**
 * The inbox: one shared poll of GET /api/notifications per user, read by the sidebar (the
 * count of decisions waiting) and the Inbox view; mark-read; the typed toasts for what just
 * arrived; and the inline actions, which join the session over the websocket, vote or accept,
 * and leave again. Every storage and network call is guarded. The pure parts (the sentence,
 * the kind, the group, the lede) are here too so the row, the toast and the aside agree.
 */
import type { SessionState } from "@henosis/kernel";
import type { SessionEvent } from "@henosis/protocol";
import { useEffect, useSyncExternalStore } from "react";
import { api, type Notification } from "./api.js";
import { HenosisClient, wsUrl } from "./client.js";
import { copy } from "./copy.js";
import { actorOf, type Identity } from "./identity.js";
import { notifyIfHidden } from "./notify.js";
import { paths } from "./router.js";
import { DECISION_KINDS, dismissNotice, type Notice, type NoticeKind, notice } from "./toast.js";

export interface InboxSnapshot {
  userId: string | null;
  items: Notification[];
  /** Decisions waiting (approvals, plans, the baton, contentions, blocks): the badge counts these only. */
  unread: number;
  /** Everything unread, mentions and news included. */
  unreadAll: number;
  error: string | null;
  loaded: boolean;
}

const EMPTY: InboxSnapshot = {
  userId: null,
  items: [],
  unread: 0,
  unreadAll: 0,
  error: null,
  loaded: false,
};
const EVERY_MS = 10_000;

let current: InboxSnapshot = EMPTY;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let interest = 0;
let seen: Set<string> | null = null;

// ---- the grammar, shared by the row, the toast and the banner ----------------------------

/** The kind a row or toast wears: a gated approval is its own crease. */
export function kindOf(n: Notification): NoticeKind {
  if (n.kind === "approval" && n.ratings) return "gate";
  return n.kind;
}

/** Whether something stops until this person acts. */
export function isDecision(n: Notification): boolean {
  return DECISION_KINDS.has(kindOf(n));
}

/** who · verb · what; an older server sends only `title`, which stands in for the sentence. */
export function sentenceOf(n: Notification): { who: string; verb: string; what: string } {
  if (n.who !== undefined && n.what !== undefined)
    return { who: n.who, verb: n.verb ?? "", what: n.what };
  return { who: "", verb: "", what: n.title };
}

/** The body split at its first " · ": where, then what it means for you. */
export function bodyOf(n: Notification): { where: string; forYou: string | null } {
  const at = n.body.indexOf(" · ");
  if (at < 0) return { where: n.body, forYou: null };
  return { where: n.body.slice(0, at), forYou: n.body.slice(at + 3) };
}

export type InboxGroup = "needs-you" | "mentions" | "done";

/** Needs you first (something stops until you act), then mentions, then the quiet rest. */
export function groupOf(n: Notification, acted = false): InboxGroup {
  if (acted || n.read) return "done";
  if (isDecision(n)) return "needs-you";
  if (n.kind === "mention" || n.kind === "search") return "mentions";
  return "done";
}

export type InboxFilter =
  | "needs-you"
  | "mentions"
  | "approvals"
  | "handoffs"
  | "contentions"
  | "done";

export function matchesFilter(n: Notification, f: InboxFilter, acted = false): boolean {
  const g = groupOf(n, acted);
  switch (f) {
    case "needs-you":
      return g === "needs-you";
    case "mentions":
      return n.kind === "mention" || n.kind === "search";
    case "approvals":
      return n.kind === "approval" || n.kind === "plan";
    case "handoffs":
      return n.kind === "handoff";
    case "contentions":
      return n.kind === "contention" || n.kind === "blocked";
    default:
      return g === "done";
  }
}

export const INBOX_FILTERS: InboxFilter[] = [
  "needs-you",
  "mentions",
  "approvals",
  "handoffs",
  "contentions",
  "done",
];

export function filterCounts(
  items: Notification[],
  acted: (n: Notification) => boolean = () => false,
): Record<InboxFilter, number> {
  const out = { "needs-you": 0, mentions: 0, approvals: 0, handoffs: 0, contentions: 0, done: 0 };
  for (const n of items)
    for (const f of INBOX_FILTERS) if (matchesFilter(n, f, acted(n))) out[f] += 1;
  return out;
}

/** "Six things need you. Two wait on a rating, and Ana is holding the baton out." */
export function ledeOf(items: Notification[]): { lead: string; emphasis: string; rest: string } {
  const needs = items.filter((n) => groupOf(n) === "needs-you");
  if (items.length === 0) return { lead: copy.inbox.nothingYet, emphasis: "", rest: "" };
  if (needs.length === 0) return { lead: copy.inbox.nothingNew, emphasis: "", rest: "" };
  const ratings = needs.filter((n) => n.kind === "plan" || (n.kind === "approval" && n.ratings));
  const baton = needs.find((n) => n.kind === "handoff");
  const emphasis = ratings.length ? copy.inbox.ledeRatings(ratings.length) : "";
  const who = baton ? copy.inbox.ledeBaton(sentenceOf(baton).who || "Someone") : "";
  // `rest` carries its own punctuation and follows the emphasis without a space.
  const rest = who
    ? emphasis
      ? `, and ${who}.`
      : ` ${who.charAt(0).toUpperCase() + who.slice(1)}.`
    : emphasis
      ? "."
      : "";
  return { lead: copy.inbox.lede(needs.length), emphasis, rest };
}

/** The aside's "Where things stand". */
export function standOf(
  items: Notification[],
  acted: (n: Notification) => boolean = () => false,
): { onYou: number; onOthers: number; moving: number } {
  let onYou = 0;
  let onOthers = 0;
  let moving = 0;
  for (const n of items) {
    if (groupOf(n, acted(n)) === "needs-you") onYou += 1;
    else if (acted(n) && isDecision(n)) onOthers += 1;
    else if (n.kind === "done" || n.kind === "joined") moving += 1;
  }
  return { onYou, onOthers, moving };
}

/** "6 min ago" from a wall-clock time. */
export function ago(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(at).toLocaleDateString();
}

/** The short mono age for a row: "6 min", "2 h", "3 d". */
export function ageOf(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

/** The toast for an inbox item: the same sentence at the second distance. */
export function noticeOf(n: Notification): Notice {
  const { who, verb, what } = sentenceOf(n);
  const { where, forYou } = bodyOf(n);
  const { projectId, sessionId } = linkOf(n.link);
  const kind = kindOf(n);
  return {
    id: n.id,
    kind,
    who,
    verb,
    what,
    ...(n.code ? { code: n.code } : {}),
    where: n.kind === "mention" || n.kind === "search" ? what : where,
    ...(forYou && n.kind !== "mention" && n.kind !== "search" ? { forYou } : {}),
    ...(n.kind === "mention" || n.kind === "search" ? { quote: n.body } : {}),
    route: n.route ?? linkOf(n.link).href ?? paths.inbox(),
    sticky: DECISION_KINDS.has(kind),
    ...(n.ratings ? { ratings: true } : {}),
    ...(n.ref ? { ref: n.ref } : {}),
    ...(projectId ? { projectId } : {}),
    ...(sessionId ? { sessionId } : {}),
    at: n.at,
  };
}

// ---- the poll ------------------------------------------------------------------------------

function set(patch: Partial<InboxSnapshot>): void {
  const items = patch.items ?? current.items;
  current = {
    ...current,
    ...patch,
    unread: items.filter((n) => !n.read && isDecision(n)).length,
    unreadAll: items.filter((n) => !n.read).length,
  };
  for (const fn of listeners) fn();
}

function hidden(): boolean {
  try {
    return typeof document !== "undefined" && document.hidden;
  } catch {
    return false;
  }
}

/**
 * Fetch the inbox now. New unread items become typed toasts while the tab is in view and
 * browser notifications while it is hidden; "joins the circle" never becomes a banner.
 */
export function refreshInbox(): void {
  const userId = current.userId;
  if (!userId) return;
  api
    .notifications(userId)
    .then((r) => {
      if (current.userId !== userId) return;
      const items = [...r.notifications].sort((a, b) => b.at - a.at);
      if (seen) {
        for (const n of items) {
          if (n.read || seen.has(n.id)) continue;
          if (hidden()) {
            if (n.kind !== "joined") notifyIfHidden(n.title, n.body, n.tag ?? n.id, n.kind);
          } else notice(noticeOf(n));
        }
      }
      // An item answered elsewhere (the session, another device) leaves the corner too.
      for (const n of items) if (n.read) dismissNotice(n.id);
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
  addEventListener("henosis:inbox", refreshInbox);
}

function stop(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  removeEventListener("focus", refreshInbox);
  removeEventListener("henosis:inbox", refreshInbox);
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
  // A mention links into a group chat; it has no project of its own.
  const c = link.match(/^henosis:\/\/c\/([^/?#]+)\/([^/?#]+)/);
  if (c)
    return {
      projectId: "",
      sessionId: null,
      href: paths.chat(decodeURIComponent(c[1] as string), decodeURIComponent(c[2] as string)),
    };
  const m = link.match(/^henosis:\/\/p\/([^/?#]+)(?:\/s\/([^/?#]+))?/);
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
  fn: (client: HenosisClient, state: SessionState) => Promise<T>,
): Promise<T> {
  const client = new HenosisClient();
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
  client: HenosisClient,
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

/**
 * Vote on an approval from the inbox; the words that come back are what the row shows. Under
 * a release gate the approve carries `rating` (the row's stars, or the default).
 */
export async function voteFromInbox(
  identity: Identity,
  n: Pick<Notification, "link" | "ref">,
  vote: "approve" | "deny",
  rating: number | null = null,
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
    client.send({
      type: "vote",
      approvalId,
      vote,
      note: "",
      ...(vote === "approve" && rating !== null ? { rating } : {}),
    });
    await awaitEvent(
      client,
      (e) =>
        e.kind === "approval.voted" &&
        e.payload.approvalId === approvalId &&
        e.actor === identity.userId,
    );
    const after = client.snapshot.state?.approvals[approvalId];
    const word =
      vote === "approve" ? `Approved${rating !== null ? ` · ★ ${rating}` : ""}` : "Denied";
    if (after?.status === "pending") return `${word} · waiting on others`;
    if (after?.status === "granted" && vote === "approve") return `${word} · the gate opened`;
    return word;
  });
}

/** Accept a handoff from the inbox. */
export async function acceptFromInbox(
  identity: Identity,
  n: Pick<Notification, "link" | "ref">,
): Promise<string> {
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
    return "You have the baton";
  });
}

/** Decline a handoff from the inbox ("Not now"). */
export async function declineFromInbox(
  identity: Identity,
  n: Pick<Notification, "link" | "ref">,
): Promise<string> {
  const { projectId, sessionId } = linkOf(n.link);
  if (!sessionId || !n.ref) throw new Error("Open the session to answer this");
  const handoffId = n.ref;
  return inSession(identity, projectId, sessionId, async (client, state) => {
    const h = state.handoffs[handoffId];
    if (!h) return "No longer offered";
    if (h.status !== "pending") return h.status === "accepted" ? "Already accepted" : "Declined";
    client.send({ type: "handoff.decline", handoffId });
    await awaitEvent(
      client,
      (e) => e.kind === "handoff.declined" && e.payload.handoffId === handoffId,
    );
    return "Declined · they keep driving";
  });
}
