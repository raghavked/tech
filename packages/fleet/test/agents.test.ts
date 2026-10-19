import { describe, expect, it } from "vitest";
import {
  AgentProfile,
  AgentsFile,
  CHAIR_PERSONA,
  councilMemberOf,
  listAgentProfiles,
  personalAgentId,
  personalAgentProfile,
  resolveAgentProfile,
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
});
