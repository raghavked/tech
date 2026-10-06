/**
 * Deep links, end to end on the client. Every shell hands the web app a `henosis://` link:
 * server notifications carry henosis://p/<project>/s/<session>, the tray opens henosis://inbox,
 * the desktop shell dispatches a "henosis:link" DOM event, Slack posts the same routes under the
 * app's base URL, and a plain browser tab can be opened at /?link=henosis://… .
 *
 * Parsing is pure (no React, no DOM at import time) so it is unit-tested directly; the DOM
 * wiring lives in `connectLinks` and is guarded for environments without a window.
 */

export type HenosisLink =
  | { kind: "session"; projectId: string; sessionId: string; title: string | null }
  | { kind: "project"; projectId: string }
  | { kind: "chat"; orgId: string; groupId: string }
  | { kind: "inbox" };

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Parse a henosis:// link: `henosis://inbox`, `henosis://p/<project>` and
 * `henosis://p/<project>/s/<session>[?title=…]`. Segments after the session (a future
 * `/a/<approvalId>`) are ignored; anything else is null.
 */
export function parseLink(link: string): HenosisLink | null {
  const m = link.trim().match(/^henosis:\/\/([^?#]*)(?:\?([^#]*))?/i);
  if (!m) return null;
  const parts = (m[1] ?? "").split("/").filter(Boolean).map(safeDecode);
  const query = new URLSearchParams(m[2] ?? "");
  if (parts[0] === "inbox" && parts.length === 1) return { kind: "inbox" };
  if (parts[0] === "p" && parts[1]) {
    if (parts[2] === "s" && parts[3])
      return {
        kind: "session",
        projectId: parts[1],
        sessionId: parts[3],
        title: query.get("title"),
      };
    if (parts.length === 2) return { kind: "project", projectId: parts[1] };
  }
  // henosis://c/<org>/<group>: a mention in a group chat.
  if (parts[0] === "c" && parts[1] && parts[2])
    return { kind: "chat", orgId: parts[1], groupId: parts[2] };
  return null;
}

/** The client's hash route for a parsed link. */
export function routeOf(link: HenosisLink): string {
  const enc = encodeURIComponent;
  switch (link.kind) {
    case "inbox":
      return "#/inbox";
    case "project":
      return `#/p/${enc(link.projectId)}`;
    case "chat":
      return `#/c/${enc(link.orgId)}/${enc(link.groupId)}`;
    case "session":
      return `#/p/${enc(link.projectId)}/s/${enc(link.sessionId)}${
        link.title ? `?title=${enc(link.title)}` : ""
      }`;
  }
}

/** Turn a henosis:// deep link into the client's hash route, or null when it is not one. */
export function routeOfLink(link: string): string | null {
  const parsed = parseLink(link);
  return parsed ? routeOf(parsed) : null;
}

/** The henosis:// link for a session, project or the inbox: the inverse of `parseLink`. */
export function linkOf(target: HenosisLink): string {
  const enc = encodeURIComponent;
  switch (target.kind) {
    case "inbox":
      return "henosis://inbox";
    case "project":
      return `henosis://p/${enc(target.projectId)}`;
    case "chat":
      return `henosis://c/${enc(target.orgId)}/${enc(target.groupId)}`;
    case "session":
      return `henosis://p/${enc(target.projectId)}/s/${enc(target.sessionId)}${
        target.title ? `?title=${enc(target.title)}` : ""
      }`;
  }
}

/**
 * The hash route a shell may hand the client on load: `?link=henosis://…` in the query (a
 * browser tab opened from a notification or Slack) or the henosis:// link in place of the hash
 * (`/#henosis://p/x/s/y`). Pure: takes `location.search` and `location.hash`.
 */
export function pendingLinkIn(search: string, hash: string): string | null {
  const fromQuery = new URLSearchParams(search.replace(/^\?/, "")).get("link");
  if (fromQuery) return routeOfLink(fromQuery);
  const raw = safeDecode(hash.replace(/^#/, ""));
  return /^henosis:\/\//i.test(raw) ? routeOfLink(raw) : null;
}

/** Hash routes and henosis:// links alike: the route to navigate to, or null. */
export function routeOfAny(linkOrRoute: unknown): string | null {
  if (typeof linkOrRoute !== "string") return null;
  const s = linkOrRoute.trim();
  if (s.startsWith("#/")) return s;
  if (s.startsWith("/#/")) return s.slice(1);
  return routeOfLink(s);
}

/** Navigate to a henosis:// link or a `#/` hash route. Returns false when it is neither. */
export function openLink(linkOrRoute: unknown): boolean {
  const route = routeOfAny(linkOrRoute);
  if (!route) return false;
  try {
    if (location.hash !== route) location.hash = route;
    else dispatchEvent(new HashChangeEvent("hashchange"));
  } catch {
    return false;
  }
  return true;
}

/** The DOM event a shell dispatches to open a link: `detail` is the link or `{ link }`. */
export const LINK_EVENT = "henosis:link";

/**
 * Route a link given on load, then keep listening for "henosis:link" events. Call once at
 * startup, before React mounts, so the first render already sees the route.
 */
export function connectLinks(): () => void {
  try {
    const pending = pendingLinkIn(location.search, location.hash);
    if (pending) {
      location.hash = pending;
      // Drop ?link=… so a reload does not route again.
      if (location.search)
        history.replaceState(history.state, "", `${location.pathname}${location.hash}`);
    }
  } catch {
    // no window, or history is unavailable
  }
  const onLink = (e: Event) => {
    const detail = (e as CustomEvent<unknown>).detail;
    const link =
      detail && typeof detail === "object" && "link" in detail
        ? (detail as { link: unknown }).link
        : detail;
    openLink(link);
  };
  try {
    addEventListener(LINK_EVENT, onLink);
    return () => removeEventListener(LINK_EVENT, onLink);
  } catch {
    return () => undefined;
  }
}
