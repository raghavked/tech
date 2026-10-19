/**
 * A deterministic, rule-based stand-in for a coding model. It behaves like a cautious junior
 * engineer: writes a plan from the composed intent, writes a module and a test, runs the test
 * through the shell (which needs approval), and deploys only when told to. In a plan-first
 * session it proposes its steps first and marks each one as it gets there. It is a pure
 * function of the request, so offline demos and tests are reproducible.
 *
 * In a council (a request with `council` set) it speaks as a member model: its stance and its
 * words come from a hash of the task and the member, so two councils on one task with the
 * same members say the same things; as chair it writes a plan with one step per member and
 * the owners dealt round-robin.
 */
import type { CouncilMember, CouncilStance } from "@henosis/chat";
import { hashValue } from "@henosis/kernel";
import type { ToolCall, Usage } from "@henosis/protocol";
import { COUNCIL_SYNTHESIS_TOOL } from "./council.js";
import type { CouncilContext, Model, ModelRequest, ModelResponse } from "./model.js";

const PLAN = "PLAN.md";

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 24) || "feature"
  );
}

type Decision = Omit<ModelResponse, "usage">;

export class ScriptedModel implements Model {
  readonly name = "scripted-v1";

  async complete(req: ModelRequest): Promise<ModelResponse> {
    const res = decide(req);
    return { ...res, usage: syntheticUsage(req, res.text, res.toolCalls) };
  }
}

// ---- the council -----------------------------------------------------------------------

const APPROACHES = [
  "start from the tests and let them shape the interface",
  "cut the scope to the smallest slice that ships",
  "spike the risky part first and throw the spike away",
  "reuse what the team already has before writing anything new",
  "write the interface down and agree it before the implementation",
  "measure the current behaviour first so the change can be judged",
];
const RISKS = [
  "the estimate hides an unknown in the integration",
  "the change touches what another team owns",
  "the tests do not cover the path that matters",
  "the rollback is harder than the rollout",
];
const STANCES: CouncilStance[] = ["agree", "differ", "add"];

/** A stable number in [0, 2^32) from the task and the member. */
function councilSeed(task: string, member: CouncilMember, salt = ""): number {
  return Number.parseInt(hashValue({ task, member: member.profileId, salt }).slice(0, 8), 16);
}

/** The stance the scripted member takes in a discussion: a function of the task and the member. */
export function scriptedStance(task: string, member: CouncilMember): CouncilStance {
  return STANCES[councilSeed(task, member, "stance") % STANCES.length] ?? "agree";
}

/** The approach and the risk the scripted member names: a function of the task and the member. */
export function scriptedApproach(
  task: string,
  member: CouncilMember,
): { approach: string; risk: string } {
  const n = councilSeed(task, member);
  return {
    approach: APPROACHES[n % APPROACHES.length] ?? APPROACHES[0] ?? "",
    risk: RISKS[Math.floor(n / APPROACHES.length) % RISKS.length] ?? RISKS[0] ?? "",
  };
}

/** "instructed by Ana" for each person whose private instruction the member answers. */
function citeInstructions(ctx: CouncilContext): string {
  if (!ctx.instructions.length) return "";
  const names = [...new Set(ctx.instructions.map((i) => i.by))];
  return ` (instructed by ${names.join(", ")}: ${ctx.instructions.map((i) => i.text).join("; ")})`;
}

