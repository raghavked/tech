/**
 * The memory browser (`#/memory/:org`): what the organisation's agents and people have
 * remembered, attributed row by row. A scope switch (org / team / project), conflicts first
 * with both sides, retracted entries greyed, a search field, and the curator's report as a
 * quiet list. Reads GET /api/memory/:org (with the filters in packages/server/src/memoryQuery.ts)
 * and GET /api/memory/:org/curate.
 */
import { useMemo, useRef, useState } from "react";
import { Shell, type ShellContext } from "../App.js";
import {
  api,
  type CuratorReport,
  type EntryRecord,
  type Me,
  type MemoryConflict,
  useFetch,
} from "../api.js";
import { navigate, paths } from "../router.js";
import { ICONS, Icon, shortSha } from "../ui.js";

type Level = "org" | "team" | "project";

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
  const feed = useFetch(
    () => api.memory(orgId, project ? { project } : team ? { team } : {}),
    `${orgId}|${team ?? ""}|${project ?? ""}`,
  );
  const [q, setQ] = useState("");
  const [history, setHistory] = useState(false);

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
  const teamOfProject = (id: string) => refs.find((r) => r.projectId === id)?.teamId;

  const all = feed.data?.entries ?? [];
  const byId = useMemo(() => new Map<string, EntryRecord>(all.map((e) => [e.id, e])), [all]);
  const retractionOf = useMemo(() => {
    const m = new Map<string, EntryRecord>();
    for (const e of all) if (e.kind === "retraction" && e.retracts) m.set(e.retracts, e);
    return m;
  }, [all]);
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

  const conflicts: MemoryConflict[] = (feed.data?.conflicts ?? [])
    .filter((c) => history || !c.resolved)
    .filter((c) => c.entryIds.some((id) => byId.has(id) && matches(byId.get(id) as EntryRecord)))
    .sort((a, b) => Number(a.resolved) - Number(b.resolved) || b.seq - a.seq);
  const inOpenConflict = new Set(conflicts.filter((c) => !c.resolved).flatMap((c) => c.entryIds));
  const rows = all
    .filter((e) => e.kind !== "retraction" && e.kind !== "conflict")
    .filter((e) => history || e.status === "active" || e.status === "retracted")
    .filter((e) => !inOpenConflict.has(e.id))
    .filter(matches)
    .sort((a, b) => b.seq - a.seq);

  const scopeWord = (e: EntryRecord): string => {
    const s = e.scope;
    const base = s.projectId ? projectName(s.projectId) : s.teamId ? teamName(s.teamId) : "org";
    return s.path ? `${base} · ${s.path}` : base;
  };
  const where =
    level === "project" && project
      ? `in ${projectName(project)}`
      : level === "team" && team
        ? `in ${teamName(team)}`
        : `across ${orgName}`;
  const open = conflicts.filter((c) => !c.resolved).length;
  const summary = feed.loading
    ? "Loading…"
    : `${rows.length + inOpenConflict.size} entr${rows.length + inOpenConflict.size === 1 ? "y" : "ies"} ${where}${
        open ? `, ${open} open conflict${open === 1 ? "" : "s"}` : ""
      }${needle ? ` matching “${q.trim()}”` : ""}.`;

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

  return (
    <Shell
      ctx={ctx}
      title="Team memory"
      right={
        <button type="button" className="btn ghost sm" onClick={feed.reload}>
          Refresh
        </button>
      }
    >
      <div className="column page">
        <h1>Team memory</h1>
        <div className="memtools">
          <fieldset className="seg" aria-label="Scope">
            {(["org", "team", "project"] as Level[]).map((l) => (
              <button
                key={l}
                type="button"
                className={level === l ? "on" : ""}
                aria-pressed={level === l}
                disabled={(l === "team" && !teams.length) || (l === "project" && !projects.length)}
                onClick={() => go(l)}
              >
                {l === "org" ? "Org" : l === "team" ? "Team" : "Project"}
              </button>
            ))}
          </fieldset>
          {level === "team" && team && teams.length > 1 && (
            <select
              className="select sm"
              aria-label="Team"
              value={team}
              onChange={(e) => navigate(paths.memory(orgId, { team: e.target.value }))}
            >
              {teams.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}
          {level === "project" && project && projects.length > 1 && (
            <select
              className="select sm"
              aria-label="Project"
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
              {projects.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <label className="search">
            <Icon d={ICONS.search} size={14} />
            <input
              type="search"
              placeholder="Search memory"
              aria-label="Search memory"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={`chip${history ? " on" : ""}`}
            aria-pressed={history}
            title="Include superseded, folded and redacted entries and resolved conflicts"
            onClick={() => setHistory((v) => !v)}
          >
            History
          </button>
        </div>
        <p className="muted">{summary}</p>
        {feed.error && <p className="small danger">{feed.error}</p>}

        {conflicts.length > 0 && (
          <section className="group">
            <h2>Conflicts</h2>
            {conflicts.map((c) => {
              const winner = c.winnerId ? byId.get(c.winnerId) : null;
              return (
                <div className="notice contention" key={c.id}>
                  <span>
                    Two entries disagree on <span className="mono">{c.key}</span>
                    {c.resolved && (
                      <span className="muted">
                        {" "}
                        · resolved
                        {winner ? ` for ${nameOf(winner)}` : ""}
                        {c.note ? ` · ${c.note}` : ""}
                      </span>
                    )}
                    .
                  </span>
                  {c.entryIds.map((id) => {
                    const e = byId.get(id);
                    return e ? (
                      <div className="memline conflict" key={id}>
                        <span>
                          {e.key && <span className="mono muted">{e.key} </span>}
                          {e.content}
                        </span>
                        <span className="small faint">{addedBy(e)}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              );
            })}
          </section>
        )}

        <section className="group">
          <h2>Entries</h2>
          {rows.length === 0 && !feed.loading && (
            <p className="muted">
              {needle
                ? "Nothing matches."
                : all.length
                  ? "Nothing here at this scope."
                  : "Nothing remembered yet."}
            </p>
          )}
          <div className="list quiet">
            {rows.map((e) => {
              const r = retractionOf.get(e.id);
              const note =
                e.status === "retracted"
                  ? `retracted${r ? ` by ${nameOf(r)}` : ""}${r?.reason ? `: ${r.reason}` : ""}`
                  : e.status === "redacted"
                    ? "redacted"
                    : e.status === "superseded"
                      ? "superseded"
                      : e.status === "folded"
                        ? "folded into a summary"
                        : null;
              const show = level !== "project" || Boolean(e.scope.path);
              return (
                <EntryRow
                  key={e.id}
                  e={e}
                  scope={show ? scopeWord(e) : null}
                  note={note}
                  gone={e.status === "retracted" || e.status === "redacted"}
                  dim={e.status === "superseded" || e.status === "folded"}
                />
              );
            })}
          </div>
        </section>

        <CuratorList orgId={orgId} onRan={feed.reload} />
      </div>
    </Shell>
  );
}

function nameOf(e: EntryRecord): string {
  return e.attribution.userName ?? e.attribution.userId;
}

/** The attribution line on every entry: "added by Ana · session billing-42 · commit 9f3c1a". */
export function addedBy(e: EntryRecord): string {
  const a = e.attribution;
  const parts = [`added by ${nameOf(e)}`];
  if (a.sessionId) parts.push(`session ${a.sessionId}`);
  const sha = shortSha(a.commitSha);
  if (sha) parts.push(`commit ${sha}`);
  return parts.join(" · ");
}

function EntryRow({
  e,
  scope,
  note,
  gone,
  dim,
}: {
  e: EntryRecord;
  scope: string | null;
  note: string | null;
  gone: boolean;
  dim: boolean;
}) {
  const word = e.status !== "active" ? e.status : e.level > 0 ? "summary" : e.kind;
  return (
    <div className={`rowitem memrow${gone ? " gone" : dim ? " dim" : ""}`}>
      <span className="ellipsis">
        <span className="t">
          {e.key && <span className="mono muted">{e.key} </span>}
          {e.content}
        </span>
        <span className="s">
          {addedBy(e)}
          {scope ? ` · ${scope}` : ""}
          {note ? ` · ${note}` : ""}
        </span>
      </span>
      <span className="small muted">{word}</span>
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
    <section className="group">
      <div className="row">
        <h2 className="grow">Curator</h2>
        <button type="button" className="btn ghost sm" disabled={busy} onClick={run}>
          {busy ? "Running…" : report ? "Run again" : "Run"}
        </button>
      </div>
      {error && <p className="small danger">{error}</p>}
      {!report && !error && (
        <p className="muted">
          One pass: fold grown scopes, flag stale agent-written entries, list open conflicts.
        </p>
      )}
      {empty && <p className="muted">Nothing to tidy.</p>}
      {report && (
        <div className="list quiet">
          {report.compacted.map((c) => (
            <div className="rowitem" key={c.summaryId}>
              <span className="ellipsis">
                <span className="t">
                  Folded {c.folded} entries in <span className="mono">{c.scope}</span>
                </span>
                <span className="s">level {c.level}</span>
              </span>
              <span className="small muted">compacted</span>
            </div>
          ))}
          {report.stale.map((s) => (
            <div className="rowitem" key={s.id}>
              <span className="ellipsis">
                <span className="t">
                  <span className="mono">{s.key ?? s.id}</span>
                </span>
                <span className="s">
                  by {s.author} · unread for {s.unreadFor} events
                </span>
              </span>
              <span className="small muted">stale</span>
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
              <span className="small muted">conflict</span>
            </div>
          ))}
          {report.proposedRetractions.map((p) => (
            <div className="rowitem" key={`r-${p.id}`}>
              <span className="ellipsis">
                <span className="t">
                  Retract <span className="mono">{p.id}</span>
                </span>
                <span className="s">{p.reason}</span>
              </span>
              <span className="small muted">proposed</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
