/**
 * The person's workspaces, fetched once and shared by every view that reads them (the first
 * run, Settings, the line under the top row). A write calls `reloadWorkspaces()` and the
 * views follow; `reloadMe()` asks the page to read /api/me again, since a new workspace or an
 * accepted invitation changes the projects a person has.
 */
import { useEffect, useSyncExternalStore } from "react";
import { api, type Me, type Workspace, type WorkspacesResponse } from "./api.js";
import type { Route } from "./router.js";

interface State {
  userId: string | null;
  data: WorkspacesResponse | null;
  error: string | null;
  loading: boolean;
}

let state: State = { userId: null, data: null, error: null, loading: false };
const listeners = new Set<() => void>();
let request = 0;

function set(next: State): void {
  state = next;
  for (const fn of listeners) fn();
}

function load(userId: string): void {
  const mine = ++request;
  set({ ...state, userId, loading: true, ...(state.userId === userId ? {} : { data: null }) });
  api
    .workspaces(userId)
    .then((data) => {
      if (mine === request) set({ userId, data, error: null, loading: false });
    })
    .catch((e: unknown) => {
      if (mine === request)
        set({
          userId,
          data: state.userId === userId ? state.data : null,
          error: e instanceof Error ? e.message : String(e),
          loading: false,
        });
    });
}

/** Read the workspaces again (after one was made, joined, renamed, or its key changed). */
export function reloadWorkspaces(): void {
  if (state.userId) load(state.userId);
}

/** Ask the page to read /api/me again. */
export function reloadMe(): void {
  dispatchEvent(new Event("henosis:me"));
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const read = () => state;

export function useWorkspaces(userId: string | null): State {
  const s = useSyncExternalStore(subscribe, read, read);
  useEffect(() => {
    if (userId && state.userId !== userId) load(userId);
  }, [userId]);
  return userId && s.userId === userId ? s : { userId, data: null, error: null, loading: true };
}

/** The workspace a project belongs to, or null. */
export function workspaceOfProject(
  data: WorkspacesResponse | null,
  projectId: string,
): Workspace | null {
  return (
    data?.workspaces.find((w) => w.teams.some((t) => t.projects.some((p) => p.id === projectId))) ??
    null
  );
}

/** The workspace a team belongs to, or null. */
export function workspaceOfTeam(data: WorkspacesResponse | null, teamId: string): Workspace | null {
  return data?.workspaces.find((w) => w.teams.some((t) => t.id === teamId)) ?? null;
}

/** A date as the settings rows say it: "24 Nov 2026". */
export function shortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** The link a person opens to accept an invitation, on this app's own address. */
export function inviteUrl(token: string): string {
  const { origin, pathname } = location;
  return `${origin}${pathname}#/join/${encodeURIComponent(token)}`;
}

/** Whether a route points inside a workspace the person is in (routes about the person alone always do). */
export function inMyWorkspaces(route: Route, me: Pick<Me, "projects">): boolean {
  switch (route.name) {
    case "session":
    case "fleet":
      return me.projects.some((p) => p.projectId === route.projectId);
    case "management":
      return me.projects.some((p) => p.teamId === route.teamId);
    case "chat":
    case "memory":
      return me.projects.some((p) => p.orgId === route.orgId);
    case "search":
      return route.org === null || me.projects.some((p) => p.orgId === route.org);
    default:
      return true;
  }
}
