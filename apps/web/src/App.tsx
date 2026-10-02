import { type ReactNode, useEffect, useMemo, useState } from "react";
import { api, type Me, type SessionRow, useFetch } from "./api.js";
import { copy } from "./copy.js";
import { ErrorBoundary, Recover } from "./ErrorBoundary.js";
import { clearIdentity, type Identity, useIdentity } from "./identity.js";
import { useInbox } from "./inbox.js";
import { notifyPermission, requestNotifications } from "./notify.js";
import { CommandPalette, hotkeyLabel, openPalette, publishSidebarSessions } from "./palette.js";
import { useRecents } from "./recents.js";
import { navigate, paths, type Route, useRoute } from "./router.js";
import { type ShortcutHandlers, stepSession } from "./shortcuts.js";
import { type Theme, useTheme } from "./theme.js";
import { AgentCard, Avatar, ICONS, Icon, Mark, Toasts } from "./ui.js";
import { focusSoon, ShortcutSheet, sidebarSessionHrefs, useShortcuts } from "./useShortcuts.js";
import { Home } from "./views/Home.js";
import { Inbox } from "./views/Inbox.js";
import { Project } from "./views/Project.js";
import { SessionView } from "./views/SessionView.js";
import { Team } from "./views/Team.js";

/**
 * Hook point (error-boundary-toasts): every view renders inside one error boundary that resets
 * when the route changes, and the toast stack sits beside it. The views themselves live in `Page`.
 */
export function App() {
  const route = useRoute();
  const routeKey = JSON.stringify(route);
  return (
    <>
      <ErrorBoundary
        resetKey={routeKey}
        fallback={(error, reset) => <BrokenView error={error} onRetry={reset} />}
      >
        <Page />
      </ErrorBoundary>
      <Toasts />
    </>
  );
}

