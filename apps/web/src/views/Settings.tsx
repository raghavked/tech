/**
 * settings-page: #/settings. One column of quiet sections: Profile, Notifications, Appearance,
 * Keyboard, Team policy (read-only, from the current project) and Integrations.
 */
import { describeRule, ruleFor } from "@henosis/kernel";
import type { ContentionPolicy, RiskClass, SessionPolicy } from "@henosis/protocol";
import { type ReactNode, useState } from "react";
import { Shell, type ShellContext } from "../App.js";
import { api, type Me, useFetch } from "../api.js";
import { clearIdentity, type Identity } from "../identity.js";
import { notifyPermission, requestNotifications } from "../notify.js";
import { hotkeyLabel } from "../palette.js";
import { NOTIFY_KINDS, useNotifyPrefs } from "../prefs.js";
import { useRecents } from "../recents.js";
import { paths } from "../router.js";
import { SHORTCUTS } from "../shortcuts.js";
import { type Theme, useTheme } from "../theme.js";
import { Avatar, ICONS, Icon } from "../ui.js";
import { TeamLook } from "./TeamLook.js";

const RISKS: { risk: RiskClass; detail: string }[] = [
  { risk: "read", detail: "Reading files and state" },
  { risk: "write", detail: "Writing in the workspace" },
  { risk: "exec", detail: "Running commands" },
  { risk: "external", detail: "Reaching outside the workspace" },
  { risk: "irreversible", detail: "What cannot be undone" },
];

const CONTENTION: Record<ContentionPolicy, string> = {
  block: "Two peers who disagree block each other until the driver resolves it",
  "latest-wins": "The most recent directive wins",
  "driver-wins": "The driver's directive wins",
};

