/**
 * Empty states, one sentence and one action each, plus the demo session and an offline hook.
 * Every page with a list that can be empty uses `EmptyState`; the copy stays in Henosis's voice.
 */
import { type ReactNode, useEffect, useState } from "react";
import { slugify } from "./identity.js";
import { navigate, paths } from "./router.js";
import { ICONS, Icon } from "./ui.js";

export interface EmptyAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

/** A quiet row: the sentence on the left, the one thing to do on the right. */
export function EmptyState({
  text,
  action,
  className = "",
}: {
  text: ReactNode;
  action?: EmptyAction | null;
  className?: string;
}) {
  return (
    <p className={`empty row${className ? ` ${className}` : ""}`}>
      <span className="muted grow">{text}</span>
      {action &&
        (action.href ? (
          <a className="btn ghost sm" href={action.href}>
            {action.label}
          </a>
        ) : (
          <button type="button" className="btn ghost sm" onClick={action.onClick}>
            {action.label}
          </button>
        ))}
    </p>
  );
}

/** The sentence for a server that cannot be reached, with a retry. */
export function OfflineState({ online, onRetry }: { online: boolean; onRetry?: () => void }) {
  return (
    <EmptyState
      text={online ? "Henosis cannot reach its server right now." : "You are offline."}
      action={onRetry ? { label: "Retry", onClick: onRetry } : null}
    />
  );
}

// ---- the demo session --------------------------------------------------------------------

/** The project the demo session is created in: the server's own default. */
export const DEMO_PROJECT = "default";

export function demoSessionId(userId: string): string {
  return `demo-${slugify(userId) || "you"}`;
}

/** Opening the session route creates it on join: `demo-<user>` in the default project. */
export function openDemoSession(userId: string, projectId: string = DEMO_PROJECT): void {
  navigate(paths.session(projectId, demoSessionId(userId)));
}

export function DemoRow({
  userId,
  projectId = DEMO_PROJECT,
}: {
  userId: string;
  projectId?: string;
}) {
  return (
    <button
      type="button"
      className="rowitem new"
      onClick={() => openDemoSession(userId, projectId)}
    >
      <span className="row">
        <Icon d={ICONS.play} size={14} />
        Try the demo session
      </span>
      <span className="small faint mono">{demoSessionId(userId)}</span>
    </button>
  );
}

// ---- offline -------------------------------------------------------------------------------

/** What the browser says about the network; true when it does not know. */
export function useOnline(): boolean {
  const [on, setOn] = useState(() => {
    try {
      return navigator.onLine !== false;
    } catch {
      return true;
    }
  });
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    addEventListener("online", up);
    addEventListener("offline", down);
    return () => {
      removeEventListener("online", up);
      removeEventListener("offline", down);
    };
  }, []);
  return on;
}

/** True when the browser is offline, or a connection has stayed down for `after` ms. */
export function useOffline(connected: boolean, after = 4000): boolean {
  const online = useOnline();
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (connected) {
      setStale(false);
      return;
    }
    const t = setTimeout(() => setStale(true), after);
    return () => clearTimeout(t);
  }, [connected, after]);
  return !online || (!connected && stale);
}
