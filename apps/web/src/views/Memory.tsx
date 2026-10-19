/**
 * The memory browser (`#/memory/:org`, SCREENS.md §14): what the organisation believes, who said
 * so, in which session, at which commit, and where it disagrees. The scope segment (Org / Team /
 * Project with mono counts) with a picker, search and the History toggle; conflicts first as a
 * two-sided notice with "Keep this" under each side and "read by N sessions" from the per-entry
 * read log; entries as attributed rows with the kind disc; the curator's report last; the aside
 * with the counts, who remembers, and the scope tree. One gradient on the screen: the summary
 * disc and the agents bar are drawn in `--rail` with an apricot edge.
 *
 * Reads GET /api/memory/:org (packages/server/src/memoryQuery.ts) once for the organisation and
 * filters in the page, so the segment's counts cost nothing; Keep and Retract POST in the
 * person's name (Decision 1, who may Keep, is open: anyone signed in may, the curator never).
 */
import type { MemoryRead } from "@henosis/memory";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Shell, type ShellContext } from "../App.js";
import {
  api,
  type CuratorReport,
  type EntryRecord,
  type Me,
  type MemoryConflict,
  useFetch,
} from "../api.js";
import { copy } from "../copy.js";
import { EmptyState } from "../empty.js";
import { navigate, paths } from "../router.js";
import { isTyping } from "../shortcuts.js";
import { Avatar, ICONS, Icon, shortSha, toast } from "../ui.js";

type Level = "org" | "team" | "project";

const HOUR = 3600_000;
const STILL_READ = 7 * 24 * HOUR;

/** The person behind an entry, as the page names them: "Bo", "Ana's agent", "the curator". */
function authorOf(e: EntryRecord): { name: string; agent: boolean; curator: boolean } {
  const a = e.attribution;
  const base = a.userName ?? a.userId;
  if (a.agentId === "curator" || a.userId === "curator")
    return { name: copy.memory.curator, agent: true, curator: true };
  if (a.agentId) return { name: copy.memory.agentOf(base), agent: true, curator: false };
  return { name: base, agent: false, curator: false };
}

/** "added by *Bo* · session invoice-pdf-3 · commit 0c8d44 · Billing page", scope last so it wraps. */
export function Attribution({ e, scope }: { e: EntryRecord; scope: string | null }) {
  const a = e.attribution;
  const who = authorOf(e);
  const sha = shortSha(a.commitSha);
  return (
    <span className="attribution">
      <span>
        {copy.memory.addedBy}
        <span className={`serif${who.agent ? " i" : ""}`}>{who.name}</span>
      </span>
      {a.sessionId && (
        <span>
          {copy.memory.session}
          <span className="mono">{a.sessionId}</span>
        </span>
      )}
      {sha && (
        <span>
          {copy.memory.commit}
          <span className="mono">{sha}</span>
        </span>
      )}
      {scope && <span className="scope">{scope}</span>}
    </span>
  );
}

