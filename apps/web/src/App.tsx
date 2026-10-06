import {
  memo,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, type Me, type SessionRow, useFetch } from "./api.js";
import { pendingOf } from "./approvalsQueue.js";
import { useChatUnread } from "./chat.js";
import { copy } from "./copy.js";
import { ErrorBoundary, Recover } from "./ErrorBoundary.js";
import { clearIdentity, type Identity, useIdentity } from "./identity.js";
import { useInbox } from "./inbox.js";
import { notifyPermission, requestNotifications } from "./notify.js";
import { CommandPalette, hotkeyLabel, openPalette, publishSidebarSessions } from "./palette.js";
import { useRecents } from "./recents.js";
import { navigate, paths, type Route, useRoute } from "./router.js";
import { MemoryResults, matchSession, needleOf, searchKeys, useMemorySearch } from "./search.js";
import { isDesktop } from "./shell.js";
import { type ShortcutHandlers, stepSession } from "./shortcuts.js";
import { type Theme, useTheme } from "./theme.js";
import { AgentCard, Avatar, ICONS, Icon, Mark, Toasts } from "./ui.js";
import { UpdateRow } from "./update.js";
import { focusSoon, ShortcutSheet, sidebarSessionHrefs, useShortcuts } from "./useShortcuts.js";
import { Home } from "./views/Home.js";
// Perf: the other views are separate chunks, loaded on first use and warmed once idle (views/lazy.ts).
import {
  Approvals,
  ChatView,
  Inbox,
  Memory,
  Project,
  SessionView,
  Settings,
  Team,
  warmViews,
} from "./views/lazy.js";

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
  useEffect(warmViews, []);
  if (!identity || route.name === "home")
    return (
      <Home me={me.data} meError={me.error} identity={identity} ctx={ctx} onRetry={me.reload} />
    );
  return (
    <Suspense fallback={<Loading ctx={ctx} />}>
      <View route={route} identity={identity} me={me.data} ctx={ctx} />
    </Suspense>
  );
}

function View({
  route,
  identity,
  me,
  ctx,
}: {
  route: Route;
  identity: Identity;
  me: Me | null;
  ctx: ShellContext;
}) {
  switch (route.name) {
    case "fleet":
      return <Project projectId={route.projectId} identity={identity} me={me} ctx={ctx} />;
    case "session":
      return (
        <SessionView
          key={`${route.projectId}/${route.sessionId}`}
          projectId={route.projectId}
          sessionId={route.sessionId}
          title={route.title}
          identity={identity}
          me={me}
          ctx={ctx}
        />
      );
    case "management":
      return <Team teamId={route.teamId} identity={identity} me={me} ctx={ctx} />;
    case "chat": // groups-chats: people and agents in one circle
      return (
        <ChatView
          key={`${route.orgId}/${route.groupId ?? ""}`}
          orgId={route.orgId}
          groupId={route.groupId}
          newGroup={route.newGroup}
          identity={identity}
          me={me}
          ctx={ctx}
        />
      );
    case "inbox":
      return <Inbox identity={identity} me={me} ctx={ctx} />;
    case "memory":
      return (
        <Memory orgId={route.orgId} team={route.team} project={route.project} me={me} ctx={ctx} />
      );
    case "settings":
      return <Settings identity={identity} me={me} ctx={ctx} />;
    case "approvals": // hook: approvals-queue
      return <Approvals identity={identity} me={me} ctx={ctx} />;
    default:
      return null;
  }
}

