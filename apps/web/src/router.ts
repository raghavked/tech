/** A tiny hash router: `#/`, `#/p/:projectId`, `#/p/:projectId/s/:sessionId`, `#/m/:teamId`, `#/inbox`, `#/approvals`, `#/memory/:orgId`, `#/settings`. */
import { useSyncExternalStore } from "react";

export type Route =
  | { name: "home" }
  | { name: "fleet"; projectId: string }
  | { name: "session"; projectId: string; sessionId: string; title: string | null }
  | { name: "management"; teamId: string }
  | { name: "inbox" }
  | { name: "approvals" }
  | { name: "memory"; orgId: string; team: string | null; project: string | null }
  | { name: "settings" };

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "") || "/";
  const [pathPart = "/", query = ""] = raw.split("?");
  const parts = pathPart.split("/").filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(query);
  if (parts[0] === "p" && parts[1]) {
    if (parts[2] === "s" && parts[3])
      return {
        name: "session",
        projectId: parts[1],
        sessionId: parts[3],
        title: params.get("title"),
      };
    return { name: "fleet", projectId: parts[1] };
  }
  if (parts[0] === "m" && parts[1]) return { name: "management", teamId: parts[1] };
  if (parts[0] === "inbox") return { name: "inbox" };
  if (parts[0] === "memory" && parts[1])
    return {
      name: "memory",
      orgId: parts[1],
      team: params.get("team"),
      project: params.get("project"),
    };
  if (parts[0] === "settings") return { name: "settings" };
  if (parts[0] === "approvals") return { name: "approvals" };
  return { name: "home" };
}

export const paths = {
  home: () => "#/",
  fleet: (projectId: string) => `#/p/${encodeURIComponent(projectId)}`,
  session: (projectId: string, sessionId: string, title?: string) =>
    `#/p/${encodeURIComponent(projectId)}/s/${encodeURIComponent(sessionId)}${
      title ? `?title=${encodeURIComponent(title)}` : ""
    }`,
  management: (teamId: string) => `#/m/${encodeURIComponent(teamId)}`,
  inbox: () => "#/inbox",
  memory: (orgId: string, scope: { team?: string; project?: string } = {}) => {
    const p = new URLSearchParams();
    if (scope.team) p.set("team", scope.team);
    if (scope.project) p.set("project", scope.project);
    const q = p.toString();
    return `#/memory/${encodeURIComponent(orgId)}${q ? `?${q}` : ""}`;
  },
  settings: () => "#/settings",
  approvals: () => "#/approvals",
};

export function navigate(href: string): void {
  location.hash = href.startsWith("#") ? href.slice(1) : href;
}

const subscribe = (fn: () => void) => {
  addEventListener("hashchange", fn);
  return () => removeEventListener("hashchange", fn);
};
const read = () => location.hash;

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, read, () => "#/");
  return parseHash(hash);
}
