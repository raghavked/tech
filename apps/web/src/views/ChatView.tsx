/**
 * Groups and chats (feature: groups-chats): a group is a circle of people and agents. A
 * message that mentions an agent member reaches its session as a steer; the agent's next words
 * come back as a reply. The page is one column of messages with a composer whose `@` completes
 * over the members, a members drawer, and a sheet to start a new group.
 */
import {
  type ChatEvent,
  type ChatMember,
  type ChatScope,
  type Group,
  isMember,
  type Message,
  memberId,
  memberKey,
  memberName,
  splitMentions,
  unreadIn,
} from "@henosis/chat";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Shell, type ShellContext } from "../App.js";
import { api, type ChatDirectoryListing, type Me, useFetch } from "../api.js";
import { ChatClient } from "../chatClient.js";
import { wsUrl } from "../client.js";
import { copy } from "../copy.js";
import { EmptyState } from "../empty.js";
import type { Identity } from "../identity.js";
import { notifyIfHidden } from "../notify.js";
import { ReconnectLine } from "../reconnect.js";
import { navigate, paths } from "../router.js";
import { Avatar, ErrorLine, ICONS, Icon, STATUS, toast, useConnectionToasts } from "../ui.js";

export function ChatView({
  orgId,
  groupId,
  newGroup,
  identity,
  me,
  ctx,
}: {
  orgId: string;
  groupId: string | null;
  newGroup: boolean;
  identity: Identity;
  me: Me | null;
  ctx: ShellContext;
}) {
  const client = useMemo(() => new ChatClient(), []);
  const snap = useSyncExternalStore(
    (fn) => client.subscribe(fn),
    () => client.snapshot,
  );
  useEffect(() => {
    client.connect(wsUrl(), orgId, identity.userId, identity.name);
    return () => client.disconnect();
  }, [client, orgId, identity.userId, identity.name]);
  useConnectionToasts(snap.connected, snap.errors);
  const s = snap.state;
  const meId = identity.userId;
  const orgName = me?.projects.find((p) => p.orgId === orgId)?.orgName ?? orgId;
  // The pickers' source: who is in the organisation and which agents are live; looked at now and then.
  const directory = useFetch(() => api.chatDirectory(orgId), orgId);
  useEffect(() => {
    const every = setInterval(directory.reload, 5_000);
    return () => clearInterval(every);
  }, [directory.reload]);
  const [members, setMembers] = useState(false);
  const [creating, setCreating] = useState(newGroup);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the route decides whether the sheet is open
  useEffect(() => setCreating(newGroup), [newGroup, groupId]);

  // A group this person just created opens as soon as the server says so; a mention of them
  // elsewhere becomes a browser notification while the tab is hidden.
  const pendingName = useRef<string | null>(null);
  useEffect(
    () =>
      client.onLiveEvent((e) => {
        if (
          e.kind === "group.created" &&
          e.actor === meId &&
          e.payload.name === pendingName.current
        ) {
          pendingName.current = null;
          toast(copy.chat.created(e.payload.name));
          navigate(paths.chat(orgId, e.payload.groupId));
          dispatchEvent(new Event("henosis:chat"));
        }
        if (e.kind === "message.posted" && e.actor !== meId) {
          const g = client.snapshot.state?.groups[e.payload.groupId];
          const mine = e.payload.mentions.some((m) => m.kind === "human" && m.id === meId);
          if (g && mine) {
            const who = g.members.find((m) => m.kind === "human" && m.userId === e.actor);
            notifyIfHidden(
              copy.notify.mentionTitle(who ? memberName(who) : e.actor, g.name),
              e.payload.text,
              e.id,
              "mention",
            );
          }
          if (e.payload.groupId !== groupId) dispatchEvent(new Event("henosis:chat"));
        }
        if (e.kind === "message.agent.replied" && e.payload.groupId !== groupId)
          dispatchEvent(new Event("henosis:chat"));
      }),
    [client, meId, orgId, groupId],
  );

  const group = groupId && s ? (s.groups[groupId] ?? null) : null;
  const sheet = creating && (
    <NewGroupSheet
      orgId={orgId}
      me={me}
      meId={meId}
      directory={directory.data}
      onClose={() => {
        setCreating(false);
        if (newGroup) navigate(paths.chat(orgId));
      }}
      onCreate={(input) => {
        pendingName.current = input.name;
        client.send({ type: "chat.create", ...input });
      }}
    />
  );

  if (!groupId || !s || !group) {
    const groups = s
      ? Object.values(s.groups)
          .filter((g) => isMember(g, meId))
          .sort((a, b) => b.lastSeq - a.lastSeq)
      : [];
    return (
      <Shell
        ctx={ctx}
        title={copy.chat.title}
        below={<ReconnectLine reconnecting={snap.reconnecting} />}
        right={
          <button type="button" className="btn sm" onClick={() => setCreating(true)}>
            <Icon d={ICONS.plus} size={14} />
            {copy.chat.newGroup}
          </button>
        }
      >
        {sheet}
        <div className="column page">
          <h1>{copy.shell.orgChats(orgName)}</h1>
          <ErrorLine errors={snap.errors} />
          {!s && <p className="muted">{copy.chat.joining}</p>}
          {s && groupId && !group && <p className="muted">{copy.chat.unknownGroup}</p>}
          <section className="group" aria-label={copy.chat.groups}>
            <h2>{copy.chat.groups}</h2>
            {s && groups.length === 0 && (
              <EmptyState
                text={copy.chat.noGroups}
                action={{ label: copy.chat.newGroup, onClick: () => setCreating(true) }}
              />
            )}
            <div className="list">
              {groups.map((g) => {
                const unread = s ? unreadIn(s, meId, g.id) : 0;
                return (
                  <a className="rowitem" key={g.id} href={paths.chat(orgId, g.id)}>
                    <span className="ellipsis">
                      <span className="t serif">#{g.name}</span>
                      <span className="s">
                        {g.purpose ? `${g.purpose} · ` : ""}
                        {copy.chat.memberCount(g.members.length)}
                      </span>
                    </span>
                    {unread > 0 && <span className="count">{unread}</span>}
                  </a>
                );
              })}
            </div>
          </section>
        </div>
      </Shell>
    );
  }

  const mine = isMember(group, meId);
  const live = new Map((directory.data?.agents ?? []).map((a) => [a.sessionId, a.live]));
  const stack = group.members.slice(0, 5);
  return (
    <Shell
      ctx={ctx}
      title={
        <>
          <span className="ellipsis serif">#{group.name}</span>
          {group.purpose && <span className="purpose muted ellipsis">{group.purpose}</span>}
        </>
      }
      right={
        <>
          <span className="stack" aria-hidden="true">
            {stack.map((m) => (
              <MemberAvatar key={memberKey(m)} m={m} live={live} />
            ))}
            {group.members.length > stack.length && (
              <span className="avatar">+{group.members.length - stack.length}</span>
            )}
          </span>
          <button
            type="button"
            className={`btn sm${members ? " on" : ""}`}
            aria-pressed={members}
            onClick={() => setMembers((v) => !v)}
          >
            {copy.chat.members}
          </button>
        </>
      }
      below={<ReconnectLine reconnecting={snap.reconnecting} />}
      drawer={
        members ? (
          <MembersDrawer
            group={group}
            meId={meId}
            live={live}
            directory={directory.data}
            projectNameOf={(id) => me?.projects.find((p) => p.projectId === id)?.name ?? id}
            onAdd={(member) => client.send({ type: "chat.add", groupId: group.id, member })}
            onRemove={(member) => client.send({ type: "chat.remove", groupId: group.id, member })}
            onClose={() => setMembers(false)}
          />
        ) : null
      }
    >
      {sheet}
      <Messages
        group={group}
        messages={s.messages[group.id] ?? []}
        meId={meId}
        live={live}
        errors={snap.errors}
      />
      {mine ? (
        <Composer
          group={group}
          read={s.reads[meId]?.[group.id] ?? -1}
          onSay={(text) => {
            client.send({ type: "chat.say", groupId: group.id, text });
            setTimeout(() => dispatchEvent(new Event("henosis:chat")), 300);
          }}
          onRead={() => {
            client.send({ type: "chat.read", groupId: group.id });
            setTimeout(() => dispatchEvent(new Event("henosis:chat")), 300);
          }}
        />
      ) : (
        <div className="composer-wrap">
          <p className="hint small muted">{copy.chat.notAMember}</p>
        </div>
      )}
    </Shell>
  );
}

