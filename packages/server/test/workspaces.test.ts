/**
 * A server of workspaces (orgs.ts `Tenancy`, workspaceApi.ts): a company makes its own
 * workspace, invites its people and connects its own model key; nothing of a workspace is
 * visible to anyone outside it, over HTTP or the websocket.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ServerMessage } from "@henosis/protocol";
import {
  defaultTools,
  type KeyCheck,
  type Model,
  type ModelRequest,
  ScriptedModel,
} from "@henosis/runner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { INVITE_TTL_MS, OrgRegistry, slugOf, tenancyFromEnv } from "../src/orgs.js";
import { HenosisServer } from "../src/server.js";
import { FileStore, MirrorStore } from "../src/store/index.js";

const GOOD_KEY = "sk-ant-api03-GOODGOODGOODGOODGOODGOODGOODGOOD-good";
const BAD_KEY = "sk-ant-api03-BADBADBADBADBADBADBADBADBADBADBAD-nope";

class Keyed implements Model {
  constructor(
    readonly name: string,
    readonly apiKey: string,
  ) {}
  async complete(_req: ModelRequest) {
    return { text: "DONE", toolCalls: [], done: true };
  }
}

interface WorkspaceView {
  id: string;
  name: string;
  role: "admin" | "member" | null;
  teams: { id: string; name: string; projects: { id: string; name: string }[] }[];
  members: number;
  model: {
    connected: boolean;
    last4: string | null;
    source: string;
    running: string;
    status: string;
    canManage: boolean;
    storage: boolean;
    addedBy: string | null;
    model: string;
  };
}

/** One websocket message in, the first reply out. */
async function wsReply(base: string, message: Record<string, unknown>): Promise<ServerMessage> {
  const ws = new WebSocket(`${base.replace("http", "ws")}/ws`);
  await new Promise<void>((r) => ws.once("open", () => r()));
  const reply = new Promise<ServerMessage>((r) =>
    ws.once("message", (raw) => r(JSON.parse(raw.toString()) as ServerMessage)),
  );
  ws.send(JSON.stringify(message));
  const out = await reply;
  ws.close();
  return out;
}

