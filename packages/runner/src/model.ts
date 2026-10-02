/**
 * Model interface. The runner builds a request from session state; a model returns text and
 * tool calls. Outputs are recorded in the log so replays never call a model.
 */
import type { Intent } from "@fold/kernel";
import type { RiskClass, ToolCall, ToolResult } from "@fold/protocol";

export interface ToolSpec {
  name: string;
  description: string;
  risk: RiskClass;
  /** JSON schema for the arguments. */
  schema: Record<string, unknown>;
}

export type TranscriptEntry =
  | { role: "assistant"; text: string; toolCalls: ToolCall[] }
  | { role: "tool"; results: ToolResult[] };

export interface ModelRequest {
  title: string;
  intent: Intent;
  intentText: string;
  /** Summaries of previous turns, oldest first. */
  history: string[];
  /** Files currently in the workspace. */
  files: string[];
  /** Tool calls and results so far in this turn. */
  transcript: TranscriptEntry[];
  tools: ToolSpec[];
  /** Deterministic per-turn seed (turn number). */
  turn: number;
  /** New directives this epoch, rendered for the model. */
  newDirectives: string[];
}

export interface ModelResponse {
  text: string;
  toolCalls: ToolCall[];
  /** True when the model believes the current goal is complete. */
  done: boolean;
}

export interface Model {
  readonly name: string;
  complete(req: ModelRequest): Promise<ModelResponse>;
}
