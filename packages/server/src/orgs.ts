/** Org registry: orgs.json and users.json in the store root, with sane defaults when absent. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  canStyleTeam,
  DEFAULT_ORGS,
  deriveSessionRole,
  findProject,
  findTeam,
  membershipsOfGroups,
  mergeSsoUser,
  OrgsFile,
  type ProjectRef,
  type SsoMapping,
  type TeamTheme,
  type User,
  UsersFile,
} from "@henosis/fleet";
import type { Role } from "@henosis/protocol";
import type { Principal } from "./auth.js";
import { atomicWrite } from "./storage.js";

export class OrgRegistry {
  readonly orgs: OrgsFile;
  readonly users: Map<string, User>;
  /**
   * Identity (oidc): people a verified token has named, as users.json entries merged with
   * what their directory groups grant (`sso` in orgs.json). Refreshed on every verified
   * request, so a group change reaches the next join. Never written to disk.
   */
  readonly resolved = new Map<string, User>();
  private readonly orgsPath: string;

  constructor(root: string) {
    const orgsPath = join(root, "orgs.json");
    const usersPath = join(root, "users.json");
    this.orgsPath = orgsPath;
    this.orgs = existsSync(orgsPath)
      ? OrgsFile.parse(JSON.parse(readFileSync(orgsPath, "utf8")))
      : structuredClone(DEFAULT_ORGS);
    const users = existsSync(usersPath)
      ? UsersFile.parse(JSON.parse(readFileSync(usersPath, "utf8")))
      : { users: [] };
    this.users = new Map(users.users.map((u) => [u.id, u]));
  }

  project(projectId: string) {
    return findProject(this.orgs, projectId);
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
    atomicWrite(this.orgsPath, `${JSON.stringify(this.orgs, null, 2)}\n`);
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