describe("a server of workspaces", () => {
  let root: string;
  let server: HenosisServer;
  let base: string;
  const checked: { key: string; model?: string | undefined }[] = [];
  const built: Keyed[] = [];

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "henosis-workspaces-"));
    server = new HenosisServer({
      root,
      model: new ScriptedModel(),
      tools: defaultTools(),
      tenancy: "workspaces",
      keysSecret: "a-test-secret-of-enough-length",
      envKey: false,
      offline: () => false,
      checkKey: async (key, model): Promise<KeyCheck> => {
        checked.push({ key, model });
        if (key === BAD_KEY)
          return { ok: false, reason: "refused", message: "Anthropic did not accept this key." };
        if (model === "no-such-model")
          return { ok: false, reason: "model", message: "This key cannot use the model." };
        return { ok: true };
      },
      listModels: async () => [{ id: "house-model", name: "House" }],
      buildKeyed: (key, id) => {
        const m = new Keyed(id, key);
        built.push(m);
        return m;
      },
    });
    base = `http://127.0.0.1:${await server.listen(0)}`;
  });
  afterAll(async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  const call = async (method: string, path: string, user: string | null, body?: unknown) => {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${base}${path}${user ? `${sep}user=${user}` : ""}`, {
      method,
      ...(body !== undefined
        ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    });
    const text = await res.text();
    return { status: res.status, text, body: (text ? JSON.parse(text) : null) as never };
  };
  const get = (path: string, user: string | null) => call("GET", path, user);

  it("answers a stranger nothing: sign in first, and health lists no sessions or projects", async () => {
    expect((await get("/api/me", null)).status).toBe(401);
    expect((await get("/api/orgs", null)).status).toBe(401);
    expect((await get("/api/workspaces", null)).status).toBe(401);
    const health = (await get("/api/health", null)).body as Record<string, unknown>;
    expect(health).toMatchObject({
      ok: true,
      tenancy: "workspaces",
      keys: true,
      sessions: [],
      projects: [],
    });
    // /api/auth still says how to sign in.
    expect((await get("/api/auth", null)).status).toBe(200);
  });

  it("lets a person make a workspace and be its admin, with a first team and project", async () => {
    const before = (await get("/api/workspaces", "ana")).body as {
      tenancy: string;
      canCreate: boolean;
      workspaces: WorkspaceView[];
    };
    expect(before).toEqual({ tenancy: "workspaces", canCreate: true, workspaces: [] });
    expect((await call("POST", "/api/workspaces", "ana", { name: "x" })).status).toBe(400);
    const made = await call("POST", "/api/workspaces", "ana", { name: "  Acme   Robotics " });
    expect(made.status).toBe(201);
    const ws = (made.body as { workspace: WorkspaceView }).workspace;
    expect(ws).toMatchObject({
      id: "acme-robotics",
      name: "Acme Robotics",
      role: "admin",
      members: 1,
      teams: [
        {
          id: "acme-robotics-team",
          name: "General",
          projects: [{ id: "acme-robotics-main", name: "Main" }],
        },
      ],
    });
    expect(ws.model).toMatchObject({
      connected: false,
      source: "demo",
      canManage: true,
      storage: true,
    });
    const me = (await get("/api/me", "ana")).body as {
      tenancy: string;
      projects: { projectId: string; orgId: string }[];
    };
    expect(me.tenancy).toBe("workspaces");
    expect(me.projects.map((p) => p.projectId)).toEqual(["acme-robotics-main"]);
    // A second workspace with the same name gets an id of its own.
    const twin = await call("POST", "/api/workspaces", "zed", { name: "Acme Robotics" });
    expect((twin.body as { workspace: WorkspaceView }).workspace.id).toBe("acme-robotics-2");
    // It is written to the store: the org with who made it, and the person's row.
    const orgs = JSON.parse(readFileSync(join(root, "orgs.json"), "utf8")) as {
      orgs: { id: string; createdBy?: string }[];
    };
    expect(orgs.orgs.find((o) => o.id === "acme-robotics")?.createdBy).toBe("ana");
    const users = JSON.parse(readFileSync(join(root, "users.json"), "utf8")) as {
      users: { id: string; orgs: { orgId: string; role: string }[] }[];
    };
    expect(users.users.find((u) => u.id === "ana")?.orgs).toEqual([
      { orgId: "acme-robotics", role: "admin" },
    ]);
  });

  it("hides a workspace from everyone outside it, on every route and on the socket", async () => {
    // Ana's session, so there is something to find.
    const joined = await wsReply(base, {
      type: "join",
      sessionId: "acme-plan",
      projectId: "acme-robotics-main",
      branch: "main",
      actor: { id: "ana", kind: "human", name: "Ana" },
      userId: "ana",
      title: "Acme plan",
    });
    expect(joined.type).not.toBe("error");

    expect((await get("/api/workspaces", "bo")).body).toMatchObject({ workspaces: [] });
    expect(((await get("/api/me", "bo")).body as { projects: unknown[] }).projects).toEqual([]);
    expect((await get("/api/orgs", "bo")).body).toEqual({ orgs: [] });
    for (const path of [
      "/api/workspaces/acme-robotics",
      "/api/workspaces/acme-robotics/members",
      "/api/workspaces/acme-robotics/model",
      "/api/projects/acme-robotics-main",
      "/api/projects/acme-robotics-main/sessions",
      "/api/projects/acme-robotics-main/brief",
      "/api/chat/acme-robotics",
      "/api/chat/acme-robotics/directory",
      "/api/chat/acme-robotics/councils",
      "/api/memory/acme-robotics",
      "/api/agents/acme-robotics",
      "/api/teams/acme-robotics-team/theme",
      "/api/sessions/acme-plan/export.md",
      "/api/projects/acme-robotics-main/sessions/acme-plan/branches",
    ]) {
      const res = await get(path, "bo");
      expect(`${path} ${res.status}`).toBe(`${path} 404`);
      expect(res.text).not.toContain("Acme");
    }
    // Ana reads the same routes.
    expect((await get("/api/projects/acme-robotics-main/sessions", "ana")).status).toBe(200);
    expect((await get("/api/chat/acme-robotics", "ana")).status).toBe(200);
    // Search and usage read only the asker's own workspaces, whatever org they name.
    const found = await get("/api/search?q=acme&org=acme-robotics", "bo");
    expect(found.text).not.toContain("Acme plan");
    expect((await get("/api/search?q=acme", "ana")).text).toContain("Acme plan");
    const usage = await get("/api/usage?org=acme-robotics", "bo");
    expect(usage.text).not.toContain("acme-plan");
    // The glance counts nothing of another workspace.
    expect((await get("/api/glance", "bo")).text).not.toContain("acme");

    // The socket: joining, subscribing to the project, subscribing to the chat.
    const join = await wsReply(base, {
      type: "join",
      sessionId: "acme-plan",
      projectId: "acme-robotics-main",
      branch: "main",
      actor: { id: "bo", kind: "human", name: "Bo" },
      userId: "bo",
    });
    expect(join).toMatchObject({ type: "error" });
    const sub = await wsReply(base, {
      type: "project.subscribe",
      projectId: "acme-robotics-main",
      userId: "bo",
    });
    expect(sub).toMatchObject({ type: "error" });
    const chat = await wsReply(base, {
      type: "chat.subscribe",
      orgId: "acme-robotics",
      userId: "bo",
      name: "Bo",
    });
    expect(chat).toMatchObject({ type: "error" });
  });

  it("does not open one workspace's session by its id from another workspace", async () => {
    const made = await call("POST", "/api/workspaces", "cy", { name: "Beta" });
    expect(made.status).toBe(201);
    const reply = await wsReply(base, {
      type: "join",
      sessionId: "acme-plan",
      projectId: "beta-main",
      branch: "main",
      actor: { id: "cy", kind: "human", name: "Cy" },
      userId: "cy",
    });
    expect(reply).toMatchObject({ type: "error" });
    expect((reply as { message: string }).message).toMatch(/taken/);
    // And with no project named, the session's own project is not the stranger's.
    const bare = await wsReply(base, {
      type: "join",
      sessionId: "acme-plan",
      branch: "main",
      actor: { id: "cy", kind: "human", name: "Cy" },
      userId: "cy",
    });
    expect(bare).toMatchObject({ type: "error" });
  });

  it("brings people in by invitation, and only an admin invites", async () => {
    expect((await call("POST", "/api/workspaces/acme-robotics/invites", "bo", {})).status).toBe(
      404,
    );
    const made = await call("POST", "/api/workspaces/acme-robotics/invites", "ana", {});
    expect(made.status).toBe(201);
    const { token, invite } = made.body as { token: string; invite: { id: string; state: string } };
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(invite.state).toBe("open");
    // Only the hash is kept.
    expect(readFileSync(join(root, "invites.json"), "utf8")).not.toContain(token);
    // The link says where it leads; a wrong token says nothing.
    const seen = (await get(`/api/invites/${token}`, "bo")).body as Record<string, unknown>;
    expect(seen).toMatchObject({
      workspace: { id: "acme-robotics", name: "Acme Robotics" },
      role: "member",
      state: "open",
      member: false,
    });
    expect((await get("/api/invites/not-a-token", "bo")).status).toBe(404);
    const accepted = await call("POST", `/api/invites/${token}/accept`, "bo");
    expect(accepted.status).toBe(200);
    expect((accepted.body as { workspace: WorkspaceView }).workspace).toMatchObject({
      id: "acme-robotics",
      role: "member",
      members: 2,
    });
    // Bo is in: reads the project, joins the session as a contributor, but manages nothing.
    expect((await get("/api/projects/acme-robotics-main/sessions", "bo")).status).toBe(200);
    const members = (await get("/api/workspaces/acme-robotics/members", "bo")).body as {
      members: { id: string; role: string }[];
      invites: unknown[];
      canManage: boolean;
    };
    expect(members.members.map((m) => `${m.id}:${m.role}`)).toEqual(["ana:admin", "bo:member"]);
    expect(members.invites).toEqual([]);
    expect(members.canManage).toBe(false);
    expect((await call("POST", "/api/workspaces/acme-robotics/invites", "bo", {})).status).toBe(
      403,
    );
    expect(
      (await call("PUT", "/api/workspaces/acme-robotics/model", "bo", { key: GOOD_KEY })).status,
    ).toBe(403);
    expect(
      (await call("PUT", "/api/workspaces/acme-robotics", "bo", { name: "Bo's now" })).status,
    ).toBe(403);
    expect(
      (await call("POST", "/api/workspaces/acme-robotics/projects", "bo", { name: "X" })).status,
    ).toBe(403);
    // A withdrawn link no longer works.
    const second = (await call("POST", "/api/workspaces/acme-robotics/invites", "ana", {}))
      .body as { token: string; invite: { id: string } };
    expect(
      (await call("DELETE", `/api/workspaces/acme-robotics/invites/${second.invite.id}`, "ana"))
        .status,
    ).toBe(200);
    expect((await call("POST", `/api/invites/${second.token}/accept`, "dee")).status).toBe(403);
    expect((await get("/api/workspaces", "dee")).body).toMatchObject({ workspaces: [] });
  });

  it("keeps at least one admin, lets a member leave, and lets an admin change roles and remove", async () => {
    expect(
      (await call("PUT", "/api/workspaces/acme-robotics/members/ana", "ana", { role: "member" }))
        .status,
    ).toBe(409);
    expect((await call("DELETE", "/api/workspaces/acme-robotics/members/ana", "ana")).status).toBe(
      409,
    );
    const raised = await call("PUT", "/api/workspaces/acme-robotics/members/bo", "ana", {
      role: "admin",
    });
    expect(raised.status).toBe(200);
    expect(
      (raised.body as { members: { id: string; role: string }[] }).members.find(
        (m) => m.id === "bo",
      )?.role,
    ).toBe("admin");
    await call("PUT", "/api/workspaces/acme-robotics/members/bo", "ana", { role: "member" });
    expect((await call("DELETE", "/api/workspaces/acme-robotics/members/ana", "bo")).status).toBe(
      403,
    );
    // Bo leaves, and is outside again.
    expect((await call("DELETE", "/api/workspaces/acme-robotics/members/bo", "bo")).body).toEqual({
      left: true,
    });
    expect((await get("/api/projects/acme-robotics-main", "bo")).status).toBe(404);
  });

  it("adds teams and projects with ids that are unique on the server", async () => {
    const withTeam = await call("POST", "/api/workspaces/acme-robotics/teams", "ana", {
      name: "Hardware",
    });
    expect(withTeam.status).toBe(201);
    const withProject = await call("POST", "/api/workspaces/acme-robotics/projects", "ana", {
      name: "Arm firmware",
      teamId: "acme-robotics-hardware",
    });
    expect(withProject.status).toBe(201);
    const ws = (withProject.body as { workspace: WorkspaceView }).workspace;
    expect(ws.teams.find((t) => t.id === "acme-robotics-hardware")?.projects).toEqual([
      { id: "acme-robotics-arm-firmware", name: "Arm firmware" },
    ]);
    expect(
      (
        await call("POST", "/api/workspaces/acme-robotics/projects", "ana", {
          name: "arm firmware",
          teamId: "acme-robotics-hardware",
        })
      ).status,
    ).toBe(409);
    expect((await get("/api/projects/acme-robotics-arm-firmware", "ana")).status).toBe(200);
    expect((await get("/api/projects/acme-robotics-arm-firmware", "cy")).status).toBe(404);
  });

  it("connects a workspace's own key: checked with the provider, sealed, never answered back", async () => {
    const refused = await call("PUT", "/api/workspaces/acme-robotics/model", "ana", {
      key: BAD_KEY,
    });
    expect(refused.status).toBe(400);
    expect(refused.body).toMatchObject({ reason: "refused" });
    expect(
      (await call("PUT", "/api/workspaces/acme-robotics/model", "ana", { key: "nope" })).status,
    ).toBe(400);
    expect(
      (
        (await get("/api/workspaces/acme-robotics/model", "ana")).body as {
          model: { connected: boolean };
        }
      ).model.connected,
    ).toBe(false);

    const ok = await call("PUT", "/api/workspaces/acme-robotics/model", "ana", { key: GOOD_KEY });
    expect(ok.status).toBe(200);
    expect(ok.text).not.toContain(GOOD_KEY);
    expect((ok.body as { model: WorkspaceView["model"] }).model).toMatchObject({
      connected: true,
      last4: "good",
      source: "workspace",
      status: "ok",
      addedBy: "ana",
      canManage: true,
    });
    expect(checked.at(-1)).toEqual({ key: GOOD_KEY, model: undefined });
    // Nowhere in the store in the clear.
    await server.store.flush();
    expect(readFileSync(join(root, "keys.json"), "utf8")).not.toContain(GOOD_KEY);
    // No route answers it: not the workspace, not the list, not the member's view.
    for (const path of ["/api/workspaces", "/api/workspaces/acme-robotics", "/api/agents"]) {
      expect((await get(path, "ana")).text).not.toContain(GOOD_KEY);
    }

    // The workspace's sessions now run on it; another workspace's still run the demo model.
    const acme = server.project("acme-robotics-main").session("acme-plan");
    const beta = server.project("beta-main").session("beta-one", { title: "One", ownerId: "cy" });
    expect(server.models.source("acme-robotics")).toBe("workspace");
    expect(server.models.source("beta")).toBe("demo");
    expect(server.models.sessionModelName("beta")).toBe(new ScriptedModel().name);
    acme.session.directive("main", "ana", { text: "Say hello", mode: "steer", scope: "goal" });
    await acme.drive("main");
    expect(built.at(-1)?.apiKey).toBe(GOOD_KEY);
    const usedModel = acme.session
      .events("main")
      .filter((e) => e.kind === "agent.model.completed")
      .at(-1);
    expect(usedModel?.kind === "agent.model.completed" && usedModel.payload.model).toBe(
      built.at(-1)?.name,
    );
    expect(beta.session.state().projectId).toBe("beta-main");

    // The default model is the admin's to pick, checked against the key.
    expect(
      (await call("PUT", "/api/workspaces/acme-robotics/model", "ana", { model: "no-such-model" }))
        .status,
    ).toBe(400);
    const picked = await call("PUT", "/api/workspaces/acme-robotics/model", "ana", {
      model: "house-model",
    });
    expect((picked.body as { model: { model: string; running: string } }).model).toMatchObject({
      model: "house-model",
      running: "house-model",
    });
    expect((await get("/api/workspaces/acme-robotics/models", "ana")).body).toEqual({
      models: [{ id: "house-model", name: "House" }],
    });

    // Disconnecting puts the workspace back on the demo model.
    const gone = await call("DELETE", "/api/workspaces/acme-robotics/model", "ana");
    expect((gone.body as { model: WorkspaceView["model"] }).model).toMatchObject({
      connected: false,
      source: "demo",
    });
  });

  it("limits how many workspaces one person makes", async () => {
    for (let i = 0; i < 5; i++)
      expect((await call("POST", "/api/workspaces", "max", { name: `Max ${i}` })).status).toBe(201);
    const sixth = await call("POST", "/api/workspaces", "max", { name: "Max six" });
    expect(sixth.status).toBe(409);
  });
});

describe("workspace invitations in the registry", () => {
  it("expire, are single use when addressed to an email, and are for that address alone", () => {
    const root = mkdtempSync(join(tmpdir(), "henosis-invites-"));
    try {
      const orgs = new OrgRegistry(new FileStore(root));
      orgs.tenancy = "workspaces";
      const t0 = new Date("2026-11-24T10:00:00.000Z");
      const org = orgs.createWorkspace({ userId: "ana", name: "Ana" }, "Acme", t0);
      const open = orgs.createInvite(org.id, "ana", {}, t0);
      const late = new Date(t0.getTime() + INVITE_TTL_MS + 1);
      expect(orgs.inviteByToken(open.token, late)?.invite.state).toBe("expired");
      expect(() => orgs.acceptInvite(open.token, { userId: "bo" }, late)).toThrow(/expired/);
      const addressed = orgs.createInvite(
        org.id,
        "ana",
        { email: " Bo@Acme.test ", role: "admin" },
        t0,
      );
      expect(addressed.invite.email).toBe("bo@acme.test");
      expect(() =>
        orgs.acceptInvite(addressed.token, { userId: "eve", email: "eve@evil.test" }, t0),
      ).toThrow(/bo@acme.test/);
      expect(() => orgs.acceptInvite(addressed.token, { userId: "eve" }, t0)).toThrow(/sign in/);
      orgs.acceptInvite(addressed.token, { userId: "bo", name: "Bo", email: "BO@acme.test" }, t0);
      expect(orgs.orgRole("bo", org.id)).toBe("admin");
      expect(() =>
        orgs.acceptInvite(addressed.token, { userId: "bo2", email: "bo@acme.test" }, t0),
      ).toThrow(/already used/);
      expect(() => orgs.createInvite(org.id, "ana", { email: "not-an-address" }, t0)).toThrow(
        /email/,
      );
      // The registry survives a restart with its workspaces, people and invitations.
      const again = new OrgRegistry(new FileStore(root));
      again.tenancy = "workspaces";
      expect(again.orgRole("ana", org.id)).toBe("admin");
      expect(again.orgRole("bo", org.id)).toBe("admin");
      expect(
        again
          .invitesOf(org.id, t0)
          .map((i) => i.state)
          .sort(),
      ).toEqual(["open", "used"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("makes ids from names", () => {
    expect(slugOf("  Acme   Robotics, Inc. ")).toBe("acme-robotics-inc");
    expect(slugOf("Café Zürich")).toBe("cafe-zurich");
    expect(slugOf("!!!")).toBe("");
    expect(slugOf("x".repeat(80))).toHaveLength(32);
    expect(tenancyFromEnv({})).toBe("shared");
    expect(tenancyFromEnv({}, "workspaces")).toBe("workspaces");
    expect(tenancyFromEnv({ HENOSIS_TENANCY: "Shared" }, "workspaces")).toBe("shared");
    expect(() => tenancyFromEnv({ HENOSIS_TENANCY: "silo" })).toThrow(/workspaces or shared/);
  });
});

describe("a one-org server keeps its ways", () => {
  let root: string;
  let server: HenosisServer;
  let base: string;
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "henosis-shared-"));
    writeFileSync(
      join(root, "users.json"),
      JSON.stringify({
        users: [
          { id: "ada", name: "Ada", orgs: [{ orgId: "default", role: "admin" }] },
          { id: "bo", name: "Bo", orgs: [{ orgId: "default", role: "member" }] },
        ],
      }),
    );
    server = new HenosisServer({
      root,
      model: new ScriptedModel(),
      tools: defaultTools(),
      keysSecret: "a-test-secret-of-enough-length",
      offline: () => false,
      checkKey: async () => ({ ok: true }),
      buildKeyed: (key, id) => new Keyed(id, key),
    });
    base = `http://127.0.0.1:${await server.listen(0)}`;
  });
  afterAll(async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("makes no workspaces, shows its org, and lets its admin connect the key", async () => {
    const put = (path: string, body: unknown) =>
      fetch(`${base}${path}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const made = await fetch(`${base}/api/workspaces?user=ada`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Another" }),
    });
    expect(made.status).toBe(403);
    const list = (await (await fetch(`${base}/api/workspaces?user=bo`)).json()) as {
      tenancy: string;
      canCreate: boolean;
      workspaces: WorkspaceView[];
    };
    expect(list).toMatchObject({ tenancy: "shared", canCreate: false });
    expect(list.workspaces.map((w) => `${w.id}:${w.role}`)).toEqual(["default:member"]);
    // Health still lists what it always did.
    const health = (await (await fetch(`${base}/api/health`)).json()) as Record<string, unknown>;
    expect(health).toMatchObject({ tenancy: "shared", keys: true, model: "scripted" });
    expect((await put("/api/workspaces/default/model?user=bo", { key: GOOD_KEY })).status).toBe(
      403,
    );
    const ok = await put("/api/workspaces/default/model?user=ada", { key: GOOD_KEY });
    expect(ok.status).toBe(200);
    expect(server.models.source("default")).toBe("workspace");
    expect(server.models.sessionModelName("default")).not.toBe(new ScriptedModel().name);
  });
});

describe("a server with no secret for keys", () => {
  it("says it cannot keep one", async () => {
    const root = mkdtempSync(join(tmpdir(), "henosis-nosecret-"));
    const server = new HenosisServer({
      root,
      model: new ScriptedModel(),
      tools: defaultTools(),
      tenancy: "workspaces",
    });
    try {
      const base = `http://127.0.0.1:${await server.listen(0)}`;
      const made = await fetch(`${base}/api/workspaces?user=ana`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Acme" }),
      });
      expect(made.status).toBe(201);
      const res = await fetch(`${base}/api/workspaces/acme/model?user=ana`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: GOOD_KEY }),
      });
      expect(res.status).toBe(503);
      expect(((await res.json()) as { error: string }).error).toMatch(/HENOSIS_KEYS_SECRET/);
    } finally {
      await server.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("two instances of the server over one database", () => {
  it("see each other's workspaces, members and keys without a restart", async () => {
    const root = mkdtempSync(join(tmpdir(), "henosis-two-"));
    // One durable store, mirrored by two processes, as two function instances mirror Postgres.
    const durable = new FileStore(root);
    const mirrorA = await MirrorStore.open(durable);
    const mirrorB = await MirrorStore.open(durable);
    const options = (store: MirrorStore) => ({
      root,
      store,
      model: new ScriptedModel(),
      tools: defaultTools(),
      tenancy: "workspaces" as const,
      keysSecret: "a-test-secret-of-enough-length",
      envKey: false,
      offline: () => false,
      checkKey: async (): Promise<KeyCheck> => ({ ok: true }),
      buildKeyed: (key: string, id: string) => new Keyed(id, key),
    });
    const a = new HenosisServer(options(mirrorA));
    const b = new HenosisServer(options(mirrorB));
    try {
      const baseA = `http://127.0.0.1:${await a.listen(0)}`;
      const baseB = `http://127.0.0.1:${await b.listen(0)}`;
      const post = (base: string, path: string, body: unknown, method = "POST") =>
        fetch(`${base}${path}`, {
          method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      expect((await post(baseA, "/api/workspaces?user=ana", { name: "Acme" })).status).toBe(201);
      // The other instance answers Ana with her workspace on her very next request.
      const listed = (await (await fetch(`${baseB}/api/workspaces?user=ana`)).json()) as {
        workspaces: { id: string; role: string }[];
      };
      expect(listed.workspaces.map((w) => `${w.id}:${w.role}`)).toEqual(["acme:admin"]);
      // A key connected on B is the key A runs on.
      expect(
        (await post(baseB, "/api/workspaces/acme/model?user=ana", { key: GOOD_KEY }, "PUT")).status,
      ).toBe(200);
      const model = (await (await fetch(`${baseA}/api/workspaces?user=ana`)).json()) as {
        workspaces: { model: { connected: boolean; last4: string } }[];
      };
      expect(model.workspaces[0]?.model).toMatchObject({ connected: true, last4: "good" });
      expect(a.models.source("acme")).toBe("workspace");
      // An invitation made on A is accepted on B, and A then knows the new member.
      const invite = (await (
        await post(baseA, "/api/workspaces/acme/invites?user=ana", {})
      ).json()) as { token: string };
      expect((await post(baseB, `/api/invites/${invite.token}/accept?user=bo`, {})).status).toBe(
        200,
      );
      const me = (await (await fetch(`${baseA}/api/me?user=bo`)).json()) as {
        projects: { projectId: string }[];
      };
      expect(me.projects.map((p) => p.projectId)).toEqual(["acme-main"]);
    } finally {
      await a.close();
      await b.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps a document written here while a refresh was reading", async () => {
    const root = mkdtempSync(join(tmpdir(), "henosis-refresh-"));
    try {
      const durable = new FileStore(root);
      const one = await MirrorStore.open(durable);
      const two = await MirrorStore.open(durable);
      one.writeDoc("notes", { v: 1 });
      await one.flush();
      expect(await two.refreshDocs()).toEqual(["notes"]);
      expect(two.readDoc("notes")).toEqual({ v: 1 });
      expect(await two.refreshDocs()).toEqual([]);
      // A local write that lands during the refresh is not overwritten by the older read.
      one.writeDoc("notes", { v: 2 });
      await one.flush();
      const refreshing = two.refreshDocs();
      two.writeDoc("notes", { v: 3 });
      await refreshing;
      expect(two.readDoc("notes")).toEqual({ v: 3 });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
