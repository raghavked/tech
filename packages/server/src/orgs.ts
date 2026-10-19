/**
 * Org registry: the `orgs`, `users` and `agents` (the shared team agents) documents of the
 * store, with sane defaults when absent.
 */
import {
  type AgentProfile,
  AgentsFile,
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
  resolveAgentProfile,
  type SsoMapping,
  type TeamTheme,
  type User,
  UsersFile,
} from "@henosis/fleet";
import type { Role } from "@henosis/protocol";
import type { Principal } from "./auth.js";
import { FileStore, type LiveStore } from "./store/index.js";

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
  private readonly store: LiveStore;

  /** A store root (orgs.json, users.json and agents.json in it) or the store itself. */
  constructor(rootOrStore: string | LiveStore) {
    this.store = typeof rootOrStore === "string" ? new FileStore(rootOrStore) : rootOrStore;
    const orgsDoc = this.store.readDoc("orgs");
    const usersDoc = this.store.readDoc("users");
    const agentsDoc = this.store.readDoc("agents");
    this.orgs = orgsDoc ? OrgsFile.parse(orgsDoc) : structuredClone(DEFAULT_ORGS);
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
    this.store.writeDoc("orgs", this.orgs);
  }

  user(id: string | null | undefined): User | null {
    return id ? (this.resolved.get(id) ?? this.users.get(id) ?? null) : null;
  }

  /** The SSO group mapping from orgs.json, or null when there is none. */
  get sso(): SsoMapping | null {
    return this.orgs.sso ?? null;
  }

  /**
   * Identity (oidc): remember the person a verified token names. The user is their users.json
   * entry (if any) plus the memberships their groups grant; someone placed nowhere is a User
   * with no memberships, an observer everywhere until a lead adds them. Dev-mode assertions
   * are not remembered: `user()` keeps answering from users.json for those.
   */
  resolve(principal: Principal): User {
    const known = this.users.get(principal.userId) ?? null;
    if (!principal.verified)
      return known ?? mergeSsoUser(null, principal, membershipsOfGroups(null, []));
    const u = mergeSsoUser(known, principal, membershipsOfGroups(this.sso, principal.groups));
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
