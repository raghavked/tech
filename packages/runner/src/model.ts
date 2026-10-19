/**
 * Model interface. The runner builds a request from session state; a model returns text and
 * tool calls. Outputs are recorded in the log so replays never call a model.
 */
import type { CouncilMember, CouncilRound, CouncilStance } from "@henosis/chat";
import type { Intent } from "@henosis/kernel";
import type { PlanStatus, RiskClass, ToolCall, ToolResult, Usage } from "@henosis/protocol";

/** What a member model said in an earlier round, as the next round reads it. */
export interface CouncilAnswer {
  member: CouncilMember;
  round: CouncilRound;
  index: number;
  text: string;
  stance: CouncilStance | null;
}

/**
 * A council round as one member model sees it (docs/19_council.md). Set on a request when the
 * model speaks in a council rather than works in a session: the scripted model answers it
 * deterministically, the Claude model from the member's persona.
 */
export interface CouncilContext {
  councilId: string;
  task: string;
  round: CouncilRound;
  index: number;
  /** The member this request is for. */
  member: CouncilMember;
  chair: CouncilMember;
  members: CouncilMember[];
  /** Everything said in earlier rounds, oldest first; empty in the individual round. */
  answers: CouncilAnswer[];
  /** Private instructions to this member that it has not cited yet. */
  instructions: { by: string; text: string }[];
  /** The member's persona from its profile; empty for the default manner. */
  persona: string;
}

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

/** The plan as the model sees it: which step is running, which are left. */
export interface PlanView {
  id: string;
  goal: string;
  status: PlanStatus;
  steps: { id: string; title: string; status: "pending" | "running" | "done" }[];
}

export interface ModelRequest {
  title: string;
  intent: Intent;
  intentText: string;
  /** Plan first: the session wants a plan before any work. */
  planFirst: boolean;
  /** The active plan for the goal, or null; the model proposes one when `needsPlan`. */
  plan: PlanView | null;
  needsPlan: boolean;
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
  /** Set when the model speaks in a council round instead of working in a session. */
  council?: CouncilContext;
}

export interface ModelResponse {
  text: string;
  toolCalls: ToolCall[];
  /** True when the model believes the current goal is complete. */
  done: boolean;
  /** What the call cost, as the provider counted it; the scripted model synthesises it. */
  usage?: Usage;
}

export interface Model {
  readonly name: string;
  complete(req: ModelRequest): Promise<ModelResponse>;
}
