/**
 * Links that open the app from Slack. Slack only linkifies http(s), so the fold:// links the
 * server puts in notifications are rewritten under the web app's base URL as the client's
 * hash routes (`https://fold.example.com/#/p/<project>/s/<session>`). The desktop and mobile
 * shells open the same routes. Without an `appBaseUrl` nothing is linked.
 */

/** fold://p/<project>/s/<session>, fold://p/<project> and fold://inbox → the client's hash route. */
export function routeOfLink(link: string): string | null {
  const m = link.trim().match(/^fold:\/\/([^?#]*)(?:\?([^#]*))?/i);
  if (!m) return null;
  const parts = (m[1] ?? "").split("/").filter(Boolean);
  const query = m[2] ? `?${m[2]}` : "";
  if (parts[0] === "inbox" && parts.length === 1) return "#/inbox";
  if (parts[0] === "p" && parts[1]) {
    if (parts[2] === "s" && parts[3]) return `#/p/${parts[1]}/s/${parts[3]}${query}`;
    if (parts.length === 2) return `#/p/${parts[1]}`;
  }
  return null;
}

/** The web app URL for a fold:// link, or null without a base URL or for an unknown link. */
export function appUrlOf(link: string, appBaseUrl: string | undefined): string | null {
  const base = appBaseUrl
    ?.trim()
    .replace(/\/?#.*$/, "")
    .replace(/\/+$/, "");
  if (!base) return null;
  const route = routeOfLink(link);
  return route ? `${base}/${route}` : null;
}

/** The fold:// link of a session or a project, as the server's notifications write it. */
export function linkOf(projectId: string, sessionId?: string): string {
  const enc = encodeURIComponent;
  return sessionId
    ? `fold://p/${enc(projectId)}/s/${enc(sessionId)}`
    : `fold://p/${enc(projectId)}`;
}

/** Slack mrkdwn for a link, or "" when there is no URL to point at. */
export function mrkdwnLink(url: string | null, label: string): string {
  return url ? `<${url}|${label.replace(/[<>|]/g, " ")}>` : "";
}