function councilDecision(ctx: CouncilContext): Decision {
  const me = ctx.member;
  const { approach, risk } = scriptedApproach(ctx.task, me);
  switch (ctx.round) {
    case "individual":
      return {
        text: `${me.name} on "${ctx.task}": I would ${approach}. First step: write down what done looks like. Main risk: ${risk}.${citeInstructions(ctx)}`,
        toolCalls: [],
        done: true,
      };
    case "discussion": {
      const stance = scriptedStance(ctx.task, me);
      const others = ctx.answers.filter((a) => a.member.profileId !== me.profileId);
      const first = others[0];
      const word = stance.toUpperCase();
      const reason = !first
        ? `Nobody else has spoken; I hold to: ${approach}.`
        : stance === "agree"
          ? `${first.member.name} has it right; I would ${approach} as well.`
          : stance === "differ"
            ? `${first.member.name} starts elsewhere; I would ${approach}, because ${risk}.`
            : `To what ${first.member.name} said I add: ${approach}.`;
      return {
        text: `${word}\n${reason}${citeInstructions(ctx)}`,
        toolCalls: [],
        done: true,
      };
    }
    case "synthesis": {
      const members = ctx.members;
      const n = members.length;
      const steps = [
        ...members.map((m, i) => {
          const a = scriptedApproach(ctx.task, m);
          return {
            id: `s${i + 1}`,
            title: `${a.approach[0]?.toUpperCase()}${a.approach.slice(1)}`,
            detail: `From ${m.name}'s answer; watch that ${a.risk}.`,
            estTokens: 400 + (councilSeed(ctx.task, m, "est") % 5) * 100,
            risk: "write",
            owner: (members[i % n] ?? ctx.chair).profileId,
          };
        }),
        {
          id: `s${n + 1}`,
          title: "Run the tests and report back to the council",
          detail: "Every owner reports its step done, blocked or revised.",
          estTokens: 300,
          risk: "exec",
          owner: (members[n % n] ?? ctx.chair).profileId,
        },
      ];
      const dissent = ctx.answers
        .filter((a) => a.round === "discussion" && a.stance === "differ")
        .filter(
          (a, i, all) => all.findIndex((b) => b.member.profileId === a.member.profileId) === i,
        )
        .map((a) => ({
          member: a.member.profileId,
          text: a.text.split("\n").slice(1).join(" ") || a.text,
        }));
      return {
        text: `The council settles on ${steps.length} steps, one per member and a last one to verify; ${dissent.length ? `${dissent.length} dissent${dissent.length > 1 ? "s" : ""} recorded` : "no dissent"}.${citeInstructions(ctx)}`,
        toolCalls: [
          {
            id: `c${ctx.index}_synth`,
            name: COUNCIL_SYNTHESIS_TOOL,
            args: {
              steps,
              rationale: "One step per answer, owners dealt in turn, tests before anything ships.",
              dissent,
            },
            risk: "read",
          },
        ],
        done: true,
      };
    }
    case "vote":
      return { text: "The people vote; I have nothing to add.", toolCalls: [], done: true };
  }
}

