/**
 * Chat: the command layer over one organisation's chat log. Authority lives here:
 *
 * - any member of the organisation creates a group and is its first member;
 * - a member of the group posts to it;
 * - a lead or admin of the group's scope, or the person who created the group, adds and
 *   removes members; a person may always leave;
 * - an agent is added by anyone who owns that session, or by a lead.
 *
 * Who is a lead, who owns a session and who is in the organisation come from a `ChatDirectory`
 * the host supplies, so the log itself stays pure.
 */
import { ChainLog, KernelError, type SerializedChain, shortId } from "@henosis/kernel";
import { MAIN_BRANCH } from "@henosis/protocol";
import {
  type ChatEvent,
  type ChatEventBody,
  type ChatMember,
  ChatMember as ChatMemberSchema,
  type ChatScope,
  ChatScope as ChatScopeSchema,
  type Mention,
  memberName,
  sameMember,
} from "./events.js";
import { mentionsIn } from "./mentions.js";
import {
  type ChatState,
  foldChat,
  type Group,
  hasAgent,
  isMember,
  type Message,
  reduceChat,
} from "./state.js";

export type SerializedChat = SerializedChain<ChatEvent>;

/** The chat log: one branch, hash-chained, never forked. */
export class ChatLog extends ChainLog<ChatEventBody, ChatEvent> {
  constructor() {
    super(null);
  }
  static fromSerialized(data: SerializedChat): ChatLog {
    return new ChatLog().load(data);
  }
}

/** What the host knows about people and sessions; the chat asks, never assumes. */
export interface ChatDirectory {
  /** A person in the organisation, or null when unknown here. */
  person(userId: string): { id: string; name: string } | null;
  /** A session in one of the organisation's projects, or null when unknown. */
  agent(
    projectId: string,
    sessionId: string,
  ): { projectId: string; sessionId: string; title: string; ownerId: string | null } | null;
  /** Is this person a lead or admin for the scope (team, project, or the organisation)? */
  isLead(userId: string, scope: ChatScope): boolean;
}

/** A directory with no identity file: everyone is in, nobody leads, sessions are taken on trust. */
export const OPEN_DIRECTORY: ChatDirectory = {
  person: (id) => ({ id, name: id }),
  agent: (projectId, sessionId) => ({ projectId, sessionId, title: sessionId, ownerId: null }),
  isLead: () => false,
};

export interface CreateGroupInput {
  name: string;
  scope?: ChatScope;
  purpose?: string;
  members?: ChatMember[];
}

export type ChatListener = (event: ChatEvent, state: ChatState) => void;

export interface ChatOptions {
  directory?: ChatDirectory;
  /** Wall clock for message timestamps; injectable for deterministic tests. */
  now?: () => number;
}

export class Chat {
  readonly log: ChatLog;
  private current: ChatState;
  private readonly listeners = new Set<ChatListener>();
  private readonly directory: ChatDirectory;
  private readonly now: () => number;

  constructor(log: ChatLog = new ChatLog(), opts: ChatOptions = {}) {
    this.log = log;
    this.directory = opts.directory ?? OPEN_DIRECTORY;
    this.now = opts.now ?? (() => Date.now());
    this.current = foldChat(log.eventsOf(MAIN_BRANCH));
  }

  static create(orgId: string, opts: ChatOptions = {}): Chat {
    const c = new Chat(new ChatLog(), opts);
    c.emit("system", { kind: "chat.created", payload: { orgId } });
    return c;
  }

  static fromSerialized(data: SerializedChat, opts: ChatOptions = {}): Chat {
    return new Chat(ChatLog.fromSerialized(data), opts);
  }

  state(): ChatState {
    return this.current;
  }

  events(): ChatEvent[] {
    return this.log.eventsOf(MAIN_BRANCH);
  }

