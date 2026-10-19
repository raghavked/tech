/**
 * Identity, phase 0: a users.json with memberships. Session roles derive from project roles
 * so a lead opening any session in their project is its owner and a member is a contributor.
 */
import type { Role } from "@henosis/protocol";
import { z } from "zod";
import { ProjectRole } from "./events.js";

export const OrgRole = z.enum(["member", "admin"]);
export const TeamRole = z.enum(["member", "lead", "manager"]);

/** Which model runs a member's agent: the scripted stand-in offline, or Claude. */
export const AgentProvider = z.enum(["scripted", "claude"]);
export type AgentProvider = z.infer<typeof AgentProvider>;

/**
 * A member model's profile (docs/19_council.md): the agent a person, a manager or a team
 * brings to a council. A person's profile is the `agent` field of their users.json row
 * (`ownerId` is them); a shared team agent is a row of the org's agents.json with no owner.
 * `model` is the provider's model id, empty for the provider's default; `persona` is the
 * manner it speaks in; `tools` names the tools it may call; `budget` is its soft token budget
 * per council, null for none.
 */
export const AgentProfile = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1).nullable().default(null),
  name: z.string().min(1).max(80),
  provider: AgentProvider.default("scripted"),
  model: z.string().max(120).default(""),
  persona: z.string().max(4000).default(""),
  tools: z.array(z.string().min(1)).default([]),
  budget: z.number().int().min(1).nullable().default(null),
});
export type AgentProfile = z.infer<typeof AgentProfile>;

export const User = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().optional(),
  slackId: z.string().optional(),
  orgs: z.array(z.object({ orgId: z.string(), role: OrgRole })).default([]),
  teams: z.array(z.object({ teamId: z.string(), role: TeamRole })).default([]),
  projects: z.array(z.object({ projectId: z.string(), role: ProjectRole })).default([]),
  /** The person's own agent, edited in Settings → My agent; absent means the default. */
  agent: AgentProfile.partial().optional(),
});
export type User = z.infer<typeof User>;

export const UsersFile = z.object({ users: z.array(User) });
export type UsersFile = z.infer<typeof UsersFile>;

/** The org's shared team agents: `agents.json` beside users.json in the store root. */
export const AgentsFile = z.object({ agents: z.array(AgentProfile).default([]) });
export type AgentsFile = z.infer<typeof AgentsFile>;

/** The profile id a person's own agent has when their users.json row names none. */
export function personalAgentId(userId: string): string {
  return `agent:${userId}`;
}

/** The manner a chair speaks in; a manager's agent has it by default. */
export const CHAIR_PERSONA =
  "You chair: you weigh every answer, name the disagreements, and write the plan with an owner for each step.";

/** True when the person manages a team: their agent then chairs by default. */
export function isManager(user: Pick<User, "teams">): boolean {
  return user.teams.some((t) => t.role === "manager");
}

/**
 * A person's member model: their `agent` field over the defaults (scripted provider, named
 * "<Name>'s agent", the chair's manners for a manager). The owner is always the person.
 */
export function personalAgentProfile(user: User): AgentProfile {
  const given = user.agent ?? {};
  return AgentProfile.parse({
    ...given,
    id: given.id ?? personalAgentId(user.id),
    ownerId: user.id,
    name: given.name ?? `${user.name}'s agent`,
    persona: given.persona ?? (isManager(user) ? CHAIR_PERSONA : ""),
  });
}

/**
 * Find a member model by profile id: a person's own agent (by its profile id, or by
 * `agent:<userId>` when their row names none) or a shared team agent from agents.json.
 */
export function resolveAgentProfile(
  users: Iterable<User>,
  agents: AgentsFile | null | undefined,
  profileId: string,
): AgentProfile | null {
  for (const u of users) {
    const p = personalAgentProfile(u);
    if (p.id === profileId || personalAgentId(u.id) === profileId) return p;
  }
  const shared = agents?.agents.find((a) => a.id === profileId);
  return shared ? AgentProfile.parse({ ...shared, ownerId: shared.ownerId ?? null }) : null;
}

