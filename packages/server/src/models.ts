/**
 * The model factory: which `Model` does a piece of work run on.
 *
 * Bring your own key (keys.ts): a workspace that connected its own provider key runs all of
 * its work on that key. Its session agents run the workspace's default model, and a member
 * model in a council (docs/19_council.md, "Member models") runs the model id its profile
 * names, or the workspace default when it names none. The demo stand-in is retired for that
 * workspace: a profile still marked `scripted` runs on the workspace's model too.
 *
 * A workspace without a key runs on what the server itself offers: the server's own model for
 * session agents (the scripted stand-in, or Claude when the person running the server started
 * it with their own key), and for a `claude` member profile the environment's key when the
 * server allows it (`claude`), else the scripted stand-in, said once in the log.
 * HENOSIS_OFFLINE blocks every provider call, a workspace's key included.
 *
 * Models are shared between profiles that name the same provider, key and model, since a
 * `Model` holds no per-member state: the persona rides on every request.
 */
import type { AgentProfile } from "@henosis/fleet";
import {
  ClaudeModel,
  claudeAvailable,
  claudeKeyRefused,
  claudeModelFor,
  DEFAULT_CLAUDE_MODEL,
  type Model,
  type ModelRequest,
  type ModelResponse,
  ScriptedModel,
  type ToolRegistry,
  type ToolSpec,
} from "@henosis/runner";
import type { KeyVault } from "./keys.js";

export interface ModelFactoryOptions {
  /**
   * Whether the server's own environment key may be called for a `claude` profile;
   * `claudeAvailable()` (the key and HENOSIS_OFFLINE) by default. A hosted server passes
   * `() => false`: there, only a workspace's own key ever reaches the provider.
   */
  claude?: (() => boolean) | undefined;
  /** How a Claude model on the server's own key is built for a model id (tests inject a stub). */
  buildClaude?: ((modelId: string) => Model) | undefined;
  /** How a Claude model on a workspace's key is built (tests inject a stub). */
  buildKeyed?: ((apiKey: string, modelId: string) => Model) | undefined;
  /** The workspaces' keys; without a vault no workspace has one. */
  vault?: KeyVault | undefined;
  /** The server's own model: what a session agent runs on in a workspace without a key. */
  fallback?: Model | undefined;
  /** Whether every provider call is blocked; HENOSIS_OFFLINE by default. */
  offline?: (() => boolean) | undefined;
  /** Whether an error is the provider turning the key itself down (tests inject). */
  refused?: ((err: unknown) => boolean) | undefined;
  log?: ((line: string) => void) | undefined;
}

/** HENOSIS_OFFLINE blocks every provider call; `0`, `false` and `no` mean it is not set. */
export function offlineFromEnv(): boolean {
  const v = (process.env.HENOSIS_OFFLINE ?? "").trim().toLowerCase();
  return v !== "" && v !== "0" && v !== "false" && v !== "no";
}

/** What a workspace's work runs on: its own key, the server's own model, or the demo stand-in. */
export type ModelSource = "workspace" | "server" | "demo";

/** What the person sees when the provider turned the workspace's key down mid-turn. */
export const KEY_REFUSED_MESSAGE =
  "The workspace's model key was refused by the provider. An admin can replace it in Settings, Workspace.";

/** The provider's model id a profile runs on: its own, else the provider's default. */
export function modelNameOf(p: Pick<AgentProfile, "provider" | "model">): string {
  if (p.provider === "claude") return p.model || DEFAULT_CLAUDE_MODEL;
  return SCRIPTED_MODEL_NAME;
}

export const SCRIPTED_MODEL_NAME = new ScriptedModel().name;

/** The tool specs a profile may call: the ones it names, every one when it names none. */
export function toolSpecsFor(p: Pick<AgentProfile, "tools">, tools: ToolRegistry): ToolSpec[] {
  const specs = tools.specs();
  if (p.tools.length === 0) return specs;
  return specs.filter((s) => p.tools.includes(s.name));
}

type ProfileRef = Pick<AgentProfile, "id" | "provider" | "model">;

export class ModelFactory {
  private readonly cache = new Map<string, Model>();
  private readonly warned = new Set<string>();
  private readonly isClaude: () => boolean;
  private readonly buildClaude: (modelId: string) => Model;
  private readonly buildKeyed: (apiKey: string, modelId: string) => Model;
  private readonly offline: () => boolean;
  /** Whether an error is the provider turning a key down. */
  readonly refused: (err: unknown) => boolean;
  private readonly log: (line: string) => void;
  private readonly vault: KeyVault | null;
  private readonly fallback: Model | null;

