/**
 * Search. The sidebar's quick match (sessions by title, owner and goal, team memory after two
 * characters) lives here as pure functions so App.tsx only has to call `matchSession` and
 * render `<MemoryResults>`; the search page (views/Search.tsx) reads the server's
 * `GET /api/search` over sessions, messages, memory, people and agents through
 * `useServerSearch`, and keeps a query with `saveSearch`. Nothing in this file knows about
 * routes beyond `paths`.
 */
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import {
  api,
  type EntryRecord,
  getJson,
  type Me,
  type MemoryFeed,
  type SessionRow,
} from "./api.js";
import { navigate, paths } from "./router.js";
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
      <a className="item mem more" href={paths.search(needle)}>
        Search everything for “{needle}” →
      </a>
    </>
  );
}

/**
 * Keyboard for the search field and the rows under it: Escape clears the query and returns to
 * the field; ArrowDown and ArrowUp move focus through the result links; Enter on a link follows
 * it as any link would, and Enter in the field opens the search page for the query. Attach to
 * the <nav> so it works from the field and from the rows.
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
  const target = e.target as HTMLElement;
  const inField = target === opts.input;
  if (e.key === "Enter" && inField) {
    const q = opts.input?.value.trim() ?? "";
    if (!q) return;
    e.preventDefault();
    navigate(paths.search(q));
    return;
  }
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
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

// ---- the server's search: everything the team keeps --------------------------------------

export type SearchKind = "session" | "message" | "memory" | "person" | "agent";
export const SEARCH_KINDS: readonly SearchKind[] = [
  "session",
  "message",
  "memory",
  "person",
  "agent",
];

export interface SearchHit {
  kind: SearchKind;
  id: string;
  orgId: string;
  title: string;
  where: string;
  snippet: string;
  route: string;
  link: string;
  projectId?: string;
  sessionId?: string;
  groupId?: string;
  who?: string;
  whoKind?: "human" | "agent";
  status?: string | null;
  seq?: number;
  at?: number;
  key?: string;
  entryKind?: string;
  conflict?: boolean;
  attribution?: string;
  role?: string;
  driving?: string;
  ownerId?: string;
  score: number;
}

export interface SearchResult {
  q: string;
  query: { text: string; org?: string; kind?: SearchKind; from?: string; in?: string };
  scope: { orgId: string; orgName: string } | null;
  counts: Record<SearchKind, number>;
  total: number;
  hits: SearchHit[];
  tookMs: number;
  at: number;
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  q: string;
  org?: string;
  at: number;
}

/** The typed filters in a query, the way the page's chips show them. */
export function parseFilters(q: string): {
  text: string;
  filters: { key: string; value: string }[];
} {
  const filters: { key: string; value: string }[] = [];
  const words: string[] = [];
  for (const m of q.matchAll(/(\w+):("([^"]*)"|(\S+))|(\S+)/g)) {
    const key = m[1]?.toLowerCase();
    const value = (m[3] ?? m[4] ?? "").trim();
    if ((key === "from" || key === "in" || key === "kind") && value) filters.push({ key, value });
    else words.push(m[5] ?? m[0]);
  }
  return { text: words.join(" ").trim(), filters };
}

/** The query with one typed filter taken out, or added. */
export function withoutFilter(q: string, key: string, value: string): string {
  const { text, filters } = parseFilters(q);
  return [text, ...filters.filter((f) => !(f.key === key && f.value === value)).map(quoteFilter)]
    .filter(Boolean)
    .join(" ");
}

export function withFilter(q: string, key: string, value: string): string {
  const { text, filters } = parseFilters(q);
  const kept = filters.filter((f) => f.key !== key);
  return [text, ...kept.map(quoteFilter), quoteFilter({ key, value })].filter(Boolean).join(" ");
}

function quoteFilter(f: { key: string; value: string }): string {
  return /\s/.test(f.value) ? `${f.key}:"${f.value}"` : `${f.key}:${f.value}`;
}

export function searchUrl(q: string, org: string | null, kind: SearchKind | "all"): string {
  const p = new URLSearchParams();
  p.set("q", q);
  if (org) p.set("org", org);
  if (kind !== "all") p.set("kind", kind);
  return `/api/search?${p}`;
}

