/**
 * Sidebar search: sessions by title, owner and goal, and, after two characters, team memory.
 * Pure matching lives here so the sidebar in App.tsx only has to call `matchSession` and
 * render `<MemoryResults>`; nothing in this file knows about routes beyond `paths`.
 */
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { api, type EntryRecord, type Me, type MemoryFeed, type SessionRow } from "./api.js";
import { paths } from "./router.js";
import { attribLine } from "./ui.js";

/** How many characters a query needs before memory is searched. */
export const MEMORY_MIN = 2;

/** Lower-cased, trimmed query, or "" when there is nothing to match against. */
export function needleOf(q: string): string {
  return q.trim().toLowerCase();
}

/** Does the session match on title, id, owner (id or name) or goal? An empty needle matches. */
export function matchSession(row: SessionRow, needle: string, ownerName?: string): boolean {
  if (!needle) return true;
  const owner = ownerName ?? row.people.find((p) => p.id === row.ownerId)?.name;
  const fields = [row.title, row.sessionId, row.ownerId, owner, row.report?.goal ?? undefined];
  return fields.some((f) => f?.toLowerCase().includes(needle));
}

/** Memory entries worth showing in search: live facts, decisions, conventions and summaries. */
function searchable(e: EntryRecord): boolean {
  return e.status === "active" && e.kind !== "retraction" && e.kind !== "conflict";
}

/** Does the entry match on its content, key, tags or who added it? */
export function matchEntry(e: EntryRecord, needle: string): boolean {
  if (!needle) return false;
  const a = e.attribution;
  const fields = [e.content, e.key ?? undefined, ...e.tags, a.userName, a.userId, a.sessionId];
  return fields.some((f) => f?.toLowerCase().includes(needle));
}

export interface MemoryHit {
  entry: EntryRecord;
  /** Where the entry is best read: its session, else its project, else its team. */
  href: string;
}

/** Pick a link for an entry from its scope and attribution; falls back to the org's first project. */
export function hrefOfEntry(e: EntryRecord, me: Me | null): string {
  const projectId =
    e.scope.projectId ??
    me?.projects.find(
      (p) => p.orgId === e.scope.orgId && (!e.scope.teamId || p.teamId === e.scope.teamId),
    )?.projectId;
  if (projectId && e.attribution.sessionId)
    return paths.session(projectId, e.attribution.sessionId);
  if (projectId) return paths.fleet(projectId);
  if (e.scope.teamId) return paths.management(e.scope.teamId);
  return paths.home();
}

/** Filter and rank a set of feeds against a needle: newest first, capped. */
export function searchMemory(
  feeds: MemoryFeed[],
  needle: string,
  me: Me | null,
  limit = 8,
): MemoryHit[] {
  if (needle.length < MEMORY_MIN) return [];
  const hits: EntryRecord[] = [];
  for (const f of feeds)
    for (const e of f.entries) if (searchable(e) && matchEntry(e, needle)) hits.push(e);
  hits.sort((a, b) => b.seq - a.seq);
  return hits.slice(0, limit).map((entry) => ({ entry, href: hrefOfEntry(entry, me) }));
}

/**
 * Fetch each org's memory feed once a query is long enough, and keep it while the query stays
 * long enough; clearing the field and typing again fetches afresh, keystrokes do not.
 */
export function useMemorySearch(me: Me | null, needle: string): MemoryHit[] {
  const orgIds = useMemo(
    () => [...new Set((me?.projects ?? []).map((p) => p.orgId))],
    [me?.projects],
  );
  const enabled = needle.length >= MEMORY_MIN && orgIds.length > 0;
  const [feeds, setFeeds] = useState<MemoryFeed[]>([]);
  const orgKey = orgIds.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `orgKey` names the orgs; refetch when a search starts
  useEffect(() => {
    if (!enabled) {
      setFeeds([]);
      return;
    }
    let alive = true;
    Promise.all(orgIds.map((id) => api.memory(id).catch(() => null))).then((fs) => {
      if (alive) setFeeds(fs.filter((f): f is MemoryFeed => f !== null));
    });
    return () => {
      alive = false;
    };
  }, [enabled, orgKey]);
  return useMemo(() => searchMemory(feeds, needle, me), [feeds, needle, me]);
}

/** The "Memory" group under the session lists: quiet rows, content then attribution. */
export function MemoryResults({ hits, needle }: { hits: MemoryHit[]; needle: string }) {
  if (needle.length < MEMORY_MIN) return null;
  return (
    <>
      <div className="section">
        Memory
        <span className="n">{hits.length || ""}</span>
      </div>
      {hits.length === 0 && <p className="item mem faint">Nothing remembered matches.</p>}
      {hits.map((h) => (
        <a key={h.entry.id} className="item mem" href={h.href} title={h.entry.content}>
          <span className="ellipsis">
            {h.entry.key && <span className="mono muted">{h.entry.key} </span>}
            {h.entry.content}
          </span>
          <span className="small faint ellipsis">{attribLine(h.entry)}</span>
        </a>
      ))}
    </>
  );
}

/**
 * Keyboard for the search field and the rows under it: Escape clears the query and returns to
 * the field; ArrowDown and ArrowUp move focus through the result links; Enter on a link follows
 * it as any link would. Attach to the <nav> so it works from the field and from the rows.
 */
export function searchKeys(
  e: KeyboardEvent<HTMLElement>,
  opts: { clear: () => void; input: HTMLInputElement | null; lists: HTMLElement | null },
): void {
  if (e.key === "Escape") {
    opts.clear();
    opts.input?.focus();
    e.preventDefault();
    return;
  }
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const target = e.target as HTMLElement;
  const inField = target === opts.input;
  if (!inField && !opts.lists?.contains(target)) return;
  const links = [...(opts.lists?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [])];
  if (links.length === 0) return;
  const at = links.indexOf(target as HTMLAnchorElement);
  let next: HTMLElement | undefined;
  if (e.key === "ArrowDown") next = at < 0 ? links[0] : links[at + 1];
  else next = at <= 0 ? (opts.input ?? undefined) : links[at - 1];
  if (!next) return;
  e.preventDefault();
  next.focus();
  next.scrollIntoView?.({ block: "nearest" });
}
