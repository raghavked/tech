/**
 * Org registry: the `orgs`, `users` and `agents` (the shared team agents) documents of the
 * store, with sane defaults when absent.
 */

import { createHash, randomBytes } from "node:crypto";
import {
  AgentProfile,
  type AgentProfileInput,
  AgentsFile,
  canManageAgents,
  canStyleTeam,
  DEFAULT_ORGS,
  deriveSessionRole,
  findProject,
  findTeam,
  listAgentProfiles,
  membershipsOfGroups,
  mergeSsoUser,
  OrgsFile,
  type ProjectRef,
  type ProjectRole,
  personalAgentId,
  personalAgentProfile,
  resolveAgentProfile,
  type SharedAgentInput,
  type SsoMapping,
  type TeamTheme,
  type User,
  UsersFile,
} from "@henosis/fleet";
import type { Role } from "@henosis/protocol";
import { z } from "zod";
import type { Principal } from "./auth.js";
import { FileStore, type LiveStore } from "./store/index.js";

/**
 * How one server holds organisations. `shared` is the one-company server the product began
 * as: identity places people, and a person placed nowhere still sees the organisation as an
 * observer. `workspaces` is the hosted service: each company makes its own workspace (an
 * org), invites its people, and nothing of a workspace is visible to anyone outside it.
 */
export type Tenancy = "shared" | "workspaces";

/**
 * `HENOSIS_TENANCY`: `workspaces` or `shared`; `fallback` when unset (the hosted function
 * passes `workspaces` under Supabase sign-in, `henosis serve` passes `shared`).
 */
export function tenancyFromEnv(
  env: Record<string, string | undefined>,
  fallback: Tenancy = "shared",
): Tenancy {
  const asked = env.HENOSIS_TENANCY?.trim().toLowerCase();
  if (!asked) return fallback;
  if (asked === "workspaces" || asked === "shared") return asked;
  throw new Error(`HENOSIS_TENANCY=${asked} is not a mode; use workspaces or shared`);
}

/** A workspace role: an admin manages members, invites, the model key, teams and projects. */
export type WorkspaceRole = "admin" | "member";

export const INVITES_DOC = "invites";
/** How long an invitation link works. */
export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
/** How many workspaces one person may make; a guard against a script making thousands. */
export const MAX_WORKSPACES_PER_PERSON = 5;

const Invite = z.object({
  id: z.string(),
  orgId: z.string(),
  /** SHA-256 of the token; the token itself is shown once, to the person who made the link. */
  tokenHash: z.string(),
  role: z.enum(["admin", "member"]).default("member"),
  /** When set, only a person signed in with this address may accept, once. */
  email: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  uses: z.number().int().default(0),
  revoked: z.boolean().default(false),
});
export type Invite = z.infer<typeof Invite>;
const InvitesFile = z.object({ invites: z.array(Invite).default([]) });

/** An invitation as the API shows it: never the token or its hash. */
export interface InviteView {
  id: string;
  orgId: string;
  role: WorkspaceRole;
  email: string | null;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  uses: number;
  state: "open" | "used" | "expired" | "revoked";
}

/** A refusal the API turns into a status: 400 `invalid`, 403 `forbidden`, 404 `not_found`, 409 `conflict`. */
export class WorkspaceError extends Error {
  constructor(
    readonly code: "invalid" | "forbidden" | "not_found" | "conflict",
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceError";
  }
}

/** A person as the registry needs them to write their row: who a verified token named. */
export interface PersonSeed {
  userId: string;
  name?: string | null | undefined;
  email?: string | null | undefined;
}

/** An id made from a name: lowercase letters, digits and hyphens, at most 32 characters. */
export function slugOf(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
  return slug;
}

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

/**
 * Where a verified person nobody has placed yet lands (supabase mode, docs/20_hosting.md):
 * a project membership with this role, the org, team and project created in the `orgs`
 * document when they do not exist. `HENOSIS_AUTO_JOIN` is `org:team:project:role`, several
 * rules separated by commas; the role is a project role (`member`, `lead`, `admin`) or its
 * session word (`contributor` is `member`, `owner` is `lead`).
 */
export interface AutoJoinRule {
  orgId: string;
  teamId: string;
  projectId: string;
  role: ProjectRole;
}

export const DEFAULT_AUTO_JOIN: readonly AutoJoinRule[] = [
  { orgId: "default", teamId: "default", projectId: "default", role: "member" },
];

