/**
 * Identity in oidc mode (packages/server/src/auth.ts) against a fake provider: an in-process
 * http server that serves a discovery document and a JWKS for a key generated here, and
 * tokens signed with that key. Dev mode is what every other test runs in.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ClientMessage, ServerMessage } from "@henosis/protocol";
import { defaultTools, ScriptedModel } from "@henosis/runner";
import { type CryptoKey, exportJWK, generateKeyPair, type JWK, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { Auth, authConfigFromEnv } from "../src/auth.js";
import { HenosisServer } from "../src/server.js";

const CLIENT_ID = "henosis-web";

/** A provider on 127.0.0.1: discovery, JWKS and a way to mint tokens with its key (or a stranger's). */
class FakeProvider {
  issuer = "";
  private http: Server | null = null;
  private key!: { privateKey: CryptoKey; publicJwk: JWK };
  private stranger!: CryptoKey;
  readonly kid = "k1";

  async start(): Promise<void> {
    const pair = await generateKeyPair("RS256");
    const other = await generateKeyPair("RS256");
    this.stranger = other.privateKey;
    this.key = { privateKey: pair.privateKey, publicJwk: await exportJWK(pair.publicKey) };
    this.http = createServer((req, res) => {
      const reply = (body: unknown) => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      };
      if (req.url === "/.well-known/openid-configuration")
        return reply({
          issuer: this.issuer,
          authorization_endpoint: `${this.issuer}/authorize`,
          token_endpoint: `${this.issuer}/token`,
          jwks_uri: `${this.issuer}/keys`,
          end_session_endpoint: `${this.issuer}/logout`,
        });
      if (req.url === "/keys")
        return reply({
          keys: [{ ...this.key.publicJwk, kid: this.kid, alg: "RS256", use: "sig" }],
        });
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((r) => this.http?.listen(0, "127.0.0.1", () => r()));
    const addr = this.http.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    this.issuer = `http://127.0.0.1:${port}`;
  }

  async token(
    claims: Record<string, unknown>,
    opts: { audience?: string; expiresIn?: string; issuer?: string; strangerKey?: boolean } = {},
  ): Promise<string> {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: this.kid })
      .setIssuer(opts.issuer ?? this.issuer)
      .setAudience(opts.audience ?? CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime(opts.expiresIn ?? "10m")
      .sign(opts.strangerKey ? this.stranger : this.key.privateKey);
  }

  async stop(): Promise<void> {
    await new Promise<void>((r) => (this.http ? this.http.close(() => r()) : r()));
  }
}

const orgs = {
  sso: {
    name: "Acme ID",
    teams: {
      "acme-payments": "payments",
      "acme-payments-leads": { teamId: "payments", role: "lead" },
    },
    projects: { "acme-onboarding": "onboarding" },
  },
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
  users: [{ id: "lee", name: "Lee", teams: [{ teamId: "payments", role: "lead" }] }],
};

class Client {
  ws: WebSocket;
  events: ServerMessage[] = [];
  private waiters: ((m: ServerMessage) => void)[] = [];
  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString()) as ServerMessage;
      this.events.push(m);
      for (const w of this.waiters.splice(0)) w(m);
    });
  }
  open(): Promise<void> {
    return new Promise((r) => this.ws.once("open", () => r()));
  }
  send(m: ClientMessage | Record<string, unknown>): void {
    this.ws.send(JSON.stringify(m));
  }
  next(): Promise<ServerMessage> {
    return new Promise((r) => this.waiters.push(r));
  }
  async untilType(type: string, ms = 8000): Promise<ServerMessage> {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const found = this.events.find((e) => e.type === type);
      if (found) return found;
      await Promise.race([this.next(), new Promise((r) => setTimeout(r, 100))]);
    }
    throw new Error(`timeout waiting for ${type}`);
  }
  close(): void {
    this.ws.close();
  }
}

