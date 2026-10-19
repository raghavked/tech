/**
 * The council's model requests (docs/19_council.md). `councilPrompt` renders what one member
 * model is asked in one round: the task, who sits in the circle, what the others said, the
 * private instructions it must cite, and the shape of the answer wanted. The host builds one
 * per member per round and hands it to that member's `Model`; `parseSaid` and
 * `parseSynthesis` read the answer back into the shapes the chat log records. Pure, so the
 * tests render the same request the host sends.
 */
import {
  answersBefore,
  type Council,
  type CouncilCite,
  type CouncilDissent,
  type CouncilInstruction,
  type CouncilMember,
  type CouncilRoundRef,
  type CouncilStance,
  CouncilStance as CouncilStanceSchema,
  CouncilStep,
  roundSequence,
  sameCouncilMember,
} from "@henosis/chat";
import type { Intent } from "@henosis/kernel";
import type { ToolCall } from "@henosis/protocol";
import type { CouncilContext, ModelRequest, ModelResponse, ToolSpec } from "./model.js";

export interface CouncilPromptOptions {
  /** The member's persona from its profile. */
  persona?: string;
  /** Lines of context from the group (recent messages), oldest first. */
  context?: string[];
}

/** The tool the chair calls to hand the plan back with an owner per step. */
export const COUNCIL_SYNTHESIS_TOOL = "council.synthesise";

export const SYNTHESIS_TOOL_SPEC: ToolSpec = {
  name: COUNCIL_SYNTHESIS_TOOL,
  description:
    "Write the council's plan: steps with a title, detail, a token estimate, a risk class and the profileId of the member model that owns each; list the dissent.",
  risk: "read",
  schema: {
    type: "object",
    properties: {
      steps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            detail: { type: "string" },
            estTokens: { type: "integer", minimum: 0 },
            risk: { type: "string", enum: ["read", "write", "exec", "external", "irreversible"] },
            owner: { type: "string", description: "profileId of the owning member model" },
          },
          required: ["id", "title", "owner"],
        },
      },
      rationale: { type: "string" },
      dissent: {
        type: "array",
        items: {
          type: "object",
          properties: { member: { type: "string" }, text: { type: "string" } },
          required: ["member", "text"],
        },
      },
    },
    required: ["steps"],
  },
};

function label(m: CouncilMember): string {
  return m.userId ? `${m.name} (${m.userId}'s model)` : `${m.name} (shared)`;
}

/** The council context for one member in one round, from the council's state. */
export function councilContext(
  member: CouncilMember,
  council: Council,
  round: CouncilRoundRef,
  instructions: readonly CouncilInstruction[],
  persona = "",
): CouncilContext {
  const answers = answersBefore(council, round).map((s) => ({
    member: s.member,
    round: roundOf(council, s.seq),
    index: indexOf(council, s.seq),
    text: s.text,
    stance: s.stance,
  }));
  return {
    councilId: council.id,
    task: council.task,
    round: round.round,
    index: round.index,
    member,
    chair: council.chair,
    members: council.members,
    answers,
    instructions: instructions
      .filter((i) => sameCouncilMember(i.member, member))
      .map((i) => ({ by: i.by, text: i.text })),
    persona,
  };
}

function roundOf(council: Council, seq: number) {
  for (const r of council.rounds) if (r.said.some((s) => s.seq === seq)) return r.round;
  return "individual" as const;
}
function indexOf(council: Council, seq: number) {
  for (const r of council.rounds) if (r.said.some((s) => s.seq === seq)) return r.index;
  return 0;
}

/** The brief a member model reads for a round: the text the Claude adapter sends as the opening. */
export function renderCouncilBrief(ctx: CouncilContext, context: readonly string[] = []): string {
  const you = ctx.member;
  const lines: string[] = [];
  lines.push(`COUNCIL ${ctx.councilId}`);
  lines.push(`TASK: ${ctx.task}`);
  lines.push(`YOU ARE: ${label(you)}${sameCouncilMember(you, ctx.chair) ? ", the chair" : ""}`);
  lines.push(`CHAIR: ${label(ctx.chair)}`);
  lines.push(`MEMBERS: ${ctx.members.map(label).join("; ")}`);
  if (ctx.persona) lines.push(`YOUR MANNER: ${ctx.persona}`);
  if (context.length) {
    lines.push("THE GROUP SAID RECENTLY:");
    for (const c of context) lines.push(`- ${c}`);
  }
  if (ctx.instructions.length) {
    lines.push('INSTRUCTED IN PRIVATE (cite each as "instructed by <name>"):');
    for (const i of ctx.instructions) lines.push(`- ${i.by}: ${i.text}`);
  }
  if (ctx.answers.length) {
    lines.push("SAID SO FAR:");
    for (const a of ctx.answers) {
      const who = sameCouncilMember(a.member, you) ? `${a.member.name} (you)` : a.member.name;
      const stance = a.stance ? ` [${a.stance}]` : "";
      lines.push(`- ${a.round} ${a.index + 1}, ${who}${stance}: ${a.text}`);
    }
  }
  switch (ctx.round) {
    case "individual":
      lines.push(
        "ROUND: individual. Answer the task alone, without the others; say how you would do it, the first step, and the main risk. Keep it under 200 words.",
      );
      break;
    case "discussion":
      lines.push(
        `ROUND: discussion ${ctx.index + 1}. Read every answer and reply. Start with one word on its own line, AGREE, DIFFER or ADD, then your reasons: what you agree with, where you differ and why, or what you add. Keep it under 200 words.`,
      );
      break;
    case "synthesis":
      lines.push(
        `ROUND: synthesis. You chair. From every answer and dissent, write the plan: steps with a title, detail, a token estimate, a risk class and an owner from the members (by profileId). Call ${COUNCIL_SYNTHESIS_TOOL} with the steps, the rationale and the dissent (a member and what they hold against the plan). Say in one or two sentences what the council settled.`,
      );
      break;
    case "vote":
      lines.push("ROUND: vote. The people rate the plan; models do not speak.");
      break;
  }
  return lines.join("\n");
}

