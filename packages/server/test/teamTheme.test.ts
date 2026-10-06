/** team-theme: GET /api/teams/:id/theme and PUT by a lead or manager, persisted into orgs.json. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultTools, ScriptedModel } from "@henosis/runner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
  ],
};
const users = {
  users: [
    { id: "lee", name: "Lee", teams: [{ teamId: "payments", role: "lead" }] },
    { id: "max", name: "Max", teams: [{ teamId: "growth", role: "manager" }] },
    { id: "bo", name: "Bo", teams: [{ teamId: "payments", role: "member" }] },
    { id: "ada", name: "Ada", orgs: [{ orgId: "northwind", role: "admin" }] },
  ],
};

describe("team theme API", () => {
  let root: string;
  let server: HenosisServer;
  let base: string;
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "henosis-theme-"));
    writeFileSync(join(root, "orgs.json"), JSON.stringify(orgs));
    writeFileSync(join(root, "users.json"), JSON.stringify(users));
    server = new HenosisServer({ root, model: new ScriptedModel(), tools: defaultTools() });
    const port = await server.listen(0);
    base = `http://127.0.0.1:${port}`;
  });
  afterAll(async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  const put = (team: string, user: string, body: unknown) =>
    fetch(`${base}/api/teams/${team}/theme?user=${user}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("reads an unstyled team as null and an unknown team as 404", async () => {
    const res = await fetch(`${base}/api/teams/payments/theme`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ teamId: "payments", name: "Payments", theme: null });
    expect((await fetch(`${base}/api/teams/nope/theme`)).status).toBe(404);
  });

  it("refuses a member, an unknown user and a lead of another team", async () => {
    expect((await put("payments", "bo", { theme: { accent: "#56352D" } })).status).toBe(403);
    expect((await put("payments", "zed", { theme: { accent: "#56352D" } })).status).toBe(403);
    expect((await put("payments", "max", { theme: { accent: "#56352D" } })).status).toBe(403);
  });

  it("rejects a bad colour, a long emblem and an unknown field", async () => {
    const bad = await put("payments", "lee", { theme: { accent: "red" } });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toContain("accent");
    expect((await put("payments", "lee", { theme: { emblem: "PAY" } })).status).toBe(400);
    expect((await put("payments", "lee", { theme: { font: "Comic" } })).status).toBe(400);
  });

  it("lets the lead set the look, persists it, and lets the lead clear it", async () => {
    const theme = {
      accent: "#2A3244",
      highlight: "#E2C4A6",
      surface: "#56352D",
      mark: "bead",
      motion: "calm",
      emblem: "PY",
    };
    const res = await put("payments", "lee", { theme });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ teamId: "payments", name: "Payments", theme });
    const read = await (await fetch(`${base}/api/teams/payments/theme`)).json();
    expect(read).toEqual({ teamId: "payments", name: "Payments", theme });
    const disk = JSON.parse(readFileSync(join(root, "orgs.json"), "utf8")) as typeof orgs & {
      orgs: { teams: { id: string; theme?: unknown }[] }[];
    };
    expect(disk.orgs[0]?.teams.find((t) => t.id === "payments")?.theme).toEqual(theme);
    // The other team is untouched, and a manager styles their own team.
    expect((await (await fetch(`${base}/api/teams/growth/theme`)).json()).theme).toBeNull();
    expect((await put("growth", "max", { theme: { accent: "#56352D" } })).status).toBe(200);
    // An org admin may style any team in the org.
    expect((await put("growth", "ada", { theme: { accent: "#2A3244" } })).status).toBe(200);
    // Clearing: theme null, or an empty theme.
    const cleared = await put("payments", "lee", { theme: null });
    expect(await cleared.json()).toEqual({ teamId: "payments", name: "Payments", theme: null });
    const again = JSON.parse(readFileSync(join(root, "orgs.json"), "utf8")) as {
      orgs: { teams: { id: string; theme?: unknown }[] }[];
    };
    expect(again.orgs[0]?.teams.find((t) => t.id === "payments")?.theme).toBeUndefined();
  });

  it("tells /api/me which teams a user may style", async () => {
    const me = async (u: string) =>
      (await (await fetch(`${base}/api/me?user=${u}`)).json()) as { styles: string[] };
    expect((await me("lee")).styles).toEqual(["payments"]);
    expect((await me("max")).styles).toEqual(["growth"]);
    expect((await me("bo")).styles).toEqual([]);
    expect((await me("ada")).styles).toEqual(["payments", "growth"]);
  });
});

describe("team theme API with a shared token", () => {
  it("needs the token on a write", async () => {
    const root = mkdtempSync(join(tmpdir(), "henosis-theme-tok-"));
    writeFileSync(join(root, "orgs.json"), JSON.stringify(orgs));
    writeFileSync(join(root, "users.json"), JSON.stringify(users));
    const server = new HenosisServer({
      root,
      model: new ScriptedModel(),
      tools: defaultTools(),
      token: "secret",
    });
    const port = await server.listen(0);
    const base = `http://127.0.0.1:${port}`;
    try {
      const body = JSON.stringify({ theme: { accent: "#56352D" } });
      const headers = { "content-type": "application/json" };
      const no = await fetch(`${base}/api/teams/payments/theme?user=lee`, {
        method: "PUT",
        headers,
        body,
      });
      expect(no.status).toBe(401);
      const yes = await fetch(`${base}/api/teams/payments/theme?user=lee`, {
        method: "PUT",
        headers: { ...headers, authorization: "Bearer secret" },
        body,
      });
      expect(yes.status).toBe(200);
      // Reads need no token.
      expect((await fetch(`${base}/api/teams/payments/theme`)).status).toBe(200);
    } finally {
      await server.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
