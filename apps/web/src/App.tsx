import { type ReactNode, useEffect, useMemo, useState } from "react";
import { api, type Me, type SessionRow, useFetch } from "./api.js";
import { clearIdentity, type Identity, useIdentity } from "./identity.js";
import { notifyPermission, requestNotifications } from "./notify.js";
import { useRecents } from "./recents.js";
import { paths, type Route, useRoute } from "./router.js";
import { type Theme, useTheme } from "./theme.js";
import { Avatar, ICONS, Icon, Mark } from "./ui.js";
import { Home } from "./views/Home.js";
import { Project } from "./views/Project.js";
import { SessionView } from "./views/SessionView.js";
import { Team } from "./views/Team.js";

export function App() {
  const route = useRoute();
  const identity = useIdentity();
  const userId = identity?.userId ?? "";
  const me = useFetch<Me>(identity ? () => api.me(userId) : null, userId);
  const ctx: ShellContext = { route, identity, me: me.data };
  if (!identity || route.name === "home")
    return <Home me={me.data} meError={me.error} identity={identity} ctx={ctx} />;
  switch (route.name) {
    case "fleet":
      return <Project projectId={route.projectId} identity={identity} me={me.data} ctx={ctx} />;
    case "session":
      return (
        <SessionView
          key={`${route.projectId}/${route.sessionId}`}
          projectId={route.projectId}
          sessionId={route.sessionId}
          title={route.title}
          identity={identity}
          me={me.data}
          ctx={ctx}
        />
      );
    case "management":
      return <Team teamId={route.teamId} identity={identity} me={me.data} ctx={ctx} />;
  }
}

export interface ShellContext {
  route: Route;
  identity: Identity | null;
  me: Me | null;
}

/**
 * The chrome every page shares: a sidebar (mark, new session, search, projects, recents, you)
 * and a main column with a 48px top row. On a phone the sidebar is a drawer behind the menu icon.
 */