function decide(req: ModelRequest): Decision {
  if (req.council) return councilDecision(req.council);
  const intentKey = hashValue({
    goal: req.intent.goal?.text ?? null,
    steers: req.intent.steers,
    constraints: req.intent.constraints.map((c) => c.text),
  }).slice(0, 12);
  const files = new Set(req.files);
  const texts = [
    req.intent.goal?.text ?? "",
    ...Object.values(req.intent.steers).map((s) => s.text),
  ]
    .join(" ")
    .toLowerCase();
  const python = /\bpython\b/.test(texts);
  const module = slug(req.intent.goal?.text ?? "feature");
  const src = python ? `src/${module}.py` : `src/${module}.mjs`;
  const test = python ? `tests/test_${module}.py` : `test/${module}.test.mjs`;
  const wantsDeploy = /\bdeploy\b/.test(texts);
  const calls: ToolCall[] = [];
  const id = (n: number) => `t${req.turn}_${n}`;

  // Plan first: propose the steps before any work, and again when asked to revise.
  if (req.planFirst && req.needsPlan) {
    const revised = req.plan !== null;
    const steps = [
      {
        id: "s1",
        title: `Write ${src}`,
        detail: `The module and ${PLAN} from the team's direction`,
        estTokens: 600,
        risk: "write",
      },
      {
        id: "s2",
        title: `Write and run ${test}`,
        detail: "A test for the module, run through the shell",
        estTokens: 900,
        risk: "exec",
      },
      ...(wantsDeploy
        ? [
            {
              id: "s3",
              title: "Deploy to production",
              detail: "Only after the tests pass",
              estTokens: 300,
              risk: "irreversible",
            },
          ]
        : []),
    ];
    return {
      text: revised
        ? `Revised plan for ${module}, as the team asked.`
        : `Proposing a plan for ${module} before writing anything.`,
      toolCalls: [
        {
          id: id(0),
          name: "plan.propose",
          args: {
            steps,
            rationale: revised
              ? "The same steps, restated; tests run before anything ships."
              : "Small steps; tests run before anything ships.",
          },
          risk: "read",
        },
      ],
      done: false,
    };
  }
  /** The plan.step call for a step we are about to work on, when it has not started yet. */
  const stepCall = (stepId: string): ToolCall[] => {
    const st = req.plan?.steps.find((x) => x.id === stepId);
    return req.plan?.status === "approved" && st?.status === "pending"
      ? [{ id: `${id(9)}_${stepId}`, name: "plan.step", args: { stepId }, risk: "read" }]
      : [];
  };

  // What has this turn already done?
  const didThisTurn = new Set<string>();
  for (const e of req.transcript)
    if (e.role === "assistant")
      for (const c of e.toolCalls)
        didThisTurn.add(`${c.name}:${String(c.args.path ?? c.args.command ?? c.args.env ?? "")}`);
  const lastResults = [...req.transcript].reverse().find((e) => e.role === "tool");
  const lastFailed = lastResults?.role === "tool" && lastResults.results.some((r) => !r.ok);

  // Step 1: plan reflects the current intent.
  const planStale = !files.has(PLAN) || !req.history.some((h) => h.includes(`plan ${intentKey}`));
  if (planStale && !didThisTurn.has(`workspace.write:${PLAN}`)) {
    const lines = [
      `# Plan (intent ${intentKey})`,
      "",
      `Goal: ${req.intent.goal?.text ?? "(none)"}`,
      ...Object.entries(req.intent.steers)
        .sort()
        .map(([k, v]) => `- [${k}] ${v.text}`),
      ...(req.intent.constraints.length
        ? ["", "Constraints:", ...req.intent.constraints.map((c) => `- ${c.text}`)]
        : []),
      "",
      `Steps: write ${src}; write ${test}; run tests${wantsDeploy ? "; deploy" : ""}.`,
      "",
    ];
    calls.push(...stepCall("s1"));
    calls.push({
      id: id(1),
      name: "workspace.write",
      args: { path: PLAN, content: lines.join("\n") },
      risk: "write",
    });
    // Rewrite the module alongside the plan so it reflects the new intent.
    calls.push({
      id: id(2),
      name: "workspace.write",
      args: { path: src, content: moduleSource(python, module, req) },
      risk: "write",
    });
    return {
      text: `Updating plan ${intentKey} and ${src} to match the team's direction.`,
      toolCalls: calls,
      done: false,
    };
  }

  if (!files.has(src) && !didThisTurn.has(`workspace.write:${src}`)) {
    calls.push(...stepCall("s1"));
    calls.push({
      id: id(3),
      name: "workspace.write",
      args: { path: src, content: moduleSource(python, module, req) },
      risk: "write",
    });
    return { text: `Writing ${src}.`, toolCalls: calls, done: false };
  }
  if (!files.has(test) && !didThisTurn.has(`workspace.write:${test}`)) {
    calls.push(...stepCall("s2"));
    if (req.tools.some((t) => t.name === "memory.remember")) {
      calls.push({
        id: id(7),
        name: "memory.remember",
        args: {
          key: `module.${module}`,
          content: `${module} lives in ${src}; tests in ${test}`,
          kind: "fact",
          evidence: [src],
        },
        risk: "write",
      });
    }
    calls.push({
      id: id(4),
      name: "workspace.write",
      args: { path: test, content: testSource(python, module, src) },
      risk: "write",
    });
    return { text: `Writing ${test}.`, toolCalls: calls, done: false };
  }
  const ranTests =
    req.history.some((h) => h.includes(`tests ${intentKey}`)) ||
    didThisTurn.has("shell.run:node") ||
    didThisTurn.has("shell.run:python3");
  if (!ranTests) {
    if (lastFailed)
      return {
        text: "The test run was refused; stopping here until the team decides.",
        toolCalls: [],
        done: true,
      };
    calls.push(...stepCall("s2"));
    calls.push(
      python
        ? {
            id: id(5),
            name: "shell.run",
            args: { command: "python3", args: [test] },
            risk: "exec",
          }
        : {
            id: id(5),
            name: "shell.run",
            args: { command: "node", args: ["--test", test] },
            risk: "exec",
          },
    );
    return { text: `Running tests ${intentKey}.`, toolCalls: calls, done: false };
  }
  if (wantsDeploy && !files.has(".deployments/production.log")) {
    if (didThisTurn.has("deploy:production")) {
      return {
        text: lastFailed
          ? "Deployment was denied by the team; not retrying."
          : "Deployment finished.",
        toolCalls: [],
        done: true,
      };
    }
    calls.push(...stepCall("s3"));
    calls.push({ id: id(6), name: "deploy", args: { env: "production" }, risk: "irreversible" });
    return {
      text: "Tests pass; deploying to production as directed.",
      toolCalls: calls,
      done: false,
    };
  }
  return {
    text: `Done: plan ${intentKey}, module, tests ${intentKey} complete.`,
    toolCalls: [],
    done: true,
  };
}