  onEvent(fn: ChatListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ---- groups ------------------------------------------------------------------------

  createGroup(by: string, input: CreateGroupInput): Group {
    const who = this.directory.person(by);
    if (!who) throw new KernelError("unauthorized", `${by} is not in this organisation`);
    const name = input.name.trim();
    if (!name) throw new KernelError("invalid", "a group needs a name");
    const scope = ChatScopeSchema.parse(input.scope ?? {});
    const groupId = shortId("grp", this.current.orgId, name, by, this.current.seq + 1);
    this.emit(by, {
      kind: "group.created",
      payload: { groupId, name, scope, purpose: (input.purpose ?? "").trim() },
    });
    this.addMember(by, groupId, { kind: "human", userId: by, name: who.name });
    for (const m of input.members ?? []) {
      if (m.kind === "human" && m.userId === by) continue;
      this.addMember(by, groupId, m);
    }
    return this.group(groupId);
  }

  rename(by: string, groupId: string, name: string, purpose?: string): ChatEvent {
    const g = this.group(groupId);
    this.requireManager(by, g);
    const n = name.trim();
    if (!n) throw new KernelError("invalid", "a group needs a name");
    return this.emit(by, {
      kind: "group.renamed",
      payload: {
        groupId,
        name: n,
        ...(purpose === undefined ? {} : { purpose: purpose.trim() }),
      },
    });
  }

  /** Can this person add or remove this member? Leads and the creator manage; a session's owner adds their own agent; anyone leaves. */
  canManage(by: string, g: Group, member: ChatMember): boolean {
    if (this.directory.isLead(by, g.scope) || g.createdBy === by) return true;
    if (member.kind === "human" && member.userId === by) return true;
    if (member.kind === "agent") {
      const a = this.directory.agent(member.projectId, member.sessionId);
      if (a?.ownerId === by) return true;
    }
    return false;
  }

  addMember(by: string, groupId: string, raw: ChatMember): ChatEvent | null {
    const g = this.group(groupId);
    const parsed = ChatMemberSchema.parse(raw);
    let member: ChatMember;
    if (parsed.kind === "human") {
      const who = this.directory.person(parsed.userId);
      if (!who) throw new KernelError("not_found", `${parsed.userId} is not in this organisation`);
      member = { kind: "human", userId: who.id, name: parsed.name ?? who.name };
    } else {
      const a = this.directory.agent(parsed.projectId, parsed.sessionId);
      if (!a)
        throw new KernelError(
          "not_found",
          `no session ${parsed.sessionId} in project ${parsed.projectId}`,
        );
      member = {
        kind: "agent",
        projectId: a.projectId,
        sessionId: a.sessionId,
        title: parsed.title ?? a.title,
      };
    }
    // The creator joins their own group; after that, authority applies.
    const creating = g.members.length === 0 && member.kind === "human" && member.userId === by;
    if (!creating && !this.canManage(by, g, member))
      throw new KernelError(
        "unauthorized",
        member.kind === "agent"
          ? "only the session's owner, the group's creator or a lead adds an agent"
          : "only the group's creator or a lead adds a person",
      );
    if (g.members.some((m) => sameMember(m, member))) return null;
    return this.emit(by, { kind: "group.member.added", payload: { groupId, member } });
  }

  removeMember(by: string, groupId: string, raw: ChatMember): ChatEvent {
    const g = this.group(groupId);
    const member = ChatMemberSchema.parse(raw);
    const existing = g.members.find((m) => sameMember(m, member));
    if (!existing) throw new KernelError("not_found", `${memberName(member)} is not a member`);
    if (!this.canManage(by, g, member))
      throw new KernelError("unauthorized", "only the group's creator or a lead removes members");
    return this.emit(by, { kind: "group.member.removed", payload: { groupId, member: existing } });
  }

  // ---- messages ----------------------------------------------------------------------

  /** A person posts; the mentions are resolved against the group's members here and recorded. */
  post(
    by: string,
    groupId: string,
    text: string,
    replyTo?: string,
  ): { message: Message; mentions: Mention[]; event: ChatEvent } {
    const g = this.group(groupId);
    if (!isMember(g, by))
      throw new KernelError("unauthorized", `${by} is not a member of ${g.name}`);
    const t = text.trim();
    if (!t) throw new KernelError("invalid", "nothing to say");
    if (replyTo && !(this.current.messages[groupId] ?? []).some((m) => m.id === replyTo))
      throw new KernelError("not_found", `no message ${replyTo} in ${g.name}`);
    const mentions = mentionsIn(t, g);
    const messageId = shortId("msg", groupId, by, this.current.seq + 1, t);
    const event = this.emit(by, {
      kind: "message.posted",
      payload: {
        groupId,
        messageId,
        text: t,
        mentions,
        ...(replyTo ? { replyTo } : {}),
        at: this.now(),
      },
    });
    const message = (this.current.messages[groupId] ?? []).find((m) => m.id === messageId);
    if (!message) throw new KernelError("invalid", "message did not fold");
    return { message, mentions, event };
  }

  /** An agent member answers a message it was mentioned in; the first 1200 characters are kept. */
  agentReply(
    projectId: string,
    sessionId: string,
    groupId: string,
    inReplyTo: string,
    text: string,
    turn: number,
  ): ChatEvent {
    const g = this.group(groupId);
    if (!hasAgent(g, projectId, sessionId))
      throw new KernelError("unauthorized", `session ${sessionId} is not a member of ${g.name}`);
    const t = text.trim().slice(0, 1200);
    if (!t) throw new KernelError("invalid", "nothing to say");
    const messageId = shortId("msg", groupId, sessionId, this.current.seq + 1, t);
    return this.emit(`session:${sessionId}`, {
      kind: "message.agent.replied",
      payload: {
        groupId,
        messageId,
        inReplyTo,
        projectId,
        sessionId,
        text: t,
        turn,
        at: this.now(),
      },
    });
  }

  /** Mark a group read up to `seq` (default: everything so far). Returns null when nothing advanced. */
  read(by: string, groupId: string, seq?: number): ChatEvent | null {
    const g = this.group(groupId);
    if (!isMember(g, by))
      throw new KernelError("unauthorized", `${by} is not a member of ${g.name}`);
    const upTo = seq ?? g.lastSeq;
    if ((this.current.reads[by]?.[groupId] ?? -1) >= upTo) return null;
    return this.emit(by, { kind: "group.read", payload: { groupId, seq: upTo } });
  }

  // ---- internals ---------------------------------------------------------------------

  group(groupId: string): Group {
    const g = this.current.groups[groupId];
    if (!g) throw new KernelError("not_found", `unknown group ${groupId}`);
    return g;
  }

  private requireManager(by: string, g: Group): void {
    if (this.directory.isLead(by, g.scope) || g.createdBy === by) return;
    throw new KernelError("unauthorized", "only the group's creator or a lead changes it");
  }

  private emit(actor: string, body: ChatEventBody): ChatEvent {
    const event = this.log.append(MAIN_BRANCH, actor, body);
    this.current = reduceChat(this.current, event);
    for (const fn of this.listeners) fn(event, this.current);
    return event;
  }
}
