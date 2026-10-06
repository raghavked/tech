/** Chat websocket messages, layered beside the session and project messages. */
import { z } from "zod";
import { ChatEventBody, ChatMember, ChatScope } from "./events.js";

export const ChatClientMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("chat.subscribe"),
    orgId: z.string().min(1),
    userId: z.string().min(1),
    /** Display name hint for a person users.json does not know (phase-0 identity). */
    name: z.string().optional(),
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

export const ChatServerMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("chat.snapshot"), orgId: z.string(), events: z.array(ChatEvent) }),
  z.object({ type: z.literal("chat.event"), event: ChatEvent }),
]);
export type ChatServerMessage = z.infer<typeof ChatServerMessage>;

export const CHAT_MESSAGE_TYPES: ReadonlySet<string> = new Set(
  ChatClientMessage.options.map((o) => o.shape.type.value),
);