/** The shell with an empty column while a view's chunk is on its way (rarely seen once warmed). */
function Loading({ ctx }: { ctx: ShellContext }) {
  return (
    <Shell ctx={ctx} title="">
      <div className="column">
        <p className="muted">Loading…</p>
      </div>
    </Shell>
  );
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
    addEventListener("henosis:shortcuts", open);
    return () => removeEventListener("henosis:shortcuts", open);
  }, []);
  // A stable handler keeps the memoised sidebar out of the stream's re-renders.
  const closeNav = useCallback(() => setNavOpen(false), []);
  return (
    <div className="shell">
      {help && <ShortcutSheet onClose={() => setHelp(false)} />}
      <Sidebar ctx={ctx} open={navOpen} onClose={closeNav} />
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

/** Memoised: it polls on its own, so a stream event in the main column should not redraw the rail. */
const Sidebar = memo(function Sidebar({
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
  const needle = needleOf(q);
  const hit = (...xs: (string | undefined)[]) =>
    !needle || xs.some((x) => x?.toLowerCase().includes(needle));
  // session-search: owner and goal matching, team memory after two characters, keyboard.
  const searchInput = useRef<HTMLInputElement>(null);
  const listsRef = useRef<HTMLDivElement>(null);
  const memoryHits = useMemorySearch(me, needle);
  const matchRow = (s: SessionRow) =>
    s.open && matchSession(s, needle, me?.user?.id === s.ownerId ? me.user.name : undefined);
  const activeSession = route.name === "session" ? route.sessionId : null;
  const activeProject = route.name === "fleet" ? route.projectId : null;
  const activeTeam = route.name === "management" ? route.teamId : null;
  const activeMemory = route.name === "memory" ? route.orgId : null;
  const activeGroup = route.name === "chat" ? route.groupId : null;
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
  // memory-browser: one "Memory" item per org (the default org when none is known).
  const orgs = useMemo(() => {
    const out = new Map<string, string>();
    for (const p of projects) out.set(p.orgId, p.orgName);
    if (out.size === 0) out.set("default", "Default org");
    return [...out.entries()];
  }, [projects]);
  // groups-chats: the person's groups across their orgs, with unread counts, polled quietly.
  const chats = useChatUnread(
    orgs.map(([id]) => id),
    identity?.userId ?? null,
  );
  const firstOrg = orgs[0]?.[0] ?? "default";
  const listed = new Set(
    Object.values(sessions).flatMap((rows) => rows.filter((r) => r.open).map((r) => r.sessionId)),
  );
  const recentsShown = recents.filter((r) => !listed.has(r.sessionId) && hit(r.title, r.sessionId));
  const nothingMatches =
    Boolean(needle) &&
    recentsShown.length === 0 &&
    !projects.some((p) => hit(p.name, p.projectId)) &&
    !Object.values(sessions).some((rows) => rows.some(matchRow));
  // hook: approvals-queue — approvals waiting across every listed project
  const waiting = Object.values(sessions)
    .flat()
    .reduce((n, r) => n + pendingOf(r), 0);
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
      <nav
        className={`sidebar${open ? " open" : ""}`}
        aria-label={copy.shell.sidebar}
        onKeyDown={(e) =>
          searchKeys(e, {
            clear: () => setQ(""),
            input: searchInput.current,
            lists: listsRef.current,
          })
        }
      >
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
            ref={searchInput}
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
        {identity && (
          <a
            className={`item inbox${route.name === "approvals" ? " active" : ""}`}
            href={paths.approvals()}
          >
            <Icon d={ICONS.check} size={15} />
            Approvals
            {waiting > 0 && <span className="count">{waiting}</span>}
          </a>
        )}
        <div className="lists" ref={listsRef}>
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
                const rows = (sessions[p.projectId] ?? []).filter(matchRow);
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
          {identity &&
            orgs.map(([id, name]) => (
              <a
                key={id}
                className={`item${activeMemory === id ? " active" : ""}`}
                href={paths.memory(id)}
              >
                <Icon d={ICONS.memory} size={14} />
                {orgs.length > 1 ? copy.shell.orgMemory(name) : copy.shell.memory}
              </a>
            ))}
          {identity && (
            <div className="section">
              {copy.shell.chats}
              <span className="n">{chats.total || ""}</span>
            </div>
          )}
          {identity &&
            orgs.map(([id, name]) =>
              (chats.byOrg[id]?.groups ?? [])
                .filter((g) => hit(g.name, g.purpose))
                .map((g) => (
                  <a
                    key={`${id}/${g.groupId}`}
                    className={`item chat${activeGroup === g.groupId ? " active" : ""}`}
                    href={paths.chat(id, g.groupId)}
                    title={orgs.length > 1 ? copy.shell.orgChats(name) : g.purpose}
                  >
                    <span className="ellipsis">#{g.name}</span>
                    {g.unread > 0 && <span className="count">{g.unread}</span>}
                  </a>
                )),
            )}
          {identity && (
            <a
              className={`item chat new-group${route.name === "chat" && route.newGroup ? " active" : ""}`}
              href={paths.newGroup(firstOrg)}
            >
              <Icon d={ICONS.plus} size={14} />
              {copy.shell.newGroup}
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
          {nothingMatches && <p className="item faint">No sessions match.</p>}
          {identity && <MemoryResults hits={memoryHits} needle={needle} />}
        </div>
        {/* Desktop shell only: "Restart to update" once a newer build is downloaded. */}
        <UpdateRow />
        <Account identity={identity} route={route} />
      </nav>
    </>
  );
});

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
    addEventListener("henosis:fleet", load);
    return () => {
      alive = false;
      clearTimeout(soon);
      clearInterval(every);
      removeEventListener("focus", load);
      removeEventListener("henosis:fleet", load);
    };
  }, [key]);
  return out;
}

function Account({ identity, route }: { identity: Identity | null; route: Route }) {
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
          {perm === "granted" && (
            <span className="small">
              {isDesktop() ? copy.account.notifyOnDesktop : copy.account.notifyOn}
            </span>
          )}
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
          <a className="small" href={paths.settings()}>
            Settings
          </a>
          {route.name === "session" && (
            <>
              {/* export-session hook: the session menu's Export action */}
              <div className="small muted">Session</div>
              <a
                className="small"
                href={api.exportUrl(route.sessionId)}
                target="_blank"
                rel="noopener"
                onClick={() => setOpen(false)}
              >
                Export as markdown
              </a>
            </>
          )}
          <a className="small" href={paths.home()}>
            {copy.account.changeIdentity}
          </a>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              setOpen(false);
              dispatchEvent(new Event("henosis:shortcuts"));
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
