/**
 * Fleet layer: a project is a ledger shared by every session engineers start inside it.
 * Claims on shared ground, lead directives, cross-session contentions and status reports are
 * events, hash-chained like a session log, so the fleet replays and audits the same way.
 */
import type { ChainEvent } from "@henosis/kernel";
import { DirectiveInput } from "@henosis/protocol";
import { z } from "zod";

export const Resource = z.discriminatedUnion("type", [
  /** A path or a glob-like prefix ("src/billing/" or "src/billing/**"). */
  z.object({ type: z.literal("path"), pattern: z.string().min(1) }),
  z.object({ type: z.literal("service"), name: z.string().min(1) }),
  z.object({ type: z.literal("ticket"), key: z.string().min(1) }),
]);
export type Resource = z.infer<typeof Resource>;

export const ProjectRole = z.enum(["member", "lead", "admin"]);
export type ProjectRole = z.infer<typeof ProjectRole>;
export const PROJECT_RANK: Record<ProjectRole, number> = { member: 1, lead: 2, admin: 3 };

export const ClaimMode = z.enum(["exclusive", "shared"]);
export type ClaimMode = z.infer<typeof ClaimMode>;

export const ProjectPolicy = z.object({
  /** Take an exclusive path claim automatically when a session writes an unclaimed path. */
  autoClaimOnWrite: z.boolean().default(true),
  /** Claims expire after this many turns of inactivity by the holder (0 = never). */
  claimTtlTurns: z.number().int().min(0).default(0),
});
export type ProjectPolicy = z.infer<typeof ProjectPolicy>;

export const SessionStatusReport = z.object({
  sessionId: z.string(),
  status: z.string(),
  goal: z.string().nullable(),
  turn: z.number().int(),
  summary: z.string(),
  activePaths: z.array(z.string()),
  pendingApprovals: z.number().int(),
});
export type SessionStatusReport = z.infer<typeof SessionStatusReport>;

const base = <K extends string, P extends z.ZodTypeAny>(kind: K, payload: P) =>
  z.object({ kind: z.literal(kind), payload });

export const FleetContentionKind = z.enum(["claim", "path-overlap", "merge-conflict"]);
export type FleetContentionKind = z.infer<typeof FleetContentionKind>;

export const ProjectEventBody = z.discriminatedUnion("kind", [
  base(
    "project.created",
    z.object({
      projectId: z.string(),
      orgId: z.string(),
      teamId: z.string(),
      name: z.string(),
      policy: ProjectPolicy,
    }),
  ),
  base(
    "project.member.joined",
    z.object({ userId: z.string(), name: z.string(), role: ProjectRole }),
  ),
  base("project.member.left", z.object({ userId: z.string() })),
  base("project.role.changed", z.object({ userId: z.string(), role: ProjectRole })),

  base(
    "session.registered",
    z.object({ sessionId: z.string(), ownerId: z.string(), title: z.string() }),
  ),
  base("session.status.reported", SessionStatusReport),
  base("session.closed", z.object({ sessionId: z.string() })),
  /**
   * A crew is a named task several sessions work on together ("Invoice PDF rollout"). Sessions
   * in one crew share their briefs with each other and are shown as a team; `crew: null` makes a
   * session solo again.
   */
  base("session.crewed", z.object({ sessionId: z.string(), crew: z.string().nullable() })),

  base(
    "claim.requested",
    z.object({
      claimId: z.string(),
      sessionId: z.string(),
      resource: Resource,
      mode: ClaimMode,
      reason: z.string(),
    }),
  ),
  /** Written by the ledger right after a request: the deterministic verdict. */
  base("claim.granted", z.object({ claimId: z.string() })),
  base("claim.denied", z.object({ claimId: z.string(), holderClaimIds: z.array(z.string()) })),
  base("claim.released", z.object({ claimId: z.string() })),
  base("claim.expired", z.object({ claimId: z.string() })),
  base(
    "claim.violation",
    z.object({ sessionId: z.string(), path: z.string(), holderClaimId: z.string() }),
  ),

  base(
    "project.directive.submitted",
    z.object({
      directiveId: z.string(),
      input: DirectiveInput,
      targets: z.union([z.literal("all"), z.array(z.string())]),
    }),
  ),
  base("project.directive.withdrawn", z.object({ directiveId: z.string() })),

  base(
    "fleet.contention.opened",
    z.object({
      contentionId: z.string(),
      kind: FleetContentionKind,
      sessionIds: z.array(z.string()),
      resource: z.string(),
      detail: z.string(),
    }),
  ),
  base(
    "fleet.contention.resolved",
    z.object({
      contentionId: z.string(),
      winnerSessionId: z.string().nullable(),
      note: z.string(),
    }),
  ),
  base("project.note.posted", z.object({ text: z.string() })),
]);
export type ProjectEventBody = z.infer<typeof ProjectEventBody>;
export type ProjectEventKind = ProjectEventBody["kind"];
export type ProjectEvent = ProjectEventBody & ChainEvent;

export function resourceKey(r: Resource): string {
  switch (r.type) {
    case "path":
      return `path:${normalizePattern(r.pattern)}`;
    case "service":
      return `service:${r.name}`;
    case "ticket":
      return `ticket:${r.key}`;
  }
}

export function normalizePattern(p: string): string {
  return p
    .replace(/\\/g, "/")
    .replace(/\/\*\*$/, "/")
    .replace(/^\.\//, "");
}
