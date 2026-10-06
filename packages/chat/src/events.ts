/**
 * Groups and chats: one hash-chained log per organisation where people and agents are
 * members of the same circle. A group is a named conversation with a purpose and a scope (a
 * team or a project); its members are humans by user id and agents by session. A message
 * that mentions an agent member reaches that agent's session as a directive, and the
 * agent's next words come back into the group as a reply. Every event is chained like a
 * session log, so a chat replays, audits and verifies the same way.
 */
import type { ChainEvent } from "@henosis/kernel";
import { z } from "zod";

export const ChatScope = z.object({
  teamId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
});
export type ChatScope = z.infer<typeof ChatScope>;

/**
 * A member of a group. Names are recorded when the member is added so the log renders on its
 * own (and so `@Name` resolves without a directory); they are display hints, not identity.
 */
export const ChatMember = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("human"), userId: z.string().min(1), name: z.string().optional() }),
  z.object({
    kind: z.literal("agent"),
    projectId: z.string().min(1),
    sessionId: z.string().min(1),
    title: z.string().optional(),
  }),
]);
export type ChatMember = z.infer<typeof ChatMember>;

/** A mention resolved at post time: a person by user id or an agent by session id. */
export const Mention = z.object({ kind: z.enum(["human", "agent"]), id: z.string().min(1) });
export type Mention = z.infer<typeof Mention>;

const base = <K extends string, P extends z.ZodTypeAny>(kind: K, payload: P) =>
  z.object({ kind: z.literal(kind), payload });

export const ChatEventBody = z.discriminatedUnion("kind", [
  base("chat.created", z.object({ orgId: z.string().min(1) })),
  base(
    "group.created",
    z.object({
      groupId: z.string().min(1),
      name: z.string().min(1).max(80),
      scope: ChatScope,
      purpose: z.string().max(400).default(""),
    }),
  ),
  base("group.member.added", z.object({ groupId: z.string(), member: ChatMember })),
  base("group.member.removed", z.object({ groupId: z.string(), member: ChatMember })),
  base(
    "group.renamed",
    z.object({
      groupId: z.string(),
      name: z.string().min(1).max(80),
      purpose: z.string().max(400).optional(),
    }),
  ),
  base(
    "message.posted",
    z.object({
      groupId: z.string(),
      messageId: z.string(),
      text: z.string().min(1).max(4000),
      mentions: z.array(Mention).default([]),
      replyTo: z.string().optional(),
      /** Wall-clock time the server accepted it; the chain's `ts` is a logical clock. */
      at: z.number().int().min(0).default(0),
    }),
  ),
  base(
    "message.agent.replied",
    z.object({
      groupId: z.string(),
      messageId: z.string(),
      inReplyTo: z.string(),
      projectId: z.string(),
      sessionId: z.string(),
      text: z.string().min(1).max(1200),
      turn: z.number().int().min(0),
      at: z.number().int().min(0).default(0),
    }),
  ),
  /** Per-person read marker; the actor is the reader. */
  base("group.read", z.object({ groupId: z.string(), seq: z.number().int().min(-1) })),
]);
export type ChatEventBody = z.infer<typeof ChatEventBody>;
export type ChatEventKind = ChatEventBody["kind"];
export type ChatEvent = ChatEventBody & ChainEvent;

/** One stable key per member: `human:<userId>` or `agent:<projectId>/<sessionId>`. */
export function memberKey(m: ChatMember): string {
  return m.kind === "human" ? `human:${m.userId}` : `agent:${m.projectId}/${m.sessionId}`;
}

export function sameMember(a: ChatMember, b: ChatMember): boolean {
  return memberKey(a) === memberKey(b);
}

/** What a member is called: the recorded name or title, else its id. */
export function memberName(m: ChatMember): string {
  return m.kind === "human" ? (m.name ?? m.userId) : (m.title ?? m.sessionId);
}

/** The id a mention carries for this member. */
export function memberId(m: ChatMember): string {
  return m.kind === "human" ? m.userId : m.sessionId;
}

export function scopeKey(s: ChatScope): string {
  return s.projectId ? `project:${s.projectId}` : s.teamId ? `team:${s.teamId}` : "org";
}
