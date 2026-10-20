/**
 * Groups and chats (feature: groups-chats): a group is a circle of people and agents. A
 * message that mentions an agent member reaches its session as a steer; the agent's next words
 * come back as a reply. This page composes the pieces in `src/chat/`: the groups list, the
 * stream and the composer with its @ completion, the members drawer, and the New group sheet,
 * over one websocket to the organisation's chat.
 */
import {
  type ChatEvent,
  type ChatMember,
  type CouncilMember,
  isMember,
  memberName,
  unreadIn,
} from "@henosis/chat";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Shell, type ShellContext } from "../App.js";
import { api, type Me, useFetch } from "../api.js";
import { Composer } from "../chat/Composer.js";
import { GroupsList } from "../chat/GroupsList.js";
import { MembersDrawer } from "../chat/MembersDrawer.js";
import { NewGroupSheet } from "../chat/NewGroupSheet.js";
import { Stream } from "../chat/Stream.js";
import { Hash, liveOf, MemberStack } from "../chat/shared.js";
import { ChatClient } from "../chatClient.js";
import { wsUrl } from "../client.js";
import { copy } from "../copy.js";
import { memberOf } from "../council.js";
import type { Identity } from "../identity.js";
import { notifyIfHidden } from "../notify.js";
import { rememberRoom } from "../recents.js";
import { ReconnectLine } from "../reconnect.js";
import { navigate, paths } from "../router.js";
import { ErrorLine, ICONS, Icon, Loader, Mark, toast, useConnectionToasts } from "../ui.js";
import {
  ConveneSheet,
  CouncilMembersPanel,
  CouncilRoom,
  CouncilStrip,
  InstructRoom,
} from "./Council.js";

export type { NewGroupInput } from "../chat/NewGroupSheet.js";

