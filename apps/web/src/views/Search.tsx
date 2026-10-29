/**
 * Search (#/search?q=): one query across everything the team keeps, on a page. The query bar
 * is the one glowing surface with the scope chip and the live filters as chips; kind tabs
 * carry mono counts that add up; "All" shows every kind as a short group with its own why and
 * a "Show all"; one `.hit` row for every kind; the refine column answers the next question
 * (who said it, where) and ends with "Keep this search".
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Shell, type ShellContext } from "../App.js";
import type { Me } from "../api.js";
import { moveCursor } from "../approvalsQueue.js";
import { copy } from "../copy.js";
import { ageOf } from "../inbox.js";
import { Highlight } from "../palette.js";
import { navigate, paths } from "../router.js";
import {
  forgetSearch,
  groupHits,
  type HitGroup,
  listSavedSearches,
  parseFilters,
  type SavedSearch,
  SEARCH_KINDS,
  type SearchHit,
  type SearchKind,
  saidBy,
  saveSearch,
  useServerSearch,
  whereOf,
  whyOf,
  withFilter,
  withoutFilter,
} from "../search.js";
import { isTyping, type TargetLike } from "../shortcuts.js";
import { Avatar, ICONS, Icon, Loader, Mark, Status } from "../ui.js";

type Tab = SearchKind | "all";
const TABS: Tab[] = ["all", ...SEARCH_KINDS];

export function Search({
  q: initial,
  org: routeOrg,
  me,
  ctx,
}: {
  q: string;
  org: string | null;
  me: Me | null;
  ctx: ShellContext;
}) {
  const [q, setQ] = useState(initial);
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<"newest" | "best">("newest");
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [keptError, setKeptError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const userId = ctx.identity?.userId ?? null;
  const org = routeOrg ?? me?.projects[0]?.orgId ?? null;
  const orgName = me?.projects.find((p) => p.orgId === org)?.orgName ?? org ?? "";
  useEffect(() => setQ(initial), [initial]);
  // The address bar carries the query so a search can be shared and kept.
  useEffect(() => {
    const t = setTimeout(() => {
      const want = paths.search(q.trim(), routeOrg);
      if (location.hash !== want.slice(0)) history.replaceState(null, "", want);
    }, 300);
    return () => clearTimeout(t);
  }, [q, routeOrg]);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    listSavedSearches(userId)
      .then((s) => alive && setSaved(s))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [userId]);

  const { result, loading, error } = useServerSearch(q, org, "all");
  const text = parseFilters(q).text;
  const filters = parseFilters(q).filters;
  const hits = useMemo(() => {
    const all = result?.hits ?? [];
    const sorted = [...all].sort((a, b) =>
      sort === "newest"
        ? (b.at ?? 0) - (a.at ?? 0) || (b.seq ?? 0) - (a.seq ?? 0) || b.score - a.score
        : b.score - a.score || (b.seq ?? 0) - (a.seq ?? 0),
    );
    return sorted;
  }, [result, sort]);
  const counts = result?.counts ?? { session: 0, message: 0, memory: 0, person: 0, agent: 0 };
  const total = result?.total ?? 0;
  // All is the group cut (settled, L7): the first three of every kind, each with its full count.
  const groups = useMemo<HitGroup[]>(() => groupHits(hits, tab), [hits, tab]);
  const keys = groups.flatMap((g) => g.rows.map((h) => h.id));
  const cursor = cursorId && keys.includes(cursorId) ? cursorId : (keys[0] ?? null);

  // j/k or the arrows move the cursor, Enter opens, / goes back to the field.
  const latest = useRef({ keys, cursor, hits });
  latest.current = { keys, cursor, hits };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const typing = isTyping(e.target as TargetLike | null);
      const { keys, cursor, hits } = latest.current;
      if (typing && e.target !== field.current) return;
      if (typing && e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") return;
      switch (e.key) {
        case "j":
        case "ArrowDown":
          setCursorId(moveCursor(keys, cursor, 1));
          break;
        case "k":
        case "ArrowUp":
          setCursorId(moveCursor(keys, cursor, -1));
          break;
        case "Enter": {
          const h = hits.find((x) => x.id === cursor);
          if (!h) return;
          navigate(h.route);
          break;
        }
        case "/":
          field.current?.focus();
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    // Capture: the page's own j/k win over the shell's next/previous session.
    addEventListener("keydown", onKey, true);
    return () => removeEventListener("keydown", onKey, true);
  }, []);
  useEffect(() => {
    if (!cursor) return;
    document
      .querySelector(`[data-key="${CSS.escape(cursor)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const kept = saved.some((s) => s.q === q.trim() && (s.org ?? null) === (org ?? null));
  const keep = () => {
    if (!userId || !q.trim()) return;
    setKeptError(null);
    saveSearch(userId, { q: q.trim(), org })
      .then(setSaved)
      .catch((e: unknown) => setKeptError(e instanceof Error ? e.message : String(e)));
  };
  const forget = (id: string) => {
    if (!userId) return;
    forgetSearch(userId, id)
      .then(setSaved)
      .catch(() => undefined);
  };
  const said = saidBy(hits);
  const places = whereOf(hits);
  const maxSaid = said[0]?.n ?? 1;

  return (
    <Shell
      ctx={ctx}
      title={
        <>
          {copy.search.title}
          <span className="crumb">
            {orgName ? `${orgName} · ` : ""}
            {copy.search.subtitle}
          </span>
        </>
      }
    >
      <div className="column page wide searchpage">
        <label className="qbar">
          <Icon d={ICONS.search} size={20} />
          <input
            ref={field}
            className="field"
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder={copy.search.placeholder}
            aria-label={copy.search.title}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursorId(null);
            }}
          />
          {orgName && (
            <span className="scope">
              {copy.search.in("")}
              <span className="serif">{orgName}</span>
            </span>
          )}
          {q && (
            <button
              type="button"
              className="clear"
              aria-label={copy.search.clear}
              onClick={() => {
                setQ("");
                field.current?.focus();
              }}
            >
              <Icon d={ICONS.close} size={13} />
            </button>
          )}
        </label>
        <div className="filters">
          {filters.map((f) => (
            <span className="chip" key={`${f.key}:${f.value}`}>
              <span className="k">{f.key}</span>
              <b>{f.value}</b>
              <button
                type="button"
                className="x"
                aria-label={`Remove ${f.key}:${f.value}`}
                onClick={() => setQ(withoutFilter(q, f.key, f.value))}
              >
                <Icon d={ICONS.close} size={10} />
              </button>
            </span>
          ))}
          <span className="syntax">
            {copy.search.tryHint} <code>from:bo</code> <code>in:#billing</code>{" "}
            <code>kind:messages</code>
          </span>
        </div>
        <div className="tabs" role="tablist" aria-label="Kind">
          {TABS.map((t) => {
            const n = t === "all" ? total : counts[t];
            return (
              <button
                type="button"
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={`tab${tab === t ? " on" : ""}${n === 0 && result ? " zero" : ""}`}
                onClick={() => setTab(t)}
              >
                {copy.search.kinds[t]}
                <span className="n">{n}</span>
              </button>
            );
          })}
          {result && (
            <span className="sum">
              {copy.search.results(total, (result.tookMs / 1000).toFixed(2))}
              <button
                type="button"
                className="sort"
                onClick={() => setSort(sort === "newest" ? "best" : "newest")}
              >
                {sort === "newest" ? copy.search.newestFirst : copy.search.bestFirst}
                <Icon d={ICONS.down} size={12} />
              </button>
            </span>
          )}
        </div>
        <div className="sbody">
          <div className="results">
            {error && <p className="small danger">{error}</p>}
            {!q.trim() && (
              <div className="nohits">
                <Mark size={44} />
                <p className="muted">{copy.search.empty}</p>
              </div>
            )}
            {q.trim() && loading && !result && (
              <Loader kind="shimmer" label={copy.loading} rows={4} title />
            )}
            {result && q.trim() && groups.length === 0 && !loading && (
              <div className="nohits">
                <Mark size={44} />
                <span className="serif">{copy.search.nothing}</span>
                <p className="muted">{copy.search.nothingSub}</p>
              </div>
            )}
            {groups.map((g) => (
              <section
                className={`group${g.kind === "person" || g.kind === "agent" ? " two-up" : ""}`}
                key={g.kind}
              >
                <div className="head">
                  <h2>{copy.search.kinds[g.kind]}</h2>
                  <span className="n mono">{g.all}</span>
                  <span className="why">
                    {whyOf(
                      g.kind,
                      hits.filter((h) => h.kind === g.kind),
                      copy.search.why[g.kind] ?? "",
                    )}
                  </span>
                  {tab === "all" && g.all > g.rows.length && (
                    <button type="button" className="all" onClick={() => setTab(g.kind)}>
                      {copy.search.showAll(g.all)}
                    </button>
                  )}
                </div>
                <div className="list">
                  {g.rows.map((h) => (
                    <Hit
                      key={h.id}
                      h={h}
                      needle={text}
                      on={h.id === cursor}
                      now={result?.at ?? Date.now()}
                      onFocus={() => setCursorId(h.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
          <aside className="refine">
            {said.length > 0 && (
              <div>
                <h3>{copy.search.saidBy}</h3>
                {said.slice(0, 8).map((s) => (
                  <button
                    type="button"
                    key={s.who}
                    className="facet"
                    onClick={() => setQ(withFilter(q, "from", s.who))}
                  >
                    <span className={`avatar xs${s.agent ? " agent" : ""}`}>
                      {s.agent ? "" : s.who.slice(0, 2)}
                    </span>
                    <span className="lab serif">{s.who}</span>
                    <span className="bar">
                      <i style={{ width: `${Math.round((s.n / maxSaid) * 100)}%` }} />
                    </span>
                    <span className="n">{s.n}</span>
                  </button>
                ))}
              </div>
            )}
            {places.length > 0 && (
              <div>
                <h3>{copy.search.where}</h3>
                {places.slice(0, 8).map((p) => (
                  <button
                    type="button"
                    key={p.place}
                    className="facet"
                    onClick={() => setQ(withFilter(q, "in", p.place))}
                  >
                    <span className="lab">{p.place}</span>
                    <span className="n">{p.n}</span>
                  </button>
                ))}
              </div>
            )}
            {saved.length > 0 && (
              <div>
                <h3>{copy.search.saved}</h3>
                <div className="recent">
                  {saved.map((s) => (
                    <span className="chip" key={s.id}>
                      <a href={paths.search(s.q, s.org ?? null)}>{s.name}</a>
                      <button
                        type="button"
                        className="x"
                        aria-label={`${copy.search.forget} ${s.name}`}
                        onClick={() => forget(s.id)}
                      >
                        <Icon d={ICONS.close} size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {userId && q.trim() && (
              <div className="save">
                <span className="t">{copy.search.keep}</span>
                <p>{copy.search.keepSub}</p>
                <button type="button" className="btn sm" disabled={kept} onClick={keep}>
                  {kept ? copy.search.kept : copy.search.keep}
                </button>
                {keptError && <p className="small danger">{keptError}</p>}
              </div>
            )}
          </aside>
        </div>
      </div>
    </Shell>
  );
}

function Hit({
  h,
  needle,
  on,
  now,
  onFocus,
}: {
  h: SearchHit;
  needle: string;
  on: boolean;
  now: number;
  onFocus: () => void;
}) {
  const lead =
    h.kind === "person" ? (
      <Avatar id={h.title} name={h.title} />
    ) : h.kind === "agent" || h.whoKind === "agent" ? (
      <span className="avatar agent" aria-hidden="true" />
    ) : h.kind === "message" && h.who ? (
      <Avatar id={h.who} name={h.who} />
    ) : (
      <Icon
        d={h.kind === "memory" ? ICONS.memory : h.kind === "session" ? ICONS.columns : ICONS.file}
        size={18}
      />
    );
  return (
    <a
      className={`hit${on ? " on" : ""}`}
      href={h.route}
      data-key={h.id}
      aria-current={on ? "true" : undefined}
      onMouseEnter={onFocus}
      onFocus={onFocus}
    >
      <span className="lead">{lead}</span>
      <span className="hmain">
        <span className="t">
          <Highlight text={h.title} needle={needle} className="name" />
          {h.where && <span className="in">{h.where}</span>}
        </span>
        {h.snippet && (
          <span className="snip">
            <Highlight text={h.snippet} needle={needle} />
          </span>
        )}
        {(h.attribution || h.driving || h.role) && (
          <span className="by">
            {h.attribution ?? (h.driving ? copy.search.driving(h.driving) : h.role)}
          </span>
        )}
      </span>
      <span className="right">
        {h.status && (h.kind === "session" || h.kind === "agent") && <Status status={h.status} />}
        {h.entryKind && <span className="pill kind">{h.entryKind}</span>}
        {h.conflict && <span className="pill risk irreversible sm">conflict</span>}
        {h.at && <span className="mono">{ageOf(h.at, now)}</span>}
        <span className="enter">
          <kbd>↵</kbd> {copy.search.open}
        </span>
      </span>
    </a>
  );
}
