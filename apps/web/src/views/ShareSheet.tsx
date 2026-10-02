/**
 * Share and invite (feature: share-invite).
 * - `ShareSheet`: the drawer behind a session's Share button: the link, who can open it with
 *   their role word, an owner's role select (the existing `role` message), and Copy link.
 * - `InviteRow`: the project page's Invite row: the project id and the phase-0 users.json
 *   membership instruction, since identity is a file on the server until phase 1.
 */
import type { ProjectState } from "@fold/fleet";
import type { SessionState } from "@fold/kernel";
import type { Actor, Role } from "@fold/protocol";
import { useState } from "react";
import type { FoldClient } from "../client.js";
import { paths } from "../router.js";
import { Avatar, copyText, ErrorLine, ICONS, Icon } from "../ui.js";

const ROLES: Role[] = ["observer", "contributor", "driver", "owner"];

/** The absolute web link of a session, as the address bar would show it. */
export function sessionLink(projectId: string, sessionId: string): string {
  return `${location.origin}${location.pathname}${paths.session(projectId, sessionId)}`;
}

/** The absolute web link of a project page. */
export function projectLink(projectId: string): string {
  return `${location.origin}${location.pathname}${paths.fleet(projectId)}`;
}

/** A "Copy" button that says "Copied" for a moment. */
export function CopyButton({
  text,
  label = "Copy link",
  primary = false,
}: {
  text: string;
  label?: string;
  primary?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`btn sm${primary ? " primary" : ""}`}
      onClick={() => {
        copyText(text).then((ok) => {
          setCopied(ok);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      <Icon d={ICONS.link} size={14} />
      {copied ? "Copied" : label}
    </button>
  );
}

/** The sentence that says what a membership in users.json turns into inside a session. */
export const ROLE_RULE =
  "Leads and admins open it as owners, members as contributors, everyone else observes.";

export function ShareSheet({
  s,
  me,
  client,
  projectId,
  errors,
  onClose,
}: {
  s: SessionState;
  me: Actor;
  client: FoldClient;
  projectId: string;
  errors: string[];
  onClose: () => void;
}) {
  const link = sessionLink(projectId, s.sessionId);
  const humans = Object.values(s.participants).filter((p) => p.actor.kind === "human");
  const iOwn = s.ownerId === me.id || s.participants[me.id]?.role === "owner";
  const roleWord = (id: string, role: string) => (s.driver === id ? "driving" : role);
  return (
    <>
      <button
        type="button"
        className="scrim sheet-scrim"
        aria-label="Close share"
        onClick={onClose}
      />
      <aside className="drawer" aria-label="Share">
        <div className="drawer-head">
          <span>Share</span>
          <button
            type="button"
            className="btn ghost icon sm"
            aria-label="Close share"
            onClick={onClose}
          >
            <Icon d={ICONS.close} size={14} />
          </button>
        </div>
        <ErrorLine errors={errors} />
        <section className="group">
          <h3>Link</h3>
          <p className="mono small muted share-link" title={link}>
            {link}
          </p>
          <CopyButton text={link} primary />
          <p className="small faint">
            Anyone on <span className="mono">{projectId}</span> can open it. {ROLE_RULE}
          </p>
        </section>
        <section className="group">
          <h3>Who can open it</h3>
          {humans.map((p) => (
            <div className={`person${p.present ? "" : " off"}`} key={p.actor.id}>
              <Avatar id={p.actor.id} name={p.actor.name} driver={s.driver === p.actor.id} />
              <span className="name serif">
                {p.actor.name}
                {p.actor.id === me.id ? " (you)" : ""}
              </span>
              {iOwn && p.actor.id !== me.id ? (
                <select
                  className="select sm"
                  aria-label={`Role of ${p.actor.name}`}
                  value={p.role}
                  onChange={(e) =>
                    client.send({ type: "role", actorId: p.actor.id, role: e.target.value as Role })
                  }
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="role">
                  {roleWord(p.actor.id, p.role)}
                  {p.present ? "" : " · away"}
                </span>
              )}
            </div>
          ))}
          {humans.length <= 1 && (
            <p className="muted small">Nobody else has opened it yet. Send the link.</p>
          )}
          {iOwn && humans.length > 1 && (
            <p className="small faint">You own this session, so you can change a role.</p>
          )}
        </section>
        <section className="group">
          <h3>Invite</h3>
          <p className="small muted">
            Someone not on the project yet is added on the{" "}
            <a href={paths.fleet(projectId)}>project page</a> under Invite.
          </p>
        </section>
      </aside>
    </>
  );
}

/** The users.json entry that lets a person into a project, as the server reads it. */
export function membershipSnippet(projectId: string, userId = "<user-id>", name = "<Name>") {
  return JSON.stringify(
    {
      users: [{ id: userId, name, projects: [{ projectId, role: "member" }] }],
    },
    null,
    2,
  );
}

/** On the project page: the project id and how a person is let in (phase-0 identity). */
export function InviteRow({
  projectId,
  state,
  me,
}: {
  projectId: string;
  state: ProjectState | null;
  me: string;
}) {
  const members = Object.values(state?.members ?? {});
  const link = projectLink(projectId);
  const snippet = membershipSnippet(projectId);
  return (
    <details className="group fold invite">
      <summary>
        <h2>Invite</h2>
        <span className="faint small">
          project <span className="mono">{projectId}</span>
          {members.length > 0 ? ` · ${members.length} on it` : ""}
        </span>
      </summary>
      <p className="small muted">
        Identity is a file on the server for now: add the person to{" "}
        <span className="mono">store/users.json</span> and restart{" "}
        <span className="mono">fold serve</span>. They sign in with that user id and open the
        project link. {ROLE_RULE}
      </p>
      <pre className="brief">{snippet}</pre>
      <div className="row">
        <CopyButton text={link} />
        <CopyButton text={snippet} label="Copy entry" />
      </div>
      {members.length > 0 && (
        <p className="small faint">
          On it: {members.map((m) => `${m.userId === me ? "you" : m.name} (${m.role})`).join(", ")}
        </p>
      )}
    </details>
  );
}
