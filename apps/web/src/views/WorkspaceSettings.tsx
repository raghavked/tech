/**
 * Settings → Workspace: one section per workspace the person is in. The model key the
 * workspace brings (connect, check, replace, disconnect; the default model), its people and
 * their roles, invitation links, and its projects. An admin manages; a member reads.
 */
import { type FormEvent, type ReactNode, useEffect, useId, useState } from "react";
import {
  api,
  useFetch,
  type Workspace,
  type WorkspaceInvite,
  type WorkspaceMembers,
  type WorkspaceModel,
} from "../api.js";
import { copy } from "../copy.js";
import type { Identity } from "../identity.js";
import { paths } from "../router.js";
import { copyText, ICONS, Icon, Loader, toast } from "../ui.js";
import { inviteUrl, reloadMe, reloadWorkspaces, shortDate, useWorkspaces } from "../workspaces.js";

const c = copy.workspace;

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function WorkspaceSettings({ identity }: { identity: Identity }) {
  const ws = useWorkspaces(identity.userId);
  if (!ws.data) return null;
  return (
    <>
      {ws.data.workspaces.map((w) => (
        <WorkspaceSection key={w.id} workspace={w} identity={identity} />
      ))}
    </>
  );
}

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

function WorkspaceSection({ workspace, identity }: { workspace: Workspace; identity: Identity }) {
  const admin = workspace.role === "admin";
  return (
    <section className="group workspace" id={`workspace-${workspace.id}`}>
      <h2>{c.section(workspace.name)}</h2>
      <div className="list">
        <NameRow workspace={workspace} identity={identity} admin={admin} />
      </div>
      <ModelKey workspace={workspace} identity={identity} />
      {workspace.role && <People workspace={workspace} identity={identity} admin={admin} />}
      {workspace.role && <Projects workspace={workspace} identity={identity} admin={admin} />}
    </section>
  );
}

