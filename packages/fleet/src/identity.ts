/**
 * Identity, phase 0: a users.json with memberships. Session roles derive from project roles
 * so a lead opening any session in their project is its owner and a member is a contributor.
 */
import type { Role } from "@tiller/protocol";
import { z } from "zod";
import { ProjectRole } from "./events.js";

export const OrgRole = z.enum(["member", "admin"]);
export const TeamRole = z.enum(["member", "lead", "manager"]);

export const User = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().optional(),
  slackId: z.string().optional(),
  orgs: z.array(z.object({ orgId: z.string(), role: OrgRole })).default([]),
  teams: z.array(z.object({ teamId: z.string(), role: TeamRole })).default([]),
  projects: z.array(z.object({ projectId: z.string(), role: ProjectRole })).default([]),
});
export type User = z.infer<typeof User>;

export const UsersFile = z.object({ users: z.array(User) });
export type UsersFile = z.infer<typeof UsersFile>;

export const OrgsFile = z.object({
  orgs: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      teams: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          projects: z.array(z.object({ id: z.string(), name: z.string() })),
        }),
      ),
    }),
  ),
});
export type OrgsFile = z.infer<typeof OrgsFile>;

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
