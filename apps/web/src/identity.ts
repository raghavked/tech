/** Who is using this browser: a display name, a user id known to users.json and an optional token. */
import type { Actor } from "@henosis/protocol";
import { useSyncExternalStore } from "react";

export interface Identity {
  name: string;
  userId: string;
  token: string;
}

const KEY = "henosis.identity";
const listeners = new Set<() => void>();
let current: Identity | null = readStored();

function readStored(): Identity | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Identity>;
    if (!v.name || !v.userId) return null;
    return { name: v.name, userId: v.userId, token: v.token ?? "" };
  } catch {
    return null;
  }
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function saveIdentity(id: Identity): void {
  current = id;
  try {
    localStorage.setItem(KEY, JSON.stringify(id));
  } catch {
    // Private mode or blocked storage: identity lives for this page only.
  }
  for (const fn of listeners) fn();
}

export function clearIdentity(): void {
  current = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  for (const fn of listeners) fn();
}

/** The identity right now, outside React (the desktop shell reads it in shell.ts). */
export function getIdentity(): Identity | null {
  return current;
}

/** Called after every save or clear; returns the unsubscribe. */
export function onIdentityChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useIdentity(): Identity | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => null,
  );
}

export function actorOf(id: Identity): Actor {
  return { id: id.userId, kind: "human", name: id.name };
}

/** Two-letter initials for an avatar. */
export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
  return (a + b).toUpperCase();
}