/** Every member model an org can convene: each person's agent, then the shared ones. */
export function listAgentProfiles(
  users: Iterable<User>,
  agents: AgentsFile | null | undefined,
): AgentProfile[] {
  const out: AgentProfile[] = [];
  for (const u of users) out.push(personalAgentProfile(u));
  for (const a of agents?.agents ?? []) if (!out.some((p) => p.id === a.id)) out.push(a);
  return out;
}

/** The council member a profile stands for (packages/chat's `CouncilMember`). */
export function councilMemberOf(p: AgentProfile): {
  kind: "agent";
  userId: string | null;
  profileId: string;
  name: string;
} {
  return { kind: "agent", userId: p.ownerId, profileId: p.id, name: p.name };
}

/** A six-digit hex colour, `#RRGGBB`. */
export const HexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/, "a colour as #RRGGBB");

/**
 * How a team looks in the web app (docs/12_brand.md, "Team customisation"). Every field is
 * optional; what is absent falls back to the Henosis palette. The colours become the
 * `--team-*` custom properties on the page; `mark` picks what sits on the mark's disc;
 * `motion: "calm"` turns the loaders and side animations off for that team; `emblem` is one
 * or two letters shown beside the wordmark in the rail.
 */
export const TeamTheme = z
  .object({
    accent: HexColour.optional(),
    highlight: HexColour.optional(),
    surface: HexColour.optional(),
    glow: HexColour.optional(),
    mark: z.enum(["ring", "bead", "dot"]).optional(),
    motion: z.enum(["full", "calm"]).optional(),
    emblem: z
      .string()
      .regex(/^[\p{L}\p{N}]{1,2}$/u, "one or two letters")
      .optional(),
  })
  .strict();
export type TeamTheme = z.infer<typeof TeamTheme>;

/**
 * Single sign-on (Team edition, docs/07_security_and_compliance.md "Identity"): how the
 * provider's `groups` claim becomes memberships. A group maps to an org, a team or a project
 * as a plain id (member) or as `{ teamId, role }` so leads and managers can come from the
 * directory too. What the mapping yields is merged with the person's users.json entry.
 */
export const SsoMapping = z.object({
  /** The provider's name on the sign-in button ("Continue with Okta"); defaults to the issuer host. */
  name: z.string().optional(),
  /** The claim naming the person: `sub` (default, stable) or `email` (readable, may change). */
  userIdClaim: z.enum(["sub", "email"]).optional(),
  /** The claim carrying the directory groups; `groups` by default. */
  groupsClaim: z.string().optional(),
  orgs: z
    .record(
      z.string(),
      z.union([z.string(), z.object({ orgId: z.string(), role: OrgRole.optional() })]),
    )
    .default({}),
  teams: z
    .record(
      z.string(),
      z.union([z.string(), z.object({ teamId: z.string(), role: TeamRole.optional() })]),
    )
    .default({}),
  projects: z
    .record(
      z.string(),
      z.union([z.string(), z.object({ projectId: z.string(), role: ProjectRole.optional() })]),
    )
    .default({}),
});
export type SsoMapping = z.infer<typeof SsoMapping>;

export const OrgsFile = z.object({
  sso: SsoMapping.optional(),
  orgs: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      teams: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          theme: TeamTheme.optional(),
          projects: z.array(z.object({ id: z.string(), name: z.string() })),
        }),
      ),
    }),
  ),
});
export type OrgsFile = z.infer<typeof OrgsFile>;
export type OrgTeam = OrgsFile["orgs"][number]["teams"][number];

/** The team with this id and the org it belongs to, or null. */
export function findTeam(orgs: OrgsFile, teamId: string): { orgId: string; team: OrgTeam } | null {
  for (const o of orgs.orgs)
    for (const t of o.teams) if (t.id === teamId) return { orgId: o.id, team: t };
  return null;
}

/**
 * Whether a user may change how a team looks: a lead or manager of that team in users.json,
 * or an admin of the org the team belongs to.
 */
export function canStyleTeam(user: User | null, orgs: OrgsFile, teamId: string): boolean {
  if (!user) return false;
  const found = findTeam(orgs, teamId);
  if (!found) return false;
  const team = user.teams.find((t) => t.teamId === teamId);
  if (team && (team.role === "lead" || team.role === "manager")) return true;
  return user.orgs.some((o) => o.orgId === found.orgId && o.role === "admin");
}

