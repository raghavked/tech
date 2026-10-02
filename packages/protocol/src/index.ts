/**
 * Fold session protocol.
 *
 * Everything in a session is an event in an append-only, hash-chained log. Humans and
 * agents are actors; participants are actors with a role in a session. Directives are how
 * humans steer; approvals gate risky tool calls; checkpoints make forks and merges possible.
 *
 * This package is the single source of truth for the shapes exchanged between the kernel,
 * the runner, the server, the CLI and the web client. It has no runtime dependency except zod.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------------------
// Actors and roles
// ---------------------------------------------------------------------------------------

export const ActorKind = z.enum(["human", "agent", "system"]);
export type ActorKind = z.infer<typeof ActorKind>;

export const Actor = z.object({
  id: z.string().min(1),
  kind: ActorKind,
  name: z.string().min(1),
});
export type Actor = z.infer<typeof Actor>;

/** Authority lattice: observer < contributor < driver < owner. */
export const Role = z.enum(["observer", "contributor", "driver", "owner"]);
export type Role = z.infer<typeof Role>;

export const ROLE_RANK: Record<Role, number> = {
  observer: 0,
  contributor: 1,
  driver: 2,
  owner: 3,
};

/** Rank of a project-level directive from a lead: above every session role. */
export const LEAD_RANK = 4;

export const DirectiveOrigin = z.enum(["session", "project"]);
export type DirectiveOrigin = z.infer<typeof DirectiveOrigin>;

// ---------------------------------------------------------------------------------------
// Directives: how humans steer the agent
// ---------------------------------------------------------------------------------------

/**
 * steer      sets the register for a scope (what to do / how to do it); subject to arbitration
 * constrain  adds a standing constraint; constraints accumulate and never conflict
 * pause      stop at the next safe point; resume continues
 * cancel     stop the current turn and discard pending work for this epoch
 */
export const DirectiveMode = z.enum(["steer", "constrain", "pause", "resume", "cancel"]);
export type DirectiveMode = z.infer<typeof DirectiveMode>;

/** The scope "goal" is the top-level objective; every other scope is free-form (e.g. "api", "tests"). */
export const GOAL_SCOPE = "goal";

export const DirectiveInput = z.object({
  text: z.string().min(1).max(20_000),
  mode: DirectiveMode.default("steer"),
  scope: z.string().min(1).max(64).default(GOAL_SCOPE),
  /** Explicit supersession of earlier directives (by id). */
  supersedes: z.array(z.string()).default([]),
  /** Ask the runner to abandon the current turn at the next safe point and re-plan. */
  interrupt: z.boolean().default(false),
});
export type DirectiveInput = z.infer<typeof DirectiveInput>;

export const DirectiveStatus = z.enum([
  "active",
  "superseded",
  "withdrawn",
  "shadowed",
  "contended",
  "consumed",
]);
export type DirectiveStatus = z.infer<typeof DirectiveStatus>;

// ---------------------------------------------------------------------------------------
// Tools, risk and approvals
// ---------------------------------------------------------------------------------------

export const RiskClass = z.enum(["read", "write", "exec", "external", "irreversible"]);
export type RiskClass = z.infer<typeof RiskClass>;

/** Who must approve a tool call of a given risk class. */
export const ApprovalRule = z.union([
  z.literal("none"),
  z.literal("contributor"),
  z.literal("driver"),
  z.literal("owner"),
  z.object({ quorum: z.number().int().min(1), of: Role }),
]);
export type ApprovalRule = z.infer<typeof ApprovalRule>;

export const ApprovalPolicy = z.record(RiskClass, ApprovalRule);
export type ApprovalPolicy = z.infer<typeof ApprovalPolicy>;

export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = {
  read: "none",
  write: "none",
  exec: "contributor",
  external: "driver",
  irreversible: { quorum: 2, of: "driver" },
};

export const ContentionPolicy = z.enum(["block", "driver-wins", "latest-wins"]);
export type ContentionPolicy = z.infer<typeof ContentionPolicy>;

export const SessionPolicy = z.object({
  approvals: ApprovalPolicy.default(DEFAULT_APPROVAL_POLICY),
  contention: ContentionPolicy.default("block"),
  /** Maximum agent turns per branch before the runner stops and asks for direction. */
  maxTurns: z.number().int().min(1).default(200),
});
export type SessionPolicy = z.infer<typeof SessionPolicy>;

