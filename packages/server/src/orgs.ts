/**
 * Org registry: the `orgs`, `users` and `agents` (the shared team agents) documents of the
 * store, with sane defaults when absent.
 */
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
import type { Principal } from "./auth.js";
import { FileStore, type LiveStore } from "./store/index.js";

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
  }

  project(projectId: string) {
    return findProject(this.orgs, projectId);
  }

  /** A member model by profile id: a person's agent or a shared one; null when unknown. */
  agentProfile(profileId: string): AgentProfile | null {
    return resolveAgentProfile(this.users.values(), this.agents, profileId);
  }

  /** Every member model the org can convene. */
  agentProfiles(): AgentProfile[] {
    return listAgentProfiles(this.users.values(), this.agents);
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

  /** The org's shared team agents: the agents doc rows that no person owns. */
  sharedAgents(): AgentProfile[] {
    return this.agents.agents.filter((a) => a.ownerId === null).map((a) => AgentProfile.parse(a));
  }

  /**
   * Replace the shared team agents and write the agents doc; the rows people own (phase-0
   * personal agents) are kept. Throws when two rows share an id or an id is a person's agent.
   */
  setSharedAgents(list: SharedAgentInput[]): AgentProfile[] {
    const seen = new Set<string>();
    const shared: AgentProfile[] = [];
    for (const raw of list) {
      const p = AgentProfile.parse({ ...raw, ownerId: null });
      if (seen.has(p.id)) throw new Error(`two shared agents are called ${p.id}`);
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
    this.agents.agents = [...shared, ...this.agents.agents.filter((a) => a.ownerId !== null)];
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
    if (!known)
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
          if (!u || deriveSessionRole(u, ref, null) !== "observer" || this.users.size === 0) {
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
}
