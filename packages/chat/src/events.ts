/**
 * Groups and chats: one hash-chained log per organisation where people and agents are
 * members of the same circle. A group is a named conversation with a purpose and a scope (a
 * team or a project); its members are humans by user id and agents by session. A message
 * that mentions an agent member reaches that agent's session as a directive, and the
 * agent's next words come back into the group as a reply. Every event is chained like a
 * session log, so a chat replays, audits and verifies the same way.
 */
import type { ChainEvent } from "@henosis/kernel";
import { RiskClass, Usage } from "@henosis/protocol";
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

// ---- the council (docs/19_council.md) ------------------------------------------------

/**
 * A member model: the agent a person, a manager or a team brings to a council. `profileId`
 * names the profile (provider, model, persona, tools, budget) that lives in users.json or the
 * org's agents.json; `userId` is the owner, null for a shared team agent. The name is the
 * display hint recorded when the council is convened, so the log renders on its own.
 */
export const CouncilMember = z.object({
  kind: z.literal("agent"),
  userId: z.string().min(1).nullable(),
  profileId: z.string().min(1),
  name: z.string().min(1).max(80),
});
export type CouncilMember = z.infer<typeof CouncilMember>;

/**
 * The rounds a council runs, in order: every model answers alone; they discuss; the chair
 * writes the plan; the people rate it.
 */
export const CouncilRound = z.enum(["individual", "discussion", "synthesis", "vote"]);
export type CouncilRound = z.infer<typeof CouncilRound>;
export const DEFAULT_COUNCIL_ROUNDS: CouncilRound[] = [
  "individual",
  "discussion",
  "synthesis",
  "vote",
];

export const CouncilStance = z.enum(["agree", "differ", "add"]);
export type CouncilStance = z.infer<typeof CouncilStance>;

/** A step of the chair's plan: the session plan step plus the member model that owns it. */
export const CouncilStep = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().default(""),
  estTokens: z.number().int().min(0).default(0),
  risk: RiskClass.default("write"),
  owner: CouncilMember,
});
export type CouncilStep = z.infer<typeof CouncilStep>;

export const CouncilDissent = z.object({ member: CouncilMember, text: z.string().min(1) });
export type CouncilDissent = z.infer<typeof CouncilDissent>;

export const CouncilCite = z.object({ kind: z.literal("instruction"), by: z.string().min(1) });
export type CouncilCite = z.infer<typeof CouncilCite>;

export const CouncilReportStatus = z.enum(["done", "blocked", "revised"]);
export type CouncilReportStatus = z.infer<typeof CouncilReportStatus>;

export const CouncilOutcome = z.enum(["done", "abandoned", "revised"]);
export type CouncilOutcome = z.infer<typeof CouncilOutcome>;

/** What a person may do in a group: the creator manages it, a host manages it too, a member reads and writes. */
export const GroupRole = z.enum(["host", "member"]);
export type GroupRole = z.infer<typeof GroupRole>;

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
  /**
   * A person's role in the group. The creator is the group's first host and is never demoted
   * here; a host adds, removes and renames like the creator. A group role never lifts a mention
   * above contributor rank in an agent's session (Decision 5).
   */
  base(
    "group.role.set",
    z.object({ groupId: z.string(), userId: z.string().min(1), role: GroupRole }),
  ),
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
  // ---- the council: one chain of events in the group's log ----
  base(
    "council.convened",
    z.object({
      councilId: z.string().min(1),
      groupId: z.string().min(1),
      task: z.string().min(1).max(4000),
      chair: CouncilMember,
      members: z.array(CouncilMember).min(1),
      rounds: z.array(CouncilRound).min(1),
      discussionRounds: z.number().int().min(0).default(1),
      budget: z.number().int().min(1).nullable().default(null),
      by: z.string().min(1),
    }),
  ),
  base(
    "council.round.started",
    z.object({
      councilId: z.string().min(1),
      round: CouncilRound,
      index: z.number().int().min(0),
    }),
  ),
  base(
    "council.said",
    z.object({
      councilId: z.string().min(1),
      round: CouncilRound,
      index: z.number().int().min(0),
      member: CouncilMember,
      text: z.string().min(1).max(12_000),
      usage: Usage.default({}),
      cites: z.array(CouncilCite).default([]),
      stance: CouncilStance.optional(),
    }),
  ),
  /** Private: a person's message to one model; visible to that model's owner and the chair. */
  base(
    "council.instructed",
    z.object({
      councilId: z.string().min(1),
      member: CouncilMember,
      by: z.string().min(1),
      text: z.string().min(1).max(4000),
    }),
  ),
  base(
    "council.synthesised",
    z.object({
      councilId: z.string().min(1),
      planId: z.string().min(1),
      steps: z.array(CouncilStep),
      dissent: z.array(CouncilDissent).default([]),
    }),
  ),
  base(
    "council.assigned",
    z.object({
      councilId: z.string().min(1),
      stepId: z.string().min(1),
      owner: CouncilMember,
      projectId: z.string().min(1),
      sessionId: z.string().min(1),
    }),
  ),
  base(
    "council.reported",
    z.object({
      councilId: z.string().min(1),
      stepId: z.string().min(1),
      owner: CouncilMember,
      status: CouncilReportStatus,
      text: z.string().max(12_000).default(""),
      usage: Usage.default({}),
    }),
  ),
  base(
    "council.concluded",
    z.object({
      councilId: z.string().min(1),
      outcome: CouncilOutcome,
      summary: z.string().max(12_000).default(""),
      usage: Usage.default({}),
    }),
  ),
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

/** One stable key per member model: `model:<profileId>`. */
export function councilMemberKey(m: CouncilMember): string {
  return `model:${m.profileId}`;
}

export function sameCouncilMember(a: CouncilMember, b: CouncilMember): boolean {
  return a.profileId === b.profileId;
}

export function scopeKey(s: ChatScope): string {
  return s.projectId ? `project:${s.projectId}` : s.teamId ? `team:${s.teamId}` : "org";
}
