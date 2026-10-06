/** Org registry: orgs.json and users.json in the store root, with sane defaults when absent. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  canStyleTeam,
  DEFAULT_ORGS,
  deriveSessionRole,
  findProject,
  findTeam,
  OrgsFile,
  type ProjectRef,
  type TeamTheme,
  type User,
  UsersFile,
} from "@henosis/fleet";
import type { Role } from "@henosis/protocol";
import { atomicWrite } from "./storage.js";

export class OrgRegistry {
  readonly orgs: OrgsFile;
  readonly users: Map<string, User>;
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
    return id ? (this.users.get(id) ?? null) : null;
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
