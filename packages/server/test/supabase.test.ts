/**
 * Identity in supabase mode (packages/server/src/auth.ts) against a fake project: an
 * in-process http server that serves the JWKS Supabase Auth publishes (one ES256 key, as the
 * real project does) at `<url>/auth/v1/.well-known/jwks.json`, and tokens signed with that
 * key, or with the HS256 secret an older project uses. Also the auto-join rules (orgs.ts):
 * a verified stranger lands in a working project, created on first use.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ClientMessage, ServerMessage } from "@henosis/protocol";
import { defaultTools, ScriptedModel } from "@henosis/runner";
import { type CryptoKey, exportJWK, generateKeyPair, type JWK, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { Auth, authConfigFromEnv } from "../src/auth.js";
import { DEFAULT_AUTO_JOIN, parseAutoJoin } from "../src/orgs.js";
import { HenosisServer } from "../src/server.js";

const ANON_KEY = "anon-public-key";
const JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";

/** A Supabase project on 127.0.0.1: the JWKS, and a way to mint access tokens. */
class FakeProject {
  url = "";
  private http: Server | null = null;
  private key!: { privateKey: CryptoKey; publicJwk: JWK };
  private stranger!: CryptoKey;
  readonly kid = "sb-key-1";
  hits = 0;

  async start(): Promise<void> {
    const pair = await generateKeyPair("ES256");
    const other = await generateKeyPair("ES256");
    this.stranger = other.privateKey;
    this.key = { privateKey: pair.privateKey, publicJwk: await exportJWK(pair.publicKey) };
    this.http = createServer((req, res) => {
      if (req.url === "/auth/v1/.well-known/jwks.json") {
        this.hits++;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            keys: [{ ...this.key.publicJwk, kid: this.kid, alg: "ES256", use: "sig" }],
          }),
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((r) => this.http?.listen(0, "127.0.0.1", () => r()));
    const addr = this.http.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    this.url = `http://127.0.0.1:${port}`;
  }

  get issuer(): string {
    return `${this.url}/auth/v1`;
  }

  /** An access token as Supabase Auth mints it: ES256 by the project key unless asked otherwise. */
  async token(
    claims: Record<string, unknown>,
    opts: {
      audience?: string;
      expiresIn?: string;
      issuer?: string;
      strangerKey?: boolean;
      hs256?: string;
    } = {},
  ): Promise<string> {
    const jwt = new SignJWT({ role: "authenticated", ...claims })
      .setIssuer(opts.issuer ?? this.issuer)
      .setAudience(opts.audience ?? "authenticated")
      .setIssuedAt()
      .setExpirationTime(opts.expiresIn ?? "1h");
    if (opts.hs256)
      return jwt
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .sign(new TextEncoder().encode(opts.hs256));
    return jwt
      .setProtectedHeader({ alg: "ES256", kid: this.kid, typ: "JWT" })
      .sign(opts.strangerKey ? this.stranger : this.key.privateKey);
  }

  async stop(): Promise<void> {
    await new Promise<void>((r) => (this.http ? this.http.close(() => r()) : r()));
  }
}

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

const ANA = "6f1c3b8e-1111-4000-8000-000000000001";
const BO = "6f1c3b8e-2222-4000-8000-000000000002";
const CY = "6f1c3b8e-3333-4000-8000-000000000003";

describe("supabase identity", () => {
  const project = new FakeProject();

  beforeAll(async () => {
    await project.start();
  });
  afterAll(async () => {
    await project.stop();
  });

  it("reads the mode from the environment, with the defaults filled in by the Auth", () => {
    const cfg = authConfigFromEnv({
      HENOSIS_AUTH: "supabase",
      SUPABASE_URL: "https://eeriyaokbknxduztnawr.supabase.co/",
      SUPABASE_ANON_KEY: "anon",
    });
    expect(cfg).toEqual({
      mode: "supabase",
      url: "https://eeriyaokbknxduztnawr.supabase.co",
      anonKey: "anon",
      autoJoin: [{ orgId: "default", teamId: "default", projectId: "default", role: "member" }],
    });
    expect(
      authConfigFromEnv({
        HENOSIS_AUTH: "supabase",
        SUPABASE_URL: "https://x.supabase.co",
        SUPABASE_ANON_KEY: "anon",
        SUPABASE_JWT_SECRET: "s",
        HENOSIS_AUTO_JOIN: "acme:web:site:lead, acme:web:docs:contributor",
      }),
    ).toMatchObject({
      jwtSecret: "s",
      autoJoin: [
        { orgId: "acme", teamId: "web", projectId: "site", role: "lead" },
        { orgId: "acme", teamId: "web", projectId: "docs", role: "member" },
      ],
    });
    expect(() => authConfigFromEnv({ HENOSIS_AUTH: "supabase" })).toThrow(/SUPABASE_URL/);
    expect(() => parseAutoJoin("acme:web")).toThrow(/org:team:project:role/);
    expect(() => parseAutoJoin("a:b:c:king")).toThrow(/role/);
    expect(parseAutoJoin(undefined)).toEqual(DEFAULT_AUTO_JOIN);
    // The other modes are untouched, and HENOSIS_AUTH=dev wins over a stray issuer.
    expect(authConfigFromEnv({}, "t")).toEqual({ mode: "dev", token: "t" });
    expect(
      authConfigFromEnv({ HENOSIS_AUTH: "dev", HENOSIS_OIDC_ISSUER: "https://id.example" }, "t"),
    ).toEqual({ mode: "dev", token: "t" });
  });

  it("describes itself as supabase with the project URL and the public key", async () => {
    const auth = new Auth({ mode: "supabase", url: `${project.url}/`, anonKey: ANON_KEY });
    expect(auth.mode).toBe("supabase");
    expect(await auth.describe()).toEqual({
      mode: "supabase",
      url: project.url,
      anonKey: ANON_KEY,
    });
    expect(auth.acceptsSharedToken(null)).toBe(true);
  });

  it("verifies an ES256 token against the project's JWKS and names the person", async () => {
    const auth = new Auth({ mode: "supabase", url: project.url, anonKey: ANON_KEY });
    const token = await project.token({
      sub: ANA,
      email: "ana@acme.test",
      user_metadata: { full_name: "Ana Lovelace", name: "ana" },
      app_metadata: { provider: "email", groups: ["acme-everyone"] },
    });
    expect(await auth.verify(token)).toEqual({
      userId: ANA,
      name: "Ana Lovelace",
      email: "ana@acme.test",
      groups: ["acme-everyone"],
      verified: true,
    });
    // The name falls back to `name`, then the email.
    const bo = await project.token({ sub: BO, user_metadata: { name: "Bo" } });
    expect((await auth.verify(bo)).name).toBe("Bo");
    const cy = await project.token({ sub: CY, email: "cy@acme.test" });
    expect((await auth.verify(cy)).name).toBe("cy@acme.test");
    // The key set was fetched once and kept.
    expect(project.hits).toBe(1);
  });

  it("refuses another audience, another issuer, an expired token, a stranger's key and junk", async () => {
    const auth = new Auth({ mode: "supabase", url: project.url, anonKey: ANON_KEY });
    const aud = await project.token({ sub: ANA }, { audience: "anon" });
    await expect(auth.verify(aud)).rejects.toThrow(/another audience/);
    const iss = await project.token({ sub: ANA }, { issuer: "https://evil.example/auth/v1" });
    await expect(auth.verify(iss)).rejects.toThrow(/another issuer/);
    const expired = await project.token({ sub: ANA }, { expiresIn: "-5m" });
    await expect(auth.verify(expired)).rejects.toThrow(/expired/);
    const forged = await project.token({ sub: ANA }, { strangerKey: true });
    await expect(auth.verify(forged)).rejects.toThrow(/unauthorized/);
    await expect(auth.verify("not.a.jwt")).rejects.toThrow(/unauthorized/);
    const nobody = await project.token({ email: "x@y" });
    await expect(auth.verify(nobody)).rejects.toThrow(/no sub claim/);
    // An asserted id beside the token must be the token's.
    await expect(
      auth.authenticate({ token: await project.token({ sub: ANA }), userId: BO }),
    ).rejects.toThrow(/does not match/);
    await expect(auth.authenticate({ userId: ANA })).rejects.toThrow(/sign in with your email/);
    expect(await auth.authenticate({})).toBeNull();
  });

  it("takes an HS256 token with the project's secret, and only then", async () => {
    const withSecret = new Auth({
      mode: "supabase",
      url: project.url,
      anonKey: ANON_KEY,
      jwtSecret: JWT_SECRET,
    });
    const token = await project.token({ sub: ANA, email: "ana@acme.test" }, { hs256: JWT_SECRET });
    expect(await withSecret.verify(token)).toMatchObject({ userId: ANA, verified: true });
    const wrong = await project.token(
      { sub: ANA },
      { hs256: "another-secret-of-thirty-two-chars!!" },
    );
    await expect(withSecret.verify(wrong)).rejects.toThrow(/unauthorized/);
    // Without a secret an HS256 token cannot be checked against the JWKS.
    const noSecret = new Auth({ mode: "supabase", url: project.url, anonKey: ANON_KEY });
    await expect(noSecret.verify(token)).rejects.toThrow(/unauthorized/);
    // The ES256 path still works beside the secret.
    const es = await project.token({ sub: BO });
    expect((await withSecret.verify(es)).userId).toBe(BO);
  });

  it("honours jwksUri, issuer and audience when given", async () => {
    const auth = new Auth({
      mode: "supabase",
      url: "https://elsewhere.example",
      anonKey: ANON_KEY,
      jwksUri: `${project.url}/auth/v1/.well-known/jwks.json`,
      issuer: project.issuer,
      audience: "henosis",
    });
    const token = await project.token({ sub: ANA }, { audience: "henosis" });
    expect((await auth.verify(token)).userId).toBe(ANA);
    const plain = await project.token({ sub: ANA });
    await expect(auth.verify(plain)).rejects.toThrow(/another audience/);
  });

  describe("auto-join on a server", () => {
    let root: string;
    let server: HenosisServer;
    let base: string;
    let ws: string;

    beforeAll(async () => {
      root = mkdtempSync(join(tmpdir(), "henosis-supabase-"));
      // Lee is known to users.json as a lead of the default team; no orgs.json at all.
      writeFileSync(
        join(root, "users.json"),
        JSON.stringify({
          users: [{ id: "lee", name: "Lee", teams: [{ teamId: "default", role: "lead" }] }],
        }),
      );
      server = new HenosisServer({
        root,
        model: new ScriptedModel(),
        tools: defaultTools(),
        auth: {
          mode: "supabase",
          url: project.url,
          anonKey: ANON_KEY,
          autoJoin: parseAutoJoin("default:default:default:contributor,acme:web:site:lead"),
        },
      });
      const port = await server.listen(0);
      base = `http://127.0.0.1:${port}`;
      ws = `ws://127.0.0.1:${port}/ws`;
    });
    afterAll(async () => {
      await server.close();
      rmSync(root, { recursive: true, force: true });
    });

    it("GET /api/auth and /health say supabase", async () => {
      const d = (await (await fetch(`${base}/api/auth`)).json()) as Record<string, unknown>;
      expect(d).toEqual({ mode: "supabase", url: project.url, anonKey: ANON_KEY });
      const h = (await (await fetch(`${base}/api/health`)).json()) as Record<string, unknown>;
      expect(h).toMatchObject({ ok: true, model: "scripted", store: "file", auth: "supabase" });
    });

    it("places a verified stranger in the projects the rules name, creating them on first use", async () => {
      const ana = await project.token({
        sub: ANA,
        email: "ana@acme.test",
        user_metadata: { full_name: "Ana" },
      });
      const me = (await (
        await fetch(`${base}/api/me`, { headers: { authorization: `Bearer ${ana}` } })
      ).json()) as { user: { id: string; name: string } | null; projects: { projectId: string }[] };
      expect(me.user).toEqual({ id: ANA, name: "Ana" });
      expect(me.projects.map((p) => p.projectId).sort()).toEqual(["default", "site"]);
      const user = server.orgs.user(ANA);
      expect(user?.projects).toEqual([
        { projectId: "default", role: "member" },
        { projectId: "site", role: "lead" },
      ]);
      // The org, team and project the second rule named now exist, in memory and on disk.
      expect(server.orgs.project("site")).toMatchObject({
        orgId: "acme",
        teamId: "web",
        projectId: "site",
        name: "Site",
      });
      const onDisk = JSON.parse(readFileSync(join(root, "orgs.json"), "utf8")) as {
        orgs: { id: string; name: string; teams: { id: string; projects: { id: string }[] }[] }[];
      };
      expect(onDisk.orgs.map((o) => o.id)).toEqual(["default", "acme"]);
      expect(onDisk.orgs[1]).toMatchObject({ name: "Acme", teams: [{ id: "web" }] });
      // The chat host for the new org is reachable too.
      expect((await fetch(`${base}/api/chat/acme`)).status).toBe(200);
    });

    it("a stranger is a contributor in a session someone else owns, and a lead where the rule says so", async () => {
      const ana = await project.token({ sub: ANA, user_metadata: { full_name: "Ana" } });
      const bo = await project.token({ sub: BO, user_metadata: { full_name: "Bo" } });
      const c1 = new Client(ws);
      await c1.open();
      c1.send({
        type: "join",
        sessionId: "s-auto",
        actor: { id: ANA, kind: "human", name: "Ana" },
        token: ana,
        branch: "main",
        projectId: "default",
      });
      expect((await c1.untilType("snapshot")).type).toBe("snapshot");
      const c2 = new Client(ws);
      await c2.open();
      c2.send({
        type: "join",
        sessionId: "s-auto",
        actor: { id: BO, kind: "human", name: "Bo" },
        token: bo,
        branch: "main",
        projectId: "default",
      });
      await c2.untilType("snapshot");
      const st = server.project("default").hosts.get("s-auto")?.session.state();
      expect(st?.participants[ANA]?.role).toBe("owner");
      expect(st?.participants[BO]?.role).toBe("contributor");
      const ref = server.orgs.project("site");
      expect(ref && server.orgs.sessionRole(BO, ref, ANA)).toBe("owner");
      c1.close();
      c2.close();
    });

    it("leaves a person users.json knows as the file says", async () => {
      const lee = await project.token({
        sub: "lee",
        user_metadata: { full_name: "Lee from Supabase" },
      });
      server.orgs.resolve(await server.auth.verify(lee));
      expect(server.orgs.user("lee")).toMatchObject({
        name: "Lee",
        teams: [{ teamId: "default", role: "lead" }],
        projects: [],
      });
    });

    it("refuses a join without a token", async () => {
      const c = new Client(ws);
      await c.open();
      c.send({
        type: "join",
        sessionId: "s-anon",
        actor: { id: ANA, kind: "human", name: "Ana" },
        branch: "main",
        projectId: "default",
      });
      const err = await c.untilType("error");
      expect(err.type === "error" && err.message).toMatch(/^unauthorized: sign in with your email/);
      c.close();
    });
  });
});
