/** Org registry: orgs.json and users.json in the store root, with sane defaults when absent. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_ORGS,
  deriveSessionRole,
  findProject,
  OrgsFile,
  type ProjectRef,
  type User,
  UsersFile,
} from "@fold/fleet";
import type { Role } from "@fold/protocol";

export class OrgRegistry {
  readonly orgs: OrgsFile;
  readonly users: Map<string, User>;

  constructor(root: string) {
    const orgsPath = join(root, "orgs.json");
    const usersPath = join(root, "users.json");
    this.orgs = existsSync(orgsPath)
      ? OrgsFile.parse(JSON.parse(readFileSync(orgsPath, "utf8")))
      : DEFAULT_ORGS;
    const users = existsSync(usersPath)
      ? UsersFile.parse(JSON.parse(readFileSync(usersPath, "utf8")))
      : { users: [] };
    this.users = new Map(users.users.map((u) => [u.id, u]));
  }

  project(projectId: string) {
    return findProject(this.orgs, projectId);
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