/** The shell with the sidebar intact and a recovery row where the view was. */
function BrokenView({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const route = useRoute();
  const identity = useIdentity();
  const userId = identity?.userId ?? "";
  const me = useFetch<Me>(identity ? () => api.me(userId) : null, userId);
  return (
    <Shell ctx={{ route, identity, me: me.data }} title="Something went wrong">
      <div className="column page">
        <Recover error={error} onRetry={onRetry} />
      </div>
    </Shell>
  );
}

function Page() {
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
    case "inbox":
      return <Inbox identity={identity} me={me.data} ctx={ctx} />;
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
  below,
  drawer,
  shortcuts,
  children,
}: {
  ctx: ShellContext;
  title: ReactNode;
  right?: ReactNode;
  /** One quiet line under the top row, e.g. the reconnect notice. */
  below?: ReactNode;
  drawer?: ReactNode;
  /** Page-specific keys (shortcuts.ts); j, k and ? are handled here for every page. */
  shortcuts?: ShortcutHandlers;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const routeKey = JSON.stringify(ctx.route);
  // biome-ignore lint/correctness/useExhaustiveDependencies: close the drawer when the route changes
  useEffect(() => setNavOpen(false), [routeKey]);
  const [help, setHelp] = useState(false);
  useShortcuts({
    ...shortcuts,
    next: () => stepTo(1),
    previous: () => stepTo(-1),
    help: () => setHelp((v) => !v),
  });
  // The account menu (and any surface without a keyboard) asks for the sheet by this event.
  useEffect(() => {
    const open = () => setHelp(true);
    addEventListener("fold:shortcuts", open);
    return () => removeEventListener("fold:shortcuts", open);
  }, []);
  return (
    <div className="shell">
      {help && <ShortcutSheet onClose={() => setHelp(false)} />}
      <Sidebar ctx={ctx} open={navOpen} onClose={() => setNavOpen(false)} />
      {/* hook point (command-palette): ⌘K / Ctrl+K opens the palette on every page */}
      <CommandPalette ctx={ctx} />
      <div className="main">
        <div className="topbar">
          <button
            type="button"
            className="btn ghost icon menu"
            aria-label={copy.shell.menu}
            onClick={() => setNavOpen(true)}
          >
            <Icon d={ICONS.menu} />
          </button>
          <span className="title">{title}</span>
          <div className="right">{right}</div>
        </div>
        {below}
        <div className="body">
          <div className="scroll">{children}</div>
          {drawer}
        </div>
      </div>
    </div>
  );
}

/** j/k: the session above or below the current one in the sidebar, wrapping at the ends. */
function stepTo(delta: 1 | -1): void {
  const current = location.hash.split("?")[0] ?? "";
  const href = stepSession(sidebarSessionHrefs(), current, delta);
  if (!href) return;
  navigate(href);
  focusSoon(`.sidebar a[href="${href}"]`);
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
  const inbox = useInbox(identity?.userId ?? null);
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
      {open && (
        <button
          type="button"
          className="scrim"
          aria-label={copy.shell.closeMenu}
          onClick={onClose}
        />
      )}
      <nav className={`sidebar${open ? " open" : ""}`} aria-label={copy.shell.sidebar}>
        <a className="brand" href={paths.home()}>
          <Mark size={22} />
          <span className="serif">{copy.product}</span>
        </a>
        <a className="new" href={paths.fleet(firstProject) + (identity ? "?new=1" : "")}>
          <Icon d={ICONS.plus} />
          {copy.shell.newSession}
        </a>
        <label className="search">
          <Icon d={ICONS.search} size={14} />
          <input
            type="search"
            placeholder={copy.shell.searchSessions}
            aria-label={copy.shell.searchSessions}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="button" className="kbd" title="Commands" onClick={openPalette}>
            {hotkeyLabel()}
          </button>
        </label>
        {identity && (
          <a
            className={`item inbox${route.name === "inbox" ? " active" : ""}`}
            href={paths.inbox()}
          >
            <Icon d={ICONS.inbox} size={15} />
            Inbox
            {inbox.unread > 0 && <span className="count">{inbox.unread}</span>}
          </a>
        )}
        <div className="lists">
          {identity && teams.length > 0 && (
            <div className="section">
              {copy.shell.agents}
              <span className="n">{listed.size || ""}</span>
            </div>
          )}
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
                    {groupByCrew(rows).map(([crew, members]) => (
                      <div key={crew ?? "_solo"}>
                        {crew && (
                          <div className="crew">
                            <span className="serif">{crew}</span>
                            <span className="faint">
                              {members.length} agent{members.length === 1 ? "" : "s"}
                            </span>
                          </div>
                        )}
                        {members.map((s) => (
                          <AgentCard
                            key={s.sessionId}
                            row={s}
                            href={paths.session(p.projectId, s.sessionId)}
                            active={activeSession === s.sessionId}
                            nameOf={(id) =>
                              me?.user?.id === id ? "you" : (nameOfMember(s, id) ?? id)
                            }
                          />
                        ))}
                      </div>
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
              {copy.shell.defaultTeam}
            </a>
          )}
          {recentsShown.length > 0 && <div className="section">{copy.shell.recents}</div>}
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

/** Crewed sessions first, grouped under their crew; solo sessions after, under no header. */
function groupByCrew(rows: SessionRow[]): [string | null, SessionRow[]][] {
  const crews = new Map<string, SessionRow[]>();
  const solo: SessionRow[] = [];
  for (const r of rows) {
    if (r.crew) crews.set(r.crew, [...(crews.get(r.crew) ?? []), r]);
    else solo.push(r);
  }
  const out: [string | null, SessionRow[]][] = [...crews.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  if (solo.length) out.push([null, solo]);
  return out;
}

/** The owner's name as the session's people list knows it (they may be offline). */
function nameOfMember(row: SessionRow, id: string): string | undefined {
  return row.people.find((p) => p.id === id)?.name;
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
        if (!alive) return;
        const rows = Object.fromEntries(pairs);
        setOut(rows);
        publishSidebarSessions(rows); // hook point (command-palette)
      });
    load();
    // A session registers a moment after its page opens; look again shortly, then now and then.
    const soon = setTimeout(load, 1500);
    const every = setInterval(load, 8_000);
    addEventListener("focus", load);
    addEventListener("fold:fleet", load);
    return () => {
      alive = false;
      clearTimeout(soon);
      clearInterval(every);
      removeEventListener("focus", load);
      removeEventListener("fold:fleet", load);
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
        {copy.shell.signIn}
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
        <div className="menu" role="menu" aria-label={copy.account.menu}>
          <div className="small muted">{copy.account.theme}</div>
          <div className="row">
            {themeOpt("system", copy.account.themeAuto)}
            {themeOpt("light", copy.account.themeLight)}
            {themeOpt("dark", copy.account.themeDark)}
          </div>
          <div className="small muted">{copy.account.notifications}</div>
          {perm === "granted" && <span className="small">{copy.account.notifyOn}</span>}
          {perm === "denied" && <span className="small">{copy.account.notifyBlocked}</span>}
          {perm === "unsupported" && (
            <span className="small">{copy.account.notifyUnsupported}</span>
          )}
          {perm === "default" && (
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                requestNotifications().then(setPerm);
              }}
            >
              <Icon d={ICONS.bell} size={14} />
              {copy.account.notifyTurnOn}
            </button>
          )}
          <a className="small" href={paths.home()}>
            {copy.account.changeIdentity}
          </a>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              setOpen(false);
              dispatchEvent(new Event("fold:shortcuts"));
            }}
          >
            Keyboard shortcuts
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              clearIdentity();
              setOpen(false);
            }}
          >
            {copy.account.signOut}
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
