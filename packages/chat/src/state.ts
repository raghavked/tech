/** Chat state: the fold of an organisation's chat log. Pure and total, like the session reducer. */
import {
  type ChatEvent,
  type ChatMember,
  type ChatScope,
  type Mention,
  memberKey,
  sameMember,
} from "./events.js";

export interface Group {
  id: string;
  name: string;
  scope: ChatScope;
  purpose: string;
  members: ChatMember[];
  /** User id of the person who created it; they manage members beside the leads. */
  createdBy: string;
  createdSeq: number;
  /** Seq of the last event that touched this group (a message, a member, a rename). */
  lastSeq: number;
  /** Seq of the last message in the group, or -1 when none yet. */
  lastMessageSeq: number;
}

export type MessageAuthor =
  | { kind: "human"; userId: string }
  | { kind: "agent"; projectId: string; sessionId: string };

export interface Message {
  id: string;
  groupId: string;
  seq: number;
  at: number;
  author: MessageAuthor;
  text: string;
  mentions: Mention[];
  replyTo: string | null;
  /** The agent turn a reply came from; null for a human message. */
  turn: number | null;
}

export interface ChatState {
  orgId: string;
  head: string | null;
  seq: number;
  groups: Record<string, Group>;
  messages: Record<string, Message[]>;
  /** userId -> groupId -> seq of the last event the person has read. */
  reads: Record<string, Record<string, number>>;
}

export function initialChatState(): ChatState {
  return { orgId: "", head: null, seq: -1, groups: {}, messages: {}, reads: {} };
}

export function reduceChat(prev: ChatState, e: ChatEvent): ChatState {
  const s: ChatState = structuredClone(prev);
  s.head = e.id;
  s.seq = e.seq;
  switch (e.kind) {
    case "chat.created":
      s.orgId = e.payload.orgId;
      break;
    case "group.created":
      s.groups[e.payload.groupId] = {
        id: e.payload.groupId,
        name: e.payload.name,
        scope: e.payload.scope,
        purpose: e.payload.purpose,
        members: [],
        createdBy: e.actor,
        createdSeq: e.seq,
        lastSeq: e.seq,
        lastMessageSeq: -1,
      };
      s.messages[e.payload.groupId] = [];
      break;
    case "group.member.added": {
      const g = s.groups[e.payload.groupId];
      if (!g) break;
      const i = g.members.findIndex((m) => sameMember(m, e.payload.member));
      if (i >= 0) g.members[i] = e.payload.member;
      else g.members.push(e.payload.member);
      g.lastSeq = e.seq;
      break;
    }
    case "group.member.removed": {
      const g = s.groups[e.payload.groupId];
      if (!g) break;
      g.members = g.members.filter((m) => !sameMember(m, e.payload.member));
      g.lastSeq = e.seq;
      break;
    }
    case "group.renamed": {
      const g = s.groups[e.payload.groupId];
      if (!g) break;
      g.name = e.payload.name;
      if (e.payload.purpose !== undefined) g.purpose = e.payload.purpose;
      g.lastSeq = e.seq;
      break;
    }
    case "message.posted": {
      const g = s.groups[e.payload.groupId];
      if (!g) break;
      const list = s.messages[g.id] ?? [];
      s.messages[g.id] = list;
      list.push({
        id: e.payload.messageId,
        groupId: g.id,
        seq: e.seq,
        at: e.payload.at,
        author: { kind: "human", userId: e.actor },
        text: e.payload.text,
        mentions: e.payload.mentions,
        replyTo: e.payload.replyTo ?? null,
        turn: null,
      });
      g.lastSeq = e.seq;
      g.lastMessageSeq = e.seq;
      // Your own message never counts as unread for you.
      const reads = s.reads[e.actor] ?? {};
      reads[g.id] = e.seq;
      s.reads[e.actor] = reads;
      break;
    }
    case "message.agent.replied": {
      const g = s.groups[e.payload.groupId];
      if (!g) break;
      const list = s.messages[g.id] ?? [];
      s.messages[g.id] = list;
      list.push({
        id: e.payload.messageId,
        groupId: g.id,
        seq: e.seq,
        at: e.payload.at,
        author: {
          kind: "agent",
          projectId: e.payload.projectId,
          sessionId: e.payload.sessionId,
        },
        text: e.payload.text,
        mentions: [],
        replyTo: e.payload.inReplyTo,
        turn: e.payload.turn,
      });
      g.lastSeq = e.seq;
      g.lastMessageSeq = e.seq;
      break;
    }
    case "group.read": {
      const r = s.reads[e.actor] ?? {};
      r[e.payload.groupId] = Math.max(r[e.payload.groupId] ?? -1, e.payload.seq);
      s.reads[e.actor] = r;
      break;
    }
  }
  return s;
}

export function foldChat(events: readonly ChatEvent[], from?: ChatState): ChatState {
  let s = from ?? initialChatState();
  for (const e of events) s = reduceChat(s, e);
  return s;
}

/** Is this person a member of the group? */
export function isMember(g: Group, userId: string): boolean {
  return g.members.some((m) => m.kind === "human" && m.userId === userId);
}

/** Is this session a member of the group? */
export function hasAgent(g: Group, projectId: string, sessionId: string): boolean {
  return g.members.some(
    (m) => m.kind === "agent" && m.projectId === projectId && m.sessionId === sessionId,
  );
}

/** The groups a person belongs to, most recently active first. */
export function groupsOf(s: ChatState, userId: string): Group[] {
  return Object.values(s.groups)
    .filter((g) => isMember(g, userId))
    .sort((a, b) => b.lastSeq - a.lastSeq);
}

/** Messages in a group this person has not read, excluding their own. */
export function unreadIn(s: ChatState, userId: string, groupId: string): number {
  const read = s.reads[userId]?.[groupId] ?? -1;
  return (s.messages[groupId] ?? []).filter(
    (m) => m.seq > read && !(m.author.kind === "human" && m.author.userId === userId),
  ).length;
}

/** Unread messages per group the person belongs to. */
export function unreadByGroup(s: ChatState, userId: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of groupsOf(s, userId)) out[g.id] = unreadIn(s, userId, g.id);
  return out;
}

/** Unread messages across every group the person belongs to. */
export function unreadCount(s: ChatState, userId: string): number {
  let n = 0;
  for (const v of Object.values(unreadByGroup(s, userId))) n += v;
  return n;
}

export { memberKey };