export const ToolCall = z.object({
  id: z.string(),
  name: z.string(),
  args: z.record(z.unknown()),
  risk: RiskClass,
});
export type ToolCall = z.infer<typeof ToolCall>;

export const ToolResult = z.object({
  callId: z.string(),
  ok: z.boolean(),
  output: z.string(),
});
export type ToolResult = z.infer<typeof ToolResult>;

// ---------------------------------------------------------------------------------------
// Events: the only way state changes
// ---------------------------------------------------------------------------------------

const base = <K extends string, P extends z.ZodTypeAny>(kind: K, payload: P) =>
  z.object({ kind: z.literal(kind), payload });

export const EventBody = z.discriminatedUnion("kind", [
  base(
    "session.created",
    z.object({
      sessionId: z.string(),
      title: z.string(),
      policy: SessionPolicy,
      /** Project this session belongs to; "default" when the fleet layer is not used. */
      projectId: z.string().default("default"),
      /** User id of the human who started the session, when identity is known. */
      ownerId: z.string().nullable().default(null),
    }),
  ),
  base("participant.joined", z.object({ actor: Actor, role: Role })),
  base("participant.left", z.object({ actorId: z.string() })),
  base("role.changed", z.object({ actorId: z.string(), role: Role, by: z.string() })),

  base("directive.submitted", z.object({ directiveId: z.string(), input: DirectiveInput })),
  base("directive.withdrawn", z.object({ directiveId: z.string() })),

  base(
    "contention.resolved",
    z.object({
      contentionId: z.string(),
      /** Which directive wins; the others become superseded. Null = resolver wrote a new one. */
      winner: z.string().nullable(),
      replacementDirectiveId: z.string().nullable(),
    }),
  ),

  base("agent.turn.started", z.object({ turn: z.number().int(), epoch: z.number().int() })),
  base(
    "agent.model.completed",
    z.object({
      turn: z.number().int(),
      text: z.string(),
      toolCalls: z.array(ToolCall),
      /** Opaque model identity for the record; never used to reproduce output. */
      model: z.string(),
    }),
  ),
  base("agent.tool.requested", z.object({ turn: z.number().int(), call: ToolCall })),
  base("agent.tool.completed", z.object({ turn: z.number().int(), result: ToolResult })),
  base(
    "agent.turn.ended",
    z.object({
      turn: z.number().int(),
      reason: z.enum(["done", "interrupted", "paused", "cancelled", "blocked", "error"]),
      summary: z.string(),
    }),
  ),

  base("approval.requested", z.object({ approvalId: z.string(), call: ToolCall })),
  base("approval.voted", z.object({ approvalId: z.string(), vote: z.enum(["approve", "deny"]) })),

  base("handoff.requested", z.object({ handoffId: z.string(), to: z.string() })),
  base("handoff.accepted", z.object({ handoffId: z.string() })),
  base("handoff.declined", z.object({ handoffId: z.string() })),

  base(
    "checkpoint.created",
    z.object({
      checkpointId: z.string(),
      /** Content hash of the workspace tree manifest. */
      tree: z.string(),
      label: z.string(),
    }),
  ),
  base(
    "workspace.changed",
    z.object({
      /** path -> blob hash, or null for deletion. */
      changes: z.record(z.string().nullable()),
    }),
  ),

  base(
    "branch.created",
    z.object({ branch: z.string(), fromCheckpoint: z.string(), fromBranch: z.string() }),
  ),
  base(
    "branch.merged",
    z.object({
      source: z.string(),
      base: z.string(),
      /** path -> blob hash after merge, or null for deletion. */
      tree: z.record(z.string().nullable()),
      conflicts: z.array(z.string()),
      /** Directives re-entered from the source branch, with their original authors and ranks. */
      carried: z.array(
        z.object({
          id: z.string(),
          author: z.string(),
          rank: z.number().int(),
          input: DirectiveInput,
        }),
      ),
    }),
  ),

  base("note.posted", z.object({ text: z.string() })),

  // ---- fleet layer: events a project host writes into a session -------------------------
  base(
    "project.directive.applied",
    z.object({
      directiveId: z.string(),
      projectDirectiveId: z.string(),
      projectId: z.string(),
      /** User id of the lead who issued it on the project. */
      author: z.string(),
      input: DirectiveInput,
    }),
  ),
  base("project.directive.withdrawn", z.object({ directiveId: z.string() })),
  base(
    "workspace.blocked",
    z.object({ path: z.string(), holderSessionId: z.string(), claimId: z.string() }),
  ),
  base(
    "fleet.contention.mirrored",
    z.object({
      contentionId: z.string(),
      kind: z.enum(["claim", "path-overlap", "merge-conflict"]),
      sessionIds: z.array(z.string()),
      resource: z.string(),
      resolved: z.boolean(),
    }),
  ),
]);
export type EventBody = z.infer<typeof EventBody>;
export type EventKind = EventBody["kind"];

