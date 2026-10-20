/**
 * The first run on #/: three steps in one column (four in the desktop shell). Who you are,
 * which team, then a session to open or create; on the desktop a fourth step teaches the tray
 * by showing the menu as it is (design/henosis SCREENS.md §19, first-run-desktop). The step
 * marks are the four stages of the mark: a faint ring, one arc, two arcs apart, the closed
 * ring with its centre. Steps already done fold to a line with a check; the demo session is
 * one row away.
 */
import { type ReactNode, useMemo, useState } from "react";
import type { Me, Notification, ProjectRef } from "../api.js";
import { wsUrl } from "../client.js";
import { copy } from "../copy.js";
import {
  DEMO_PROJECT,
  DemoRow,
  EmptyState,
  OfflineState,
  openDemoSession,
  useOnline,
} from "../empty.js";
import { type Identity, slugify } from "../identity.js";
import { useInbox } from "../inbox.js";
import { createSession } from "../projectClient.js";
import { recentRoutes, useRecentRooms, useRecents } from "../recents.js";
import { navigate, paths } from "../router.js";
import { useShellInbox, useShellPlatform } from "../shell.js";
import { requestTourIfNew } from "../tour.js";
import { type TrayItem, trayMenuOf } from "../tray.js";
import { Avatar, ICONS, Icon, Mark, type MarkState } from "../ui.js";

/** The policy fields a new session starts with: plan first (on) and an optional token budget. */
export function PolicyFields({
  planFirst,
  budget,
  onPlanFirst,
  onBudget,
  idPrefix,
}: {
  planFirst: boolean;
  budget: string;
  onPlanFirst: (v: boolean) => void;
  onBudget: (v: string) => void;
  idPrefix: string;
}) {
  return (
    <div className="row small policy-row">
      <label htmlFor={`${idPrefix}-plan-first`} title={copy.home.planFirstHint}>
        <input
          id={`${idPrefix}-plan-first`}
          type="checkbox"
          checked={planFirst}
          onChange={(e) => onPlanFirst(e.target.checked)}
        />
        {copy.home.planFirst}
      </label>
      <label htmlFor={`${idPrefix}-budget`}>
        <span className="muted">{copy.home.tokenBudget}</span>
        <input
          id={`${idPrefix}-budget`}
          className="input sm mono budget"
          type="number"
          min={1}
          inputMode="numeric"
          placeholder={copy.home.tokenBudgetHint}
          value={budget}
          onChange={(e) => onBudget(e.target.value)}
        />
      </label>
    </div>
  );
}

/** What the fields say, as the wire's partial policy. */
export function policyOf(planFirst: boolean, budget: string) {
  const n = Number.parseInt(budget, 10);
  return { planFirst, tokenBudget: Number.isInteger(n) && n > 0 ? n : null };
}

interface Team {
  id: string;
  name: string;
  orgName: string;
  projects: ProjectRef[];
}

const TEAM_KEY = "henosis.team";

function readTeam(): string | null {
  try {
    return localStorage.getItem(TEAM_KEY);
  } catch {
    return null;
  }
}

function rememberTeam(id: string): void {
  try {
    localStorage.setItem(TEAM_KEY, id);
  } catch {
    // private mode: the pick lives for this page only
  }
}

export function groupByTeam(projects: ProjectRef[]): Team[] {
  const teams = new Map<string, Team>();
  for (const p of projects) {
    const t = teams.get(p.teamId) ?? {
      id: p.teamId,
      name: p.teamName,
      orgName: p.orgName,
      projects: [],
    };
    t.projects.push(p);
    teams.set(p.teamId, t);
  }
  return [...teams.values()];
}

/** The four stages of the mark, as step marks: faint ring, one arc, two arcs apart, closed. */
const STAGES: MarkState[] = ["faint", "one-arc", "apart", "closed"];

