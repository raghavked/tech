/**
 * Bring your own key: the vault that seals each workspace's model key (keys.ts) and the
 * factory that routes a workspace's work to it (models.ts).
 */
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Model, type ModelRequest, ScriptedModel } from "@henosis/runner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanKey, KEYS_DOC, KeyVault, keysSecretFrom } from "../src/keys.js";
import { KEY_REFUSED_MESSAGE, ModelFactory, offlineFromEnv } from "../src/models.js";
import { FileStore } from "../src/store/index.js";

const SECRET = "a-test-secret-of-enough-length";
const KEY_A = "sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA-aaaa";
const KEY_B = "sk-ant-api03-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB-bbbb";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "henosis-keys-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("the key vault", () => {
  it("seals a workspace's key, opens it again, and never writes it in the clear", () => {
    const store = new FileStore(root);
    const vault = new KeyVault(store, SECRET);
    expect(vault.configured).toBe(true);
    expect(vault.describe("acme")).toMatchObject({ connected: false, status: "none", last4: null });
    const status = vault.set("acme", KEY_A, { userId: "ana", at: "2026-11-24T10:00:00.000Z" });
    expect(status).toEqual({
      provider: "anthropic",
      connected: true,
      last4: "aaaa",
      addedBy: "ana",
      addedAt: "2026-11-24T10:00:00.000Z",
      model: "",
      status: "ok",
      checkedAt: "2026-11-24T10:00:00.000Z",
    });
    expect(JSON.stringify(status)).not.toContain(KEY_A);
    expect(vault.key("acme")).toBe(KEY_A);
    // On disk: the sealed document, without the key or any long piece of it.
    const onDisk = readFileSync(join(root, `${KEYS_DOC}.json`), "utf8");
    expect(onDisk).not.toContain(KEY_A);
    expect(onDisk).not.toContain(KEY_A.slice(0, 24));
    // A new vault over the same store, with the same secret, opens it.
    expect(new KeyVault(new FileStore(root), SECRET).key("acme")).toBe(KEY_A);
  });

  it("does not open a key with another secret, nor one workspace's sealed key as another's", () => {
    const store = new FileStore(root);
    const vault = new KeyVault(store, SECRET);
    vault.set("acme", KEY_A, { userId: "ana" });
    vault.set("beta", KEY_B, { userId: "bo" });
    const rotated = new KeyVault(new FileStore(root), "another-secret-entirely!");
    expect(rotated.key("acme")).toBeNull();
    // The key is still listed, and says it has to be connected again.
    expect(rotated.describe("acme")).toMatchObject({ connected: true, status: "unreadable" });
    // Move acme's sealed key under beta's name: it must not open as beta's.
    const doc = store.readDoc(KEYS_DOC) as { orgs: Record<string, unknown> };
    store.writeDoc(KEYS_DOC, { orgs: { beta: doc.orgs.acme } });
    const moved = new KeyVault(new FileStore(root), SECRET);
    expect(moved.describe("beta").connected).toBe(true);
    expect(moved.key("beta")).toBeNull();
  });

  it("keeps nothing without a secret, and says so", () => {
    const vault = new KeyVault(new FileStore(root), null);
    expect(vault.configured).toBe(false);
    expect(() => vault.set("acme", KEY_A, { userId: "ana" })).toThrow(/not configured/);
    expect(vault.key("acme")).toBeNull();
  });

  it("replaces, marks and removes a key, bumping the version each time it changes", () => {
    const vault = new KeyVault(new FileStore(root), SECRET);
    expect(vault.version("acme")).toBe(0);
    vault.set("acme", KEY_A, { userId: "ana", model: "house-model" });
    const v1 = vault.version("acme");
    expect(v1).toBeGreaterThan(0);
    vault.set("acme", KEY_B, { userId: "ana" });
    expect(vault.key("acme")).toBe(KEY_B);
    // The default model survives a replaced key unless a new one is named.
    expect(vault.describe("acme").model).toBe("house-model");
    expect(vault.version("acme")).toBeGreaterThan(v1);
    vault.mark("acme", "refused", "2026-11-24T11:00:00.000Z");
    expect(vault.describe("acme")).toMatchObject({
      status: "refused",
      checkedAt: "2026-11-24T11:00:00.000Z",
    });
    expect(vault.setModel("acme", "").model).toBe("");
    expect(vault.remove("acme")).toBe(true);
    expect(vault.remove("acme")).toBe(false);
    expect(vault.key("acme")).toBeNull();
    expect(vault.describe("acme").connected).toBe(false);
  });

  it("takes the secret from the environment, or keeps one beside a folder store", () => {
    expect(keysSecretFrom({})).toBeNull();
    expect(keysSecretFrom({ HENOSIS_KEYS_SECRET: `  ${SECRET} ` })).toBe(SECRET);
    expect(() => keysSecretFrom({ HENOSIS_KEYS_SECRET: "short" })).toThrow(/at least 16/);
    const made = keysSecretFrom({}, root);
    expect(made).toMatch(/^[0-9a-f]{64}$/);
    expect(keysSecretFrom({}, root)).toBe(made);
    expect(statSync(join(root, "keys.secret")).mode & 0o777).toBe(0o600);
    // A store folder that does not exist yet is made for it.
    expect(keysSecretFrom({}, join(root, "not", "yet"))).toMatch(/^[0-9a-f]{64}$/);
    // The environment wins over the file.
    expect(keysSecretFrom({ HENOSIS_KEYS_SECRET: SECRET }, root)).toBe(SECRET);
  });

  it("knows a pasted key from something that is not one", () => {
    expect(cleanKey(`  ${KEY_A}\n`)).toBe(KEY_A);
    expect(cleanKey("short")).toBeNull();
    expect(cleanKey("two words that are long enough to pass a length check")).toBeNull();
    expect(cleanKey(42)).toBeNull();
    expect(cleanKey("x".repeat(500))).toBeNull();
  });
});