describe("oidc identity", () => {
  const idp = new FakeProvider();
  let root: string;
  let server: HenosisServer;
  let base: string;
  let ws: string;

  beforeAll(async () => {
    await idp.start();
    root = mkdtempSync(join(tmpdir(), "henosis-auth-"));
    writeFileSync(join(root, "orgs.json"), JSON.stringify(orgs));
    writeFileSync(join(root, "users.json"), JSON.stringify(users));
    server = new HenosisServer({
      root,
      model: new ScriptedModel(),
      tools: defaultTools(),
      auth: { mode: "oidc", issuer: idp.issuer, clientId: CLIENT_ID },
    });
    const port = await server.listen(0);
    base = `http://127.0.0.1:${port}`;
    ws = `ws://127.0.0.1:${port}/ws`;
  });
  afterAll(async () => {
    await server.close();
    await idp.stop();
    rmSync(root, { recursive: true, force: true });
  });

  it("reads the mode from the environment", () => {
    expect(authConfigFromEnv({})).toEqual({ mode: "dev", token: undefined });
    expect(authConfigFromEnv({ HENOSIS_TOKEN: "x" }, "x")).toEqual({ mode: "dev", token: "x" });
    expect(
      authConfigFromEnv({
        HENOSIS_OIDC_ISSUER: "https://id.example.com/",
        HENOSIS_OIDC_CLIENT_ID: "web",
        HENOSIS_OIDC_AUDIENCE: "api",
      }),
    ).toEqual({
      mode: "oidc",
      issuer: "https://id.example.com/",
      clientId: "web",
      audience: "api",
    });
    expect(() => authConfigFromEnv({ HENOSIS_OIDC_ISSUER: "https://id.example.com" })).toThrow(
      /CLIENT_ID/,
    );
  });

  it("GET /api/auth tells the client how to sign in", async () => {
    const d = (await (await fetch(`${base}/api/auth`)).json()) as Record<string, unknown>;
    expect(d.mode).toBe("oidc");
    expect(d.clientId).toBe(CLIENT_ID);
    expect(d.authorizationEndpoint).toBe(`${idp.issuer}/authorize`);
    expect(d.tokenEndpoint).toBe(`${idp.issuer}/token`);
    expect(d.scopes).toEqual(["openid", "profile", "email"]);
    // The provider's name comes from the issuer host; orgs.json `sso.name` is for the client to show.
    expect(d.provider).toBe(new URL(idp.issuer).host);
  });

  it("accepts a good token and names the person by its subject", async () => {
    const token = await idp.token({ sub: "ana", name: "Ana Lovelace", email: "ana@acme.test" });
    const who = await server.auth.verify(token);
    expect(who).toEqual({
      userId: "ana",
      name: "Ana Lovelace",
      email: "ana@acme.test",
      groups: [],
      verified: true,
    });
  });

  it("refuses a token for another audience, an expired one, a stranger's key and another issuer", async () => {
    const aud = await idp.token({ sub: "ana" }, { audience: "someone-else" });
    await expect(server.auth.verify(aud)).rejects.toThrow(/another audience/);
    const expired = await idp.token({ sub: "ana" }, { expiresIn: "-5m" });
    await expect(server.auth.verify(expired)).rejects.toThrow(/expired/);
    const forged = await idp.token({ sub: "ana" }, { strangerKey: true });
    await expect(server.auth.verify(forged)).rejects.toThrow(/unauthorized/);
    const elsewhere = await idp.token({ sub: "ana" }, { issuer: "https://evil.example" });
    await expect(server.auth.verify(elsewhere)).rejects.toThrow(/another issuer/);
    await expect(server.auth.verify("not.a.jwt")).rejects.toThrow(/unauthorized/);
  });

  it("refuses an asserted user id that does not match the token, over HTTP and on join", async () => {
    const token = await idp.token({ sub: "ana", name: "Ana" });
    const headers = { authorization: `Bearer ${token}` };
    const wrong = await fetch(`${base}/api/me?user=lee`, { headers });
    expect(wrong.status).toBe(401);
    expect(((await wrong.json()) as { error: string }).error).toMatch(/does not match/);
    // No token at all but a user asserted: refused; nothing asserted: a public read.
    expect((await fetch(`${base}/api/me?user=ana`)).status).toBe(401);
    expect((await fetch(`${base}/api/orgs`)).status).toBe(200);
    // The same token with the right id, or with no id at all (the server fills it in).
    const ok = (await (await fetch(`${base}/api/me?user=ana`, { headers })).json()) as {
      user: { id: string; name: string } | null;
    };
    expect(ok.user).toEqual({ id: "ana", name: "Ana" });
    const filled = (await (await fetch(`${base}/api/me`, { headers })).json()) as {
      user: { id: string } | null;
    };
    expect(filled.user?.id).toBe("ana");

    const c = new Client(ws);
    await c.open();
    c.send({
      type: "join",
      sessionId: "s-mismatch",
      actor: { id: "lee", kind: "human", name: "Lee" },
      token,
      branch: "main",
      projectId: "billing",
    });
    const err = await c.untilType("error");
    expect(err.type === "error" && err.message).toMatch(/^unauthorized: .*does not match/);
    c.close();
  });

  it("refuses a join without a token in oidc mode", async () => {
    const c = new Client(ws);
    await c.open();
    c.send({
      type: "join",
      sessionId: "s-anon",
      actor: { id: "ana", kind: "human", name: "Ana" },
      branch: "main",
      projectId: "billing",
    });
    const err = await c.untilType("error");
    expect(err.type === "error" && err.message).toMatch(/^unauthorized: sign in with/);
    c.close();
  });

  it("maps groups to teams and projects, merged with users.json; strangers observe", async () => {
    // Bo: a member of payments by group, and a member of the onboarding project by group.
    const bo = await idp.token({
      sub: "bo",
      name: "Bo",
      groups: ["acme-payments", "acme-onboarding", "unmapped"],
    });
    const c = new Client(ws);
    await c.open();
    c.send({
      type: "join",
      sessionId: "s-groups",
      actor: { id: "bo", kind: "human", name: "Bo" },
      token: bo,
      branch: "main",
      projectId: "billing",
    });
    const snap = await c.untilType("snapshot");
    expect(snap.type).toBe("snapshot");
    const me = (await (
      await fetch(`${base}/api/me`, { headers: { authorization: `Bearer ${bo}` } })
    ).json()) as { user: { id: string } | null; projects: { projectId: string }[] };
    expect(me.user?.id).toBe("bo");
    expect(me.projects.map((p) => p.projectId).sort()).toEqual(["billing", "onboarding"]);
    const user = server.orgs.user("bo");
    expect(user?.teams).toEqual([{ teamId: "payments", role: "member" }]);
    expect(user?.projects).toEqual([{ projectId: "onboarding", role: "member" }]);
    // A member is a contributor in a session someone else owns; a lead by group owns it.
    const lead = await idp.token({ sub: "cy", name: "Cy", groups: ["acme-payments-leads"] });
    const c2 = new Client(ws);
    await c2.open();
    c2.send({
      type: "join",
      sessionId: "s-groups",
      actor: { id: "cy", kind: "human", name: "Cy" },
      token: lead,
      branch: "main",
      projectId: "billing",
    });
    await c2.untilType("snapshot");
    const ph = server.project("billing");
    const st = ph.hosts.get("s-groups")?.session.state();
    expect(st?.participants.bo?.role).toBe("owner"); // first in owned it
    expect(st?.participants.cy?.role).toBe("owner"); // a lead of the team by group
    expect(server.orgs.user("cy")?.teams).toEqual([{ teamId: "payments", role: "lead" }]);
    // Lee is a lead in users.json and the token adds nothing; the file's name is kept.
    const lee = await idp.token({ sub: "lee", name: "Lee from the IdP" });
    expect((await server.auth.verify(lee)).name).toBe("Lee from the IdP");
    server.orgs.resolve(await server.auth.verify(lee));
    expect(server.orgs.user("lee")).toMatchObject({
      name: "Lee",
      teams: [{ teamId: "payments", role: "lead" }],
    });
    // A stranger: known to nobody, observes everywhere.
    const dan = await idp.token({ sub: "dan", name: "Dan" });
    server.orgs.resolve(await server.auth.verify(dan));
    expect(server.orgs.user("dan")).toMatchObject({ orgs: [], teams: [], projects: [] });
    const ref = server.orgs.project("billing");
    expect(ref && server.orgs.sessionRole("dan", ref, "bo")).toBe("observer");
    c.close();
    c2.close();
  });

  it("subscribes to a project and a chat with the token on the message", async () => {
    const bo = await idp.token({ sub: "bo", name: "Bo", groups: ["acme-payments"] });
    const c = new Client(ws);
    await c.open();
    c.send({ type: "project.subscribe", projectId: "billing", userId: "bo", token: bo });
    expect((await c.untilType("project.snapshot")).type).toBe("project.snapshot");
    c.send({ type: "chat.subscribe", orgId: "northwind", userId: "bo", token: bo });
    expect((await c.untilType("chat.snapshot")).type).toBe("chat.snapshot");
    c.close();
    // The wrong person on the message is refused.
    const c2 = new Client(ws);
    await c2.open();
    c2.send({ type: "project.subscribe", projectId: "billing", userId: "lee", token: bo });
    const err = await c2.untilType("error");
    expect(err.type === "error" && err.message).toMatch(/does not match/);
    c2.close();
  });

  it("takes the token from the socket's upgrade request too", async () => {
    const bo = await idp.token({ sub: "bo", name: "Bo" });
    const c = new Client(`${ws}?token=${encodeURIComponent(bo)}`);
    await c.open();
    c.send({
      type: "join",
      sessionId: "s-upgrade",
      actor: { id: "bo", kind: "human", name: "Bo" },
      branch: "main",
      projectId: "billing",
    });
    expect((await c.untilType("snapshot")).type).toBe("snapshot");
    c.close();
  });

  it("can name people by email when orgs.json asks for it", async () => {
    const auth = new Auth({
      mode: "oidc",
      issuer: idp.issuer,
      clientId: CLIENT_ID,
      userIdClaim: "email",
      groupsClaim: "roles",
    });
    const t = await idp.token({ sub: "x1", email: "ana@acme.test", roles: "a b" });
    expect(await auth.verify(t)).toMatchObject({
      userId: "ana@acme.test",
      groups: ["a", "b"],
    });
    const noEmail = await idp.token({ sub: "x2" });
    await expect(auth.verify(noEmail)).rejects.toThrow(/no email claim/);
  });
});

describe("dev identity", () => {
  it("keeps today's behaviour: the shared token on join, assertions taken at their word", async () => {
    const auth = new Auth({ mode: "dev", token: "secret" });
    expect((await auth.describe()).tokenRequired).toBe(true);
    await expect(
      auth.authenticate({ token: "nope", userId: "ana", enforceShared: true }),
    ).rejects.toThrow("unauthorized");
    expect(await auth.authenticate({ token: "nope", userId: "ana" })).toMatchObject({
      userId: "ana",
      verified: false,
    });
    expect(
      await auth.authenticate({ token: "secret", userId: "ana", enforceShared: true }),
    ).toMatchObject({ userId: "ana", verified: false });
    expect(await auth.authenticate({})).toBeNull();
    expect(auth.acceptsSharedToken("secret")).toBe(true);
    expect(auth.acceptsSharedToken("x")).toBe(false);
    expect(new Auth().acceptsSharedToken(null)).toBe(true);
  });
});