export function FirstRun({
  identity,
  me,
  meError,
  onRetry,
  identityStep,
}: {
  identity: Identity | null;
  me: Me | null;
  meError: string | null;
  onRetry?: () => void;
  /** The identity form the home page owns; rendered inside step one. */
  identityStep: ReactNode;
}) {
  const teams = useMemo(() => groupByTeam(me?.projects ?? []), [me]);
  const [picked, setPicked] = useState<string | null>(readTeam);
  const team = teams.find((t) => t.id === picked) ?? teams[0] ?? null;
  const online = useOnline();
  const loaded = Boolean(me) || Boolean(meError);
  const pick = (id: string) => {
    setPicked(id);
    rememberTeam(id);
  };
  // The desktop shell adds the one step the web client has no need of: where Henosis waits.
  const platform = useShellPlatform();
  const done = [Boolean(identity), Boolean(identity) && loaded && teams.length > 0, false, false];
  const now = done.indexOf(false);
  const step = (n: number) => ({
    n,
    stage: STAGES[n - 1] ?? "closed",
    done: done[n - 1] ?? false,
    now: now === n - 1,
  });
  return (
    <ol className="firstrun">
      <Step {...step(1)} title="Who you are">
        {identityStep}
      </Step>
      <Step {...step(2)} title="Your team">
        {!identity ? (
          <p className="small faint">Your teams appear once you have a name.</p>
        ) : meError || !online ? (
          <OfflineState online={online} onRetry={onRetry} />
        ) : !me ? (
          <p className="muted">Loading…</p>
        ) : teams.length === 0 ? (
          <EmptyState
            text="No projects for you yet."
            action={{
              label: "Try the demo session",
              onClick: () => openDemoSession(identity.userId),
            }}
          />
        ) : (
          <TeamPick teams={teams} picked={team?.id ?? null} onPick={pick} />
        )}
      </Step>
      <Step {...step(3)} title="A session">
        {!identity ? (
          <p className="small faint">Open one by id, start a new one, or try the demo.</p>
        ) : (
          <OpenSession identity={identity} team={team} />
        )}
      </Step>
      {platform && (
        <Step {...step(4)} title={copy.desktop.trayStep} sub={copy.desktop.trayStepSub}>
          <TrayStep platform={platform} identity={identity} team={team} />
        </Step>
      )}
    </ol>
  );
}

function Step({
  n,
  stage,
  title,
  sub,
  done,
  now,
  children,
}: {
  n: number;
  stage: MarkState;
  title: string;
  sub?: string;
  done: boolean;
  now: boolean;
  children: ReactNode;
}) {
  return (
    <li
      className={`fr-step${done ? " done" : ""}${now ? " now" : ""}`}
      aria-current={now ? "step" : undefined}
    >
      <span className="num" aria-hidden="true" data-step={n}>
        <Mark size={24} state={stage} />
      </span>
      <div className="body">
        <h2>
          {title}
          {done && <Icon d={ICONS.check} size={14} className="ok" />}
        </h2>
        {sub && <p className="small muted sub">{sub}</p>}
        {children}
      </div>
    </li>
  );
}

/** One row per team; the picked one carries a check. Links to its pages sit beneath. */
function TeamPick({
  teams,
  picked,
  onPick,
}: {
  teams: Team[];
  picked: string | null;
  onPick: (id: string) => void;
}) {
  const team = teams.find((t) => t.id === picked) ?? null;
  return (
    <>
      <div className="list">
        {teams.map((t) => {
          const on = t.id === picked;
          return (
            <button
              type="button"
              className={`rowitem pick${on ? " picked" : ""}`}
              key={t.id}
              aria-pressed={on}
              onClick={() => onPick(t.id)}
            >
              <span className="ellipsis">
                <span className="t serif">{t.name}</span>
                <span className="s">
                  {t.orgName} · {t.projects.length} project{t.projects.length === 1 ? "" : "s"}
                </span>
              </span>
              <span className="small muted row">
                {on && <Icon d={ICONS.check} size={14} />}
                {on ? "Chosen" : "Pick"}
              </span>
            </button>
          );
        })}
      </div>
      {team && (
        <p className="small muted">
          {team.projects.map((p) => (
            <span key={p.projectId}>
              <a href={paths.fleet(p.projectId)}>{p.name}</a>
              {" · "}
            </span>
          ))}
          <a href={paths.management(team.id)}>team overview</a>
        </p>
      )}
    </>
  );
}

