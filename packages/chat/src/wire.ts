/** Chat websocket messages, layered beside the session and project messages. */
import { z } from "zod";
import {
  ChatEventBody,
  ChatMember,
  ChatScope,
  CouncilMember,
  CouncilRound,
  DEFAULT_COUNCIL_ROUNDS,
  GroupRole,
} from "./events.js";

export const ChatClientMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("chat.subscribe"),
    orgId: z.string().min(1),
    userId: z.string().min(1),
    /** Display name hint for a person users.json does not know (phase-0 identity). */
    name: z.string().optional(),
    /** Identity: the provider's ID token in oidc mode (packages/server/src/auth.ts). */
    token: z.string().optional(),
  }),
  z.object({ type: z.literal("chat.unsubscribe") }),
  z.object({
    type: z.literal("chat.create"),
    name: z.string().min(1).max(80),
    scope: ChatScope.default({}),
    purpose: z.string().max(400).default(""),
    members: z.array(ChatMember).default([]),
  }),
  z.object({ type: z.literal("chat.add"), groupId: z.string(), member: ChatMember }),
  z.object({ type: z.literal("chat.remove"), groupId: z.string(), member: ChatMember }),
  z.object({
    type: z.literal("chat.rename"),
    groupId: z.string(),
    name: z.string().min(1).max(80),
    purpose: z.string().max(400).optional(),
  }),
  z.object({
    type: z.literal("chat.say"),
    groupId: z.string(),
    text: z.string().min(1).max(4000),
    replyTo: z.string().optional(),
  }),
  z.object({ type: z.literal("chat.read"), groupId: z.string() }),
  // ---- the council (docs/19_council.md) ----
  /** Convene a council in a group: the task, the member models, the chair, the rounds, a budget. */
  z.object({
    type: z.literal("chat.council.convene"),
    groupId: z.string().min(1),
    task: z.string().min(1).max(4000),
    members: z.array(CouncilMember).min(1),
    /** Defaults to the convener's own model among the members, else the first member. */
    chair: CouncilMember.optional(),
    rounds: z.array(CouncilRound).min(1).default(DEFAULT_COUNCIL_ROUNDS),
    discussionRounds: z.number().int().min(0).default(1),
    budget: z.number().int().min(1).nullable().default(null),
  }),
  /** A private word to one member model, by its profile id. */
  z.object({
    type: z.literal("chat.council.instruct"),
    councilId: z.string().min(1),
    profileId: z.string().min(1),
    text: z.string().min(1).max(4000),
  }),
  /** End a council early (the convener or a lead). */
  z.object({
    type: z.literal("chat.council.end"),
    councilId: z.string().min(1),
    summary: z.string().max(12_000).optional(),
  }),
  /** Hand the keys on: a member becomes a host, or a host a member again. */
  z.object({
    type: z.literal("chat.role"),
    groupId: z.string(),
    userId: z.string().min(1),
    role: GroupRole,
  }),
  /** Is this name free for a new group? Answered with `chat.name` as the name is typed. */
  z.object({ type: z.literal("chat.check"), name: z.string().max(80) }),
]);
export type ChatClientMessage = z.infer<typeof ChatClientMessage>;

const ChatEvent = z
  .object({
    id: z.string(),
    prev: z.string().nullable(),
    seq: z.number(),
    branch: z.string(),
    ts: z.number(),
    actor: z.string(),
  })
  .and(ChatEventBody);

/**
 * What the server sends: the snapshot and every event, council events included (they are
 * `chat.event`s like any other, so one reducer folds them on both sides).
 */
/** An agent member that was mentioned and has not answered yet: what the typing line shows. */
export const Answering = z.object({
  groupId: z.string(),
  projectId: z.string(),
  sessionId: z.string(),
  /** The message that mentioned it. */
  messageId: z.string(),
  /** Who wrote that message. */
  askedBy: z.string(),
  /** Wall clock when the mention reached the session. */
  since: z.number().int().min(0),
});
export type Answering = z.infer<typeof Answering>;

export const ChatServerMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("chat.snapshot"),
    orgId: z.string(),
    events: z.array(ChatEvent),
    /** Mentions still waiting on an agent, across the organisation, at the time of the snapshot. */
    answering: z.array(Answering).default([]),
  }),
  z.object({ type: z.literal("chat.event"), event: ChatEvent }),
  /** An agent member is (or is no longer) answering a mention in a group; live state, not log. */
  z.object({ type: z.literal("chat.answering"), on: z.boolean(), answering: Answering }),
  /** The answer to `chat.check`. */
  z.object({ type: z.literal("chat.name"), name: z.string(), free: z.boolean() }),
]);
export type ChatServerMessage = z.infer<typeof ChatServerMessage>;

export const CHAT_MESSAGE_TYPES: ReadonlySet<string> = new Set(
  ChatClientMessage.options.map((o) => o.shape.type.value),
);

/** The council events, for a client that filters a group's stream into a council room. */
export const COUNCIL_EVENT_KINDS: ReadonlySet<string> = new Set([
  "council.convened",
  "council.round.started",
  "council.said",
  "council.instructed",
  "council.synthesised",
  "council.assigned",
  "council.reported",
  "council.concluded",
]);