export interface ProjectRef {
  orgId: string;
  teamId: string;
  projectId: string;
}

export function deriveProjectRole(user: User, ref: ProjectRef): z.infer<typeof ProjectRole> | null {
  const direct = user.projects.find((p) => p.projectId === ref.projectId);
  if (direct) return direct.role;
  const team = user.teams.find((t) => t.teamId === ref.teamId);
  if (team) return team.role === "member" ? "member" : team.role === "lead" ? "lead" : "admin";
  const org = user.orgs.find((o) => o.orgId === ref.orgId);
  if (org) return org.role === "admin" ? "admin" : "member";
  return null;
}

/** Session role of a user: owner of the session or a lead/admin → owner; member → contributor; else observer. */
export function deriveSessionRole(
  user: User,
  ref: ProjectRef,
  sessionOwnerId: string | null,
): Role {
  if (sessionOwnerId && sessionOwnerId === user.id) return "owner";
  const pr = deriveProjectRole(user, ref);
  if (pr === "lead" || pr === "admin") return "owner";
  if (pr === "member") return "contributor";
  return "observer";
}

export function findProject(
  orgs: OrgsFile,
  projectId: string,
): (ProjectRef & { name: string; teamName: string; orgName: string }) | null {
  for (const o of orgs.orgs)
    for (const t of o.teams)
      for (const p of t.projects) {
        if (p.id === projectId)
          return {
            orgId: o.id,
            teamId: t.id,
            projectId: p.id,
            name: p.name,
            teamName: t.name,
            orgName: o.name,
          };
      }
  return null;
}

/** Memberships the directory groups grant under an SSO mapping; empty without one. */
export function membershipsOfGroups(
  sso: SsoMapping | null | undefined,
  groups: readonly string[],
): Pick<User, "orgs" | "teams" | "projects"> {
  const out: Pick<User, "orgs" | "teams" | "projects"> = { orgs: [], teams: [], projects: [] };
  if (!sso) return out;
  for (const g of groups) {
    const o = sso.orgs[g];
    if (o)
      out.orgs.push(
        typeof o === "string"
          ? { orgId: o, role: "member" }
          : { orgId: o.orgId, role: o.role ?? "member" },
      );
    const t = sso.teams[g];
    if (t)
      out.teams.push(
        typeof t === "string"
          ? { teamId: t, role: "member" }
          : { teamId: t.teamId, role: t.role ?? "member" },
      );
    const p = sso.projects[g];
    if (p)
      out.projects.push(
        typeof p === "string"
          ? { projectId: p, role: "member" }
          : { projectId: p.projectId, role: p.role ?? "member" },
      );
  }
  return out;
}

/**
 * The person a verified token names, as a User: the users.json entry (when there is one)
 * with the memberships the directory groups grant added; where both name the same org, team
 * or project, users.json wins, so a lead can still raise someone by hand. A person neither
 * file nor directory places anywhere has no memberships and is an observer everywhere until a
 * lead adds them. users.json keeps the name it knows; the token's name fills in for others.
 */
export function mergeSsoUser(
  known: User | null,
  principal: { userId: string; name?: string | null; email?: string | null },
  granted: Pick<User, "orgs" | "teams" | "projects">,
): User {
  const union = <T>(ours: T[], theirs: T[], key: (x: T) => string): T[] => {
    const seen = new Map<string, T>();
    for (const x of [...theirs, ...ours]) seen.set(key(x), x);
    return [...seen.values()];
  };
  const email = known?.email ?? principal.email ?? undefined;
  return {
    id: principal.userId,
    name: known?.name ?? principal.name ?? principal.email ?? principal.userId,
    ...(email ? { email } : {}),
    ...(known?.slackId ? { slackId: known.slackId } : {}),
    orgs: union(known?.orgs ?? [], granted.orgs, (m) => m.orgId),
    teams: union(known?.teams ?? [], granted.teams, (m) => m.teamId),
    projects: union(known?.projects ?? [], granted.projects, (m) => m.projectId),
  };
}

export const DEFAULT_ORGS: OrgsFile = {
  orgs: [
    {
      id: "default",
      name: "Default org",
      teams: [
        {
          id: "default",
          name: "Default team",
          projects: [{ id: "default", name: "Default project" }],
        },
      ],
    },
  ],
};
