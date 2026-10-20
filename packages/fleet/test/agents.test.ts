import { describe, expect, it } from "vitest";
import {
  AgentProfile,
  AgentProfileInput,
  AgentsFile,
  CHAIR_PERSONA,
  canManageAgents,
  councilMemberOf,
  listAgentProfiles,
  mergeSsoUser,
  type OrgsFile,
  personalAgentId,
  personalAgentProfile,
  resolveAgentProfile,
  SharedAgentInput,
  User,
  UsersFile,
} from "../src/identity.js";

const users = UsersFile.parse({
  users: [
    { id: "ana", name: "Ana", teams: [{ teamId: "pay", role: "member" }] },
    {
      id: "dee",
      name: "Dee",
      teams: [{ teamId: "pay", role: "manager" }],
      agent: { name: "Dee's chair", provider: "claude", tools: ["workspace.read"], budget: 20000 },
    },
    { id: "bo", name: "Bo", agent: { id: "bo-bot", persona: "Blunt." } },
  ],
});
const agents = AgentsFile.parse({
  agents: [{ id: "team:pay", name: "Payments agent", persona: "Speaks for the team." }],
});

describe("member model profiles", () => {
  it("parse with defaults; users.json takes a partial agent field and agents.json shared rows", () => {
    expect(AgentProfile.parse({ id: "x", name: "X" })).toEqual({
      id: "x",
      ownerId: null,
      name: "X",
      provider: "scripted",
      model: "",
      persona: "",
      tools: [],
      budget: null,
    });
    expect(AgentProfile.safeParse({ id: "x", name: "X", provider: "gemini" }).success).toBe(false);
    expect(AgentProfile.safeParse({ id: "x", name: "X", budget: 0 }).success).toBe(false);
    expect(User.safeParse({ id: "u", name: "U", agent: { provider: "nope" } }).success).toBe(false);
    expect(agents.agents[0]?.ownerId).toBeNull();
  });

  it("a person's own agent is theirs, named after them, and chairs by default when they manage", () => {
    const ana = personalAgentProfile(users.users[0] as User);
    expect(ana).toEqual({
      id: personalAgentId("ana"),
      ownerId: "ana",
      name: "Ana's agent",
      provider: "scripted",
      model: "",
      persona: "",
      tools: [],
      budget: null,
    });
    const dee = personalAgentProfile(users.users[1] as User);
    expect(dee).toMatchObject({
      id: "agent:dee",
      ownerId: "dee",
      name: "Dee's chair",
      provider: "claude",
      persona: CHAIR_PERSONA,
      tools: ["workspace.read"],
      budget: 20000,
    });
    const bo = personalAgentProfile(users.users[2] as User);
    expect(bo).toMatchObject({
      id: "bo-bot",
      ownerId: "bo",
      name: "Bo's agent",
      persona: "Blunt.",
    });
  });

  it("resolves by profile id, by agent:<userId>, or from the shared agents; lists them all", () => {
    expect(resolveAgentProfile(users.users, agents, "agent:ana")?.name).toBe("Ana's agent");
    expect(resolveAgentProfile(users.users, agents, "bo-bot")?.ownerId).toBe("bo");
    expect(resolveAgentProfile(users.users, agents, "agent:bo")?.id).toBe("bo-bot");
    expect(resolveAgentProfile(users.users, agents, "team:pay")).toMatchObject({
      id: "team:pay",
      ownerId: null,
      name: "Payments agent",
    });
    expect(resolveAgentProfile(users.users, null, "team:pay")).toBeNull();
    expect(resolveAgentProfile(users.users, agents, "nobody")).toBeNull();
    expect(listAgentProfiles(users.users, agents).map((p) => p.id)).toEqual([
      "agent:ana",
      "agent:dee",
      "bo-bot",
      "team:pay",
    ]);
    expect(councilMemberOf(agents.agents[0] as AgentProfile)).toEqual({
      kind: "agent",
      userId: null,
      profileId: "team:pay",
      name: "Payments agent",
    });
  });

  it("takes what a person or a lead may set: no id or owner on their own, an id on a shared one", () => {
    expect(AgentProfileInput.parse({})).toEqual({});
    expect(
      AgentProfileInput.parse({ id: "x", ownerId: "y", name: "N", provider: "claude", budget: 10 }),
    ).toEqual({ name: "N", provider: "claude", budget: 10 });
    expect(AgentProfileInput.safeParse({ provider: "gemini" }).success).toBe(false);
    expect(AgentProfileInput.safeParse({ budget: 0 }).success).toBe(false);
    expect(AgentProfileInput.safeParse({ tools: [""] }).success).toBe(false);
    expect(SharedAgentInput.parse({ id: "team:pay", name: "P" })).toEqual({
      id: "team:pay",
      name: "P",
      provider: "scripted",
      model: "",
      persona: "",
      tools: [],
      budget: null,
    });
    expect(SharedAgentInput.safeParse({ name: "no id" }).success).toBe(false);
  });

  it("keeps the agent a verified person saved when their token is merged with users.json", () => {
    const known = User.parse({
      id: "ana",
      name: "Ana",
      teams: [{ teamId: "pay", role: "manager" }],
      agent: { name: "Ana's chair", provider: "claude", budget: 9000 },
    });
    const merged = mergeSsoUser(
      known,
      { userId: "ana", name: "Ana B" },
      { orgs: [], teams: [{ teamId: "growth", role: "member" }], projects: [] },
    );
    expect(merged.agent).toEqual(known.agent);
    expect(personalAgentProfile(merged)).toMatchObject({
      id: "agent:ana",
      name: "Ana's chair",
      provider: "claude",
      budget: 9000,
      persona: CHAIR_PERSONA,
    });
    // A person users.json does not know has no agent field to carry.
    expect(
      "agent" in mergeSsoUser(null, { userId: "new" }, { orgs: [], teams: [], projects: [] }),
    ).toBe(false);
  });

  it("lets a lead or manager of a team in the org, or an org admin, manage its shared agents", () => {
    const orgs: OrgsFile = {
      orgs: [
        {
          id: "nw",
          name: "Northwind",
          teams: [
            { id: "pay", name: "Payments", projects: [] },
            { id: "growth", name: "Growth", projects: [] },
          ],
        },
        { id: "other", name: "Other", teams: [{ id: "ops", name: "Ops", projects: [] }] },
      ],
    };
    const u = (over: Partial<User>): User => User.parse({ id: "u", name: "U", ...over });
    expect(canManageAgents(null, orgs, "nw")).toBe(false);
    expect(canManageAgents(u({ teams: [{ teamId: "pay", role: "member" }] }), orgs, "nw")).toBe(
      false,
    );
    expect(canManageAgents(u({ teams: [{ teamId: "pay", role: "lead" }] }), orgs, "nw")).toBe(true);
    expect(canManageAgents(u({ teams: [{ teamId: "growth", role: "manager" }] }), orgs, "nw")).toBe(
      true,
    );
    // A lead elsewhere, an admin elsewhere, an unknown org.
    expect(canManageAgents(u({ teams: [{ teamId: "ops", role: "lead" }] }), orgs, "nw")).toBe(
      false,
    );
    expect(canManageAgents(u({ orgs: [{ orgId: "other", role: "admin" }] }), orgs, "nw")).toBe(
      false,
    );
    expect(canManageAgents(u({ orgs: [{ orgId: "nw", role: "admin" }] }), orgs, "nw")).toBe(true);
    expect(canManageAgents(u({ orgs: [{ orgId: "nw", role: "member" }] }), orgs, "nw")).toBe(false);
    expect(canManageAgents(u({ orgs: [{ orgId: "nw", role: "admin" }] }), orgs, "nope")).toBe(
      false,
    );
  });
});
