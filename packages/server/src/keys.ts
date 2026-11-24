/**
 * The key vault: each workspace (an org) connects its own model provider key, and the server
 * calls the provider with that key for that workspace's sessions and councils. Nobody else's
 * key is ever used for a workspace's work, and no key ever leaves the server again: the API
 * answers with the last four characters, who connected it and when.
 *
 * At rest a key is sealed with AES-256-GCM under a key derived (HKDF-SHA256) from the server's
 * secret and the workspace id, so one workspace's ciphertext does not open under another's
 * derived key, and the workspace id and provider are bound in as associated data. The sealed
 * keys are the `keys` document of the store; the secret is `HENOSIS_KEYS_SECRET`, or for a
 * folder store on one machine a random one kept beside it (`keys.secret`, mode 600). Without a
 * secret the vault is not configured: it stores nothing and says so.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { LiveStore } from "./store/index.js";

export const KEYS_DOC = "keys";

/** The providers a workspace can connect. One today; the stored shape carries the name. */
export const KeyProvider = z.enum(["anthropic"]);
export type KeyProvider = z.infer<typeof KeyProvider>;

const SealedKey = z.object({
  v: z.literal(1),
  iv: z.string(),
  tag: z.string(),
  data: z.string(),
  last4: z.string(),
  addedBy: z.string(),
  addedAt: z.string(),
  /** The model the workspace's agents run on by default; empty for the provider's default. */
  model: z.string().default(""),
  /** `refused` once the provider turned the key down; set back by a successful check. */
  status: z.enum(["ok", "refused"]).default("ok"),
  checkedAt: z.string().nullable().default(null),
});
type SealedKey = z.infer<typeof SealedKey>;

const KeysFile = z.object({
  orgs: z.record(z.string(), z.record(z.string(), SealedKey)).default({}),
});
type KeysFile = z.infer<typeof KeysFile>;

/** What the API says of a workspace's key: never the key. */
export interface KeyStatus {
  provider: KeyProvider;
  connected: boolean;
  last4: string | null;
  addedBy: string | null;
  addedAt: string | null;
  model: string;
  /**
   * `refused`: the provider turned the key down. `unreadable`: the key is kept but this
   * server cannot open it (its secret changed), so it has to be connected again.
   */
  status: "ok" | "refused" | "unreadable" | "none";
  checkedAt: string | null;
}

/** A key as a person types it: trimmed, one line, long enough to be one. */
export function cleanKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim();
  if (key.length < 20 || key.length > 400 || /\s/.test(key)) return null;
  return key;
}

/**
 * The server's vault secret: `HENOSIS_KEYS_SECRET` when set; else, when `localDir` is given (a
 * folder store on this machine), a random secret kept in `<localDir>/keys.secret`, created on
 * first use. Null when neither applies, and the vault then refuses to store keys.
 */