function moduleSource(python: boolean, module: string, req: ModelRequest): string {
  const steers = Object.entries(req.intent.steers)
    .sort()
    .map(([k, v]) => `${k}: ${v.text}`);
  const constraints = req.intent.constraints.map((c) => c.text);
  if (python) {
    return [
      `"""${module}: ${req.intent.goal?.text ?? ""}"""`,
      ...steers.map((s) => `# direction ${s}`),
      ...constraints.map((c) => `# constraint ${c}`),
      "",
      "",
      `def ${module}(x: int) -> int:`,
      "    return x * 2",
      "",
    ].join("\n");
  }
  return [
    `// ${module}: ${req.intent.goal?.text ?? ""}`,
    ...steers.map((s) => `// direction ${s}`),
    ...constraints.map((c) => `// constraint ${c}`),
    `export function ${module}(x) {`,
    "  return x * 2;",
    "}",
    "",
  ].join("\n");
}

function testSource(python: boolean, module: string, src: string): string {
  if (python) {
    return [
      "import sys",
      "sys.path.insert(0, 'src')",
      `from ${module} import ${module}`,
      "",
      `assert ${module}(2) == 4`,
      "print('ok')",
      "",
    ].join("\n");
  }
  return [
    'import { test } from "node:test";',
    'import assert from "node:assert/strict";',
    `import { ${module} } from "../${src}";`,
    "",
    `test("${module}", () => { assert.equal(${module}(2), 4); });`,
    "",
  ].join("\n");
}

/** A rough token count for text: four characters per token, like a real tokenizer on prose. */
function tokensOf(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Deterministic usage for the scripted model: a function of what the prompt would have held
 * (intent, history, files, this turn's transcript) and of the text and tool calls it emits.
 * The system prompt is a fixed 64 tokens; within a turn the earlier transcript reads from
 * cache, and the first call of a turn writes the prefix to it. Same request, same numbers.
 */
export function syntheticUsage(req: ModelRequest, text: string, toolCalls: ToolCall[]): Usage {
  const SYSTEM = 64;
  const prefix =
    SYSTEM +
    tokensOf(req.title) +
    tokensOf(req.intentText) +
    tokensOf(req.history.join("\n")) +
    tokensOf(req.files.join("\n")) +
    tokensOf(req.newDirectives.join("\n")) +
    tokensOf(JSON.stringify(req.tools));
  const transcript = tokensOf(JSON.stringify(req.transcript));
  const cacheRead = req.transcript.length ? prefix : 0;
  const cacheWrite = req.transcript.length ? 0 : prefix;
  return {
    input: prefix + transcript,
    output: tokensOf(text) + tokensOf(JSON.stringify(toolCalls)),
    cacheRead,
    cacheWrite,
  };
}