/** A person's initials, or the agent mark with its live status dot. */
function MemberAvatar({ m, live }: { m: ChatMember; live: Map<string, string | null> }) {
  if (m.kind === "human") return <Avatar id={m.userId} name={memberName(m)} />;
  const status = live.get(m.sessionId) ?? "offline";
  const word = STATUS[status]?.label ?? STATUS.offline?.label ?? status;
  return (
    <span className="avatar-wrap" title={`${memberName(m)} · ${word}`}>
      <Avatar id={m.sessionId} name={memberName(m)} agent />
      <span className={`livedot ${status}`} />
    </span>
  );
}

// ---- messages ------------------------------------------------------------------------------

function Messages({
  group,
  messages,
  meId,
  live,
  errors,
}: {
  group: Group;
  messages: Message[];
  meId: string;
  live: Map<string, string | null>;
  errors: string[];
}) {
  const nameOf = (m: Message) => {
    const a = m.author;
    const member = group.members.find((x) =>
      a.kind === "human"
        ? x.kind === "human" && x.userId === a.userId
        : x.kind === "agent" && x.sessionId === a.sessionId,
    );
    return member ? memberName(member) : a.kind === "human" ? a.userId : a.sessionId;
  };
  const byId = new Map(messages.map((m) => [m.id, m]));
  const end = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1]?.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when a message lands
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [last]);
  let lastDay = "";
  return (
    <section className="column chatcol" aria-label={copy.chat.messages}>
      <ErrorLine errors={errors} />
      {messages.length === 0 && (
        <p className="muted" style={{ textAlign: "center", padding: "48px 0" }}>
          {copy.chat.empty}
        </p>
      )}
      {messages.map((m) => {
        const day = dayOf(m.at);
        const divider = day !== lastDay ? <div className="divider">{dayLabel(m.at)}</div> : null;
        lastDay = day;
        const replyTo = m.replyTo ? byId.get(m.replyTo) : undefined;
        return (
          <div key={m.id}>
            {divider}
            {m.author.kind === "human" ? (
              <div className={`msg human${m.author.userId === meId ? " mine" : ""}`}>
                <div className="meta">
                  <span className="who">{nameOf(m)}</span>
                  <span className="when">{timeOf(m.at)}</span>
                </div>
                <div className="text">
                  <Runs text={m.text} members={group.members} />
                </div>
              </div>
            ) : (
              <div className="msg agent">
                <div className="meta">
                  <span className="avatar-wrap">
                    <Avatar id={m.author.sessionId} name={nameOf(m)} agent />
                    <span className={`livedot ${live.get(m.author.sessionId) ?? "offline"}`} />
                  </span>
                  <span className="who serif">{nameOf(m)}</span>
                  <span className="faint">{copy.chat.agentReplied}</span>
                  {replyTo && (
                    <span className="faint ellipsis">
                      {copy.chat.inReplyTo} {replyTo.author.kind === "human" ? nameOf(replyTo) : ""}
                    </span>
                  )}
                  {m.turn !== null && <span className="faint">{copy.chat.turn(m.turn)}</span>}
                  <a className="small" href={paths.session(m.author.projectId, m.author.sessionId)}>
                    {copy.chat.inSession}
                  </a>
                  <span className="when">{timeOf(m.at)}</span>
                </div>
                <div className="text">{m.text}</div>
              </div>
            )}
          </div>
        );
      })}
      <div ref={end} />
    </section>
  );
}

