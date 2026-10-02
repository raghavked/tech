import type { ReactNode } from "react";
import { useState } from "react";
import { api, type Me, useFetch } from "./api.js";
import { useIdentity } from "./identity.js";
import { notifyPermission, requestNotifications } from "./notify.js";
import { paths, useRoute } from "./router.js";
import { type Theme, useTheme } from "./theme.js";
import { Avatar, ICONS, Icon, Mark } from "./ui.js";
import { Fleet } from "./views/Fleet.js";
import { Home } from "./views/Home.js";
import { Management } from "./views/Management.js";
import { SessionView } from "./views/SessionView.js";

export function App() {
  const route = useRoute();
  const identity = useIdentity();
  const userId = identity?.userId ?? "";
  const me = useFetch<Me>(identity ? () => api.me(userId) : null, userId);
  if (!identity || route.name === "home")
    return <Home me={me.data} meError={me.error} route={route} identity={identity} />;
  switch (route.name) {
    case "fleet":
      return <Fleet projectId={route.projectId} identity={identity} me={me.data} />;
    case "session":
      return (
        <SessionView
          key={`${route.projectId}/${route.sessionId}`}
          projectId={route.projectId}
          sessionId={route.sessionId}
          title={route.title}
          identity={identity}
          me={me.data}
        />
      );
    case "management":
      return <Management teamId={route.teamId} identity={identity} me={me.data} />;
  }
}

export interface RailLinks {
  current: "sessions" | "fleet" | "memory" | "mgmt";
  projectId?: string;
  teamId?: string;
}

/** The chrome every page shares: mark, crumbs, a page slot, notifications, theme, who, and the rail. */
export function Shell({
  crumbs,
  bar,
  course,
  rail,
  who,
  fill = false,
  children,
}: {
  crumbs: ReactNode;
  bar?: ReactNode;
  course?: ReactNode;
  rail: RailLinks | null;
  who: { name: string; userId: string } | null;
  fill?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <header className="chrome">
        <div className="topbar">
          <a className="brand" href={paths.home()} aria-label="Fold home">
            <Mark />
            <span className="wordmark hide-mobile">Fold</span>
          </a>
          <nav className="crumb" aria-label="Breadcrumb">
            {crumbs}
          </nav>
          {bar}
          <span className="grow" />
          <NotifyButton />
          <ThemeSwitch />
          {who && (
            <a className="who-chip" href={paths.home()} title="Change identity">
              <Avatar id={who.userId} name={who.name} small />
              <span className="hide-mobile">{who.name}</span>
            </a>
          )}
        </div>
        {course}
      </header>
      <div className="app">
        {rail && <Rail {...rail} />}
        <main className={`page ${fill ? "fill" : ""}`}>{children}</main>
      </div>
    </div>
  );
}

function Rail({ current, projectId, teamId }: RailLinks) {
  const item = (key: RailLinks["current"], href: string, icon: string, label: string) => (
    <a href={href} aria-current={current === key ? "page" : undefined}>
      <Icon d={icon} size={18} />
      {label}
    </a>
  );
  return (
    <nav className="rail" aria-label="Primary">
      {item("sessions", paths.home(), ICONS.sessions, "Sessions")}
      {item("fleet", projectId ? paths.fleet(projectId) : paths.home(), ICONS.fleet, "Fleet")}
      {item(
        "memory",
        projectId ? `${paths.fleet(projectId)}?panel=memory` : paths.home(),
        ICONS.memory,
        "Memory",
      )}
      {item("mgmt", teamId ? paths.management(teamId) : paths.home(), ICONS.mgmt, "Mgmt")}
      <span className="spacer" />
    </nav>
  );
}

function ThemeSwitch() {
  const [theme, setTheme] = useTheme();
  const opt = (t: Theme, label: string) => (
    <>
      <input
        type="radio"
        name="theme"
        id={`t-${t === "system" ? "auto" : t}`}
        checked={theme === t}
        onChange={() => setTheme(t)}
      />
      <label htmlFor={`t-${t === "system" ? "auto" : t}`}>{label}</label>
    </>
  );
  return (
    <fieldset className="theme-switch" aria-label="Theme" style={{ margin: 0 }}>
      {opt("system", "Auto")}
      {opt("light", "Light")}
      {opt("dark", "Dark")}
    </fieldset>
  );
}

function NotifyButton() {
  const [perm, setPerm] = useState(notifyPermission());
  if (perm === "unsupported") return null;
  if (perm === "granted")
    return (
      <span
        className="muted small hide-mobile"
        title="Approvals, handoffs and fleet contentions notify you"
      >
        Notifications on
      </span>
    );
  if (perm === "denied")
    return <span className="muted small hide-mobile">Notifications blocked</span>;
  return (
    <button
      type="button"
      className="btn onchrome sm"
      onClick={() => {
        requestNotifications().then(setPerm);
      }}
    >
      <Icon d={ICONS.bell} size={14} />
      <span className="hide-mobile">Notify me</span>
    </button>
  );
}

export function Crumb({ children, href }: { children: ReactNode; href?: string }) {
  return href ? <a href={href}>{children}</a> : <span>{children}</span>;
}
export const Sep = () => <span className="sep">›</span>;