/** The kind disc: check = decision, lines = rule, i = fact; the curator's summary in `--rail` with an apricot edge. */
function KindDisc({ e }: { e: EntryRecord }) {
  const kind = e.level > 0 || e.kind === "summary" ? "summary" : e.kind;
  return (
    <span className={`kdisc ${kind}`} aria-hidden="true">
      {kind === "decision" && (
        <svg viewBox="0 0 12 12" width="12" height="12">
          <title>{copy.memory.kinds.decision}</title>
          <path
            d="M2.5 6.5l2.5 2.5 4.5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {kind === "convention" && (
        <svg viewBox="0 0 12 12" width="12" height="12">
          <title>{copy.memory.kinds.convention}</title>
          <path
            d="M2.5 4h7M2.5 6.5h7M2.5 9h4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      )}
      {(kind === "fact" || kind === "conflict" || kind === "retraction") && (
        <span className="serif i">i</span>
      )}
      {kind === "summary" && <span className="bead" />}
    </span>
  );
}

export function Memory({
  orgId,
  team,
  project,
  me,
  ctx,
}: {
  orgId: string;
  team: string | null;
  project: string | null;
  me: Me | null;
  ctx: ShellContext;
}) {
  const refs = useMemo(() => (me?.projects ?? []).filter((p) => p.orgId === orgId), [me, orgId]);
  const orgName = refs[0]?.orgName ?? orgId;
  const level: Level = project ? "project" : team ? "team" : "org";
  const feed = useFetch(() => api.memory(orgId), orgId);
  const [q, setQ] = useState("");
  const [history, setHistory] = useState(false);
  const userId = ctx.identity?.userId ?? me?.user?.id ?? null;
  const searchRef = useRef<HTMLInputElement>(null);

  // Teams and projects we can offer: from /api/me, plus any scope the feed has shown us.
  const seen = useRef({ teams: new Map<string, string>(), projects: new Map<string, string>() });
  for (const r of refs) {
    seen.current.teams.set(r.teamId, r.teamName);
    seen.current.projects.set(r.projectId, r.name);
  }
  for (const e of feed.data?.entries ?? []) {
    if (e.scope.teamId && !seen.current.teams.has(e.scope.teamId))
      seen.current.teams.set(e.scope.teamId, e.scope.teamId);
    if (e.scope.projectId && !seen.current.projects.has(e.scope.projectId))
      seen.current.projects.set(e.scope.projectId, e.scope.projectId);
  }
  const teams = [...seen.current.teams.entries()];
  const projects = [...seen.current.projects.entries()];
  const teamName = (id: string) => seen.current.teams.get(id) ?? id;
  const projectName = (id: string) => seen.current.projects.get(id) ?? id;
  const teamOfProject = (id: string) =>
    refs.find((r) => r.projectId === id)?.teamId ??
    feed.data?.entries.find((e) => e.scope.projectId === id)?.scope.teamId;

  const everything = feed.data?.entries ?? [];
  const isShown = (e: EntryRecord) => e.kind !== "retraction" && e.kind !== "conflict";
  const inScope = (e: EntryRecord, lv: Level, t: string | null, p: string | null) =>
    lv === "org" ? true : lv === "team" ? e.scope.teamId === t : e.scope.projectId === p;
  const all = everything.filter((e) => inScope(e, level, team, project));
  const byId = useMemo(
    () => new Map<string, EntryRecord>(everything.map((e) => [e.id, e])),
    [everything],
  );
  const retractionOf = useMemo(() => {
    const m = new Map<string, EntryRecord>();
    for (const e of everything) if (e.kind === "retraction" && e.retracts) m.set(e.retracts, e);
    return m;
  }, [everything]);
  const needle = q.trim().toLowerCase();
  const matches = (e: EntryRecord) =>
    !needle ||
    [
      e.key ?? "",
      e.content,
      ...e.tags,
      e.attribution.userName ?? "",
      e.attribution.userId,
      e.attribution.sessionId ?? "",
      e.attribution.commitSha ?? "",
    ].some((h) => h.toLowerCase().includes(needle));

  const scopeIds = new Set(all.map((e) => e.id));
  const conflicts: MemoryConflict[] = (feed.data?.conflicts ?? [])
    .filter((c) => c.entryIds.some((id) => scopeIds.has(id)))
    .filter((c) => history || !c.resolved)
    .filter((c) => c.entryIds.some((id) => byId.has(id) && matches(byId.get(id) as EntryRecord)))
    .sort((a, b) => Number(a.resolved) - Number(b.resolved) || b.seq - a.seq);
  const inOpenConflict = new Set(conflicts.filter((c) => !c.resolved).flatMap((c) => c.entryIds));
  const rows = all
    .filter(isShown)
    .filter((e) => history || e.status === "active" || e.status === "retracted")
    .filter((e) => !inOpenConflict.has(e.id))
    .filter(matches)
    .sort((a, b) => b.seq - a.seq);
  const activeRows = all.filter(isShown).filter((e) => e.status === "active");
  const counts = {
    org: everything.filter(isShown).filter((e) => e.status === "active").length,
    team: everything
      .filter(isShown)
      .filter(
        (e) =>
          e.status === "active" &&
          inScope(e, "team", team ?? teamOfProject(project ?? "") ?? teams[0]?.[0] ?? null, null),
      ).length,
    project: everything
      .filter(isShown)
      .filter(
        (e) =>
          e.status === "active" && inScope(e, "project", null, project ?? projects[0]?.[0] ?? null),
      ).length,
  };

  const scopeWord = (e: EntryRecord): string => {
    const s = e.scope;
    const base = s.projectId ? projectName(s.projectId) : s.teamId ? teamName(s.teamId) : orgName;
    return s.path ? `${base} · ${s.path}` : base;
  };
  const whereName =
    level === "project" && project
      ? projectName(project)
      : level === "team" && team
        ? teamName(team)
        : orgName;
  const where = level === "org" ? `across ${whereName}` : `in ${whereName}`;
  const openConflicts = conflicts.filter((c) => !c.resolved);
  const staleAfter = 500;
  const headSeq = feed.data?.seq ?? 0;

  // The aside's figures from the per-entry read log (packages/memory/src/state.ts).
  const now = Date.now();
  const stats = (() => {
    let readInLastHour = 0;
    let oldest: { key: string | null; seq: number } | null = null;
    for (const e of all) {
      const log: MemoryRead[] = e.readLog ?? [];
      if (log.some((r) => r.at !== null && r.at >= now - HOUR)) readInLastHour += 1;
      const still =
        e.lastReadAt !== null && e.lastReadAt !== undefined && e.lastReadAt >= now - STILL_READ;
      if (still && e.status === "active" && isShown(e) && (oldest === null || e.seq < oldest.seq))
        oldest = { key: e.key, seq: e.seq };
    }
    return {
      entries: activeRows.length,
      open: openConflicts.length,
      retracted: all.filter((e) => e.status === "retracted").length,
      readInLastHour,
      oldest,
    };
  })();
  const authors = (() => {
    const m = new Map<string, { name: string; agent: boolean; n: number; id: string }>();
    let agents = 0;
    for (const e of activeRows) {
      const who = authorOf(e);
      if (who.curator) continue;
      if (who.agent) agents += 1;
      const id = e.attribution.userId;
      const cur = m.get(id) ?? { name: e.attribution.userName ?? id, agent: false, n: 0, id };
      cur.n += 1;
      m.set(id, cur);
    }
    return {
      people: [...m.values()].sort((a, b) => b.n - a.n).slice(0, 6),
      agents,
      total: activeRows.filter((e) => !authorOf(e).curator).length,
    };
  })();

  const go = (next: Level) => {
    if (next === "org") return navigate(paths.memory(orgId));
    if (next === "team") {
      const t = team ?? teamOfProject(project ?? "") ?? teams[0]?.[0];
      return navigate(paths.memory(orgId, t ? { team: t } : {}));
    }
    const p =
      project ?? refs.find((r) => !team || r.teamId === team)?.projectId ?? projects[0]?.[0];
    return navigate(paths.memory(orgId, p ? { team: teamOfProject(p), project: p } : {}));
  };

  // Keyboard cursor over the entries: j/k move, Enter opens the session it came from, r retracts.
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [retracting, setRetracting] = useState<string | null>(null);
  const ids = rows.map((e) => e.id);
  const cursor = cursorId && ids.includes(cursorId) ? cursorId : (ids[0] ?? null);
  const latest = useRef({ ids, cursor, rows });
  latest.current = { ids, cursor, rows };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/" && !isTyping(e.target as HTMLElement | null)) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (isTyping(e.target as HTMLElement | null)) return;
      const { ids, cursor, rows } = latest.current;
      const i = cursor ? ids.indexOf(cursor) : -1;
      const row = rows.find((r) => r.id === cursor) ?? null;
      switch (e.key) {
        case "j":
        case "ArrowDown":
          setCursorId(ids[Math.min(ids.length - 1, i + 1)] ?? null);
          break;
        case "k":
        case "ArrowUp":
          setCursorId(ids[Math.max(0, i - 1)] ?? null);
          break;
        case "Enter":
        case "o":
          if (row?.scope.projectId && row.attribution.sessionId)
            navigate(paths.session(row.scope.projectId, row.attribution.sessionId));
          else return;
          break;
        case "r":
          if (row && row.status === "active") setRetracting(row.id);
          else return;
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!cursorId) return;
    document
      .querySelector(`[data-key="${CSS.escape(cursorId)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursorId]);

  const fail = (what: string) => (e: unknown) =>
    toast(`${copy.memory.failed(what)}: ${e instanceof Error ? e.message : String(e)}`);
  const keep = (c: MemoryConflict, winnerId: string) => {
    if (!userId) return;
    api.memoryKeep(orgId, userId, c.id, winnerId).then(feed.reload).catch(fail("keep"));
  };
  const retract = (entryId: string, reason: string) => {
    if (!userId) return;
    api
      .memoryRetract(orgId, userId, entryId, reason)
      .then(() => {
        setRetracting(null);
        feed.reload();
      })
      .catch(fail("retract"));
  };

  const lede: ReactNode = feed.loading ? (
    copy.loading
  ) : (
    <>
      {copy.memory.lede(stats.entries, where)}{" "}
      {openConflicts.length > 0 && (
        <span className="serif i">
          {copy.memory.ledeConflict(openConflicts.length, openConflicts[0]?.key ?? "")}
        </span>
      )}
      {needle && <span className="muted"> {copy.memory.ledeMatch(q.trim())}</span>}
    </>
  );

  return (
    <Shell
      ctx={ctx}
      title={
        <>
          <span>{copy.memory.title}</span>
          <span className="faint small"> · {whereName}</span>
        </>
      }
      right={
        <span className="keys small faint">
          <kbd>/</kbd> {copy.memory.keys.search} <kbd>j</kbd>
          <kbd>k</kbd> {copy.memory.keys.move} <kbd>Enter</kbd> {copy.memory.keys.open} <kbd>r</kbd>{" "}
          {copy.memory.keys.retract}
        </span>
      }
    >
      <div className="column page wide">
        <div className="lede">
          <h1>{copy.memory.title}</h1>
          <p className="lede-line">{lede}</p>
        </div>
        <div className="memtools">
          <fieldset className="seg" aria-label={copy.memory.scope}>
            {(["org", "team", "project"] as Level[]).map((l) => (
              <button
                key={l}
                type="button"
                className={level === l ? "on" : ""}
                aria-pressed={level === l}
                disabled={(l === "team" && !teams.length) || (l === "project" && !projects.length)}
                onClick={() => go(l)}
              >
                {copy.memory.scopes[l]} <span className="mono n">{counts[l]}</span>
              </button>
            ))}
          </fieldset>
          {level === "team" && team && teams.length > 1 && (
            <select
              className="select sm"
              aria-label={copy.memory.teamPicker}
              value={team}
              onChange={(e) => navigate(paths.memory(orgId, { team: e.target.value }))}
            >
              {teams.map(([id, nm]) => (
                <option key={id} value={id}>
                  {nm}
                </option>
              ))}
            </select>
          )}
          {level === "project" && project && projects.length > 1 && (
            <select
              className="select sm"
              aria-label={copy.memory.projectPicker}
              value={project}
              onChange={(e) =>
                navigate(
                  paths.memory(orgId, {
                    team: teamOfProject(e.target.value),
                    project: e.target.value,
                  }),
                )
              }
            >
              {projects.map(([id, nm]) => (
                <option key={id} value={id}>
                  {nm}
                </option>
              ))}
            </select>
          )}
          <label className="search">
            <Icon d={ICONS.search} size={14} />
            <input
              ref={searchRef}
              type="search"
              placeholder={copy.memory.searchHint}
              aria-label={copy.memory.searchHint}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <kbd>/</kbd>
          </label>
          <button
            type="button"
            className={`chip${history ? " on" : ""}`}
            aria-pressed={history}
            title={copy.memory.historyHint}
            onClick={() => setHistory((v) => !v)}
          >
            {copy.memory.history}
          </button>
        </div>
        {feed.error && <p className="small danger">{feed.error}</p>}

        <div className="twocol">
          <div className="maincol">
            {conflicts.length > 0 && (
              <section className="group" aria-label={copy.memory.conflicts}>
                <div className="row group-head">
                  <h2>
                    {copy.memory.conflicts}
                    <span className="count-word mono">{conflicts.length}</span>
                  </h2>
                  <span className="small muted">{copy.memory.conflictsLine}</span>
                </div>
                {conflicts.map((c) => (
                  <ConflictCard
                    key={c.id}
                    c={c}
                    byId={byId}
                    retractionOf={retractionOf}
                    scopeWord={scopeWord}
                    canKeep={Boolean(userId)}
                    onKeep={(id) => keep(c, id)}
                  />
                ))}
              </section>
            )}

            <section className="group" aria-label={copy.memory.entries}>
              <div className="row group-head">
                <h2>
                  {copy.memory.entries}
                  <span className="count-word mono">{rows.length}</span>
                </h2>
                <span className="small muted">{copy.memory.entriesLine}</span>
              </div>
              {rows.length === 0 && !feed.loading && needle && (
                <p className="muted">{copy.memory.nothingMatches}</p>
              )}
              {rows.length === 0 && !feed.loading && !needle && all.length > 0 && (
                <p className="muted">{copy.memory.nothingHere}</p>
              )}
              {rows.length === 0 && !feed.loading && !needle && all.length === 0 && (
                <EmptyState
                  spot="memory"
                  title={copy.memoryPage.emptyTitle}
                  text={copy.memoryPage.emptyLine}
                />
              )}
              <div className="list quiet memlist-rows">
                {rows.map((e) => {
                  const r = retractionOf.get(e.id);
                  const who = authorOf(e);
                  const stale =
                    e.status === "active" &&
                    who.agent &&
                    !who.curator &&
                    headSeq - (e.lastReadSeq ?? e.seq) > staleAfter;
                  const show = level !== "project" || Boolean(e.scope.path);
                  return (
                    <EntryRow
                      key={e.id}
                      e={e}
                      scope={show ? scopeWord(e) : null}
                      retraction={r ?? null}
                      stale={stale}
                      cursor={cursor === e.id}
                      retracting={retracting === e.id}
                      canAct={Boolean(userId)}
                      onRetract={() => setRetracting(e.id)}
                      onCancel={() => setRetracting(null)}
                      onConfirm={(reason) => retract(e.id, reason)}
                      onFocus={() => setCursorId(e.id)}
                    />
                  );
                })}
              </div>
            </section>

            <CuratorList orgId={orgId} onRan={feed.reload} />
          </div>

          <aside className="sidecol">
            <section className="card" aria-label={copy.memory.atScope}>
              <span className="kicker">{copy.memory.atScope}</span>
              <dl className="kv">
                <dt>{copy.memory.statEntries}</dt>
                <dd className="mono">{stats.entries}</dd>
                <dt>{copy.memory.statOpen}</dt>
                <dd className={`mono${stats.open ? " warn-ink" : ""}`}>{stats.open}</dd>
                <dt>{copy.memory.statRetracted}</dt>
                <dd className="mono">{stats.retracted}</dd>
                <dt>{copy.memory.statReadHour}</dt>
                <dd className="mono">{stats.readInLastHour}</dd>
                <dt>{copy.memory.statOldest}</dt>
                <dd className="mono ellipsis">
                  {stats.oldest ? (stats.oldest.key ?? `#${stats.oldest.seq}`) : "—"}
                </dd>
              </dl>
            </section>
            <section className="card" aria-label={copy.memory.whoRemembers}>
              <span className="kicker">{copy.memory.whoRemembers}</span>
              {authors.total === 0 && <p className="small muted">{copy.memory.nobodyYet}</p>}
              <ul className="whobars">
                {authors.people.map((p) => (
                  <li key={p.id}>
                    <Avatar id={p.id} name={p.name} />
                    <span className="n ellipsis">{p.name}</span>
                    <span className="mono c">{p.n}</span>
                    <span className="track" aria-hidden="true">
                      <span
                        className="fill"
                        style={{ width: `${(p.n / Math.max(authors.total, 1)) * 100}%` }}
                      />
                    </span>
                  </li>
                ))}
                {authors.agents > 0 && (
                  <li className="agents">
                    <span className="avatar agent initials">A</span>
                    <span className="n">{copy.memory.agentsWord}</span>
                    <span className="mono c">{authors.agents}</span>
                    <span className="track" aria-hidden="true">
                      <span
                        className="fill"
                        style={{ width: `${(authors.agents / Math.max(authors.total, 1)) * 100}%` }}
                      />
                    </span>
                  </li>
                )}
              </ul>
              {authors.agents > 0 && (
                <p className="small serif i muted">
                  {copy.memory.agentsWrote(authors.agents, authors.total)}
                </p>
              )}
            </section>
            <section className="card" aria-label={copy.memory.scopesTree}>
              <span className="kicker">{copy.memory.scopesTree}</span>
              <ul className="scopetree">
                <li className={level === "org" ? "on" : ""}>
                  <a href={paths.memory(orgId)}>{orgName}</a>
                  <span className="mono c">{counts.org}</span>
                </li>
                {teams.map(([tid, tname]) => {
                  const tOpen = (feed.data?.conflicts ?? []).filter(
                    (c) =>
                      !c.resolved && c.entryIds.some((id) => byId.get(id)?.scope.teamId === tid),
                  ).length;
                  const n = everything
                    .filter(isShown)
                    .filter((e) => e.status === "active" && e.scope.teamId === tid).length;
                  return (
                    <li
                      key={tid}
                      className={`team${level === "team" && team === tid ? " on" : ""}`}
                    >
                      <a href={paths.memory(orgId, { team: tid })}>{tname}</a>
                      {tOpen > 0 && <span className="open-word">{copy.memory.openN(tOpen)}</span>}
                      <span className="mono c">{n}</span>
                      <ul>
                        {projects
                          .filter(([pid]) => teamOfProject(pid) === tid)
                          .map(([pid, pname]) => (
                            <li
                              key={pid}
                              className={level === "project" && project === pid ? "on" : ""}
                            >
                              <a href={paths.memory(orgId, { team: tid, project: pid })}>{pname}</a>
                              <span className="mono c">
                                {
                                  everything
                                    .filter(isShown)
                                    .filter(
                                      (e) => e.status === "active" && e.scope.projectId === pid,
                                    ).length
                                }
                              </span>
                            </li>
                          ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </Shell>
  );
}

/**
 * The two-sided conflict (COMPONENTS.md 5.3): `.open` with the amber edge, each side with the
 * author, the quote in serif, session · commit · scope, Keep this and "read by N sessions"; the
 * foot "Both can be wrong · Write the rule yourself"; `.resolved` folded to two lines with the
 * loser struck through and the reason in italic serif.
 */
function ConflictCard({
  c,
  byId,
  retractionOf,
  scopeWord,
  canKeep,
  onKeep,
}: {
  c: MemoryConflict;
  byId: Map<string, EntryRecord>;
  retractionOf: Map<string, EntryRecord>;
  scopeWord: (e: EntryRecord) => string;
  canKeep: boolean;
  onKeep: (winnerId: string) => void;
}) {
  const sides = c.entryIds.map((id) => byId.get(id)).filter((e): e is EntryRecord => Boolean(e));
  const winner = c.winnerId ? byId.get(c.winnerId) : null;
  if (c.resolved) {
    const loser = sides.find((e) => e.id !== c.winnerId);
    const r = loser ? retractionOf.get(loser.id) : null;
    return (
      <div className="conflict resolved">
        <div className="head">
          <span className="kicker ok-ink">{copy.memory.resolvedWord}</span>
          {winner && (
            <span className="small muted">{copy.memory.forWho(authorOf(winner).name)}</span>
          )}
          <span className="mono key">{c.key}</span>
          {(c.note || r?.reason) && (
            <span className="serif i small muted">“{c.note || r?.reason}”</span>
          )}
        </div>
        {winner && (
          <div className="line kept">
            <Who e={winner} />
            <span className="text">{winner.content}</span>
            <span className="small ok-ink">
              <Icon d={ICONS.check} size={12} /> {copy.memory.kept}
            </span>
          </div>
        )}
        {loser && (
          <div className="line lost">
            <Who e={loser} />
            <span className="text struck">{loser.content}</span>
            <span className="small faint">
              {r ? copy.memory.retractedBy(r.attribution.userName ?? r.attribution.userId) : ""}
            </span>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="conflict open">
      <div className="head">
        <span className="kicker warn-ink">{copy.memory.openWord}</span>
        <span>
          {copy.memory.disagreeOn}
          <span className="mono key">{c.key}</span>
        </span>
      </div>
      <div className="sides">
        {sides.map((e) => (
          <div className="side" key={e.id}>
            <Who e={e} />
            <blockquote className="serif quote">“{e.content}”</blockquote>
            <Attribution e={e} scope={scopeWord(e)} />
            <div className="row keep">
              <button
                type="button"
                className="btn primary sm"
                disabled={!canKeep}
                onClick={() => onKeep(e.id)}
              >
                {copy.memory.keepThis}
              </button>
              <span className="small muted">{copy.memory.readBy((e.readBy ?? []).length)}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="foot small">
        {copy.memory.bothWrong}
        <b>{copy.memory.writeRule}</b>
        {copy.memory.writeRuleTail}
      </p>
    </div>
  );
}

function Who({ e }: { e: EntryRecord }) {
  const who = authorOf(e);
  return (
    <span className="who">
      {who.agent ? (
        <span className="avatar agent initials sm">{who.curator ? "C" : "A"}</span>
      ) : (
        <Avatar id={e.attribution.userId} name={who.name} />
      )}
      <span className={`serif${who.agent ? " i" : ""}`}>{who.name}</span>
    </span>
  );
}

function EntryRow({
  e,
  scope,
  retraction,
  stale,
  cursor,
  retracting,
  canAct,
  onRetract,
  onCancel,
  onConfirm,
  onFocus,
}: {
  e: EntryRecord;
  scope: string | null;
  retraction: EntryRecord | null;
  stale: boolean;
  cursor: boolean;
  retracting: boolean;
  canAct: boolean;
  onRetract: () => void;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  onFocus: () => void;
}) {
  const [reason, setReason] = useState("");
  const gone = e.status === "retracted" || e.status === "redacted";
  const dim = e.status === "superseded" || e.status === "folded";
  const summary = e.level > 0 || e.kind === "summary";
  const who = authorOf(e);
  const word =
    e.status !== "active"
      ? copy.memory.states[e.status]
      : stale
        ? copy.memory.states.stale
        : summary
          ? copy.memory.kinds.summary
          : copy.memory.kinds[e.kind];
  const note =
    e.status === "retracted" && retraction
      ? `${copy.memory.retractedBy(retraction.attribution.userName ?? retraction.attribution.userId)}${retraction.reason ? ` · “${retraction.reason}”` : ""}`
      : null;
  const foldedAuthors = summary
    ? e.tags
        .filter((t) => t.startsWith("by:"))
        .map((t) => t.slice(3))
        .join(", ")
    : "";
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the row only moves the keyboard cursor; its buttons are the controls
    <div
      className={`rowitem memrow${gone ? " gone" : dim ? " dim" : ""}${cursor ? " cursor" : ""}${summary ? " summary" : ""}`}
      data-key={e.id}
      aria-current={cursor ? "true" : undefined}
      onFocus={onFocus}
    >
      <KindDisc e={e} />
      <span className="body">
        <span className="t">
          {e.key && <span className="mono key">{e.key}</span>}
          <span className={gone ? "struck" : ""}>{e.content}</span>
        </span>
        <span className="s">
          {summary && who.curator ? (
            <span className="attribution">
              <span>{copy.memory.foldedFrom(e.derivedFrom.length, foldedAuthors || "—")}</span>
              {scope && <span className="scope">{scope}</span>}
            </span>
          ) : (
            <Attribution e={e} scope={scope} />
          )}
          {note && <span className="serif i note"> · {note}</span>}
        </span>
        {retracting && (
          <form
            className="row retractform"
            onSubmit={(ev) => {
              ev.preventDefault();
              onConfirm(reason.trim());
              setReason("");
            }}
          >
            <input
              className="input grow"
              aria-label={copy.memory.retractReason}
              placeholder={copy.memory.retractHint}
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
            />
            <button type="submit" className="btn sm danger">
              {copy.memory.retract}
            </button>
            <button type="button" className="btn ghost sm" onClick={onCancel}>
              {copy.project.cancel}
            </button>
          </form>
        )}
      </span>
      <span className="right">
        <span className="small muted word">{word}</span>
        {cursor && e.status === "active" && canAct && !retracting && (
          <span className="hint small">
            {stale ? (
              <button type="button" className="btn ghost sm" onClick={onRetract}>
                {copy.memory.retract}
              </button>
            ) : (
              copy.memory.cursorHint
            )}
          </span>
        )}
      </span>
    </div>
  );
}

/** The curator's report, on request: compactions, stale entries, open conflicts, proposals. */
function CuratorList({ orgId, onRan }: { orgId: string; onRan: () => void }) {
  const [report, setReport] = useState<CuratorReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true);
    api
      .curate(orgId)
      .then((r) => {
        setReport(r);
        setError(null);
        onRan();
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };
  const empty =
    report &&
    report.compacted.length === 0 &&
    report.stale.length === 0 &&
    report.conflicts.length === 0 &&
    report.proposedRetractions.length === 0;
  return (
    <section className="group" aria-label={copy.memory.curatorTitle}>
      <div className="row group-head">
        <h2 className="grow">{copy.memory.curatorTitle}</h2>
        <span className="small faint">{copy.memory.neverRetracts}</span>
        <button type="button" className="btn ghost sm" disabled={busy} onClick={run}>
          {busy ? copy.memory.running : report ? copy.memory.runAgain : copy.memory.run}
        </button>
      </div>
      {error && <p className="small danger">{error}</p>}
      {!report && !error && <p className="muted">{copy.memory.curatorHint}</p>}
      {empty && <p className="muted">{copy.memory.nothingToTidy}</p>}
      {report && (
        <div className="list quiet">
          {report.compacted.map((c) => (
            <div className="rowitem" key={c.summaryId}>
              <span className="ellipsis">
                <span className="t">
                  {copy.memory.foldedIn(c.folded)}
                  <span className="mono">{c.scope}</span>
                </span>
                <span className="s">{copy.memory.level(c.level)}</span>
              </span>
              <span className="small muted">{copy.memory.compacted}</span>
            </div>
          ))}
          {report.stale.map((s) => (
            <div className="rowitem" key={s.id}>
              <span className="ellipsis">
                <span className="t">
                  <span className="mono">{s.key ?? s.id}</span>
                </span>
                <span className="s">{copy.memory.unreadFor(s.author, s.unreadFor)}</span>
              </span>
              <span className="small muted">{copy.memory.stale}</span>
            </div>
          ))}
          {report.conflicts.map((c) => (
            <div className="rowitem" key={c.id}>
              <span className="ellipsis">
                <span className="t">
                  <span className="mono">{c.key}</span>
                </span>
                <span className="s">
                  {c.entries.map((e) => `${e.author}: ${e.content}`).join(" · ")}
                </span>
              </span>
              <span className="small muted">{copy.memory.conflict}</span>
            </div>
          ))}
          {report.proposedRetractions.map((p) => (
            <div className="rowitem" key={`r-${p.id}`}>
              <span className="ellipsis">
                <span className="t">
                  {copy.memory.proposedRetract}
                  <span className="mono">{p.id}</span>
                </span>
                <span className="s">{p.reason}</span>
              </span>
              <span className="small muted">{copy.memory.proposed}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