const ROLE_WORDS: Record<string, ProjectRole> = {
  member: "member",
  contributor: "member",
  lead: "lead",
  owner: "lead",
  admin: "admin",
};

/** Parse `HENOSIS_AUTO_JOIN`; empty or absent is the default rule, a bad rule throws. */
export function parseAutoJoin(spec: string | undefined): AutoJoinRule[] {
  const text = spec?.trim();
  if (!text) return DEFAULT_AUTO_JOIN.map((r) => ({ ...r }));
  return text.split(",").map((part) => {
    const [orgId, teamId, projectId, roleWord = "member"] = part.trim().split(":");
    const role = ROLE_WORDS[roleWord.trim().toLowerCase()];
    if (!orgId || !teamId || !projectId || !role)
      throw new Error(
        `HENOSIS_AUTO_JOIN rule "${part.trim()}" is not org:team:project:role (role: member, contributor, lead, owner or admin)`,
      );
    return { orgId, teamId, projectId, role };
  });
}

/** A display name for an org, team or project made from its id: "Default org", "Growth". */
function titleOf(id: string, kind: "org" | "team" | "project"): string {
  if (id === "default") return `Default ${kind}`;
  const words = id.replace(/[-_.]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export class OrgRegistry {
  readonly orgs: OrgsFile;
  readonly users: Map<string, User>;
  /**
   * Identity (oidc): people a verified token has named, as users.json entries merged with
   * what their directory groups grant (`sso` in orgs.json). Refreshed on every verified
   * request, so a group change reaches the next join. Never written to the store.
   */
  readonly resolved = new Map<string, User>();
  /** The org's shared team agents (docs/19_council.md), empty when the `agents` doc is absent. */
  readonly agents: AgentsFile;
  /** Where a verified stranger is placed (see `AutoJoinRule`); empty outside supabase mode. */
  autoJoin: readonly AutoJoinRule[] = [];
  /** How this server holds organisations (see `Tenancy`); the server sets it. */
  tenancy: Tenancy = "shared";
  /** Invitation links to workspaces: the `invites` document. */
  private readonly invites: Invite[];
  private readonly store: LiveStore;
  /** Whether the `orgs` document exists in the store (the defaults are not written until needed). */
  private orgsPersisted: boolean;

  /** A store root (orgs.json, users.json and agents.json in it) or the store itself. */
  constructor(rootOrStore: string | LiveStore) {
    this.store = typeof rootOrStore === "string" ? new FileStore(rootOrStore) : rootOrStore;
    const orgsDoc = this.store.readDoc("orgs");
    const usersDoc = this.store.readDoc("users");
    const agentsDoc = this.store.readDoc("agents");
    this.orgs = orgsDoc ? OrgsFile.parse(orgsDoc) : structuredClone(DEFAULT_ORGS);
    this.orgsPersisted = Boolean(orgsDoc);
    const users = usersDoc ? UsersFile.parse(usersDoc) : { users: [] };
    this.users = new Map(users.users.map((u) => [u.id, u]));
    this.agents = agentsDoc ? AgentsFile.parse(agentsDoc) : { agents: [] };
    const invitesDoc = this.store.readDoc(INVITES_DOC);
    this.invites = invitesDoc ? InvitesFile.parse(invitesDoc).invites : [];
  }

  /**
   * Read the registry's documents again from the store, in place (another instance of the
   * server may have made a workspace, placed a person or written an invitation). What a
   * verified request remembered of a person is dropped; the next request resolves them again.
   */
  reload(): void {
    const orgsDoc = this.store.readDoc("orgs");
    if (orgsDoc) {
      const next = OrgsFile.parse(orgsDoc);
      this.orgs.orgs = next.orgs;
      if (next.sso) this.orgs.sso = next.sso;
      else delete this.orgs.sso;
      this.orgsPersisted = true;
    }
    const usersDoc = this.store.readDoc("users");
    if (usersDoc) {
      this.users.clear();
      for (const u of UsersFile.parse(usersDoc).users) this.users.set(u.id, u);
    }
    const agentsDoc = this.store.readDoc("agents");
    if (agentsDoc) this.agents.agents = AgentsFile.parse(agentsDoc).agents;
    const invitesDoc = this.store.readDoc(INVITES_DOC);
    if (invitesDoc)
      this.invites.splice(0, this.invites.length, ...InvitesFile.parse(invitesDoc).invites);
    this.resolved.clear();
  }

  /** True on a server of separate workspaces: membership decides everything a person can see. */
  get strict(): boolean {
    return this.tenancy === "workspaces";
  }

  project(projectId: string) {
    return findProject(this.orgs, projectId);
  }

  /** A member model by profile id: a person's agent or a shared one; null when unknown. */
  agentProfile(profileId: string): AgentProfile | null {
    return resolveAgentProfile(this.users.values(), this.agents, profileId);
  }

  /**
   * Every member model an org can convene. On a server of workspaces that is the agents of the
   * workspace's own people and its own shared agents; on a one-org server, everyone's.
   */
  agentProfiles(orgId?: string): AgentProfile[] {
    if (!this.strict || !orgId) return listAgentProfiles(this.users.values(), this.agents);
    const people = [...this.users.values()].filter((u) => this.isMember(u.id, orgId));
    const personal = people.map((u) => personalAgentProfile(u));
    return [...personal, ...this.sharedAgents(orgId)];
  }

  /** Whether a member model belongs to a workspace: one of its people's, or one of its shared agents. */
  agentInOrg(profile: AgentProfile, orgId: string): boolean {
    if (!this.strict) return true;
    if (profile.ownerId) return this.isMember(profile.ownerId, orgId);
    return profile.orgId === orgId;
  }

  // ---- member models (docs/19_council.md): Settings → My agent, Settings → Team agents ----

  /**
   * A person's own member model, with the defaults filled in. A person users.json knows has
   * it in their row's `agent` field. A person it does not know (phase-0 identity) keeps it as
   * a row of the agents doc that names them as owner, so nothing is written to users.json on
   * their behalf and the trust model of the store does not change under them; until they
   * save one, it is the default agent named after them.
   */
  personalAgent(userId: string, nameHint?: string | null): AgentProfile {
    const u = this.user(userId);
    if (u) return personalAgentProfile(u);
    const own = this.agents.agents.find((a) => a.ownerId === userId);
    if (own) return AgentProfile.parse(own);
    return AgentProfile.parse({
      id: personalAgentId(userId),
      ownerId: userId,
      name: `${nameHint ?? userId}'s agent`,
    });
  }

  /**
   * Set a person's own agent: what they gave (the fields of `AgentProfileInput`; what is absent
   * keeps its default) replaces their `agent` field and users.json is written; the profile id
   * their row already names is kept. A person users.json does not know gets a row of the
   * agents doc in their name instead. Returns the profile as it now resolves.
   */
  setPersonalAgent(
    userId: string,
    input: AgentProfileInput,
    nameHint?: string | null,
  ): AgentProfile {
    const given = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    const known = this.users.get(userId);
    const resolved = this.resolved.get(userId);
    if (known || resolved) {
      const row: User = known ?? {
        id: userId,
        name: resolved?.name ?? nameHint ?? userId,
        ...(resolved?.email ? { email: resolved.email } : {}),
        orgs: [],
        teams: [],
        projects: [],
      };
      const id = row.agent?.id;
      row.agent = { ...(id ? { id } : {}), ...given };
      this.users.set(userId, row);
      if (resolved) resolved.agent = row.agent;
      this.store.writeDoc("users", { users: [...this.users.values()] });
      return this.personalAgent(userId, nameHint);
    }
    const current = this.personalAgent(userId, nameHint);
    const next = AgentProfile.parse({
      ...given,
      id: current.id,
      ownerId: userId,
      name: given.name ?? current.name,
    });
    const at = this.agents.agents.findIndex((a) => a.ownerId === userId);
    if (at >= 0) this.agents.agents[at] = next;
    else this.agents.agents.push(next);
    this.store.writeDoc("agents", this.agents);
    return next;
  }

  /**
   * The shared team agents: the agents doc rows that no person owns. On a server of workspaces
   * each belongs to one workspace and only that workspace's are answered.
   */
  sharedAgents(orgId?: string): AgentProfile[] {
    return this.agents.agents
      .filter((a) => a.ownerId === null && (!this.strict || (orgId ? a.orgId === orgId : false)))
      .map((a) => AgentProfile.parse(a));
  }

  /**
   * Replace the shared team agents and write the agents doc; the rows people own (phase-0
   * personal agents) are kept. Throws when two rows share an id or an id is a person's agent.
   */
  setSharedAgents(list: SharedAgentInput[], orgId?: string): AgentProfile[] {
    const scoped = this.strict && orgId ? orgId : null;
    const seen = new Set<string>();
    const shared: AgentProfile[] = [];
    for (const raw of list) {
      const p = AgentProfile.parse({ ...raw, ownerId: null, ...(scoped ? { orgId: scoped } : {}) });
      if (seen.has(p.id)) throw new Error(`two shared agents are called ${p.id}`);
      if (scoped && this.agents.agents.some((a) => a.id === p.id && a.orgId !== scoped))
        throw new Error(`${p.id} is taken; pick another id`);
      seen.add(p.id);
      for (const u of this.users.values()) {
        const own = personalAgentProfile(u);
        if (own.id === p.id || personalAgentId(u.id) === p.id)
          throw new Error(`${p.id} is ${u.name}'s own agent`);
      }
      if (this.agents.agents.some((a) => a.ownerId !== null && a.id === p.id))
        throw new Error(`${p.id} is a person's own agent`);
      shared.push(p);
    }
    // Kept: the rows people own, and on a server of workspaces every other workspace's agents.
    const kept = this.agents.agents.filter(
      (a) => a.ownerId !== null || (scoped !== null && a.orgId !== scoped),
    );
    this.agents.agents = [...shared, ...kept];
    this.store.writeDoc("agents", this.agents);
    return shared;
  }

  /** Whether this user may edit the org's shared team agents (a lead, manager or admin in it). */
  canManageAgents(userId: string | null | undefined, orgId: string): boolean {
    return canManageAgents(this.user(userId), this.orgs, orgId);
  }

  /** The ids of every org whose shared agents this user may edit; Settings shows "Team agents" for them. */
  agentLeadsFor(userId: string | null | undefined): string[] {
    const u = this.user(userId);
    if (!u) return [];
    return this.orgs.orgs.filter((o) => canManageAgents(u, this.orgs, o.id)).map((o) => o.id);
  }

  team(teamId: string) {
    return findTeam(this.orgs, teamId);
  }

  /** Team look (team-theme): whether this user may change how the team looks. */
  canStyleTeam(userId: string | null | undefined, teamId: string): boolean {
    return canStyleTeam(this.user(userId), this.orgs, teamId);
  }

  /** The ids of every team this user may style; the Settings page shows "Team look" for them. */
  styledTeamsFor(userId: string | null | undefined): string[] {
    const u = this.user(userId);
    if (!u) return [];
    const out: string[] = [];
    for (const o of this.orgs.orgs)
      for (const t of o.teams) if (canStyleTeam(u, this.orgs, t.id)) out.push(t.id);
    return out;
  }

  /** Set or clear (null) a team's theme and persist orgs.json. Throws for an unknown team. */
  setTeamTheme(teamId: string, theme: TeamTheme | null): void {
    const found = findTeam(this.orgs, teamId);
    if (!found) throw new Error(`unknown team ${teamId}`);
    if (theme && Object.keys(theme).length > 0) found.team.theme = theme;
    else delete found.team.theme;
    this.persistOrgs();
  }

  private persistOrgs(): void {
    this.store.writeDoc("orgs", this.orgs);
    this.orgsPersisted = true;
  }

  /**
   * Make sure the org, team and project a rule names exist, creating what is missing in the
   * `orgs` document (and writing the document the first time it is needed). Returns true when
   * something was created.
   */
  ensurePlace(rule: Pick<AutoJoinRule, "orgId" | "teamId" | "projectId">): boolean {
    let changed = false;
    let org = this.orgs.orgs.find((o) => o.id === rule.orgId);
    if (!org) {
      org = { id: rule.orgId, name: titleOf(rule.orgId, "org"), teams: [] };
      this.orgs.orgs.push(org);
      changed = true;
    }
    let team = org.teams.find((t) => t.id === rule.teamId);
    if (!team) {
      team = { id: rule.teamId, name: titleOf(rule.teamId, "team"), projects: [] };
      org.teams.push(team);
      changed = true;
    }
    if (!team.projects.some((p) => p.id === rule.projectId)) {
      team.projects.push({ id: rule.projectId, name: titleOf(rule.projectId, "project") });
      changed = true;
    }
    if (changed || !this.orgsPersisted) this.persistOrgs();
    return changed;
  }

  user(id: string | null | undefined): User | null {
    return id ? (this.resolved.get(id) ?? this.users.get(id) ?? null) : null;
  }

  /** The SSO group mapping from orgs.json, or null when there is none. */
  get sso(): SsoMapping | null {
    return this.orgs.sso ?? null;
  }

  /**
   * Identity (oidc, supabase): remember the person a verified token names. The user is their
   * users.json entry (if any) plus the memberships their groups grant; someone placed nowhere
   * is a User with no memberships, an observer everywhere until a lead adds them, unless the
   * auto-join rules place them (supabase mode: a new sign-up lands in the default project as
   * a member, the org, team and project created on first use). Dev-mode assertions are not
   * remembered: `user()` keeps answering from users.json for those.
   */
  resolve(principal: Principal): User {
    const known = this.users.get(principal.userId) ?? null;
    if (!principal.verified)
      return known ?? mergeSsoUser(null, principal, membershipsOfGroups(null, []));
    const granted = membershipsOfGroups(this.sso, principal.groups);
    if (!known && !this.strict)
      for (const rule of this.autoJoin) {
        this.ensurePlace(rule);
        if (!granted.projects.some((p) => p.projectId === rule.projectId))
          granted.projects.push({ projectId: rule.projectId, role: rule.role });
      }
    const u = mergeSsoUser(known, principal, granted);
    this.resolved.set(u.id, u);
    return u;
  }

  /** Session role for a user in a project, or null when identity is unknown (fall back to first-in-owns). */
  sessionRole(
    userId: string | null | undefined,
    ref: ProjectRef,
    sessionOwnerId: string | null,
  ): Role | null {
    const u = this.user(userId);
    return u ? deriveSessionRole(u, ref, sessionOwnerId) : null;
  }

  /**
   * memory-browser: a person's standing in an org's memory, for Keep-this and Retract. A lead
   * or admin of the org, of the team or project asked for, or (at org level) of any of its
   * teams or projects is an owner; any other member is a contributor; a person placed nowhere
   * in the org observes and may not change what the team remembers. Null for an unknown user.
   * A team or project the registry does not know falls back to the person's standing in the org.
   */
  memoryRole(
    userId: string | null | undefined,
    orgId: string,
    scope: { teamId?: string; projectId?: string } = {},
  ): Role | null {
    const u = this.user(userId);
    if (!u) return null;
    const org = this.orgs.orgs.find((o) => o.id === orgId);
    const best = (roles: (Role | null)[]): Role =>
      roles.includes("owner")
        ? "owner"
        : roles.includes("contributor")
          ? "contributor"
          : "observer";
    const ofProject = (projectId: string): Role | null => {
      const ref = findProject(this.orgs, projectId);
      return ref && ref.orgId === orgId ? deriveSessionRole(u, ref, null) : null;
    };
    const ofTeam = (teamId: string): Role | null => {
      const found = findTeam(this.orgs, teamId);
      if (!found || found.orgId !== orgId) return null;
      const t = u.teams.find((m) => m.teamId === teamId);
      if (t) return t.role === "member" ? "contributor" : "owner";
      const o = u.orgs.find((m) => m.orgId === orgId);
      if (o) return o.role === "admin" ? "owner" : "contributor";
      return "observer";
    };
    // A project or team the registry knows decides; one it does not falls back to the org.
    const scoped = scope.projectId
      ? ofProject(scope.projectId)
      : scope.teamId
        ? ofTeam(scope.teamId)
        : null;
    if (scoped) return scoped;
    const o = u.orgs.find((m) => m.orgId === orgId);
    if (o) return o.role === "admin" ? "owner" : "contributor";
    if (!org) return "observer";
    return best([
      ...org.teams.map((t) => ofTeam(t.id)),
      ...org.teams.flatMap((t) => t.projects.map((p) => ofProject(p.id))),
    ]);
  }

  projectsFor(userId: string | null | undefined) {
    const u = this.user(userId);
    const out: {
      orgId: string;
      orgName: string;
      teamId: string;
      teamName: string;
      projectId: string;
      name: string;
    }[] = [];
    for (const o of this.orgs.orgs)
      for (const t of o.teams)
        for (const p of t.projects) {
          const ref = { orgId: o.id, teamId: t.id, projectId: p.id };
          const placed = u ? deriveSessionRole(u, ref, null) !== "observer" : false;
          if (this.strict ? placed : !u || placed || this.users.size === 0) {
            out.push({
              orgId: o.id,
              orgName: o.name,
              teamId: t.id,
              teamName: t.name,
              projectId: p.id,
              name: p.name,
            });
          }
        }
    return out;
  }

  // ---- workspaces: a company's own org, its people, its invitations ----------------------

  /** A person's role in an org: an org admin, a member (placed anywhere in it), or null. */
  orgRole(userId: string | null | undefined, orgId: string): WorkspaceRole | null {
    const u = this.user(userId);
    const org = this.orgs.orgs.find((o) => o.id === orgId);
    if (!u || !org) return null;
    const direct = u.orgs.find((m) => m.orgId === orgId);
    if (direct?.role === "admin") return "admin";
    if (direct) return "member";
    const inTeam = u.teams.some((m) => org.teams.some((t) => t.id === m.teamId));
    const inProject = u.projects.some((m) =>
      org.teams.some((t) => t.projects.some((p) => p.id === m.projectId)),
    );
    return inTeam || inProject ? "member" : null;
  }

  isMember(userId: string | null | undefined, orgId: string): boolean {
    return this.orgRole(userId, orgId) !== null;
  }

  isOrgAdmin(userId: string | null | undefined, orgId: string): boolean {
    return this.orgRole(userId, orgId) === "admin";
  }

  /**
   * Whether a person may look inside an org at all. On a one-org server everyone may (a person
   * placed nowhere observes); on a server of workspaces only its members.
   */
  canSee(userId: string | null | undefined, orgId: string): boolean {
    return !this.strict || this.isMember(userId, orgId);
  }

  /** The orgs a person may look inside, as `canSee` decides. */
  orgsFor(userId: string | null | undefined): OrgsFile["orgs"] {
    return this.orgs.orgs.filter((o) => this.canSee(userId, o.id));
  }

  /** The org a team or a project belongs to, or null. */
  orgOfTeam(teamId: string): string | null {
    return findTeam(this.orgs, teamId)?.orgId ?? null;
  }

  private freeId(base: string, taken: (id: string) => boolean): string {
    const root = base || "workspace";
    if (!taken(root)) return root;
    for (let n = 2; n < 10_000; n++) {
      const id = `${root.slice(0, 27)}-${n}`;
      if (!taken(id)) return id;
    }
    throw new WorkspaceError("conflict", "no free id for that name; pick another name");
  }

  private orgTaken = (id: string): boolean =>
    id === "default" || this.orgs.orgs.some((o) => o.id === id);
  private teamTaken = (id: string): boolean => findTeam(this.orgs, id) !== null;
  private projectTaken = (id: string): boolean => findProject(this.orgs, id) !== null;

  /**
   * Make a workspace for a company: an org with a first team and a first project, and the
   * person who made it as its admin. Ids are made from the name and are unique on the server.
   */
  createWorkspace(
    by: PersonSeed,
    rawName: string,
    now: Date = new Date(),
  ): OrgsFile["orgs"][number] {
    const name = rawName.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 60)
      throw new WorkspaceError("invalid", "a workspace name is 2 to 60 characters");
    const made = this.orgs.orgs.filter((o) => o.createdBy === by.userId).length;
    if (made >= MAX_WORKSPACES_PER_PERSON)
      throw new WorkspaceError(
        "conflict",
        `one person can make ${MAX_WORKSPACES_PER_PERSON} workspaces; ask for an invitation to another`,
      );
    const id = this.freeId(slugOf(name), this.orgTaken);
    const teamId = this.freeId(`${id}-team`.slice(0, 32), this.teamTaken);
    const projectId = this.freeId(`${id}-main`.slice(0, 32), this.projectTaken);
    const org = {
      id,
      name,
      createdBy: by.userId,
      createdAt: now.toISOString(),
      teams: [{ id: teamId, name: "General", projects: [{ id: projectId, name: "Main" }] }],
    };
    this.orgs.orgs.push(org);
    this.persistOrgs();
    this.place(by, (u) => {
      u.orgs = [...u.orgs.filter((m) => m.orgId !== id), { orgId: id, role: "admin" }];
    });
    return org;
  }

  /** Rename a workspace. */
  renameWorkspace(orgId: string, rawName: string): void {
    const org = this.orgs.orgs.find((o) => o.id === orgId);
    if (!org) throw new WorkspaceError("not_found", `unknown workspace ${orgId}`);
    const name = rawName.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 60)
      throw new WorkspaceError("invalid", "a workspace name is 2 to 60 characters");
    org.name = name;
    this.persistOrgs();
  }

  /** Add a team to a workspace. */
  createTeam(orgId: string, rawName: string): { id: string; name: string } {
    const org = this.orgs.orgs.find((o) => o.id === orgId);
    if (!org) throw new WorkspaceError("not_found", `unknown workspace ${orgId}`);
    const name = rawName.trim().replace(/\s+/g, " ");
    if (!name || name.length > 60)
      throw new WorkspaceError("invalid", "a team name is 1 to 60 characters");
    if (org.teams.some((t) => t.name.toLowerCase() === name.toLowerCase()))
      throw new WorkspaceError("conflict", `there is already a team called ${name}`);
    const id = this.freeId(
      `${orgId}-${slugOf(name)}`.slice(0, 32).replace(/-+$/, ""),
      this.teamTaken,
    );
    org.teams.push({ id, name, projects: [] });
    this.persistOrgs();
    return { id, name };
  }

  /** Add a project to a team of a workspace (its first team when none is named). */
  createProject(
    orgId: string,
    rawName: string,
    teamId?: string | null,
  ): { id: string; name: string; teamId: string } {
    const org = this.orgs.orgs.find((o) => o.id === orgId);
    if (!org) throw new WorkspaceError("not_found", `unknown workspace ${orgId}`);
    const team = teamId ? org.teams.find((t) => t.id === teamId) : org.teams[0];
    if (!team)
      throw new WorkspaceError(
        "not_found",
        teamId ? `unknown team ${teamId}` : "the workspace has no team",
      );
    const name = rawName.trim().replace(/\s+/g, " ");
    if (!name || name.length > 60)
      throw new WorkspaceError("invalid", "a project name is 1 to 60 characters");
    if (team.projects.some((p) => p.name.toLowerCase() === name.toLowerCase()))
      throw new WorkspaceError("conflict", `${team.name} already has a project called ${name}`);
    const id = this.freeId(
      `${orgId}-${slugOf(name)}`.slice(0, 32).replace(/-+$/, ""),
      this.projectTaken,
    );
    team.projects.push({ id, name });
    this.persistOrgs();
    return { id, name, teamId: team.id };
  }

  /**
   * Write a person's row (creating it from what their token said when users.json does not know
   * them) and apply the same change to what a verified request remembered of them, so the next
   * lookup in this request sees it.
   */
  private place(who: PersonSeed, change: (u: User) => void): User {
    const resolved = this.resolved.get(who.userId);
    const row: User = this.users.get(who.userId) ?? {
      id: who.userId,
      name: resolved?.name ?? who.name ?? who.email ?? who.userId,
      ...((resolved?.email ?? who.email)
        ? { email: (resolved?.email ?? who.email) as string }
        : {}),
      orgs: [],
      teams: [],
      projects: [],
    };
    change(row);
    this.users.set(row.id, row);
    if (resolved) change(resolved);
    this.store.writeDoc("users", { users: [...this.users.values()] });
    return row;
  }

  /** The people of an org with their role in it, admins first, then by name. */
  members(
    orgId: string,
  ): { id: string; name: string; email: string | null; role: WorkspaceRole }[] {
    const seen = new Map<
      string,
      { id: string; name: string; email: string | null; role: WorkspaceRole }
    >();
    for (const u of [...this.users.values(), ...this.resolved.values()]) {
      const role = this.orgRole(u.id, orgId);
      if (role) seen.set(u.id, { id: u.id, name: u.name, email: u.email ?? null, role });
    }
    return [...seen.values()].sort((a, b) =>
      a.role === b.role ? a.name.localeCompare(b.name) : a.role === "admin" ? -1 : 1,
    );
  }

  private adminCount(orgId: string): number {
    return this.members(orgId).filter((m) => m.role === "admin").length;
  }

  /** Make a member an admin or an admin a member; the last admin stays one. */
  setOrgRole(orgId: string, userId: string, role: WorkspaceRole): void {
    const current = this.orgRole(userId, orgId);
    if (!current) throw new WorkspaceError("not_found", "that person is not in this workspace");
    if (current === role) return;
    if (current === "admin" && this.adminCount(orgId) <= 1)
      throw new WorkspaceError("conflict", "a workspace keeps at least one admin");
    this.place({ userId }, (u) => {
      u.orgs = [...u.orgs.filter((m) => m.orgId !== orgId), { orgId, role }];
    });
  }

  /** Take a person out of an org: its org, team and project memberships go; the last admin stays. */
  removeMember(orgId: string, userId: string): void {
    const org = this.orgs.orgs.find((o) => o.id === orgId);
    const current = this.orgRole(userId, orgId);
    if (!org || !current)
      throw new WorkspaceError("not_found", "that person is not in this workspace");
    if (current === "admin" && this.adminCount(orgId) <= 1)
      throw new WorkspaceError("conflict", "a workspace keeps at least one admin");
    const teamIds = new Set(org.teams.map((t) => t.id));
    const projectIds = new Set(org.teams.flatMap((t) => t.projects.map((p) => p.id)));
    this.place({ userId }, (u) => {
      u.orgs = u.orgs.filter((m) => m.orgId !== orgId);
      u.teams = u.teams.filter((m) => !teamIds.has(m.teamId));
      u.projects = u.projects.filter((m) => !projectIds.has(m.projectId));
    });
  }

  private inviteView(i: Invite, now: Date): InviteView {
    const state = i.revoked
      ? "revoked"
      : i.email && i.uses > 0
        ? "used"
        : Date.parse(i.expiresAt) <= now.getTime()
          ? "expired"
          : "open";
    return {
      id: i.id,
      orgId: i.orgId,
      role: i.role,
      email: i.email ?? null,
      createdBy: i.createdBy,
      createdAt: i.createdAt,
      expiresAt: i.expiresAt,
      uses: i.uses,
      state,
    };
  }

  private persistInvites(): void {
    this.store.writeDoc(INVITES_DOC, { invites: this.invites });
  }

  /**
   * Make an invitation link to a workspace. The token is answered once, here; only its hash is
   * kept. With an email the link is for that address alone and works once; without, anyone who
   * has the link may join until it expires or is revoked.
   */
  createInvite(
    orgId: string,
    by: string,
    opts: { role?: WorkspaceRole | undefined; email?: string | undefined } = {},
    now: Date = new Date(),
  ): { invite: InviteView; token: string } {
    if (!this.orgs.orgs.some((o) => o.id === orgId))
      throw new WorkspaceError("not_found", `unknown workspace ${orgId}`);
    const email = opts.email?.trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new WorkspaceError("invalid", "that does not look like an email address");
    const token = randomBytes(24).toString("base64url");
    const invite: Invite = {
      id: randomBytes(6).toString("hex"),
      orgId,
      tokenHash: hashToken(token),
      role: opts.role ?? "member",
      ...(email ? { email } : {}),
      createdBy: by,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + INVITE_TTL_MS).toISOString(),
      uses: 0,
      revoked: false,
    };
    this.invites.push(invite);
    this.persistInvites();
    return { invite: this.inviteView(invite, now), token };
  }

  /** A workspace's invitations, newest first. */
  invitesOf(orgId: string, now: Date = new Date()): InviteView[] {
    return this.invites
      .filter((i) => i.orgId === orgId)
      .map((i) => this.inviteView(i, now))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Revoke an invitation; false when the workspace has none with that id. */
  revokeInvite(orgId: string, inviteId: string): boolean {
    const i = this.invites.find((x) => x.orgId === orgId && x.id === inviteId);
    if (!i) return false;
    i.revoked = true;
    this.persistInvites();
    return true;
  }

  /** What an invitation link leads to, for the page that asks "Join Acme?"; null for a link that does not exist. */
  inviteByToken(
    token: string,
    now: Date = new Date(),
  ): { invite: InviteView; workspace: { id: string; name: string } } | null {
    const i = this.invites.find((x) => x.tokenHash === hashToken(token));
    const org = i ? this.orgs.orgs.find((o) => o.id === i.orgId) : undefined;
    if (!i || !org) return null;
    return { invite: this.inviteView(i, now), workspace: { id: org.id, name: org.name } };
  }

  /**
   * Accept an invitation: the person joins the workspace with the invitation's role (a person
   * already in it keeps the higher of the two). Refused for a link that is revoked, expired,
   * used up, or addressed to someone else.
   */
  acceptInvite(
    token: string,
    who: PersonSeed,
    now: Date = new Date(),
  ): { id: string; name: string } {
    const found = this.inviteByToken(token, now);
    const i = found ? this.invites.find((x) => x.id === found.invite.id) : undefined;
    if (!found || !i) throw new WorkspaceError("not_found", "this invitation does not exist");
    if (found.invite.state !== "open")
      throw new WorkspaceError(
        "forbidden",
        found.invite.state === "expired"
          ? "this invitation has expired; ask for a new one"
          : found.invite.state === "used"
            ? "this invitation was already used"
            : "this invitation was withdrawn",
      );
    if (i.email && i.email !== who.email?.trim().toLowerCase())
      throw new WorkspaceError(
        "forbidden",
        `this invitation is for ${i.email}; sign in with that address`,
      );
    const current = this.orgRole(who.userId, i.orgId);
    const role: WorkspaceRole = current === "admin" || i.role === "admin" ? "admin" : "member";
    this.place(who, (u) => {
      u.orgs = [...u.orgs.filter((m) => m.orgId !== i.orgId), { orgId: i.orgId, role }];
    });
    i.uses += 1;
    this.persistInvites();
    return found.workspace;
  }
}
