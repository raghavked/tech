/**
 * Claude adapter. Enabled only when an API key is available and HENOSIS_OFFLINE is off.
 * The runner records every response in the log, so a replay never reaches this file.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Usage } from "@henosis/protocol";
import type { Model, ModelRequest, ModelResponse } from "./model.js";

export const DEFAULT_CLAUDE_MODEL = "claude-opus-5-5";

/** HENOSIS_OFFLINE blocks every provider call; `0`, `false` and `no` mean it is not set. */
export function offlineFromEnv(): boolean {
  const v = (process.env.HENOSIS_OFFLINE ?? "").trim().toLowerCase();
  return v !== "" && v !== "0" && v !== "false" && v !== "no";
}

export function claudeAvailable(): boolean {
  return (
    !offlineFromEnv() && Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
  );
}

/** A client that calls the provider with one given key (a workspace's own), never the environment's. */
export function claudeClientFor(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, authToken: null });
}

/** A Claude model that runs on one given key. */
export function claudeModelFor(apiKey: string, model: string = DEFAULT_CLAUDE_MODEL): ClaudeModel {
  return new ClaudeModel(model || DEFAULT_CLAUDE_MODEL, claudeClientFor(apiKey));
}

/** True when the provider turned the key itself down (wrong, revoked, or not allowed to do this). */
export function claudeKeyRefused(err: unknown): boolean {
  return (
    err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError
  );
}

export type KeyCheck =
  | { ok: true }
  | { ok: false; reason: "refused" | "unreachable" | "model"; message: string };

/**
 * Ask the provider whether a key works, without spending a token: list one model with it (and,
 * when a model id is named, look that model up). `refused` is the provider saying no to the
 * key; `model` is a key that works but cannot see the model named; `unreachable` is anything
 * else (the network, the provider being down), which says nothing about the key.
 */
export async function checkClaudeKey(apiKey: string, model?: string): Promise<KeyCheck> {
  const client = claudeClientFor(apiKey);
  try {
    await client.models.list({ limit: 1 });
  } catch (err) {
    if (claudeKeyRefused(err))
      return { ok: false, reason: "refused", message: "Anthropic did not accept this key." };
    return {
      ok: false,
      reason: "unreachable",
      message: "Anthropic could not be reached to check the key. Try again in a moment.",
    };
  }
  if (model) {
    try {
      await client.models.retrieve(model);
    } catch (err) {
      if (err instanceof Anthropic.NotFoundError || claudeKeyRefused(err))
        return { ok: false, reason: "model", message: `This key cannot use the model ${model}.` };
      return {
        ok: false,
        reason: "unreachable",
        message: "Anthropic could not be reached to check the model. Try again in a moment.",
      };
    }
  }
  return { ok: true };
}

/** The models a key can use, newest first, as the provider lists them. */
export async function listClaudeModels(apiKey: string): Promise<{ id: string; name: string }[]> {
  const out: { id: string; name: string }[] = [];
  for await (const m of claudeClientFor(apiKey).models.list({ limit: 100 }))
    out.push({ id: m.id, name: m.display_name });
  return out;
}

const SYSTEM = `You are the shared agent in a Henosis session: several humans watch and steer you at once.
The session's composed intent below is authoritative; it already arbitrates between them.
Respect every standing constraint. Do not act on scopes marked under discussion.
Work in small steps, say what you are doing in one or two sentences, and call tools to make progress.
When the goal is complete, reply with the word DONE on its own line.`;

/** The system prompt for a member model speaking in a council (docs/19_council.md). */
const COUNCIL_SYSTEM = `You are one member's model in a Henosis council: a team's own agents deliberating one task together, with the people in the room.
The brief below names the task, who you are, who chairs, what the others said and what your owner instructed you in private.
Speak for your owner's view, plainly and briefly. Cite a private instruction as "instructed by <name>" when you act on it.
In a discussion round begin with AGREE, DIFFER or ADD on its own line. As chair in synthesis, call the synthesis tool with steps and owners.`;