  constructor(opts: ModelFactoryOptions = {}) {
    this.isClaude = opts.claude ?? claudeAvailable;
    this.buildClaude = opts.buildClaude ?? ((id) => new ClaudeModel(id));
    this.buildKeyed = opts.buildKeyed ?? ((key, id) => claudeModelFor(key, id));
    this.offline = opts.offline ?? offlineFromEnv;
    this.refused = opts.refused ?? claudeKeyRefused;
    this.log = opts.log ?? (() => {});
    this.vault = opts.vault ?? null;
    this.fallback = opts.fallback ?? null;
  }

  /**
   * Whether a `claude` profile runs on Claude: in a workspace, on its own key or the server's;
   * with no workspace named, on the server's own key only.
   */
  claudeAvailable(orgId?: string | null): boolean {
    if (orgId && this.keyOf(orgId)) return true;
    return this.isClaude();
  }

  /** What a workspace's work runs on right now. */
  source(orgId: string): ModelSource {
    if (this.keyOf(orgId)) return "workspace";
    if (this.fallback && !(this.fallback instanceof ScriptedModel)) return "server";
    return "demo";
  }

  /** The model id a workspace's session agents run on right now. */
  sessionModelName(orgId: string): string {
    return this.resolve(orgId, null).name;
  }

  /**
   * The model a workspace's session agents run on. It is looked up on every call, so a key
   * connected, replaced or removed in Settings applies to the next turn of a running session.
   */
  sessionModel(orgId: string): Model {
    return new WorkspaceModel(this, orgId, null);
  }

  /** The model that speaks for a profile: in a workspace when one is named, else on the server's own. */
  modelFor(p: ProfileRef, orgId?: string | null): Model {
    if (orgId) return new WorkspaceModel(this, orgId, p);
    return this.resolve(null, p);
  }

  /** The `Model` behind a workspace's or a profile's work at this moment. */
  resolve(orgId: string | null, p: ProfileRef | null): Model {
    const key = orgId ? this.keyOf(orgId) : null;
    if (orgId && key) {
      const id = p?.model || this.vault?.describe(orgId).model || DEFAULT_CLAUDE_MODEL;
      return this.cached(`key:${orgId}:${this.vault?.version(orgId) ?? 0}:${id}`, () =>
        this.buildKeyed(key, id),
      );
    }
    const own = (): Model => this.fallback ?? this.cached("scripted", () => new ScriptedModel());
    if (!p) return own();
    if (p.provider === "claude") {
      if (this.isClaude())
        return this.cached(`claude:${modelNameOf(p)}`, () => this.buildClaude(modelNameOf(p)));
      if (!this.warned.has(p.id)) {
        this.warned.add(p.id);
        this.log(
          `models: ${p.id} asks for Claude but no key is set or HENOSIS_OFFLINE=1; the scripted model stands in`,
        );
      }
    }
    return own();
  }

  /** The provider said what it thinks of a workspace's key; keep it for Settings to show. */
  noteKey(orgId: string, status: "ok" | "refused"): void {
    const now = this.vault?.describe(orgId);
    if (!now?.connected || now.status === status) return;
    this.vault?.mark(orgId, status);
    if (status === "refused")
      this.log(`models: the provider refused the key of workspace ${orgId}`);
  }

  /** Whether the model behind this work is on the workspace's own key. */
  keyed(orgId: string): boolean {
    return this.keyOf(orgId) !== null;
  }

  private keyOf(orgId: string): string | null {
    if (!this.vault || this.offline()) return null;
    return this.vault.key(orgId);
  }

  private cached(key: string, build: () => Model): Model {
    let m = this.cache.get(key);
    if (!m) {
      m = build();
      this.cache.set(key, m);
    }
    return m;
  }
}

/**
 * A workspace's model as the hosts hold it: one object for the life of a project or a council,
 * resolved on every call to whatever the workspace runs on at that moment. When the provider
 * turns the workspace's key down, the vault remembers it and the turn ends with a sentence the
 * team can act on rather than the provider's error.
 */
class WorkspaceModel implements Model {
  constructor(
    private readonly factory: ModelFactory,
    private readonly orgId: string,
    private readonly profile: ProfileRef | null,
  ) {}

  get name(): string {
    return this.factory.resolve(this.orgId, this.profile).name;
  }

  async complete(req: ModelRequest): Promise<ModelResponse> {
    const keyed = this.factory.keyed(this.orgId);
    const model = this.factory.resolve(this.orgId, this.profile);
    try {
      const res = await model.complete(req);
      if (keyed) this.factory.noteKey(this.orgId, "ok");
      return res;
    } catch (err) {
      if (keyed && this.factory.refused(err)) {
        this.factory.noteKey(this.orgId, "refused");
        throw new Error(KEY_REFUSED_MESSAGE);
      }
      throw err;
    }
  }
}
