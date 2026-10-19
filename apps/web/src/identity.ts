/**
 * Who is using this browser: a display name, a user id and a token. In dev mode the person
 * types all three (the token is the server's optional shared token) and they live in
 * localStorage. In oidc mode (auth.ts) the token is the provider's ID token: the name and
 * id stay in localStorage, the token itself only in memory and sessionStorage, so it goes
 * when the browser closes and never outlives its expiry here.
 */
import type { Actor } from "@henosis/protocol";
import { useSyncExternalStore } from "react";

export interface Identity {
  name: string;
  userId: string;
  token: string;
  /** Where the identity came from: the dev form (default) or the provider's ID token. */
  provider?: "dev" | "oidc";
  /** oidc: when the ID token expires, in ms since the epoch. */
  expiresAt?: number;
}

const KEY = "henosis.identity";
/** oidc: the ID token, per browser tab session. */
const TOKEN_KEY = "henosis.identity.token";
const listeners = new Set<() => void>();
let current: Identity | null = readStored();

function readStored(): Identity | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Identity>;
    if (!v.name || !v.userId) return null;
    if (v.provider === "oidc") {
      // The token lives in this tab's session only; without it, or past its expiry, the
      // person signs in again.
      const token = sessionStorage.getItem(TOKEN_KEY) ?? "";
      if (!token || (v.expiresAt && v.expiresAt <= Date.now())) return null;
      return {
        name: v.name,
        userId: v.userId,
        token,
        provider: "oidc",
        ...(v.expiresAt ? { expiresAt: v.expiresAt } : {}),
      };
    }
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
    if (id.provider === "oidc") {
      localStorage.setItem(KEY, JSON.stringify({ ...id, token: "" }));
      sessionStorage.setItem(TOKEN_KEY, id.token);
    } else {
      localStorage.setItem(KEY, JSON.stringify(id));
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Private mode or blocked storage: identity lives for this page only.
  }
  for (const fn of listeners) fn();
}

export function clearIdentity(): void {
  current = null;
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
  for (const fn of listeners) fn();
}

/** The identity right now, outside React (the desktop shell reads it in shell.ts). */
export function getIdentity(): Identity | null {
  return current;
}

/** The bearer token to send with a request, when there is one (dev: the shared token; oidc: the ID token). */
export function authHeaders(): Record<string, string> {
  const token = current?.token;
  return token ? { authorization: `Bearer ${token}` } : {};
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