/** A model that remembers which key and model id it was built for. */
class Stub implements Model {
  calls = 0;
  fail: unknown = null;
  constructor(
    readonly name: string,
    readonly apiKey: string | null,
  ) {}
  async complete(_req: ModelRequest) {
    this.calls++;
    if (this.fail) throw this.fail;
    return { text: `from ${this.name}`, toolCalls: [], done: true };
  }
}

const profile = (
  over: Partial<{ id: string; provider: "scripted" | "claude"; model: string }>,
) => ({
  id: "agent:x",
  provider: "scripted" as const,
  model: "",
  ...over,
});
const REQ = {} as ModelRequest;
/** What the provider's "this key is not accepted" looks like to the factory in these tests. */
class Refused extends Error {}

describe("the model factory with workspace keys", () => {
  const build = (opts: { offline?: boolean; env?: boolean } = {}) => {
    const vault = new KeyVault(new FileStore(root), SECRET);
    const built: Stub[] = [];
    const fallback = new ScriptedModel();
    const factory = new ModelFactory({
      vault,
      fallback,
      claude: () => opts.env ?? false,
      offline: () => opts.offline ?? false,
      refused: (err) => err instanceof Refused,
      buildClaude: (id) => new Stub(`env:${id}`, null),
      buildKeyed: (key, id) => {
        const m = new Stub(id, key);
        built.push(m);
        return m;
      },
    });
    return { vault, factory, built, fallback };
  };

  it("runs a workspace on its own key and every other workspace on the server's model", async () => {
    const { vault, factory, built, fallback } = build();
    vault.set("acme", KEY_A, { userId: "ana", model: "house-model" });
    expect(factory.source("acme")).toBe("workspace");
    expect(factory.source("beta")).toBe("demo");
    const acme = factory.sessionModel("acme");
    const beta = factory.sessionModel("beta");
    expect(acme.name).toBe("house-model");
    expect(beta.name).toBe(fallback.name);
    expect((await acme.complete(REQ)).text).toBe("from house-model");
    expect(built).toHaveLength(1);
    expect(built[0]?.apiKey).toBe(KEY_A);
    // The same model is reused until the key changes.
    await acme.complete(REQ);
    expect(built).toHaveLength(1);
    expect(built[0]?.calls).toBe(2);
    // A replaced key applies to the next call of the same session model.
    vault.set("acme", KEY_B, { userId: "ana" });
    await acme.complete(REQ);
    expect(built).toHaveLength(2);
    expect(built[1]?.apiKey).toBe(KEY_B);
    // A removed key falls back to the server's model at once.
    vault.remove("acme");
    expect(acme.name).toBe(fallback.name);
    expect(factory.source("acme")).toBe("demo");
  });

  it("runs every member model of a keyed workspace on the workspace's key, the stand-in included", () => {
    const { vault, factory } = build();
    vault.set("acme", KEY_A, { userId: "ana" });
    const plain = factory.modelFor(profile({}), "acme");
    const named = factory.modelFor(profile({ id: "agent:y", model: "small-model" }), "acme");
    expect(plain.name).not.toBe(new ScriptedModel().name);
    expect(named.name).toBe("small-model");
    // Without a key the same profile is the scripted stand-in, and a claude profile too when
    // the server may not use a key of its own.
    expect(factory.modelFor(profile({}), "beta").name).toBe(new ScriptedModel().name);
    expect(factory.modelFor(profile({ provider: "claude" }), "beta").name).toBe(
      new ScriptedModel().name,
    );
    expect(factory.claudeAvailable("acme")).toBe(true);
    expect(factory.claudeAvailable("beta")).toBe(false);
    expect(factory.claudeAvailable()).toBe(false);
  });

  it("uses the server's own key for a claude profile only where the server allows it", () => {
    const { factory } = build({ env: true });
    expect(factory.modelFor(profile({ provider: "claude", model: "m1" }), "beta").name).toBe(
      "env:m1",
    );
    expect(factory.modelFor(profile({ provider: "claude", model: "m1" })).name).toBe("env:m1");
  });

  it("calls no provider when offline, a workspace's key included", () => {
    const { vault, factory, fallback } = build({ offline: true });
    vault.set("acme", KEY_A, { userId: "ana" });
    expect(factory.keyed("acme")).toBe(false);
    expect(factory.sessionModel("acme").name).toBe(fallback.name);
    expect(factory.source("acme")).toBe("demo");
  });

  it("reads HENOSIS_OFFLINE as on unless it says otherwise", () => {
    const was = process.env.HENOSIS_OFFLINE;
    try {
      for (const [value, on] of [
        ["1", true],
        ["true", true],
        ["0", false],
        ["false", false],
        ["No", false],
        ["", false],
      ] as const) {
        process.env.HENOSIS_OFFLINE = value;
        expect(`${value}:${offlineFromEnv()}`).toBe(`${value}:${on}`);
      }
      delete process.env.HENOSIS_OFFLINE;
      expect(offlineFromEnv()).toBe(false);
    } finally {
      if (was === undefined) delete process.env.HENOSIS_OFFLINE;
      else process.env.HENOSIS_OFFLINE = was;
    }
  });

  it("remembers a refused key and ends the turn with words the team can act on", async () => {
    const { vault, factory, built } = build();
    vault.set("acme", KEY_A, { userId: "ana" });
    const model = factory.sessionModel("acme");
    await model.complete(REQ);
    (built[0] as Stub).fail = new Refused("invalid x-api-key");
    await expect(model.complete(REQ)).rejects.toThrow(KEY_REFUSED_MESSAGE);
    expect(vault.describe("acme").status).toBe("refused");
    // Any other failure is passed on as it is and says nothing about the key.
    vault.mark("acme", "ok");
    (factory.resolve("acme", null) as Stub).fail = new Error("overloaded");
    await expect(model.complete(REQ)).rejects.toThrow("overloaded");
    expect(vault.describe("acme").status).toBe("ok");
    // A call that works again clears a refusal.
    vault.mark("acme", "refused");
    (factory.resolve("acme", null) as Stub).fail = null;
    await model.complete(REQ);
    expect(vault.describe("acme").status).toBe("ok");
  });
});
