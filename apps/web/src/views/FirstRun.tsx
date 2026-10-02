/**
 * The first run on #/: three steps in one column. Who you are, which team, then a session to
 * open or create. Steps already done collapse to a line; the demo session is one row away.
 */
import { type ReactNode, useMemo, useState } from "react";
import type { Me, ProjectRef } from "../api.js";
import {
  DEMO_PROJECT,
  DemoRow,
  EmptyState,
  OfflineState,
  openDemoSession,
  useOnline,
} from "../empty.js";
import { type Identity, slugify } from "../identity.js";
import { navigate, paths } from "../router.js";
import { ICONS, Icon } from "../ui.js";

interface Team {
  id: string;
  name: string;
  orgName: string;
  projects: ProjectRef[];
}

const TEAM_KEY = "fold.team";

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
  return (
    <ol className="firstrun">
      <Step n={1} title="Who you are" done={Boolean(identity)}>
        {identityStep}
      </Step>
      <Step n={2} title="Your team" done={Boolean(identity) && loaded && teams.length > 0}>
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
      <Step n={3} title="A session" done={false}>
        {!identity ? (
          <p className="small faint">Open one by id, start a new one, or try the demo.</p>
        ) : (
          <OpenSession identity={identity} team={team} />
        )}
      </Step>
    </ol>
  );
}

function Step({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <li className={`fr-step${done ? " done" : ""}`}>
      <span className="num" aria-hidden="true">
        {done ? <Icon d={ICONS.check} size={12} /> : n}
      </span>
      <div className="body">
        <h2>{title}</h2>
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
          if (!id) return;
          navigate(paths.session(pid, id));
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
        <button type="submit" className="btn sm">
          Open session
        </button>
      </form>
    </>
  );
}
