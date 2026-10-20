import {
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { api, type Me, useFetch } from "./api.js";
import { copy } from "./copy.js";
import { ErrorBoundary, Recover } from "./ErrorBoundary.js";
import { type Identity, useIdentity } from "./identity.js";
import { TypedToasts } from "./notify.js";
import { CommandPalette } from "./palette.js";
// The rail is drawn once, in Rail.tsx; the Shell only places it.
import { Rail, teamOfRoute } from "./Rail.js";
import { navigate, type Route, useRoute } from "./router.js";
import { type ShortcutHandlers, stepSession } from "./shortcuts.js";
import { useTeamTheme } from "./theme.js";
import { ICONS, Icon, Loader, Toasts } from "./ui.js";
import { focusSoon, ShortcutSheet, sidebarSessionHrefs, useShortcuts } from "./useShortcuts.js";
import { Home } from "./views/Home.js";
// Perf: the other views are separate chunks, loaded on first use and warmed once idle (views/lazy.ts).
import {
  Approvals,
  ChatView,
  Inbox,
  Memory,
  Project,
  Search,
  SessionView,
  Settings,
  Team,
  warmViews,
} from "./views/lazy.js";
import { AuthCallback } from "./views/SignIn.js";

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
      {/* notifications: one sentence at three distances; the typed stack above the composer */}
      <TypedToasts />
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

export { teamOfRoute };

function Page() {
  const route = useRoute();
  const identity = useIdentity();
  const userId = identity?.userId ?? "";
  const me = useFetch<Me>(identity ? () => api.me(userId) : null, userId);
  const ctx: ShellContext = { route, identity, me: me.data };
  useEffect(warmViews, []);
  // team-theme: the page wears the team's colours while the route is in that team.
  useTeamTheme(identity ? teamOfRoute(route, me.data) : null);
  // Identity (auth.ts): back from the provider; the code becomes a token, then the route before.
  if (route.name === "auth") return <AuthCallback query={route.query} ctx={ctx} />;
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
          convene={route.convene}
          councilId={route.councilId}
          instruct={route.instruct}
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
    case "search": // search: everything the team keeps
      return <Search q={route.q} org={route.org} me={me} ctx={ctx} />;
    default:
      return null;
  }
}

/** The shell with shimmer rows in the column while a view's chunk is on its way (rarely seen once warmed). */
function Loading({ ctx }: { ctx: ShellContext }) {
  return (
    <Shell ctx={ctx} title="">
      <div className="column page">
        <div className="centre-wait">
          <Loader
            kind="join"
            size={96}
            stack
            label={copy.wait.launch}
            after8s={copy.wait.launchSlow()}
          />
        </div>
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
 * The chrome every page shares: the rail (Rail.tsx: brand, New session, search, Inbox and
 * Approvals, the agents by project, the project section, chats, you) and a main column with a
 * 56px top row. On a phone the rail is a drawer behind the menu icon.
 */
export function Shell({
  ctx,
  title,
  right,
  below,
  busy = false,
  drawer,
  shortcuts,
  children,
}: {
  ctx: ShellContext;
  title: ReactNode;
  right?: ReactNode;
  /** One quiet line under the top row, e.g. the reconnect notice. */
  below?: ReactNode;
  /** A long operation is under way: the weave loader runs under the top row; a string names it. */
  busy?: boolean | string;
  drawer?: ReactNode;
  /** Page-specific keys (shortcuts.ts); j, k and ? are handled here for every page. */
  shortcuts?: ShortcutHandlers;
  children: ReactNode;
}) {
  // The phone drawer's state is shared by every Shell (navStore), so it survives the swap from a
  // lazy view's loading shell to the view itself; it closes when the route changes.
  const navOpen = useSyncExternalStore(subscribeNav, readNav, () => false);
  const setNavOpen = setNav;
  const routeKey = JSON.stringify(ctx.route);
  useEffect(() => {
    if (navRouteKey !== null && navRouteKey !== routeKey) setNav(false);
    navRouteKey = routeKey;
  }, [routeKey]);
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
      <Rail ctx={ctx} open={navOpen} onClose={closeNav} />
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
        <div className={`busybar${busy ? " on" : ""}`} aria-hidden={!busy}>
          {busy && <Loader kind="weave" label={typeof busy === "string" ? busy : copy.wait.rows} />}
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

// ---- the phone drawer's state, shared by every Shell --------------------------------------------
let navIsOpen = false;
let navRouteKey: string | null = null;
const navListeners = new Set<() => void>();
function subscribeNav(fn: () => void): () => void {
  navListeners.add(fn);
  return () => navListeners.delete(fn);
}
function readNav(): boolean {
  return navIsOpen;
}
function setNav(open: boolean): void {
  if (navIsOpen === open) return;
  navIsOpen = open;
  for (const fn of navListeners) fn();
}

/** j/k: the session above or below the current one in the sidebar, wrapping at the ends. */
function stepTo(delta: 1 | -1): void {
  const current = location.hash.split("?")[0] ?? "";
  const href = stepSession(sidebarSessionHrefs(), current, delta);
  if (!href) return;
  navigate(href);
  focusSoon(`.sidebar a[href="${href}"]`);
}