/** Open by id, start a new one on the project page, or try the demo. */
function OpenSession({ identity, team }: { identity: Identity; team: Team | null }) {
  const projects = team?.projects ?? [];
  const [sessionId, setSessionId] = useState("");
  const [project, setProject] = useState(DEMO_PROJECT);
  const [planFirst, setPlanFirst] = useState(true);
  const [budget, setBudget] = useState("");
  const [opening, setOpening] = useState(false);
  const pid = projects.some((p) => p.projectId === project)
    ? project
    : (projects[0]?.projectId ?? DEMO_PROJECT);
  const projectName = projects.find((p) => p.projectId === pid)?.name ?? pid;
  const demoPid = projects.some((p) => p.projectId === DEMO_PROJECT) ? DEMO_PROJECT : pid;
  return (
    <>
      <div className="list">
        <a className="rowitem new" href={`${paths.fleet(pid)}?new=1`}>
          <span className="row">
            <Icon d={ICONS.plus} size={14} />
            New session
          </span>
          <span className="small faint">in {projectName}</span>
        </a>
        <DemoRow userId={identity.userId} projectId={demoPid} />
      </div>
      <form
        className="row open-session"
        onSubmit={(e) => {
          e.preventDefault();
          const id = slugify(sessionId);
          if (!id || opening) return;
          // The session is created with its policy first; an existing one is left as it is.
          setOpening(true);
          createSession(wsUrl(), {
            projectId: pid,
            userId: identity.userId,
            sessionId: id,
            title: id,
            policy: policyOf(planFirst, budget),
          }).finally(() => {
            setOpening(false);
            // The tour shows once, on the first session a new member opens from here.
            requestTourIfNew();
            navigate(paths.session(pid, id));
          });
        }}
      >
        {projects.length > 1 ? (
          <select
            className="select"
            aria-label="Project"
            value={pid}
            onChange={(e) => setProject(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.name}
              </option>
            ))}
          </select>
        ) : null}
        <input
          className="input mono grow"
          aria-label="Session id"
          placeholder="Open a session by id"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        />
        <button type="submit" className="btn sm" disabled={opening}>
          Open session
        </button>
      </form>
      <PolicyFields
        planFirst={planFirst}
        budget={budget}
        onPlanFirst={setPlanFirst}
        onBudget={setBudget}
        idPrefix="home"
      />
    </>
  );
}

// ---- the desktop's fourth step: the tray, taught by showing it ----------------------------------

/** An inbox row as the tray lists it; older servers send no grammar, so the title stands in. */
function trayItemOf(n: Notification): TrayItem {
  return {
    id: n.id,
    kind: n.kind,
    who: n.who ?? n.title,
    verb: n.verb ?? "",
    what: n.what ?? n.body,
    age: n.age ?? Math.max(0, Math.round((Date.now() - n.at) / 1000)),
    route: n.route ?? "#/inbox",
    ...(n.ratings ? { ratings: true } : {}),
  };
}

/** The tray glyph as the tiles draw it: the ring and its centre; a corner dot when something waits. */
function TrayGlyph({ dot = false, moon = false }: { dot?: boolean; moon?: boolean }) {
  return (
    <svg className={`trayglyph${moon ? " paused" : ""}`} viewBox="0 0 96 96" aria-hidden="true">
      <path d="M48 20 A28 28 0 0 1 48 76" />
      <path d="M48 76 A28 28 0 0 1 48 20" />
      <circle className="c" cx="48" cy="48" r="8" />
      {dot && <circle className="pend" cx="80" cy="18" r="13" />}
    </svg>
  );
}