export function ChatView({
  orgId,
  groupId,
  newGroup,
  convene = false,
  councilId = null,
  instruct = null,
  identity,
  me,
  ctx,
}: {
  orgId: string;
  groupId: string | null;
  newGroup: boolean;
  /** The council (docs/19_council.md): the convene sheet, a council room, an instruct room. */
  convene?: boolean;
  councilId?: string | null;
  instruct?: string | null;
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
  const live = useMemo(() => liveOf(directory.data), [directory.data]);
  const [members, setMembers] = useState(false);
  const [creating, setCreating] = useState(newGroup);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the route decides whether the sheet is open
  useEffect(() => setCreating(newGroup), [newGroup, groupId]);
  const [convening, setConvening] = useState(convene);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the route decides whether the sheet is open
  useEffect(() => setConvening(convene), [convene, groupId]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the drawer closes when the room changes
  useEffect(() => setMembers(false), [councilId, instruct]);
  // The join toast: the member this person just added, with Undo while it shows.
  const [joined, setJoined] = useState<{ groupId: string; member: ChatMember } | null>(null);
  useEffect(() => {
    if (!joined) return;
    const t = setTimeout(() => setJoined(null), 6_000);
    return () => clearTimeout(t);
  }, [joined]);

  // A group this person just created opens as soon as the server says so; a mention of them
  // elsewhere becomes a browser notification while the tab is hidden; a council they convened
  // opens the same way; and every event tells the rail's Chats count to look again, so it is
  // one number across the pages.
  const pendingName = useRef<string | null>(null);
  const pendingTask = useRef<string | null>(null);
  const poke = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () =>
      client.onLiveEvent((e: ChatEvent) => {
        if (
          e.kind === "group.created" &&
          e.actor === meId &&
          e.payload.name === pendingName.current
        ) {
          pendingName.current = null;
          toast(copy.chat.created(e.payload.name));
          navigate(paths.chat(orgId, e.payload.groupId));
        }
        if (
          e.kind === "council.convened" &&
          e.actor === meId &&
          e.payload.task === pendingTask.current
        ) {
          pendingTask.current = null;
          toast(copy.council.convened(e.payload.members.length));
          navigate(paths.council(orgId, e.payload.groupId, e.payload.councilId));
          dispatchEvent(new Event("henosis:chat"));
        }
        if (e.kind === "council.instructed" && e.actor === meId) toast(copy.council.instructSent);
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
        }
        if (e.kind === "group.member.added" && e.actor === meId && groupId === e.payload.groupId) {
          const m = e.payload.member;
          if (!(m.kind === "human" && m.userId === meId))
            setJoined({ groupId: e.payload.groupId, member: m });
        }
        if (poke.current) clearTimeout(poke.current);
        poke.current = setTimeout(() => dispatchEvent(new Event("henosis:chat")), 300);
      }),
    [client, meId, orgId, groupId],
  );
  const onCheck = useCallback(
    (name: string) => client.send({ type: "chat.check", name }),
    [client],
  );

  const group = groupId && s ? (s.groups[groupId] ?? null) : null;
  // Where the warm rule goes: what this person had read when the group opened, before the
  // composer marks the rest read.
  const opened = useRef<{ groupId: string; read: number } | null>(null);
  if (group && opened.current?.groupId !== group.id)
    opened.current = { groupId: group.id, read: s?.reads[meId]?.[group.id] ?? -1 };
  const readAtOpen = opened.current?.read ?? -1;

  // Quick open (desktop-tray): the last rooms by name sit beside the last sessions.
  const groupName = group?.name ?? null;
  useEffect(() => {
    if (groupId && groupName) rememberRoom({ orgId, groupId, title: groupName });
  }, [orgId, groupId, groupName]);
  const sheet = creating && (
    <NewGroupSheet
      orgId={orgId}
      orgName={orgName}
      me={me}
      meId={meId}
      meName={identity.name}
      directory={directory.data}
      names={snap.names}
      onCheck={onCheck}
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
    const groups = s ? Object.values(s.groups).filter((g) => isMember(g, meId)) : [];
    // The phone subtitle (mobile-chat): "3 groups · 2 unread".
    const totalUnread = s ? groups.reduce((n, g) => n + unreadIn(s, meId, g.id), 0) : 0;
    return (
      <Shell
        ctx={ctx}
        title={copy.chat.title}
        subtitle={s ? copy.chat.groupsLine(groups.length, totalUnread) : copy.chat.joining}
        below={
          <ReconnectLine
            reconnecting={snap.reconnecting}
            retry={snap.retry}
            onTryNow={() => client.reconnectNow()}
          />
        }
        right={
          <button type="button" className="btn primary sm" onClick={() => setCreating(true)}>
            <Icon d={ICONS.plus} size={14} />
            {copy.chat.newGroup}
          </button>
        }
      >
        {sheet}
        {!s && (
          <div className="column page">
            <h1>{copy.shell.orgChats(orgName)}</h1>
            <ErrorLine errors={snap.errors} />
            <p className="muted row" role="status">
              <Loader kind="halo" />
              {copy.chat.joining}
            </p>
          </div>
        )}
        {s && (
          <>
            {groupId && !group && (
              <div className="column page" style={{ paddingBottom: 0 }}>
                <p className="muted">{copy.chat.unknownGroup}</p>
              </div>
            )}
            <GroupsList
              orgId={orgId}
              orgName={orgName}
              state={s}
              groups={groups}
              meId={meId}
              live={live}
              directory={directory.data}
              answering={snap.answering}
              me={me}
            />
          </>
        )}
      </Shell>
    );
  }

  const mine = isMember(group, meId);
  const instructModel = (member: CouncilMember, text: string) => {
    if (!councilId) return;
    client.send({ type: "chat.council.instruct", councilId, profileId: member.profileId, text });
  };
  const conveneSheet = convening && (
    <ConveneSheet
      group={group}
      meId={meId}
      directory={directory.data}
      onClose={() => {
        setConvening(false);
        if (convene) navigate(paths.chat(orgId, group.id));
      }}
      onConvene={(input) => {
        pendingTask.current = input.task;
        client.send({ type: "chat.council.convene", ...input });
      }}
    />
  );

  // The council room and the instruct room (docs/19_council.md) live inside the group.
  const council = councilId ? (s.councils?.[councilId] ?? null) : null;
  if (councilId && (!council || council.groupId !== group.id)) {
    return (
      <Shell
        ctx={ctx}
        title={
          <span className="ellipsis serif">
            <Hash />
            {group.name}
          </span>
        }
      >
        <div className="column page">
          <p className="muted">{copy.council.unknown}</p>
          <a className="small" href={paths.chat(orgId, group.id)}>
            {copy.council.backToGroup}
          </a>
        </div>
      </Shell>
    );
  }
  if (council) {
    const target = instruct ? memberOf(council, instruct) : null;
    return (
      <Shell
        ctx={ctx}
        title={
          <>
            <span className="ellipsis serif">
              <Hash />
              {group.name}
            </span>
            <span className="purpose ellipsis">
              {target ? copy.council.instructRoom(target.name) : copy.council.title}
            </span>
          </>
        }
        right={
          <button
            type="button"
            className={`btn sm${members ? " on" : ""}`}
            aria-pressed={members}
            onClick={() => setMembers((v) => !v)}
          >
            <Icon d={ICONS.columns} size={14} />
            {copy.council.panel}
          </button>
        }
        below={
          <ReconnectLine
            reconnecting={snap.reconnecting}
            retry={snap.retry}
            onTryNow={() => client.reconnectNow()}
          />
        }
        drawer={
          members ? (
            <CouncilMembersPanel
              orgId={orgId}
              group={group}
              council={council}
              meId={meId}
              directory={directory.data}
              onInstruct={instructModel}
              onClose={() => setMembers(false)}
            />
          ) : null
        }
      >
        <ErrorLine errors={snap.errors} />
        {target ? (
          <InstructRoom
            orgId={orgId}
            group={group}
            council={council}
            member={target}
            meId={meId}
            directory={directory.data}
            onInstruct={instructModel}
          />
        ) : (
          <CouncilRoom
            orgId={orgId}
            group={group}
            council={council}
            identity={identity}
            me={me}
            directory={directory.data}
            onEnd={() => client.send({ type: "chat.council.end", councilId: council.id })}
          />
        )}
      </Shell>
    );
  }

  return (
    <Shell
      ctx={ctx}
      title={
        <>
          <span className="ellipsis serif">
            <Hash />
            {group.name}
          </span>
          {group.purpose && <span className="purpose ellipsis">{group.purpose}</span>}
        </>
      }
      right={
        <>
          <MemberStack members={group.members} live={live} />
          {mine && (
            <button
              type="button"
              className="btn sm"
              aria-label={copy.council.convene}
              onClick={() => setConvening(true)}
            >
              {copy.council.conveneShort}
            </button>
          )}
          <button
            type="button"
            className={`btn sm${members ? " on" : ""}`}
            aria-pressed={members}
            onClick={() => setMembers((v) => !v)}
          >
            <Icon d={ICONS.columns} size={14} />
            {copy.chat.members}
          </button>
        </>
      }
      below={
        <ReconnectLine
          reconnecting={snap.reconnecting}
          retry={snap.retry}
          onTryNow={() => client.reconnectNow()}
        />
      }
      drawer={
        members ? (
          <MembersDrawer
            group={group}
            meId={meId}
            orgName={orgName}
            live={live}
            directory={directory.data}
            events={snap.events}
            projectNameOf={(id) => me?.projects.find((p) => p.projectId === id)?.name ?? id}
            onAdd={(member) => client.send({ type: "chat.add", groupId: group.id, member })}
            onRemove={(member) => client.send({ type: "chat.remove", groupId: group.id, member })}
            onRole={(userId, role) =>
              client.send({ type: "chat.role", groupId: group.id, userId, role })
            }
            onClose={() => setMembers(false)}
          />
        ) : null
      }
    >
      {sheet}
      {conveneSheet}
      <CouncilStrip orgId={orgId} group={group} councils={s.councils ?? {}} />
      {joined && joined.groupId === group.id && (
        <div className="join-toast" role="status">
          <Mark size={26} joining className="once" />
          <span>
            <i>{memberName(joined.member)}</i> {copy.chat.joinsCircleOne.trim()}
          </span>
          <button
            type="button"
            className="undo"
            onClick={() => {
              client.send({ type: "chat.remove", groupId: group.id, member: joined.member });
              setJoined(null);
            }}
          >
            {copy.chat.undo}
          </button>
        </div>
      )}
      <Stream
        group={group}
        state={s}
        events={snap.events}
        meId={meId}
        live={live}
        directory={directory.data}
        answering={snap.answering}
        readAtOpen={readAtOpen}
        errors={snap.errors}
      />
      {mine ? (
        <Composer
          group={group}
          meId={meId}
          read={s.reads[meId]?.[group.id] ?? -1}
          live={live}
          directory={directory.data}
          onSay={(text) => client.send({ type: "chat.say", groupId: group.id, text })}
          onRead={() => client.send({ type: "chat.read", groupId: group.id })}
        />
      ) : (
        <div className="composer-wrap">
          <p className="hint small muted">{copy.chat.notAMember}</p>
        </div>
      )}
    </Shell>
  );
}
