/**
 * Recently opened sessions and rooms, remembered per browser; every storage call is guarded.
 * The desktop shell mirrors them for the tray's Quick open (shell.ts), the last five by name.
 */
import { useSyncExternalStore } from "react";
import { paths } from "./router.js";

export interface Recent {
  projectId: string;
  sessionId: string;
  title: string;
  /** When it was last opened; absent in entries from before the tray's Quick open. */
  at?: number;
}

/** A group chat the person opened (#billing), for Quick open beside the sessions. */
export interface RecentRoom {
  orgId: string;
  groupId: string;
  title: string;
  at: number;
}

const KEY = "henosis.recents";
const ROOMS_KEY = "henosis.recents.rooms";
const MAX = 12;
const listeners = new Set<() => void>();
let current: Recent[] = read();
let rooms: RecentRoom[] = readRooms();

function read(): Recent[] {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(v)) return [];
    return v.filter(
      (r): r is Recent =>
        typeof r === "object" &&
        r !== null &&
        typeof (r as Recent).projectId === "string" &&
        typeof (r as Recent).sessionId === "string",
    );
  } catch {
    return [];
  }
}

function readRooms(): RecentRoom[] {
  try {
    const raw = localStorage.getItem(ROOMS_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(v)) return [];
    return v.filter(
      (r): r is RecentRoom =>
        typeof r === "object" &&
        r !== null &&
        typeof (r as RecentRoom).orgId === "string" &&
        typeof (r as RecentRoom).groupId === "string",
    );
  } catch {
    return [];
  }
}

function store(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private mode: recents live for this page only
  }
}

export function rememberRecent(r: Recent): void {
  const same = (x: Recent) => x.projectId === r.projectId && x.sessionId === r.sessionId;
  const was = current.find(same);
  // the same title again is not a change; a re-open only moves it up when it was not first
  if (was && was.title === r.title && current[0] === was) return;
  const next = [{ ...r, at: r.at ?? Date.now() }, ...current.filter((x) => !same(x))].slice(0, MAX);
  current = next;
  store(KEY, next);
  for (const fn of listeners) fn();
}

export function rememberRoom(r: Omit<RecentRoom, "at"> & { at?: number }): void {
  const same = (x: RecentRoom) => x.orgId === r.orgId && x.groupId === r.groupId;
  const was = rooms.find(same);
  if (was && was.title === r.title && rooms[0] === was) return;
  rooms = [{ ...r, at: r.at ?? Date.now() }, ...rooms.filter((x) => !same(x))].slice(0, MAX);
  store(ROOMS_KEY, rooms);
  for (const fn of listeners) fn();
}

const EMPTY: Recent[] = [];
const NO_ROOMS: RecentRoom[] = [];

export function useRecents(): Recent[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => EMPTY,
  );
}

export function useRecentRooms(): RecentRoom[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => rooms,
    () => NO_ROOMS,
  );
}

/** Sessions and rooms together, newest first, as routes: what the tray's Quick open lists. */
export function recentRoutes(): {
  kind: "session" | "room";
  title: string;
  route: string;
  at: number;
}[] {
  return [
    ...current.map((r) => ({
      kind: "session" as const,
      title: r.title || r.sessionId,
      route: paths.session(r.projectId, r.sessionId),
      at: r.at ?? 0,
    })),
    ...rooms.map((r) => ({
      kind: "room" as const,
      title: r.title || r.groupId,
      route: paths.chat(r.orgId, r.groupId),
      at: r.at,
    })),
  ].sort((a, b) => b.at - a.at);
}

/** Called by the shell bridge: every change to either list. */
export function onRecentsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