function TrayStep({
  platform,
  identity,
  team,
}: {
  platform: string;
  identity: Identity | null;
  team: Team | null;
}) {
  const shell = useShellInbox();
  const inbox = useInbox(identity?.userId ?? null);
  // what the shell lists (its poll) or, until it has polled, what the client's own poll has
  const items = shell.items.length
    ? shell.items
    : inbox.items.filter((n) => !n.read).map(trayItemOf);
  useRecents();
  useRecentRooms();
  const menu = trayMenuOf({
    items,
    recents: recentRoutes(),
    name: identity?.name ?? null,
    platform,
    paused: shell.paused,
  });
  const waits = items.filter((i) => i.kind === "approval" || i.kind === "handoff");
  const first = identity?.name.trim().split(/\s+/)[0] ?? "";
  const firstRoute =
    waits[0]?.route ?? (team?.projects[0] ? paths.fleet(team.projects[0].projectId) : null);
  return (
    <div className="traystep">
      <h3 className="serif">{copy.desktop.trayHead(platform)}</h3>
      <p className="muted">{copy.desktop.trayLede}</p>
      <div className="tiles">
        <div className="tile">
          <div className="pic">
            <span className="mini">
              <TrayGlyph /> 14:32
            </span>
          </div>
          <div>
            <b>{copy.desktop.tileQuiet}</b> {copy.desktop.tileQuietText}
          </div>
        </div>
        <div className="tile">
          <div className="pic">
            <span className="mini on">
              <TrayGlyph dot /> 14:32
            </span>
            <span className="dockmini" aria-hidden="true">
              <Mark size={22} cut="bare" ground="navy" />
              <span className="badge">{Math.max(1, waits.length)}</span>
            </span>
          </div>
          <div>
            <b>{copy.desktop.tileDot}</b> {copy.desktop.tileDotText(platform)}
          </div>
        </div>
        <div className="tile">
          <div className="pic">
            <div className="bubble">
              <Mark size={20} />
              <div className="txt">
                <span>
                  <b>
                    {waits[0]
                      ? `${waits[0].who} ${waits[0].verb}`
                      : "Approval · write · medium risk"}
                  </b>
                </span>
                <span className="faint">
                  {waits[0]?.what ?? "Bo's agent · Invoice PDF: tax lines"}
                </span>
              </div>
            </div>
          </div>
          <div>
            <b>{copy.desktop.tileNotice}</b> {copy.desktop.tileNoticeText}
          </div>
        </div>
      </div>

      {/* the tray taught by dropping it open: the menu exactly as the shell has it now */}
      <section className="traymenu" aria-label={copy.desktop.menuAsItIs}>
        <div className="status">{copy.desktop.menuAsItIs}</div>
        {menu.empty && <div className="row disabled">{menu.empty}</div>}
        {menu.sections.map((s) => (
          <div key={s.id} className="section">
            <div className="row head">{s.header}</div>
            {s.rows.map((r) => (
              <a key={r.id} className="row item" href={r.route ?? "#/inbox"}>
                <span className="serif">{r.who}</span> {r.verb}{" "}
                <span className="muted">{r.what}</span>
                <span className="age">{r.age}</span>
              </a>
            ))}
            {s.more && (
              <a className="row more" href={s.more.route ?? "#/inbox"}>
                {s.more.text}
              </a>
            )}
          </div>
        ))}
        <div className="sep" />
        <div className="row sub">
          <span>{copy.desktop.quickOpen}</span>
          <span className="kbd">›</span>
        </div>
        <div className="row sub">
          <span>{menu.pause.label}</span>
          <span className="kbd">›</span>
        </div>
        <div className="sep" />
        <div className="row">
          <span>{menu.open.label}</span>
          <span className="kbd">{menu.open.key}</span>
        </div>
        <div className="row">
          <span>{menu.quit}</span>
        </div>
      </section>

      {/* "Already waits for you": the first click after first run has somewhere to go */}
      <div className="waits">
        <div>
          <div className="h">{copy.desktop.waitsHead(waits.length, first)}</div>
          {waits.length === 0 ? (
            <p className="small muted">{copy.desktop.waitsNone}</p>
          ) : (
            <ul>
              {waits.slice(0, 3).map((w) => {
                const agent = w.kind === "approval";
                const tool = agent ? (w.what.split(" · ")[0] ?? w.what) : null;
                return (
                  <li key={w.id}>
                    <Avatar id={w.who} name={w.who} size={20} kind={agent ? "agent" : "person"} />
                    <span>
                      <span className="serifname">{w.who}</span> {w.verb}{" "}
                      {tool ? <code>{tool}</code> : w.what}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="cta">
          <button
            type="button"
            className="btn brand"
            disabled={!firstRoute}
            onClick={() => firstRoute && navigate(firstRoute)}
          >
            {copy.desktop.enter}
            <Icon d={ICONS.chevron} size={14} />
          </button>
          {first && (
            <span className="cap">
              <i>{copy.desktop.enterCap(first)}</i>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