/**
 * The model request for one member in one round. `instructions` are that member's pending
 * (uncited) private instructions; the chat's `pendingInstructions` gives them.
 */
export function councilPrompt(
  member: CouncilMember,
  council: Council,
  round: CouncilRoundRef,
  instructions: readonly CouncilInstruction[],
  opts: CouncilPromptOptions = {},
): ModelRequest {
  if (round.round === "vote") throw new Error("models do not speak in the vote round");
  const ctx = councilContext(member, council, round, instructions, opts.persona ?? "");
  const intent: Intent = {
    goal: {
      directiveId: `council:${council.id}`,
      author: council.by,
      text: council.task,
      seq: council.convenedSeq,
      origin: "session",
    },
    steers: {},
    constraints: [],
    control: "running",
    interrupt: false,
    contendedScopes: [],
  };
  const seq = roundSequence(council);
  const turn = Math.max(
    0,
    seq.findIndex((r) => r.round === round.round && r.index === round.index),
  );
  return {
    title: `Council: ${council.task.slice(0, 60)}`,
    intent,
    intentText: renderCouncilBrief(ctx, opts.context ?? []),
    planFirst: false,
    plan: null,
    needsPlan: false,
    history: ctx.answers.map((a) => `${a.round} ${a.index + 1} ${a.member.name}: ${a.text}`),
    files: [],
    transcript: [],
    tools: round.round === "synthesis" ? [SYNTHESIS_TOOL_SPEC] : [],
    turn,
    newDirectives: ctx.instructions.map((i) => `instructed by ${i.by}: ${i.text}`),
    council: ctx,
  };
}

/** The stance a discussion reply opens with (AGREE, DIFFER or ADD as its first word), if any. */
export function parseStance(text: string): CouncilStance | null {
  const m = text.trim().match(/^(agree|differ|add)(?:[\s:.!,-]|$)/i);
  const parsed = CouncilStanceSchema.safeParse(m?.[1]?.toLowerCase());
  return parsed.success ? parsed.data : null;
}

/** The cites a reply carries: one per person whose pending instruction it answered. */
export function citesFor(ctx: Pick<CouncilContext, "instructions">): CouncilCite[] {
  const seen = new Set<string>();
  const out: CouncilCite[] = [];
  for (const i of ctx.instructions) {
    if (seen.has(i.by)) continue;
    seen.add(i.by);
    out.push({ kind: "instruction", by: i.by });
  }
  return out;
}

/** What the chat records of a model's reply in an individual or discussion round. */
export function parseSaid(
  res: Pick<ModelResponse, "text">,
  ctx: CouncilContext,
): { text: string; stance?: CouncilStance; cites: CouncilCite[] } {
  const text = res.text.trim();
  const stance = ctx.round === "discussion" ? parseStance(text) : null;
  return { text, ...(stance ? { stance } : {}), cites: citesFor(ctx) };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

/**
 * The chair's plan from its synthesis reply: the `council.synthesise` call's steps with owners
 * resolved to the council's members (an unknown owner falls to the chair), and the dissent.
 * Null when the reply carried no plan or a step has no title.
 */
export function parseSynthesis(
  res: Pick<ModelResponse, "text" | "toolCalls">,
  council: Pick<Council, "chair" | "members">,
): { steps: CouncilStep[]; dissent: CouncilDissent[]; rationale: string } | null {
  const call: ToolCall | undefined = res.toolCalls.find((c) => c.name === COUNCIL_SYNTHESIS_TOOL);
  if (!call) return null;
  const rawSteps = call.args.steps;
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) return null;
  const everyone = [council.chair, ...council.members];
  const memberOf = (id: unknown) =>
    typeof id === "string" ? everyone.find((m) => m.profileId === id) : undefined;
  const steps: CouncilStep[] = [];
  for (const [i, raw] of rawSteps.entries()) {
    if (!isRecord(raw) || !str(raw.title)) return null;
    const parsed = CouncilStep.safeParse({
      id: str(raw.id) || `s${i + 1}`,
      title: str(raw.title),
      detail: str(raw.detail),
      estTokens: typeof raw.estTokens === "number" ? Math.max(0, Math.round(raw.estTokens)) : 0,
      risk: str(raw.risk, "write"),
      owner: memberOf(raw.owner) ?? council.chair,
    });
    if (!parsed.success) return null;
    steps.push(parsed.data);
  }
  const dissent: CouncilDissent[] = [];
  const rawDissent = Array.isArray(call.args.dissent) ? call.args.dissent : [];
  for (const d of rawDissent) {
    if (!isRecord(d)) continue;
    const m = memberOf(d.member);
    const text = str(d.text).trim();
    if (m && text) dissent.push({ member: m, text });
  }
  return { steps, dissent, rationale: str(call.args.rationale) };
}
