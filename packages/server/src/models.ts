/**
 * The model factory (docs/19_council.md, "Member models"): a member model's profile names a
 * provider and a model id; this builds the `Model` that speaks for it. The scripted stand-in
 * answers offline and deterministically; the Claude model runs the profile's model id (or the
 * adapter's default) when a key is set and HENOSIS_OFFLINE is unset, and falls back to the
 * scripted one otherwise, saying so once in the log. Models are shared between profiles that
 * name the same provider and model, since a `Model` holds no per-member state: the persona
 * rides on every request.
 */
import type { AgentProfile } from "@henosis/fleet";
import {
  ClaudeModel,
  claudeAvailable,
  DEFAULT_CLAUDE_MODEL,
  type Model,
  ScriptedModel,
  type ToolRegistry,
  type ToolSpec,
} from "@henosis/runner";

export interface ModelFactoryOptions {
  /** Whether Claude may be called; `claudeAvailable()` (the key and HENOSIS_OFFLINE) by default. */
  claude?: (() => boolean) | undefined;
  /** How a Claude model is built for a model id; the adapter by default (tests inject a stub). */
  buildClaude?: ((modelId: string) => Model) | undefined;
  log?: ((line: string) => void) | undefined;
}

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

export class ModelFactory {
  private readonly cache = new Map<string, Model>();
  private readonly warned = new Set<string>();
  private readonly isClaude: () => boolean;
  private readonly buildClaude: (modelId: string) => Model;
  private readonly log: (line: string) => void;

  constructor(opts: ModelFactoryOptions = {}) {
    this.isClaude = opts.claude ?? claudeAvailable;
    this.buildClaude = opts.buildClaude ?? ((id) => new ClaudeModel(id));
    this.log = opts.log ?? (() => {});
  }

  /** Whether a `claude` profile runs on Claude here, or on the scripted stand-in. */
  claudeAvailable(): boolean {
    return this.isClaude();
  }

  /** The model that speaks for a profile. */
  modelFor(p: Pick<AgentProfile, "id" | "provider" | "model">): Model {
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
    return this.cached("scripted", () => new ScriptedModel());
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