export function Settings({
  identity,
  me,
  ctx,
}: {
  identity: Identity;
  me: Me | null;
  ctx: ShellContext;
}) {
  return (
    <Shell ctx={ctx} title="Settings">
      <div className="column page settings">
        <h1>Settings</h1>
        <Profile identity={identity} />
        <Notifications />
        <Appearance />
        <TeamLook identity={identity} me={me} />
        <Keyboard />
        <TeamPolicy me={me} />
        <Integrations />
      </div>
    </Shell>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="group">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/** One settings row: a title, a quiet line under it, and the control on the right. */
function Row({
  title,
  detail,
  children,
}: {
  title: ReactNode;
  detail?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rowitem">
      <span className="ellipsis">
        <span className="t">{title}</span>
        {detail && <span className="s">{detail}</span>}
      </span>
      {children}
    </div>
  );
}

function Profile({ identity }: { identity: Identity }) {
  return (
    <Section title="Profile">
      <div className="list">
        <Row title={<span className="serif">{identity.name}</span>} detail="Name">
          <Avatar id={identity.userId} name={identity.name} />
        </Row>
        <Row title={<span className="mono">{identity.userId}</span>} detail="User id" />
        <Row title="Identity" detail="Remembered in this browser only">
          <span className="row">
            <a className="btn ghost sm" href={paths.home()}>
              Change
            </a>
            <button type="button" className="btn ghost sm" onClick={() => clearIdentity()}>
              Sign out
            </button>
          </span>
        </Row>
      </div>
    </Section>
  );
}

function Notifications() {
  const [prefs, setPref] = useNotifyPrefs();
  const [perm, setPerm] = useState(notifyPermission());
  return (
    <Section title="Notifications">
      <div className="list">
        <Row
          title="Browser notifications"
          detail={
            perm === "granted"
              ? "On while this tab is hidden"
              : perm === "denied"
                ? "Blocked by the browser"
                : perm === "unsupported"
                  ? "Not available here"
                  : "Ask the browser once"
          }
        >
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
        </Row>
        {NOTIFY_KINDS.map((k) => (
          <Row key={k.kind} title={k.label} detail={k.detail}>
            <input
              type="checkbox"
              className="switch"
              aria-label={k.label}
              checked={prefs[k.kind]}
              onChange={(e) => setPref(k.kind, e.target.checked)}
            />
          </Row>
        ))}
      </div>
    </Section>
  );
}

function Appearance() {
  const [theme, setTheme] = useTheme();
  const opt = (t: Theme, label: string) => (
    <button
      type="button"
      className={theme === t ? "on" : ""}
      aria-pressed={theme === t}
      onClick={() => setTheme(t)}
    >
      {label}
    </button>
  );
  return (
    <Section title="Appearance">
      <div className="list">
        <Row title="Theme" detail="Auto follows the system">
          <fieldset className="seg" aria-label="Theme">
            {opt("system", "Auto")}
            {opt("light", "Light")}
            {opt("dark", "Dark")}
          </fieldset>
        </Row>
      </div>
    </Section>
  );
}

/** The keys the client answers to: the composer's, the palette's and the shortcut map's. */
function Keyboard() {
  const rows: { keys: string[]; does: string; where: string }[] = [
    { keys: ["Enter"], does: "Send to the agent, or to the team", where: "Composer" },
    { keys: ["Shift", "Enter"], does: "New line", where: "Composer" },
    { keys: hotkeyLabel().split(" "), does: "Command palette", where: "Anywhere" },
    ...SHORTCUTS.map((sc) => ({
      keys: [sc.key],
      does: sc.label,
      where: sc.scope === "session" ? "Session" : "Anywhere",
    })),
  ];
  return (
    <Section title="Keyboard">
      <div className="list">
        {rows.map((r) => (
          <Row key={r.keys.join("+")} title={r.does} detail={r.where}>
            <span className="keys">
              {r.keys.map((k) => (
                <kbd key={k}>{k}</kbd>
              ))}
            </span>
          </Row>
        ))}
      </div>
    </Section>
  );
}

/** The policy every new session in the current project is created with; the server owns it. */
function TeamPolicy({ me }: { me: Me | null }) {
  const projects = me?.projects ?? [];
  const recents = useRecents();
  const recent = recents.find((r) => projects.some((p) => p.projectId === r.projectId));
  const [picked, setPicked] = useState<string | null>(null);
  const projectId = picked ?? recent?.projectId ?? projects[0]?.projectId ?? null;
  const policy = useFetch<SessionPolicy>(
    projectId ? () => api.policy(projectId) : null,
    projectId ?? "",
  );
  const p = policy.data;
  return (
    <Section title="Team policy">
      {projects.length === 0 && (
        <p className="muted">{me ? "No project is visible to you." : "Loading…"}</p>
      )}
      {projects.length > 1 && projectId && (
        <p className="row">
          <span className="muted grow">
            Read-only; set when the project's sessions are created.
          </span>
          <select
            className="select sm"
            aria-label="Project"
            value={projectId}
            onChange={(e) => setPicked(e.target.value)}
          >
            {projects.map((pr) => (
              <option key={pr.projectId} value={pr.projectId}>
                {pr.name}
              </option>
            ))}
          </select>
        </p>
      )}
      {projects.length === 1 && (
        <p className="muted">
          Read-only; set when sessions in {projects[0]?.name ?? projectId} are created.
        </p>
      )}
      {policy.error && <p className="small danger">{policy.error}</p>}
      {p && (
        <div className="list">
          {RISKS.map((r) => (
            <Row key={r.risk} title={<span className="mono">{r.risk}</span>} detail={r.detail}>
              <span className="small muted">{describeRule(ruleFor(p.approvals, r.risk))}</span>
            </Row>
          ))}
          <Row title="Contention" detail={CONTENTION[p.contention]}>
            <span className="small muted mono">{p.contention}</span>
          </Row>
          <Row title="Turn budget" detail="Turns per branch before the agent asks for direction">
            <span className="small muted mono">{p.maxTurns}</span>
          </Row>
        </div>
      )}
    </Section>
  );
}

function Integrations() {
  const slack = useFetch(() => api.integrations(), "integrations");
  const on = slack.data?.slack === true;
  return (
    <Section title="Integrations">
      <div className="list">
        <Row
          title="Slack"
          detail={
            slack.error
              ? slack.error
              : on
                ? "Channels per team and project; a thread per session"
                : "Start the server with `henosis slack --config slack.json` to connect"
          }
        >
          <span className={`status${on ? " on" : " idle"}`}>
            {slack.data ? (on ? "Connected" : "Not connected") : "Checking"}
          </span>
        </Row>
      </div>
    </Section>
  );
}