function NameRow({
  workspace,
  identity,
  admin,
}: {
  workspace: Workspace;
  identity: Identity;
  admin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(workspace.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!editing)
    return (
      <Row
        title={<span className="serif">{workspace.name}</span>}
        detail={c.youAre(workspace.role)}
      >
        {admin && (
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              setName(workspace.name);
              setEditing(true);
            }}
          >
            {c.rename}
          </button>
        )}
      </Row>
    );
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    api
      .renameWorkspace(identity.userId, workspace.id, name)
      .then(() => {
        setEditing(false);
        setError(null);
        reloadWorkspaces();
        reloadMe();
      })
      .catch((err: unknown) => setError(messageOf(err)))
      .finally(() => setBusy(false));
  };
  return (
    <form className="rowitem form ws-inline" onSubmit={save}>
      <input
        className="input grow"
        aria-label={c.name}
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" className="btn primary sm" disabled={busy}>
        {c.save}
      </button>
      <button type="button" className="btn ghost sm" onClick={() => setEditing(false)}>
        {c.cancel}
      </button>
      {error && (
        <p className="small danger ws-wide" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

/** The key card: what the workspace runs on, and for an admin the ways to change it. */
function ModelKey({ workspace, identity }: { workspace: Workspace; identity: Identity }) {
  const m = workspace.model;
  const [replacing, setReplacing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const done = () => {
    setBusy(null);
    reloadWorkspaces();
  };
  const act = (what: string, work: () => Promise<{ error?: string } | unknown>, said?: string) => {
    if (busy) return;
    setBusy(what);
    setError(null);
    work()
      .then((res) => {
        const refusal = (res as { error?: string } | null)?.error;
        if (refusal) setError(refusal);
        else if (said) toast(said);
      })
      .catch((err: unknown) => setError(messageOf(err)))
      .finally(done);
  };
  const showForm = m.canManage && m.storage && (!m.connected || replacing);
  return (
    <div className="ws-card" data-state={m.connected ? m.status : "none"}>
      <h3>
        <Icon d={ICONS.key} size={14} />
        {c.modelTitle}
        {m.connected && (
          <span className={`pill status ${m.status === "refused" ? "blocked" : "running"}`}>
            {m.status === "refused" ? c.refused : c.working}
          </span>
        )}
      </h3>
      {m.connected ? (
        <>
          <p className="ws-key">
            <span className="mono">{c.connected(m.last4 ?? "")}</span>
            <span className="small muted">
              {c.connectedBy(m.addedByName ?? m.addedBy ?? "", shortDate(m.addedAt))}
            </span>
          </p>
          {m.status === "refused" && <p className="small danger">{c.refusedLine}</p>}
          {m.status !== "refused" && m.source !== "workspace" && (
            <p className="small muted">{c.offlineLine}</p>
          )}
        </>
      ) : m.source === "server" ? (
        <p className="muted">{c.serverLine(m.running)}</p>
      ) : (
        <p className="muted">{m.canManage ? c.demoLine : c.demoMember(workspace.name)}</p>
      )}
      {m.canManage && !m.storage && <p className="small danger">{c.noStorage}</p>}
      {showForm && (
        <KeyForm
          busy={busy === "connect"}
          onCancel={m.connected ? () => setReplacing(false) : undefined}
          onSubmit={(key) =>
            act("connect", () =>
              api.putWorkspaceModel(identity.userId, workspace.id, { key }).then(() => {
                setReplacing(false);
              }),
            )
          }
        />
      )}
      {m.connected && m.canManage && !replacing && (
        <>
          <ModelPick workspace={workspace} identity={identity} onError={setError} />
          {asking ? (
            <p className="row ws-ask" role="alertdialog" aria-label={c.disconnect}>
              <span className="grow">{c.disconnectAsk}</span>
              <button
                type="button"
                className="btn danger-solid sm"
                disabled={busy !== null}
                onClick={() =>
                  act("disconnect", () =>
                    api.removeWorkspaceModel(identity.userId, workspace.id).then(() => {
                      setAsking(false);
                    }),
                  )
                }
              >
                {c.disconnectYes}
              </button>
              <button type="button" className="btn ghost sm" onClick={() => setAsking(false)}>
                {c.keep}
              </button>
            </p>
          ) : (
            <p className="row ws-actions">
              <button
                type="button"
                className="btn sm"
                disabled={busy !== null}
                onClick={() =>
                  act(
                    "check",
                    () => api.checkWorkspaceModel(identity.userId, workspace.id),
                    c.checked,
                  )
                }
              >
                {busy === "check" ? <Loader kind="orbit" label={c.connecting} /> : null}
                {c.check}
              </button>
              <button type="button" className="btn sm" onClick={() => setReplacing(true)}>
                {c.replace}
              </button>
              <button type="button" className="btn ghost sm" onClick={() => setAsking(true)}>
                {c.disconnect}
              </button>
            </p>
          )}
        </>
      )}
      {m.connected && !m.canManage && <p className="small muted">{c.runsOn(m.running)}</p>}
      {error && (
        <p className="small danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function KeyForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (key: string) => void;
  onCancel?: (() => void) | undefined;
}) {
  const [key, setKey] = useState("");
  const id = useId();
  return (
    <form
      className="ws-keyform"
      onSubmit={(e) => {
        e.preventDefault();
        if (key.trim() && !busy) onSubmit(key.trim());
      }}
    >
      <label className="field" htmlFor={id}>
        <span>{c.keyLabel}</span>
        <input
          id={id}
          className="input mono"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={c.keyHint}
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
      </label>
      <p className="small muted">{c.keyPromise}</p>
      <div className="row">
        <button type="submit" className="btn primary" disabled={busy || !key.trim()}>
          {busy ? (
            <>
              <Loader kind="orbit" label={c.connecting} />
              {c.connecting}
            </>
          ) : (
            c.connect
          )}
        </button>
        {onCancel && (
          <button type="button" className="btn ghost" onClick={onCancel}>
            {c.cancel}
          </button>
        )}
      </div>
    </form>
  );
}

/** The default model: the provider's default, or one of the models the key can use. */
function ModelPick({
  workspace,
  identity,
  onError,
}: {
  workspace: Workspace;
  identity: Identity;
  onError: (message: string | null) => void;
}) {
  const m: WorkspaceModel = workspace.model;
  const models = useFetch(
    () => api.workspaceModels(identity.userId, workspace.id),
    `${workspace.id}:${m.last4}`,
  );
  const [saving, setSaving] = useState(false);
  const list = models.data?.models ?? [];
  // The model in use stays in the list even when the provider no longer names it.
  const options =
    m.model && !list.some((x) => x.id === m.model)
      ? [{ id: m.model, name: m.model }, ...list]
      : list;
  return (
    <div className="list">
      <Row title={c.modelRow} detail={c.modelDetail}>
        <select
          className="select sm"
          aria-label={c.modelRow}
          value={m.model}
          disabled={saving}
          onChange={(e) => {
            setSaving(true);
            onError(null);
            api
              .putWorkspaceModel(identity.userId, workspace.id, { model: e.target.value })
              .catch((err: unknown) => onError(messageOf(err)))
              .finally(() => {
                setSaving(false);
                reloadWorkspaces();
              });
          }}
        >
          <option value="">{c.modelDefault(m.defaultModel)}</option>
          {options.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name === x.id ? x.id : `${x.name} (${x.id})`}
            </option>
          ))}
        </select>
      </Row>
    </div>
  );
}

function People({
  workspace,
  identity,
  admin,
}: {
  workspace: Workspace;
  identity: Identity;
  admin: boolean;
}) {
  const me = identity.userId;
  const fetched = useFetch(
    () => api.workspaceMembers(me, workspace.id),
    `${workspace.id}:${workspace.members}`,
  );
  const [data, setData] = useState<WorkspaceMembers | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  useEffect(() => {
    if (fetched.data) setData(fetched.data);
  }, [fetched.data]);
  const apply = (work: Promise<WorkspaceMembers | { left: true }>) => {
    setError(null);
    work
      .then((res) => {
        if ("left" in res) reloadMe();
        else setData(res);
        reloadWorkspaces();
      })
      .catch((err: unknown) => setError(messageOf(err)))
      .finally(() => setAsking(null));
  };
  const members = data?.members ?? [];
  const admins = members.filter((p) => p.role === "admin").length;
  return (
    <>
      <h3>{c.membersTitle}</h3>
      <ul className="list ws-people" aria-label={c.membersTitle}>
        {members.map((p) => {
          const self = p.id === me;
          const lastAdmin = p.role === "admin" && admins <= 1;
          return (
            <li className="rowitem" key={p.id}>
              <span className="ellipsis">
                <span className="t">
                  {p.name}
                  {self && <span className="faint"> · {c.you}</span>}
                </span>
                {p.email && <span className="s">{p.email}</span>}
              </span>
              {asking === p.id ? (
                <span className="row" role="alertdialog" aria-label={self ? c.leave : c.remove}>
                  <span className="small">{self ? c.leaveAsk : c.removeAsk(p.name)}</span>
                  <button
                    type="button"
                    className="btn danger-solid sm"
                    onClick={() => apply(api.removeWorkspaceMember(me, workspace.id, p.id))}
                  >
                    {self ? c.leave : c.remove}
                  </button>
                  <button type="button" className="btn ghost sm" onClick={() => setAsking(null)}>
                    {c.cancel}
                  </button>
                </span>
              ) : (
                <span className="row">
                  {admin && !lastAdmin ? (
                    <select
                      className="select sm"
                      aria-label={c.roleOf(p.name)}
                      value={p.role}
                      onChange={(e) =>
                        apply(
                          api.setWorkspaceRole(
                            me,
                            workspace.id,
                            p.id,
                            e.target.value === "admin" ? "admin" : "member",
                          ),
                        )
                      }
                    >
                      <option value="admin">{c.admin}</option>
                      <option value="member">{c.member}</option>
                    </select>
                  ) : (
                    <span className="small muted">{p.role === "admin" ? c.admin : c.member}</span>
                  )}
                  {(self || admin) && !lastAdmin && (
                    <button type="button" className="btn ghost sm" onClick={() => setAsking(p.id)}>
                      {self ? c.leave : c.remove}
                    </button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="small danger" role="alert">
          {error}
        </p>
      )}
      {admin && (
        <Invites
          workspace={workspace}
          identity={identity}
          invites={data?.invites ?? []}
          onChange={(invites) => setData((d) => (d ? { ...d, invites } : d))}
          onMade={fetched.reload}
        />
      )}
    </>
  );
}

function Invites({
  workspace,
  identity,
  invites,
  onChange,
  onMade,
}: {
  workspace: Workspace;
  identity: Identity;
  invites: WorkspaceInvite[];
  onChange: (invites: WorkspaceInvite[]) => void;
  onMade: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [made, setMade] = useState<{ url: string; email: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailId = useId();
  const linkId = useId();
  const create = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    api
      .createInvite(identity.userId, workspace.id, {
        role,
        ...(email.trim() ? { email: email.trim() } : {}),
      })
      .then((res) => {
        setMade({ url: inviteUrl(res.token), email: res.invite.email });
        setEmail("");
        onMade();
      })
      .catch((err: unknown) => setError(messageOf(err)))
      .finally(() => setBusy(false));
  };
  const open = invites.filter((i) => i.state === "open");
  return (
    <div className="ws-card ws-invite">
      <h3>
        <Icon d={ICONS.plus} size={14} />
        {c.inviteTitle}
      </h3>
      <p className="muted">{c.inviteLine}</p>
      <form className="ws-inviteform" onSubmit={create}>
        <label className="field" htmlFor={emailId}>
          <span>{c.inviteEmail}</span>
          <input
            id={emailId}
            className="input"
            type="email"
            autoComplete="off"
            placeholder={c.inviteEmailHint}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field ws-role">
          <span>{c.inviteRole}</span>
          <select
            className="select"
            value={role}
            onChange={(e) => setRole(e.target.value === "admin" ? "admin" : "member")}
          >
            <option value="member">{c.member}</option>
            <option value="admin">{c.admin}</option>
          </select>
        </label>
        <button type="submit" className="btn primary" disabled={busy}>
          {c.inviteCreate}
        </button>
      </form>
      {error && (
        <p className="small danger" role="alert">
          {error}
        </p>
      )}
      {made && (
        <div className="ws-link" role="status">
          <label className="field" htmlFor={linkId}>
            <span>{c.inviteReady}</span>
            <input
              id={linkId}
              className="input mono"
              readOnly
              value={made.url}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <div className="row">
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                void copyText(made.url).then((ok) => ok && toast(c.copied));
              }}
            >
              <Icon d={ICONS.link} size={14} />
              {c.copyLink}
            </button>
            <span className="small muted">
              {made.email ? c.inviteEmailNote(made.email) : c.inviteOpenNote}
            </span>
          </div>
        </div>
      )}
      {open.length > 0 && (
        <ul className="list" aria-label={c.invitesOpen}>
          {open.map((i) => (
            <li className="rowitem" key={i.id}>
              <span className="ellipsis">
                <span className="t">{c.inviteFor(i.email)}</span>
                <span className="s">
                  {i.role === "admin" ? c.admin : c.member} ·{" "}
                  {c.inviteState(i.state, shortDate(i.expiresAt))}
                </span>
              </span>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => {
                  api
                    .revokeInvite(identity.userId, workspace.id, i.id)
                    .then((res) => onChange(res.invites))
                    .catch((err: unknown) => setError(messageOf(err)));
                }}
              >
                {c.withdraw}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Projects({
  workspace,
  identity,
  admin,
}: {
  workspace: Workspace;
  identity: Identity;
  admin: boolean;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    api
      .addProject(identity.userId, workspace.id, name.trim())
      .then(() => {
        setName("");
        reloadWorkspaces();
        reloadMe();
      })
      .catch((err: unknown) => setError(messageOf(err)))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <h3>{c.projectsTitle}</h3>
      <ul className="list" aria-label={c.projectsTitle}>
        {workspace.teams.flatMap((t) =>
          t.projects.map((p) => (
            <li className="rowitem" key={p.id}>
              <span className="ellipsis">
                <a className="t" href={paths.fleet(p.id)}>
                  {p.name}
                </a>
                <span className="s">{c.inTeam(t.name)}</span>
              </span>
              <span className="small faint mono">{p.id}</span>
            </li>
          )),
        )}
        {admin && (
          <li>
            <form className="rowitem form ws-inline" onSubmit={add}>
              <input
                className="input grow"
                aria-label={c.projectName}
                placeholder={c.projectName}
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
              />
              <button type="submit" className="btn sm" disabled={busy || !name.trim()}>
                <Icon d={ICONS.plus} size={14} />
                {c.addProject}
              </button>
            </form>
          </li>
        )}
      </ul>
      {error && (
        <p className="small danger" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