/** The text with each resolved mention highlighted; what is marked is exactly what resolved. */
function Runs({ text, members }: { text: string; members: readonly ChatMember[] }) {
  return (
    <>
      {splitMentions(text, members).map((r, i) =>
        r.member ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: runs have no identity of their own
          <mark className="mention" key={i}>
            {r.text}
          </mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: runs have no identity of their own
          <span key={i}>{r.text}</span>
        ),
      )}
    </>
  );
}

function dayOf(at: number): string {
  return at ? new Date(at).toDateString() : "";
}

function dayLabel(at: number): string {
  if (!at) return "";
  const d = new Date(at);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return copy.chat.today;
  if (d.toDateString() === yesterday.toDateString()) return copy.chat.yesterday;
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function timeOf(at: number): string {
  return at
    ? new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : "";
}

// ---- composer with @ completion -------------------------------------------------------------

function Composer({
  group,
  read,
  onSay,
  onRead,
}: {
  group: Group;
  /** Seq of the last event this person has read in the group. */
  read: number;
  onSay: (text: string) => void;
  onRead: () => void;
}) {
  const [text, setText] = useState("");
  const [sel, setSel] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);
  // Mark read while the page is in view: now, when something lands, and when it comes back.
  const unread = group.lastSeq > read;
  const markRead = useCallback(() => {
    try {
      if (!document.hidden) onRead();
    } catch {
      onRead();
    }
  }, [onRead]);
  useEffect(() => {
    if (unread) markRead();
  }, [unread, markRead]);
  useEffect(() => {
    const on = () => {
      if (group.lastSeq > read) markRead();
    };
    addEventListener("focus", on);
    document.addEventListener("visibilitychange", on);
    return () => {
      removeEventListener("focus", on);
      document.removeEventListener("visibilitychange", on);
    };
  }, [group.lastSeq, read, markRead]);

  // The `@word` being typed at the caret, if any, and the members it could mean.
  const query = useMemo(() => {
    const el = ta.current;
    const caret = el ? el.selectionStart : text.length;
    const before = text.slice(0, caret);
    const m = before.match(/(?:^|\s)@([^\s@]*)$/);
    return m
      ? { q: (m[1] ?? "").toLowerCase(), start: before.length - (m[1] ?? "").length - 1 }
      : null;
  }, [text]);
  const options = useMemo(() => {
    if (!query) return [];
    return group.members
      .filter((m) => {
        const hay = [memberName(m), memberId(m)].map((x) => x.toLowerCase());
        return hay.some((h) => h.startsWith(query.q)) || hay.some((h) => h.includes(query.q));
      })
      .slice(0, 6);
  }, [group.members, query]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset the cursor when the list changes
  useEffect(() => setSel(0), [options.length, query?.q]);

  const pick = (m: ChatMember) => {
    if (!query) return;
    const el = ta.current;
    const caret = el ? el.selectionStart : text.length;
    const next = `${text.slice(0, query.start)}@${memberName(m)} ${text.slice(caret)}`;
    setText(next);
    requestAnimationFrame(() => {
      const at = query.start + memberName(m).length + 2;
      el?.focus();
      el?.setSelectionRange(at, at);
    });
  };
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSay(t);
    setText("");
    if (ta.current) ta.current.style.height = "auto";
  };
  const grow = () => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };
  const onKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (options.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSel((v) => (v + 1) % options.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSel((v) => (v - 1 + options.length) % options.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const m = options[sel];
        if (m) pick(m);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };
  return (
    <div className="composer-wrap">
      <form
        className="composer to-team"
        aria-label={copy.chat.composer}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={ta}
          rows={1}
          aria-label={copy.chat.label}
          placeholder={copy.chat.placeholder(group.name)}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            grow();
          }}
          onKeyDown={onKey}
        />
        {options.length > 0 && (
          <div className="mention-list" role="listbox" aria-label={copy.chat.mentionList}>
            {options.map((m, i) => (
              <button
                type="button"
                role="option"
                aria-selected={i === sel}
                className={i === sel ? "on" : ""}
                key={memberKey(m)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(m)}
              >
                {m.kind === "human" ? (
                  <Avatar id={m.userId} name={memberName(m)} />
                ) : (
                  <Avatar id={m.sessionId} name={memberName(m)} agent />
                )}
                <span className={m.kind === "agent" ? "serif" : ""}>{memberName(m)}</span>
                <span className="faint small">{memberId(m)}</span>
              </button>
            ))}
          </div>
        )}
        <div className="bar">
          <span className="small faint">{copy.chat.placeholderMention}</span>
          <div className="right">
            <button
              type="submit"
              className="send"
              aria-label={copy.chat.send}
              disabled={!text.trim()}
            >
              <Icon d={ICONS.send} />
            </button>
          </div>
        </div>
      </form>
      <p className="hint small faint">{copy.chat.hint}</p>
    </div>
  );
}