/** A committed log entry. `id` is sha256 over (prev, branch, seq, actor, ts, body). */
export const SessionEvent = z
  .object({
    id: z.string(),
    prev: z.string().nullable(),
    seq: z.number().int().min(0),
    branch: z.string(),
    /** Lamport-style logical clock, monotonic per branch. */
    ts: z.number().int().min(0),
    actor: z.string(),
  })
  .and(EventBody);
export type SessionEvent = z.infer<typeof SessionEvent>;

export const MAIN_BRANCH = "main";

// ---------------------------------------------------------------------------------------
// Wire protocol (websocket)
// ---------------------------------------------------------------------------------------

export const ClientMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join"),
    sessionId: z.string(),
    actor: Actor,
    /** Phase-0 auth: a shared token checked by the server. */
    token: z.string().optional(),
    branch: z.string().default(MAIN_BRANCH),
    /** Identity in users.json; roles derive from memberships when present. */
    userId: z.string().optional(),
    /** Project to create the session in when it does not exist yet. */
    projectId: z.string().optional(),
    title: z.string().optional(),
    /**
     * Resume: the seq of the last event this client already holds on `branch`. The snapshot
     * then carries only the events after it; folding them onto the client's state gives the
     * same state as folding the full history. Omit (or send a seq the branch does not have)
     * for the full history.
     */
    sinceSeq: z.number().int().min(0).optional(),
  }),
  z.object({ type: z.literal("directive"), input: DirectiveInput }),
  z.object({ type: z.literal("withdraw"), directiveId: z.string() }),
  z.object({
    type: z.literal("resolve"),
    contentionId: z.string(),
    winner: z.string().nullable(),
    replacement: DirectiveInput.optional(),
  }),
  z.object({ type: z.literal("vote"), approvalId: z.string(), vote: z.enum(["approve", "deny"]) }),
  z.object({ type: z.literal("handoff.request"), to: z.string() }),
  z.object({ type: z.literal("handoff.accept"), handoffId: z.string() }),
  z.object({ type: z.literal("handoff.decline"), handoffId: z.string() }),
  z.object({ type: z.literal("role"), actorId: z.string(), role: Role }),
  z.object({ type: z.literal("checkpoint"), label: z.string().default("manual") }),
  z.object({ type: z.literal("fork"), branch: z.string(), fromCheckpoint: z.string().optional() }),
  z.object({ type: z.literal("merge"), source: z.string() }),
  z.object({ type: z.literal("switch"), branch: z.string() }),
  z.object({ type: z.literal("note"), text: z.string() }),
  z.object({ type: z.literal("presence"), status: z.string().max(200) }),
  z.object({ type: z.literal("brief") }),
  z.object({ type: z.literal("leave") }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

export const PresenceEntry = z.object({
  actor: Actor,
  role: Role,
  branch: z.string(),
  status: z.string(),
  online: z.boolean(),
});
export type PresenceEntry = z.infer<typeof PresenceEntry>;

export const ServerMessage = z.discriminatedUnion("type", [
  /** Full event history of a branch; the client folds it with the same reducer as the server. */
  z.object({ type: z.literal("snapshot"), branch: z.string(), events: z.array(SessionEvent) }),
  z.object({ type: z.literal("event"), event: SessionEvent }),
  z.object({ type: z.literal("presence"), entries: z.array(PresenceEntry) }),
  z.object({ type: z.literal("brief"), markdown: z.string() }),
  z.object({ type: z.literal("error"), message: z.string() }),
  z.object({ type: z.literal("joined"), sessionId: z.string(), branch: z.string() }),
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

export const PROTOCOL_VERSION = 1;
