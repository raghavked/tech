/** A tiny hash router: `#/`, `#/p/:projectId`, `#/p/:projectId/s/:sessionId`, `#/m/:teamId`. */
import { useSyncExternalStore } from "react";

export type Route =
  | { name: "home" }
  | { name: "fleet"; projectId: string }
  | { name: "session"; projectId: string; sessionId: string; title: string | null }
  | { name: "management"; teamId: string };

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