// ---- members drawer -------------------------------------------------------------------------

function MembersDrawer({
  group,
  meId,
  live,
  directory,
  projectNameOf,
  onAdd,
  onRemove,
  onClose,
}: {
  group: Group;
  meId: string;
  live: Map<string, string | null>;
  directory: ChatDirectoryListing | null;
  projectNameOf: (projectId: string) => string;
  onAdd: (m: ChatMember) => void;
  onRemove: (m: ChatMember) => void;
  onClose: () => void;
}) {
  const people = group.members.filter(
    (m): m is ChatMember & { kind: "human" } => m.kind === "human",
  );
  const agents = group.members.filter(
    (m): m is ChatMember & { kind: "agent" } => m.kind === "agent",
  );
  const inGroup = new Set(group.members.map(memberKey));
  const canAddPeople = (directory?.people ?? []).filter((p) => !inGroup.has(`human:${p.id}`));
  const canAddAgents = (directory?.agents ?? []).filter(
    (a) => !inGroup.has(`agent:${a.projectId}/${a.sessionId}`),
  );
  const nameOfPerson = (id: string) =>
    people.find((p) => p.userId === id)?.name ??
    directory?.people.find((p) => p.id === id)?.name ??
    id;
  const [person, setPerson] = useState("");
  const [agent, setAgent] = useState("");
  const creator = group.createdBy === meId;
  return (
    <>
      <button
        type="button"
        className="scrim sheet-scrim"
        aria-label={copy.chat.closeMembers}
        onClick={onClose}
      />
      <aside className="drawer" aria-label={copy.chat.members}>
        <div className="drawer-head">
          <span>{copy.chat.members}</span>
          <button
            type="button"
            className="btn ghost icon sm"
            aria-label={copy.chat.closeMembers}
            onClick={onClose}
          >
            <Icon d={ICONS.close} size={14} />
          </button>
        </div>
        <section className="group">
          <h3>{copy.chat.people}</h3>
          {people.map((p) => (
            <div className="person" key={p.userId}>
              <Avatar id={p.userId} name={memberName(p)} />
              <span className="name">
                {memberName(p)}
                {p.userId === meId ? copy.chat.you : ""}
              </span>
              <span className="role">{p.userId === group.createdBy ? copy.chat.creator : ""}</span>
              {(creator || p.userId === meId) && (
                <button
                  type="button"
                  className="btn ghost sm"
                  aria-label={`${p.userId === meId ? copy.chat.leave : copy.chat.remove}: ${memberName(p)}`}
                  onClick={() => onRemove(p)}
                >
                  {p.userId === meId ? copy.chat.leave : copy.chat.remove}
                </button>
              )}
            </div>
          ))}
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!person) return;
              onAdd({ kind: "human", userId: person });
              setPerson("");
            }}
          >
            <select
              className="select sm grow"
              aria-label={copy.chat.addPerson}
              value={person}
              onChange={(e) => setPerson(e.target.value)}
            >
              <option value="">{copy.chat.addPerson}</option>
              {canAddPeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn sm" disabled={!person}>
              {copy.chat.add}
            </button>
          </form>
          {directory && canAddPeople.length === 0 && (
            <p className="small faint">{copy.chat.nobodyToAdd}</p>
          )}
        </section>
        <section className="group">
          <h3>{copy.chat.agents}</h3>
          {agents.map((a) => {
            const row = directory?.agents.find((x) => x.sessionId === a.sessionId);
            const status = live.get(a.sessionId) ?? "offline";
            return (
              <div className="person" key={memberKey(a)}>
                <MemberAvatar m={a} live={live} />
                <span className="name">
                  <span className="serif">{memberName(a)}</span>
                  <span className="small faint">
                    {" "}
                    ·{" "}
                    {row
                      ? copy.chat.agentOf(nameOfPerson(row.ownerId), projectNameOf(a.projectId))
                      : projectNameOf(a.projectId)}
                  </span>
                </span>
                <span className="role">{STATUS[status]?.label ?? status}</span>
                <a className="small" href={paths.session(a.projectId, a.sessionId)}>
                  {copy.chat.inSession}
                </a>
                {(creator || row?.ownerId === meId) && (
                  <button
                    type="button"
                    className="btn ghost sm"
                    aria-label={`${copy.chat.remove}: ${memberName(a)}`}
                    onClick={() => onRemove(a)}
                  >
                    {copy.chat.remove}
                  </button>
                )}
              </div>
            );
          })}
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              const a = canAddAgents.find((x) => `${x.projectId}/${x.sessionId}` === agent);
              if (!a) return;
              onAdd({
                kind: "agent",
                projectId: a.projectId,
                sessionId: a.sessionId,
                title: a.title,
              });
              setAgent("");
            }}
          >
            <select
              className="select sm grow"
              aria-label={copy.chat.addAgent}
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
            >
              <option value="">{copy.chat.addAgent}</option>
              {canAddAgents.map((a) => (
                <option
                  key={`${a.projectId}/${a.sessionId}`}
                  value={`${a.projectId}/${a.sessionId}`}
                >
                  {a.title} · {copy.chat.agentOf(nameOfPerson(a.ownerId), a.projectName)}
                </option>
              ))}
            </select>
            <button type="submit" className="btn sm" disabled={!agent}>
              {copy.chat.add}
            </button>
          </form>
          {directory && canAddAgents.length === 0 && (
            <p className="small faint">{copy.chat.noAgentsToAdd}</p>
          )}
        </section>
      </aside>
    </>
  );
}