export class ClaudeModel implements Model {
  readonly name: string;
  private readonly client: Anthropic;

  constructor(model: string = DEFAULT_CLAUDE_MODEL, client?: Anthropic) {
    this.name = model;
    this.client = client ?? new Anthropic();
  }

  async complete(req: ModelRequest): Promise<ModelResponse> {
    const tools: Anthropic.Tool[] = req.tools.map((t) => ({
      name: t.name.replace(/\./g, "__"),
      description: `${t.description} (risk: ${t.risk})`,
      input_schema: t.schema as Anthropic.Tool.InputSchema,
    }));
    const system = req.council
      ? `${COUNCIL_SYSTEM}${req.council.persona ? `\nYour manner: ${req.council.persona}` : ""}`
      : SYSTEM;
    const opening = [
      `Session: ${req.title}`,
      "",
      req.intentText,
      "",
      req.planFirst
        ? req.needsPlan
          ? "Plan first: call plan__propose before any other tool; the team rates the plan and you continue once it is approved."
          : req.plan
            ? `Plan ${req.plan.status}: ${req.plan.steps.map((s) => `${s.id} [${s.status}] ${s.title}`).join("; ")}. Call plan__step {stepId} when you move to the next step.`
            : ""
        : "",
      req.newDirectives.length
        ? `New directives this turn:\n${req.newDirectives.map((d) => `- ${d}`).join("\n")}`
        : "",
      req.history.length
        ? `Previous turns:\n${req.history
            .slice(-10)
            .map((h) => `- ${h}`)
            .join("\n")}`
        : "",
      `Workspace files: ${req.files.length ? req.files.join(", ") : "(empty)"}`,
    ]
      .filter(Boolean)
      .join("\n");
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: opening }];
    for (const entry of req.transcript) {
      if (entry.role === "assistant") {
        const content: Anthropic.ContentBlockParam[] = [];
        if (entry.text) content.push({ type: "text", text: entry.text });
        for (const c of entry.toolCalls) {
          content.push({
            type: "tool_use",
            id: c.id,
            name: c.name.replace(/\./g, "__"),
            input: c.args,
          });
        }
        messages.push({ role: "assistant", content });
      } else {
        messages.push({
          role: "user",
          content: entry.results.map(
            (r): Anthropic.ToolResultBlockParam => ({
              type: "tool_result",
              tool_use_id: r.callId,
              content: r.output,
              is_error: !r.ok,
            }),
          ),
        });
      }
    }
    const response = await this.client.messages.create({
      model: this.name,
      max_tokens: 16000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools,
      messages,
    });
    const usage = usageOf(response.usage);
    if (response.stop_reason === "refusal") {
      const details = (response as { stop_details?: { category?: string | null } | null })
        .stop_details;
      return {
        text: `The model declined to continue (${details?.category ?? "unspecified"}).`,
        toolCalls: [],
        done: true,
        usage,
      };
    }
    let text = "";
    const toolCalls: ModelResponse["toolCalls"] = [];
    for (const block of response.content) {
      if (block.type === "text") text += block.text;
      if (block.type === "tool_use") {
        const name = block.name.replace(/__/g, ".");
        const spec = req.tools.find((t) => t.name === name);
        toolCalls.push({
          id: block.id,
          name,
          args: (block.input ?? {}) as Record<string, unknown>,
          risk: spec?.risk ?? "irreversible",
        });
      }
    }
    const done = toolCalls.length === 0 && /^DONE$/m.test(text.trim());
    return { text: text.trim(), toolCalls, done, usage };
  }
}

/** The Messages API's counts, as the log records them; cache fields are null on older models. */
export function usageOf(u: Anthropic.Usage | null | undefined): Usage {
  return {
    input: u?.input_tokens ?? 0,
    output: u?.output_tokens ?? 0,
    cacheRead: u?.cache_read_input_tokens ?? 0,
    cacheWrite: u?.cache_creation_input_tokens ?? 0,
  };
}