/** Ask the server once the query settles; the previous result stays while the next one loads. */
export function useServerSearch(
  q: string,
  org: string | null,
  kind: SearchKind | "all",
): { result: SearchResult | null; loading: boolean; error: string | null } {
  const [state, setState] = useState<{
    result: SearchResult | null;
    loading: boolean;
    error: string | null;
  }>({ result: null, loading: false, error: null });
  const text = q.trim();
  useEffect(() => {
    if (!text) {
      setState({ result: null, loading: false, error: null });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    const timer = setTimeout(() => {
      getJson<SearchResult>(searchUrl(text, org, kind))
        .then((result) => alive && setState({ result, loading: false, error: null }))
        .catch(
          (e: unknown) =>
            alive &&
            setState((s) => ({
              result: s.result,
              loading: false,
              error: e instanceof Error ? e.message : String(e),
            })),
        );
    }, 180);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [text, org, kind]);
  return state;
}

export async function listSavedSearches(userId: string): Promise<SavedSearch[]> {
  const r = await getJson<{ searches: SavedSearch[] }>(
    `/api/search/saved?user=${encodeURIComponent(userId)}`,
  );
  return r.searches;
}

export async function saveSearch(
  userId: string,
  input: { q: string; org?: string | null; name?: string },
): Promise<SavedSearch[]> {
  const res = await fetch(`/api/search/saved?user=${encodeURIComponent(userId)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      q: input.q,
      ...(input.org ? { org: input.org } : {}),
      ...(input.name ? { name: input.name } : {}),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { searches?: SavedSearch[]; error?: string };
  if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  return body.searches ?? [];
}

export async function forgetSearch(userId: string, id: string): Promise<SavedSearch[]> {
  const res = await fetch(
    `/api/search/saved/${encodeURIComponent(id)}?user=${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
  const body = (await res.json().catch(() => ({}))) as { searches?: SavedSearch[] };
  return body.searches ?? [];
}

/** How many rows of a kind the All tab shows before "Show all N →" (SCREENS.md §27). */
export const PER_KIND = 3;

export interface HitGroup {
  kind: SearchKind;
  /** The rows shown: the first `perKind` on All, every row on a kind's own tab. */
  rows: SearchHit[];
  /** How many hits the kind has in all, the count the group head and the tab carry. */
  all: number;
}

/**
 * "All" is a group cut, not a ranked list with kind pills (settled, BACKLOG.md L7): every kind
 * in the tab order as a short group of its first `perKind` rows in `hits`' order, with the
 * kind's full count beside it; a kind's own tab shows every row. Kinds with nothing stay out.
 */
export function groupHits(
  hits: readonly SearchHit[],
  tab: SearchKind | "all",
  perKind = PER_KIND,
): HitGroup[] {
  const kinds = tab === "all" ? SEARCH_KINDS : [tab];
  return kinds
    .map((kind) => {
      const rows = hits.filter((h) => h.kind === kind);
      return { kind, rows: tab === "all" ? rows.slice(0, perKind) : rows, all: rows.length };
    })
    .filter((g) => g.rows.length > 0);
}

/** The "why" under a group head: human 6 · agent 5 for messages, the kind's one line otherwise. */
export function whyOf(kind: SearchKind, hits: SearchHit[], fallback: string): string {
  if (kind !== "message") return fallback;
  const human = hits.filter((h) => h.whoKind === "human").length;
  const agent = hits.length - human;
  return `human ${human} · agent ${agent}`;
}

/** Said by: people and agents in one list, with how often each appears. */
export function saidBy(hits: SearchHit[]): { who: string; agent: boolean; n: number }[] {
  const out = new Map<string, { who: string; agent: boolean; n: number }>();
  for (const h of hits) {
    if (!h.who || h.kind === "person" || h.kind === "agent") continue;
    const cur = out.get(h.who) ?? { who: h.who, agent: h.whoKind === "agent", n: 0 };
    cur.n += 1;
    out.set(h.who, cur);
  }
  return [...out.values()].sort((a, b) => b.n - a.n || a.who.localeCompare(b.who));
}

/** Where: the places hits live, with counts. */
export function whereOf(hits: SearchHit[]): { place: string; n: number }[] {
  const out = new Map<string, number>();
  for (const h of hits) {
    const place = h.where.replace(/^(in|to the team in)\s+/, "");
    if (!place) continue;
    out.set(place, (out.get(place) ?? 0) + 1);
  }
  return [...out.entries()]
    .map(([place, n]) => ({ place, n }))
    .sort((a, b) => b.n - a.n || a.place.localeCompare(b.place));
}