export function Shell({
  ctx,
  title,
  right,
  drawer,
  children,
}: {
  ctx: ShellContext;
  title: ReactNode;
  right?: ReactNode;
  drawer?: ReactNode;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const routeKey = JSON.stringify(ctx.route);
  // biome-ignore lint/correctness/useExhaustiveDependencies: close the drawer when the route changes
  useEffect(() => setNavOpen(false), [routeKey]);
  return (
    <div className="shell">
      <Sidebar ctx={ctx} open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="main">
        <div className="topbar">
          <button
            type="button"
            className="btn ghost icon menu"
            aria-label="Menu"
            onClick={() => setNavOpen(true)}
          >
            <Icon d={ICONS.menu} />
          </button>
          <span className="title">{title}</span>
          <div className="right">{right}</div>
        </div>
        <div className="body">
          <div className="scroll">{children}</div>
          {drawer}
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  ctx,
  open,
  onClose,
}: {
  ctx: ShellContext;
  open: boolean;
  onClose: () => void;
}) {
  const { route, identity, me } = ctx;
  const [q, setQ] = useState("");
  const recents = useRecents();
  const projects = me?.projects ?? [];
  const sessions = useProjectSessions(
    projects.map((p) => p.projectId),
    route,
  );
  const needle = q.trim().toLowerCase();
  const hit = (...xs: (string | undefined)[]) =>
    !needle || xs.some((x) => x?.toLowerCase().includes(needle));
  const activeSession = route.name === "session" ? route.sessionId : null;
  const activeProject = route.name === "fleet" ? route.projectId : null;
  const activeTeam = route.name === "management" ? route.teamId : null;
  const teams = useMemo(() => {
    const out = new Map<string, { id: string; name: string; projects: typeof projects }>();
    for (const p of projects) {
      const t = out.get(p.teamId) ?? { id: p.teamId, name: p.teamName, projects: [] };
      t.projects.push(p);
      out.set(p.teamId, t);
    }
    return [...out.values()];
  }, [projects]);
  const firstProject = projects[0]?.projectId ?? "default";
  const listed = new Set(
    Object.values(sessions).flatMap((rows) => rows.filter((r) => r.open).map((r) => r.sessionId)),
  );
  const recentsShown = recents.filter((r) => !listed.has(r.sessionId) && hit(r.title, r.sessionId));
  return (
    <>
      {open && <button type="button" className="scrim" aria-label="Close menu" onClick={onClose} />}
      <nav className={`sidebar${open ? " open" : ""}`} aria-label="Sidebar">
        <a className="brand" href={paths.home()}>
          <Mark size={22} />
          Fold
        </a>
        <a className="new" href={paths.fleet(firstProject) + (identity ? "?new=1" : "")}>
          <Icon d={ICONS.plus} />
          New session
        </a>
        <label className="search">
          <Icon d={ICONS.search} size={14} />
          <input
            type="search"
            placeholder="Search sessions"
            aria-label="Search sessions"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <div className="lists">
          {identity && teams.length > 0 && <div className="section">Projects</div>}
          {teams.map((t) => (
            <div key={t.id}>
              {teams.length > 1 || t.name !== t.projects[0]?.name ? (
                <a
                  className={`item team${activeTeam === t.id ? " active" : ""}`}
                  href={paths.management(t.id)}
                >
                  {t.name}
                </a>
              ) : null}
              {t.projects.map((p) => {
                const rows = (sessions[p.projectId] ?? []).filter(
                  (s) => s.open && hit(s.title, s.sessionId),
                );
                if (!hit(p.name, p.projectId) && rows.length === 0) return null;
                return (
                  <div key={p.projectId}>
                    <a
                      className={`item${activeProject === p.projectId ? " active" : ""}`}
                      href={paths.fleet(p.projectId)}
                    >
                      {p.name}
                    </a>
                    {rows.map((s) => (
                      <a
                        key={s.sessionId}
                        className={`item sub${activeSession === s.sessionId ? " active" : ""}`}
                        href={paths.session(p.projectId, s.sessionId)}
                        title={s.sessionId}
                      >
                        <span className={`dot ${s.live ?? "idle"}`} />
                        {s.title || s.sessionId}
                      </a>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
          {identity && teams.length === 0 && (
            <a
              className={`item${activeTeam === "default" ? " active" : ""}`}
              href={paths.management("default")}
            >
              Default team
            </a>
          )}
          {recentsShown.length > 0 && <div className="section">Recents</div>}
          {recentsShown.map((r) => (
            <a
              key={`${r.projectId}/${r.sessionId}`}
              className={`item${activeSession === r.sessionId ? " active" : ""}`}
              href={paths.session(r.projectId, r.sessionId)}
              title={r.sessionId}
            >
              {r.title || r.sessionId}
            </a>
          ))}
        </div>
        <Account identity={identity} />
      </nav>
    </>
  );
}

/** Open sessions per project for the sidebar; refetched whenever the route changes. */
function useProjectSessions(ids: string[], route: Route): Record<string, SessionRow[]> {
  const [out, setOut] = useState<Record<string, SessionRow[]>>({});
  const key = `${ids.join(",")}|${JSON.stringify(route)}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` names the projects and the route
  useEffect(() => {
    let alive = true;
    const load = () =>
      Promise.all(
        ids.map((id) =>
          api
            .sessions(id)
            .then((rows) => [id, rows] as const)
            .catch(() => [id, []] as const),
        ),
      ).then((pairs) => {
        if (alive) setOut(Object.fromEntries(pairs));
      });
    load();
    // A session registers a moment after its page opens; look again shortly, then now and then.
    const soon = setTimeout(load, 1500);
    const every = setInterval(load, 20_000);
    addEventListener("focus", load);
    return () => {
      alive = false;
      clearTimeout(soon);
      clearInterval(every);
      removeEventListener("focus", load);
    };
  }, [key]);
  return out;
}

function Account({ identity }: { identity: Identity | null }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const [perm, setPerm] = useState(notifyPermission());
  if (!identity)
    return (
      <a className="me" href={paths.home()}>
        <span className="avatar">?</span>
        Sign in
      </a>
    );
  const themeOpt = (t: Theme, label: string) => (
    <button
      type="button"
      className={`chip${theme === t ? " on" : ""}`}
      aria-pressed={theme === t}
      onClick={() => setTheme(t)}
    >
      {label}
    </button>
  );
  return (
    <div className="me-wrap">
      {open && (
        <div className="menu" role="menu" aria-label="Account">
          <div className="small muted">Theme</div>
          <div className="row">
            {themeOpt("system", "Auto")}
            {themeOpt("light", "Light")}
            {themeOpt("dark", "Dark")}
          </div>
          <div className="small muted">Notifications</div>
          {perm === "granted" && <span className="small">On while this tab is hidden</span>}
          {perm === "denied" && <span className="small">Blocked by the browser</span>}
          {perm === "unsupported" && <span className="small">Not available here</span>}
          {perm === "default" && (
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                requestNotifications().then(setPerm);
              }}
            >
              <Icon d={ICONS.bell} size={14} />
              Turn on
            </button>
          )}
          <a className="small" href={paths.home()}>
            Change identity
          </a>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              clearIdentity();
              setOpen(false);
            }}
          >
            Sign out
          </button>
        </div>
      )}
      <button
        type="button"
        className="me"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar id={identity.userId} name={identity.name} />
        <span className="grow ellipsis">{identity.name}</span>
        <Icon d={ICONS.dots} size={14} />
      </button>
    </div>
  );
}