export function keysSecretFrom(
  env: Record<string, string | undefined>,
  localDir?: string | null,
): string | null {
  const given = env.HENOSIS_KEYS_SECRET?.trim();
  if (given) {
    if (given.length < 16) throw new Error("HENOSIS_KEYS_SECRET must be at least 16 characters");
    return given;
  }
  if (!localDir) return null;
  const file = join(localDir, "keys.secret");
  if (existsSync(file)) {
    const kept = readFileSync(file, "utf8").trim();
    if (kept.length >= 16) return kept;
  }
  const made = randomBytes(32).toString("hex");
  // The folder of a store that was never opened does not exist yet.
  mkdirSync(localDir, { recursive: true });
  writeFileSync(file, `${made}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
  return made;
}

export class KeyVault {
  private file: KeysFile;
  /** Opened keys by `org:provider`, so a turn does not derive and decrypt every time. */
  private readonly open = new Map<string, string>();
  /** Bumped on every change to a workspace's key, so callers can drop what they built with it. */
  private readonly versions = new Map<string, number>();

  constructor(
    private readonly store: LiveStore,
    private readonly secret: string | null,
  ) {
    const doc = store.readDoc(KEYS_DOC);
    this.file = doc ? KeysFile.parse(doc) : { orgs: {} };
  }

  /** Read the sealed keys again from the store (another instance may have written them). */
  reload(): void {
    const doc = this.store.readDoc(KEYS_DOC);
    const orgs = new Set([...Object.keys(this.file.orgs)]);
    this.file = doc ? KeysFile.parse(doc) : { orgs: {} };
    for (const id of Object.keys(this.file.orgs)) orgs.add(id);
    this.open.clear();
    for (const id of orgs) this.versions.set(id, this.version(id) + 1);
  }

  /** Whether keys can be stored here at all (the server has a secret to seal them with). */
  get configured(): boolean {
    return this.secret !== null;
  }

  /** Changes whenever the workspace's key or default model does. */
  version(orgId: string): number {
    return this.versions.get(orgId) ?? 0;
  }

  has(orgId: string, provider: KeyProvider = "anthropic"): boolean {
    return Boolean(this.file.orgs[orgId]?.[provider]);
  }

  describe(orgId: string, provider: KeyProvider = "anthropic"): KeyStatus {
    const k = this.file.orgs[orgId]?.[provider];
    if (!k)
      return {
        provider,
        connected: false,
        last4: null,
        addedBy: null,
        addedAt: null,
        model: "",
        status: "none",
        checkedAt: null,
      };
    return {
      provider,
      connected: true,
      last4: k.last4,
      addedBy: k.addedBy,
      addedAt: k.addedAt,
      model: k.model,
      status: this.secret !== null && this.key(orgId, provider) === null ? "unreadable" : k.status,
      checkedAt: k.checkedAt,
    };
  }

  /** The workspace's key, opened; null when it has none or it cannot be opened with this secret. */
  key(orgId: string, provider: KeyProvider = "anthropic"): string | null {
    const id = `${orgId}:${provider}`;
    const cached = this.open.get(id);
    if (cached) return cached;
    const k = this.file.orgs[orgId]?.[provider];
    if (!k || !this.secret) return null;
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.derive(orgId),
        Buffer.from(k.iv, "base64"),
      );
      decipher.setAAD(Buffer.from(id, "utf8"));
      decipher.setAuthTag(Buffer.from(k.tag, "base64"));
      const key = Buffer.concat([
        decipher.update(Buffer.from(k.data, "base64")),
        decipher.final(),
      ]).toString("utf8");
      this.open.set(id, key);
      return key;
    } catch {
      // Sealed under another secret (it was rotated, or the store was moved): not usable here.
      return null;
    }
  }

  /** Seal and keep a workspace's key. Throws when the vault has no secret. */
  set(
    orgId: string,
    key: string,
    by: { userId: string; model?: string | undefined; at?: string | undefined },
    provider: KeyProvider = "anthropic",
  ): KeyStatus {
    if (!this.secret) throw new Error("key storage is not configured on this server");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.derive(orgId), iv);
    cipher.setAAD(Buffer.from(`${orgId}:${provider}`, "utf8"));
    const data = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
    const at = by.at ?? new Date().toISOString();
    const sealed: SealedKey = {
      v: 1,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: data.toString("base64"),
      last4: key.slice(-4),
      addedBy: by.userId,
      addedAt: at,
      model: by.model ?? this.file.orgs[orgId]?.[provider]?.model ?? "",
      status: "ok",
      checkedAt: at,
    };
    this.file.orgs[orgId] = { ...this.file.orgs[orgId], [provider]: sealed };
    this.changed(orgId, provider);
    return this.describe(orgId, provider);
  }

  /** Set the model the workspace's agents run on by default; a no-op without a key. */
  setModel(orgId: string, model: string, provider: KeyProvider = "anthropic"): KeyStatus {
    const k = this.file.orgs[orgId]?.[provider];
    if (k && k.model !== model) {
      k.model = model;
      this.changed(orgId, provider);
    }
    return this.describe(orgId, provider);
  }

  /** Record what the provider last said of the key. */
  mark(
    orgId: string,
    status: "ok" | "refused",
    at: string = new Date().toISOString(),
    provider: KeyProvider = "anthropic",
  ): void {
    const k = this.file.orgs[orgId]?.[provider];
    if (!k) return;
    k.status = status;
    k.checkedAt = at;
    // The key itself did not change, so nothing built with it is dropped.
    this.store.writeDoc(KEYS_DOC, this.file);
  }

  /** Forget a workspace's key; true when there was one. */
  remove(orgId: string, provider: KeyProvider = "anthropic"): boolean {
    const org = this.file.orgs[orgId];
    if (!org?.[provider]) return false;
    delete org[provider];
    if (Object.keys(org).length === 0) delete this.file.orgs[orgId];
    this.changed(orgId, provider);
    return true;
  }

  private changed(orgId: string, provider: KeyProvider): void {
    this.open.delete(`${orgId}:${provider}`);
    this.versions.set(orgId, this.version(orgId) + 1);
    this.store.writeDoc(KEYS_DOC, this.file);
  }

  private derive(orgId: string): Buffer {
    return Buffer.from(
      hkdfSync("sha256", this.secret ?? "", "henosis.keys.v1", `workspace:${orgId}`, 32),
    );
  }
}
