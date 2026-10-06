/**
 * A deterministic, rule-based stand-in for a coding model. It behaves like a cautious junior
 * engineer: writes a plan from the composed intent, writes a module and a test, runs the test
 * through the shell (which needs approval), and deploys only when told to. It is a pure
 * function of the request, so offline demos and tests are reproducible.
 */
import { hashValue } from "@henosis/kernel";
import type { ToolCall, Usage } from "@henosis/protocol";
import type { Model, ModelRequest, ModelResponse } from "./model.js";

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

export class ScriptedModel implements Model {
  readonly name = "scripted-v1";

  async complete(req: ModelRequest): Promise<ModelResponse> {
    const res = this.decide(req);
    return { ...res, usage: syntheticUsage(req, res.text, res.toolCalls) };
  }

  private decide(req: ModelRequest): ModelResponse {
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
    const calls: ModelResponse["toolCalls"] = [];
    const id = (n: number) => `t${req.turn}_${n}`;

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
      calls.push({
        id: id(3),
        name: "workspace.write",
        args: { path: src, content: moduleSource(python, module, req) },
        risk: "write",
      });
      return { text: `Writing ${src}.`, toolCalls: calls, done: false };
    }
    if (!files.has(test) && !didThisTurn.has(`workspace.write:${test}`)) {
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
