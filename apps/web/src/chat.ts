/**
 * The sidebar's view of groups and chats: one shared poll of GET /api/chat/:org/unread per
 * organisation the person is in, with unread counts per group. The chat page itself holds a
 * websocket (chatClient.ts); it tells this poll to look again with a "henosis:chat" event
 * after it posts or marks a group read.
 */
import { useEffect, useSyncExternalStore } from "react";
import { api, type ChatGroupRow } from "./api.js";

export interface ChatUnreadSnapshot {
  userId: string | null;
  byOrg: Record<string, { total: number; groups: ChatGroupRow[] }>;
  total: number;
  loaded: boolean;
}

const EMPTY: ChatUnreadSnapshot = { userId: null, byOrg: {}, total: 0, loaded: false };
const EVERY_MS = 10_000;

let current: ChatUnreadSnapshot = EMPTY;
let orgs: string[] = [];
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let interest = 0;

function set(patch: Partial<ChatUnreadSnapshot>): void {
  const byOrg = patch.byOrg ?? current.byOrg;
  current = {
    ...current,
    ...patch,
    byOrg,
    total: Object.values(byOrg).reduce((n, o) => n + o.total, 0),
  };
  for (const fn of listeners) fn();
}

/** Fetch every org's unread rows now. */
export function refreshChatUnread(): void {
  const userId = current.userId;
  if (!userId) return;
  Promise.all(
    orgs.map((org) =>
      api
        .chatUnread(org, userId)
        .then((r) => [org, r] as const)
        .catch(() => [org, { total: 0, groups: [] as ChatGroupRow[] }] as const),
    ),
  ).then((pairs) => {
    if (current.userId !== userId) return;
    const byOrg = Object.fromEntries(pairs);
    // The sidebar is memoised on this snapshot: hand it a new one only when something changed.
    if (current.loaded && JSON.stringify(byOrg) === JSON.stringify(current.byOrg)) return;
    set({ byOrg, loaded: true });
  });
}

function start(userId: string): void {
  if (current.userId !== userId) {
    current = { ...EMPTY, userId };
    for (const fn of listeners) fn();
  }
  refreshChatUnread();
  if (timer) return;
  timer = setInterval(refreshChatUnread, EVERY_MS);
  addEventListener("focus", refreshChatUnread);
  addEventListener("henosis:chat", refreshChatUnread);
}

function stop(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  removeEventListener("focus", refreshChatUnread);
  removeEventListener("henosis:chat", refreshChatUnread);
}

/** Unread rows for the person across `orgIds`, polled while any component holds it. */
export function useChatUnread(orgIds: string[], userId: string | null): ChatUnreadSnapshot {
  const snap = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => EMPTY,
  );
  const key = orgIds.join(",");
  useEffect(() => {
    if (!userId) return;
    orgs = key ? key.split(",") : [];
    interest += 1;
    start(userId);
    if (current.loaded) refreshChatUnread();
    return () => {
      interest -= 1;
      if (interest === 0) stop();
    };
  }, [userId, key]);
  return userId && snap.userId === userId ? snap : EMPTY;
}
