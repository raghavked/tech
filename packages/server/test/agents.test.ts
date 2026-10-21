/**
 * Member models (docs/19_council.md): GET/PUT /api/agents for a person's own agent and for the
 * org's shared team agents, the roles that guard them, the files they land in, the directory
 * row that shows each person's agent with its model, and the model factory behind them.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CHAIR_PERSONA } from "@henosis/fleet";
import { defaultTools, type Model, ScriptedModel } from "@henosis/runner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ModelFactory, modelNameOf, SCRIPTED_MODEL_NAME, toolSpecsFor } from "../src/models.js";
import { OrgRegistry } from "../src/orgs.js";
import { HenosisServer } from "../src/server.js";

const orgs = {
  orgs: [
    {
      id: "northwind",
      name: "Northwind",
      teams: [
        { id: "payments", name: "Payments", projects: [{ id: "billing", name: "Billing" }] },
        { id: "growth", name: "Growth", projects: [{ id: "onboarding", name: "Onboarding" }] },
      ],
    },
    { id: "other", name: "Other", teams: [] },
  ],
};
const users = {
  users: [
    { id: "lee", name: "Lee", teams: [{ teamId: "payments", role: "lead" }] },
    { id: "max", name: "Max", teams: [{ teamId: "growth", role: "manager" }] },
    { id: "bo", name: "Bo", teams: [{ teamId: "payments", role: "member" }] },
    {
      id: "cy",
      name: "Cy",
      teams: [{ teamId: "payments", role: "member" }],
      agent: { id: "cy-bot", provider: "claude", model: "house-model", tools: ["workspace.read"] },
    },
    { id: "ada", name: "Ada", orgs: [{ orgId: "northwind", role: "admin" }] },
  ],
};

interface Row {
  id: string;
  ownerId: string | null;
  name: string;
  provider: string;
  model: string;
  modelName: string;
  persona: string;
  tools: string[];
  budget: number | null;
}
interface Mine {
  mine: Row | null;
  manager: boolean;
  chairPersona: string;
  shared: Row[];
  leads: string[];
  providers: { scripted: boolean; claude: boolean };
  tools: { name: string; risk: string }[];
}

describe("member model API", () => {
  let root: string;
  let server: HenosisServer;
  let base: string;
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "henosis-agents-"));
    writeFileSync(join(root, "orgs.json"), JSON.stringify(orgs));
    writeFileSync(join(root, "users.json"), JSON.stringify(users));
    server = new HenosisServer({ root, model: new ScriptedModel(), tools: defaultTools() });
    base = `http://127.0.0.1:${await server.listen(0)}`;
  });
  afterAll(async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  const get = async (path: string) => (await fetch(`${base}${path}`)).json();
  const put = (path: string, body: unknown) =>
    fetch(`${base}${path}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("describes a person's agent with its defaults, the chair's manners for a manager, and what runs here", async () => {
    const lee = (await get("/api/agents?user=lee")) as Mine;
    expect(lee.mine).toEqual({
      id: "agent:lee",
      ownerId: "lee",
      name: "Lee's agent",
      provider: "scripted",
      model: "",
      modelName: SCRIPTED_MODEL_NAME,
      persona: "",
      tools: [],
      budget: null,
    });
    expect(lee.manager).toBe(false);
    expect(lee.leads).toEqual(["northwind"]);
    expect(lee.chairPersona).toBe(CHAIR_PERSONA);
    expect(lee.providers.scripted).toBe(true);
    expect(typeof lee.providers.claude).toBe("boolean");
    expect(lee.tools.map((t) => t.name)).toContain("workspace.read");
    expect(lee.shared).toEqual([]);

    const max = (await get("/api/agents?user=max")) as Mine;
    expect(max.manager).toBe(true);
    expect(max.mine?.persona).toBe(CHAIR_PERSONA);

    // A row with its own id and a Claude model id keeps them; the model name is the id.
    const cy = (await get("/api/agents?user=cy")) as Mine;
    expect(cy.mine).toMatchObject({
      id: "cy-bot",
      provider: "claude",
      model: "house-model",
      modelName: "house-model",
      tools: ["workspace.read"],
    });
    expect(cy.leads).toEqual([]);
    // A member leads nowhere; an admin leads the org.
    expect(((await get("/api/agents?user=bo")) as Mine).leads).toEqual([]);
    expect(((await get("/api/agents?user=ada")) as Mine).leads).toEqual(["northwind"]);
    // Without a person there is no "mine".
    expect(((await get("/api/agents")) as Mine).mine).toBeNull();
  });

  it("lets a person set their own agent, persists it in users.json, and keeps the defaults for what they left out", async () => {
    const res = await put("/api/agents?user=bo", {
      agent: { name: "Bo's blunt one", persona: "Blunt.", tools: ["workspace.read"], budget: 5000 },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Mine;
    expect(body.mine).toMatchObject({
      id: "agent:bo",
      ownerId: "bo",
      name: "Bo's blunt one",
      provider: "scripted",
      persona: "Blunt.",
      tools: ["workspace.read"],
      budget: 5000,
    });
    const disk = JSON.parse(readFileSync(join(root, "users.json"), "utf8")) as {
      users: { id: string; agent?: unknown; teams?: unknown[] }[];
    };
    const bo = disk.users.find((u) => u.id === "bo");
    expect(bo?.agent).toEqual({
      name: "Bo's blunt one",
      persona: "Blunt.",
      tools: ["workspace.read"],
      budget: 5000,
    });
    expect(bo?.teams).toEqual([{ teamId: "payments", role: "member" }]);
    // The profile id a row already names survives a save.
    await put("/api/agents?user=cy", { agent: { provider: "scripted" } });
    const cy = (await get("/api/agents?user=cy")) as Mine;
    expect(cy.mine).toMatchObject({ id: "cy-bot", provider: "scripted", model: "" });
    // A manager who clears the persona keeps it cleared; one who leaves it out keeps the chair's.
    await put("/api/agents?user=max", { agent: { persona: "" } });
    expect(((await get("/api/agents?user=max")) as Mine).mine?.persona).toBe("");
    await put("/api/agents?user=max", { agent: { name: "Max's chair" } });
    expect(((await get("/api/agents?user=max")) as Mine).mine?.persona).toBe(CHAIR_PERSONA);
    // The registry reads the saved profile back on a fresh start.
    const again = new OrgRegistry(root);
    expect(again.personalAgent("bo").name).toBe("Bo's blunt one");
    expect(again.agentProfile("agent:bo")?.budget).toBe(5000);
  });

  it("rejects a bad profile and a write without a person", async () => {
    const bad = await put("/api/agents?user=bo", { agent: { provider: "gemini" } });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toContain("provider");
    expect((await put("/api/agents?user=bo", { agent: { budget: 0 } })).status).toBe(400);
    expect((await put("/api/agents?user=bo", { agent: "nope" })).status).toBe(400);
    expect((await put("/api/agents?user=bo", {})).status).toBe(400);
    expect((await put("/api/agents", { agent: { name: "X" } })).status).toBe(403);
  });

  it("keeps the agent of a person users.json does not know in agents.json, in their name", async () => {
    const before = (await get("/api/agents?user=zed")) as Mine;
    expect(before.mine).toMatchObject({ id: "agent:zed", ownerId: "zed", name: "zed's agent" });
    const res = await put("/api/agents?user=zed", {
      agent: { name: "Zed's agent", persona: "Terse." },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as Mine).mine).toMatchObject({
      id: "agent:zed",
      ownerId: "zed",
      persona: "Terse.",
    });
    const disk = JSON.parse(readFileSync(join(root, "agents.json"), "utf8")) as {
      agents: { id: string; ownerId: string | null }[];
    };
    expect(disk.agents).toEqual([expect.objectContaining({ id: "agent:zed", ownerId: "zed" })]);
    const usersDisk = JSON.parse(readFileSync(join(root, "users.json"), "utf8")) as {
      users: { id: string }[];
    };
    expect(usersDisk.users.some((u) => u.id === "zed")).toBe(false);
    // The shared list does not count it, and the registry resolves it by id.
    expect(((await get("/api/agents/northwind")) as { agents: Row[] }).agents).toEqual([]);
    expect(server.orgs.agentProfile("agent:zed")?.persona).toBe("Terse.");
  });

  it("guards the shared team agents: leads, managers and admins write; members read", async () => {
    const list = [
      { id: "team:payments", name: "Payments agent", persona: "Speaks for the team." },
      { id: "team:growth", name: "Growth agent", provider: "claude", budget: 20000 },
    ];
    expect((await put("/api/agents/northwind?user=bo", { agents: list })).status).toBe(403);
    expect((await put("/api/agents/northwind?user=nobody", { agents: list })).status).toBe(403);
    expect((await put("/api/agents/nope?user=lee", { agents: list })).status).toBe(404);
    // Lee leads a team in Northwind, not in Other.
    expect((await put("/api/agents/other?user=lee", { agents: list })).status).toBe(403);
    const ok = await put("/api/agents/northwind?user=lee", { agents: list });
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { orgId: string; agents: Row[]; canEdit: boolean };
    expect(body.orgId).toBe("northwind");
    expect(body.canEdit).toBe(true);
    expect(body.agents).toEqual([
      {
        id: "team:payments",
        ownerId: null,
        name: "Payments agent",
        provider: "scripted",
        model: "",
        modelName: SCRIPTED_MODEL_NAME,
        persona: "Speaks for the team.",
        tools: [],
        budget: null,
      },
      expect.objectContaining({
        id: "team:growth",
        ownerId: null,
        provider: "claude",
        modelName: modelNameOf({ provider: "claude", model: "" }),
        budget: 20000,
      }),
    ]);
    // On disk beside users.json, with Zed's own row kept.
    const disk = JSON.parse(readFileSync(join(root, "agents.json"), "utf8")) as {
      agents: { id: string; ownerId: string | null }[];
    };
    expect(disk.agents.map((a) => a.id)).toEqual(["team:payments", "team:growth", "agent:zed"]);
    // Anyone reads; a member sees they cannot edit; the person view lists them too.
    const read = (await get("/api/agents/northwind?user=bo")) as {
      agents: Row[];
      canEdit: boolean;
    };
    expect(read.agents.map((a) => a.id)).toEqual(["team:payments", "team:growth"]);
    expect(read.canEdit).toBe(false);
    expect(((await get("/api/agents?user=bo")) as Mine).shared.map((a) => a.id)).toEqual([
      "team:payments",
      "team:growth",
    ]);
    // A manager and an admin may write too; the list replaces, so one row remains.
    expect((await put("/api/agents/northwind?user=max", { agents: list.slice(0, 1) })).status).toBe(
      200,
    );
    expect((await put("/api/agents/northwind?user=ada", { agents: list.slice(0, 1) })).status).toBe(
      200,
    );
    expect(((await get("/api/agents/northwind")) as { agents: Row[] }).agents.length).toBe(1);
    // The registry resolves a shared agent for a council.
    expect(server.orgs.agentProfile("team:payments")).toMatchObject({
      ownerId: null,
      name: "Payments agent",
    });
  });

  it("rejects shared agents that collide: two of one id, or a person's own agent", async () => {
    const two = await put("/api/agents/northwind?user=lee", {
      agents: [
        { id: "team:x", name: "X" },
        { id: "team:x", name: "X again" },
      ],
    });
    expect(two.status).toBe(400);
    expect(((await two.json()) as { error: string }).error).toContain("team:x");
    const own = await put("/api/agents/northwind?user=lee", {
      agents: [{ id: "agent:lee", name: "Mine" }],
    });
    expect(own.status).toBe(400);
    expect(((await own.json()) as { error: string }).error).toContain("Lee");
    expect(
      (await put("/api/agents/northwind?user=lee", { agents: [{ id: "cy-bot", name: "Cy's" }] }))
        .status,
    ).toBe(400);
    expect(
      (await put("/api/agents/northwind?user=lee", { agents: [{ id: "agent:zed", name: "Z" }] }))
        .status,
    ).toBe(400);
    expect(
      (await put("/api/agents/northwind?user=lee", { agents: [{ name: "no id" }] })).status,
    ).toBe(400);
    expect((await put("/api/agents/northwind?user=lee", { nope: [] })).status).toBe(400);
    // Nothing changed.
    expect(
      ((await get("/api/agents/northwind")) as { agents: Row[] }).agents.map((a) => a.id),
    ).toEqual(["team:payments"]);
  });

  it("lists each person's agent with its model name in the chat directory", async () => {
    const dir = (await get("/api/chat/northwind/directory")) as {
      people: { id: string; name: string; agent: Row }[];
    };
    const byId = new Map(dir.people.map((p) => [p.id, p]));
    expect(byId.get("bo")?.agent).toMatchObject({
      id: "agent:bo",
      name: "Bo's blunt one",
      provider: "scripted",
      modelName: SCRIPTED_MODEL_NAME,
    });
    expect(byId.get("max")?.agent).toMatchObject({ id: "agent:max", persona: CHAIR_PERSONA });
    expect(byId.get("cy")?.agent).toMatchObject({ id: "cy-bot", provider: "scripted" });
  });

  it("says which teams each person is in and which a model's owner manages, for the chair default", async () => {
    const dir = (await get("/api/chat/northwind/directory")) as {
      people: { id: string; teams: string[] }[];
      models: { profileId: string; ownerId: string | null; manages: string[] }[];
    };
    const teams = new Map(dir.people.map((p) => [p.id, p.teams]));
    expect(teams.get("bo")).toEqual(["payments"]);
    expect(teams.get("max")).toEqual(["growth"]);
    // An org admin with no team row is in no team by their row; a person users.json does not
    // know is in every team of the org, on trust.
    expect(teams.get("ada")).toEqual([]);
    const manages = new Map(dir.models.map((m) => [m.profileId, m.manages]));
    expect(manages.get("agent:max")).toEqual(["growth"]);
    expect(manages.get("agent:lee")).toEqual([]);
    expect(manages.get("agent:bo")).toEqual([]);
  });
});

describe("member model API with a shared token", () => {
  it("needs the token on a write, not on a read", async () => {
    const root = mkdtempSync(join(tmpdir(), "henosis-agents-tok-"));
    writeFileSync(join(root, "orgs.json"), JSON.stringify(orgs));
    writeFileSync(join(root, "users.json"), JSON.stringify(users));
    const server = new HenosisServer({
      root,
      model: new ScriptedModel(),
      tools: defaultTools(),
      token: "secret",
    });
    const base = `http://127.0.0.1:${await server.listen(0)}`;
    try {
      const body = JSON.stringify({ agent: { name: "Lee's own" } });
      const headers = { "content-type": "application/json" };
      const no = await fetch(`${base}/api/agents?user=lee`, { method: "PUT", headers, body });
      expect(no.status).toBe(401);
      const yes = await fetch(`${base}/api/agents?user=lee`, {
        method: "PUT",
        headers: { ...headers, authorization: "Bearer secret" },
        body,
      });
      expect(yes.status).toBe(200);
      const shared = await fetch(`${base}/api/agents/northwind?user=lee`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ agents: [] }),
      });
      expect(shared.status).toBe(401);
      expect((await fetch(`${base}/api/agents?user=lee`)).status).toBe(200);
      expect((await fetch(`${base}/api/agents/northwind`)).status).toBe(200);
    } finally {
      await server.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("model factory", () => {
  const profile = (
    over: Partial<{ id: string; provider: "scripted" | "claude"; model: string; tools: string[] }>,
  ) => ({
    id: "agent:x",
    provider: "scripted" as const,
    model: "",
    tools: [],
    ...over,
  });

  it("names the model a profile runs on", () => {
    expect(modelNameOf({ provider: "scripted", model: "" })).toBe(SCRIPTED_MODEL_NAME);
    expect(modelNameOf({ provider: "scripted", model: "ignored" })).toBe(SCRIPTED_MODEL_NAME);
    expect(modelNameOf({ provider: "claude", model: "house-model" })).toBe("house-model");
    expect(modelNameOf({ provider: "claude", model: "" })).not.toBe("");
  });

  it("builds the scripted model, shares it, and stands it in for Claude when Claude cannot run", () => {
    const lines: string[] = [];
    const f = new ModelFactory({ claude: () => false, log: (l) => lines.push(l) });
    const a = f.modelFor(profile({}));
    expect(a).toBeInstanceOf(ScriptedModel);
    expect(f.modelFor(profile({ id: "agent:y" }))).toBe(a);
    expect(f.claudeAvailable()).toBe(false);
    const c = f.modelFor(profile({ id: "agent:c", provider: "claude", model: "house-model" }));
    expect(c).toBe(a);
    f.modelFor(profile({ id: "agent:c", provider: "claude", model: "house-model" }));
    expect(lines).toEqual([expect.stringContaining("agent:c asks for Claude")]);
  });

  it("builds Claude from the profile's model id (or the default) when it can run, one per model id", () => {
    const built: string[] = [];
    const stub = (name: string): Model => ({
      name,
      complete: async () => ({ text: "", toolCalls: [], done: true }),
    });
    const f = new ModelFactory({
      claude: () => true,
      buildClaude: (id) => {
        built.push(id);
        return stub(id);
      },
    });
    const house = f.modelFor(profile({ provider: "claude", model: "house-model" }));
    expect(house.name).toBe("house-model");
    expect(f.modelFor(profile({ id: "agent:z", provider: "claude", model: "house-model" }))).toBe(
      house,
    );
    const dflt = f.modelFor(profile({ provider: "claude" }));
    expect(dflt.name).toBe(modelNameOf({ provider: "claude", model: "" }));
    expect(built).toEqual(["house-model", dflt.name]);
    expect(f.modelFor(profile({}))).toBeInstanceOf(ScriptedModel);
  });

  it("narrows the tools to what the profile names, every tool when it names none", () => {
    const tools = defaultTools();
    expect(toolSpecsFor({ tools: [] }, tools)).toEqual(tools.specs());
    expect(toolSpecsFor({ tools: ["workspace.read", "nope"] }, tools).map((t) => t.name)).toEqual([
      "workspace.read",
    ]);
  });
});
