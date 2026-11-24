import { describe, expect, it } from "vitest";
import type { WorkspacesResponse } from "./api.js";
import { parseHash, paths } from "./router.js";
import { inMyWorkspaces, shortDate, workspaceOfProject, workspaceOfTeam } from "./workspaces.js";

const me = {
  projects: [
    {
      orgId: "acme",
      orgName: "Acme",
      teamId: "acme-team",
      teamName: "General",
      projectId: "acme-main",
      name: "Main",
    },
  ],
};

const model = {
  provider: "anthropic" as const,
  connected: false,
  last4: null,
  addedBy: null,
  addedByName: null,
  addedAt: null,
  model: "",
  status: "none" as const,
  checkedAt: null,
  source: "demo" as const,
  running: "scripted-v1",
  defaultModel: "default",
  canManage: true,
  storage: true,
};

const data: WorkspacesResponse = {
  tenancy: "workspaces",
  canCreate: true,
  workspaces: [
    {
      id: "acme",
      name: "Acme",
      role: "admin",
      members: 1,
      model,
      teams: [{ id: "acme-team", name: "General", projects: [{ id: "acme-main", name: "Main" }] }],
    },
  ],
};

describe("workspaces in the client", () => {
  it("reads an invitation link as the join route, and writes it back", () => {
    expect(parseHash("#/join/abc_DEF-123")).toEqual({ name: "join", token: "abc_DEF-123" });
    expect(parseHash(paths.join("a/b"))).toEqual({ name: "join", token: "a/b" });
    expect(parseHash("#/join")).toEqual({ name: "home" });
  });

  it("knows a route inside the person's workspaces from one outside", () => {
    const inside = [
      "#/p/acme-main",
      "#/p/acme-main/s/one",
      "#/m/acme-team",
      "#/c/acme",
      "#/c/acme/g1",
      "#/memory/acme",
      "#/search?q=x",
      "#/search?q=x&org=acme",
      "#/inbox",
      "#/approvals",
      "#/settings",
      "#/",
    ];
    for (const hash of inside)
      expect(`${hash} ${inMyWorkspaces(parseHash(hash), me)}`).toBe(`${hash} true`);
    const outside = [
      "#/p/beta-main",
      "#/p/beta-main/s/one",
      "#/m/beta-team",
      "#/c/beta",
      "#/memory/beta",
      "#/search?q=x&org=beta",
    ];
    for (const hash of outside)
      expect(`${hash} ${inMyWorkspaces(parseHash(hash), me)}`).toBe(`${hash} false`);
  });

  it("finds the workspace of a project and of a team", () => {
    expect(workspaceOfProject(data, "acme-main")?.id).toBe("acme");
    expect(workspaceOfProject(data, "beta-main")).toBeNull();
    expect(workspaceOfTeam(data, "acme-team")?.id).toBe("acme");
    expect(workspaceOfTeam(null, "acme-team")).toBeNull();
  });

  it("says a date shortly and nothing for no date", () => {
    expect(shortDate(null)).toBe("");
    expect(shortDate("not a date")).toBe("");
    expect(shortDate("2026-11-24T10:00:00.000Z")).toMatch(/2026/);
  });
});
