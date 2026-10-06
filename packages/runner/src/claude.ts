/**
 * Claude adapter. Enabled only when an API key is available and HENOSIS_OFFLINE is unset.
 * The runner records every response in the log, so a replay never reaches this file.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Usage } from "@henosis/protocol";
import type { Model, ModelRequest, ModelResponse } from "./model.js";

export const DEFAULT_CLAUDE_MODEL = "claude-opus-5-5";

export function claudeAvailable(): boolean {
  return (
    !process.env.HENOSIS_OFFLINE &&
    Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
  );
}

const SYSTEM = `You are the shared agent in a Henosis session: several humans watch and steer you at once.
The session's composed intent below is authoritative; it already arbitrates between them.
Respect every standing constraint. Do not act on scopes marked under discussion.
Work in small steps, say what you are doing in one or two sentences, and call tools to make progress.
When the goal is complete, reply with the word DONE on its own line.`;

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
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
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