// ---- new group sheet ------------------------------------------------------------------------

export interface NewGroupInput {
  name: string;
  purpose: string;
  scope: ChatScope;
  members: ChatMember[];
}

function NewGroupSheet({
  orgId,
  me,
  meId,
  directory,
  onClose,
  onCreate,
}: {
  orgId: string;
  me: Me | null;
  meId: string;
  directory: ChatDirectoryListing | null;
  onClose: () => void;
  onCreate: (input: NewGroupInput) => void;
}) {
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [scope, setScope] = useState("org");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const projects = (me?.projects ?? []).filter((p) => p.orgId === orgId);
  const teams = [...new Map(projects.map((p) => [p.teamId, p.teamName])).entries()];
  const people = (directory?.people ?? []).filter((p) => p.id !== meId);
  const agents = directory?.agents ?? [];
  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const scopeOf = (): ChatScope => {
    if (scope.startsWith("team:")) return { teamId: scope.slice(5) };
    if (scope.startsWith("project:")) {
      const p = projects.find((x) => x.projectId === scope.slice(8));
      return p ? { teamId: p.teamId, projectId: p.projectId } : { projectId: scope.slice(8) };
    }
    return {};
  };
  const submit = () => {
    const n = name.trim();
    if (!n) return;
    const members: ChatMember[] = [];
    for (const p of people)
      if (picked.has(`human:${p.id}`)) members.push({ kind: "human", userId: p.id, name: p.name });
    for (const a of agents)
      if (picked.has(`agent:${a.projectId}/${a.sessionId}`))
        members.push({
          kind: "agent",
          projectId: a.projectId,
          sessionId: a.sessionId,
          title: a.title,
        });
    onCreate({ name: n, purpose: purpose.trim(), scope: scopeOf(), members });
    onClose();
  };
  return (
    <div className="sheet-wrap">
      <button type="button" className="sheet-dim" aria-label={copy.chat.cancel} onClick={onClose} />
      <form
        className="sheet newgroup"
        aria-label={copy.chat.newGroup}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="row">
          <span className="serif grow">{copy.chat.newGroup}</span>
          <button
            type="button"
            className="btn ghost icon sm"
            aria-label={copy.chat.cancel}
            onClick={onClose}
          >
            <Icon d={ICONS.close} size={14} />
          </button>
        </div>
        <label className="field">
          {copy.chat.name}
          <input
            className="input"
            aria-label={copy.chat.name}
            placeholder={copy.chat.nameHint}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field">
          {copy.chat.purpose}
          <input
            className="input"
            aria-label={copy.chat.purpose}
            placeholder={copy.chat.purposeHint}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </label>
        <label className="field">
          {copy.chat.scope}
          <select
            className="select"
            aria-label={copy.chat.scope}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="org">{copy.chat.scopeOrg}</option>
            {teams.map(([id, teamName]) => (
              <option key={`team:${id}`} value={`team:${id}`}>
                {copy.chat.scopeTeam(teamName)}
              </option>
            ))}
            {projects.map((p) => (
              <option key={`project:${p.projectId}`} value={`project:${p.projectId}`}>
                {copy.chat.scopeProject(p.name)}
              </option>
            ))}
          </select>
        </label>
        <h3>{copy.chat.people}</h3>
        <p className="small faint">{copy.chat.membersHint}</p>
        <fieldset className="picks" aria-label={copy.chat.people}>
          {people.map((p) => (
            <label className="pick" key={p.id}>
              <input
                type="checkbox"
                aria-label={p.name}
                checked={picked.has(`human:${p.id}`)}
                onChange={() => toggle(`human:${p.id}`)}
              />
              <Avatar id={p.id} name={p.name} />
              {p.name}
            </label>
          ))}
          {directory && people.length === 0 && (
            <span className="small faint">{copy.chat.nobodyToAdd}</span>
          )}
        </fieldset>
        <h3>{copy.chat.agents}</h3>
        <fieldset className="picks" aria-label={copy.chat.agents}>
          {agents.map((a) => {
            const key = `agent:${a.projectId}/${a.sessionId}`;
            return (
              <label className="pick" key={key}>
                <input
                  type="checkbox"
                  aria-label={a.title}
                  checked={picked.has(key)}
                  onChange={() => toggle(key)}
                />
                <Avatar id={a.sessionId} name={a.title} agent />
                <span className="serif">{a.title}</span>
                <span className="small faint ellipsis">
                  {copy.chat.agentOf(
                    directory?.people.find((p) => p.id === a.ownerId)?.name ?? a.ownerId,
                    a.projectName,
                  )}
                </span>
              </label>
            );
          })}
          {directory && agents.length === 0 && (
            <span className="small faint">{copy.chat.noAgentsToAdd}</span>
          )}
        </fieldset>
        <div className="row" style={{ justifyContent: "flex-end", paddingTop: 8 }}>
          <button type="button" className="btn sm" onClick={onClose}>
            {copy.chat.cancel}
          </button>
          <button type="submit" className="btn primary sm" disabled={!name.trim()}>
            {copy.chat.create}
          </button>
        </div>
      </form>
    </div>
  );
}

export type { ChatEvent };
