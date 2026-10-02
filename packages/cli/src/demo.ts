/**
 * Offline demo: a scripted team works one agent session through every multiplayer primitive.
 * No network, no model API; the scripted model and deterministic ids make it reproducible.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkReplay, handoffBrief, type Session } from "@atelier/kernel";
import {
  type Actor,
  DEFAULT_APPROVAL_POLICY,
  MAIN_BRANCH,
  type SessionEvent,
} from "@atelier/protocol";
import { defaultTools, Runner, ScriptedModel } from "@atelier/runner";
import { ProjectHost, SessionHost } from "@atelier/server";
import { renderReport } from "./report.js";

const ana: Actor = { id: "ana", kind: "human", name: "Ana" };
const bo: Actor = { id: "bo", kind: "human", name: "Bo" };
const cy: Actor = { id: "cy", kind: "human", name: "Cy" };
const dee: Actor = { id: "dee", kind: "human", name: "Dee" };
const M = MAIN_BRANCH;

export interface DemoResult {
  dir: string;
  narrative: string[];
  ok: boolean;
}

export async function runDemo(
  root: string,
  print: (line: string) => void = () => {},
): Promise<DemoResult> {
  const narrative: string[] = [];
  const say = (line: string) => {
    narrative.push(line);
    print(line);
  };
  const host = new SessionHost({
    root,
    sessionId: "demo",
    model: new ScriptedModel(),
    tools: defaultTools(),
    create: {
      title: "Ship the doubling helper",
      policy: { approvals: DEFAULT_APPROVAL_POLICY, contention: "block", maxTurns: 60 },
    },
  });
  const s: Session = host.session;
  const agent: Actor = { id: "agent", kind: "agent", name: "Agent" };
  const runner = new Runner(s, M, agent, new ScriptedModel(), defaultTools(), {
    maxStepsPerTurn: 1,
  });

  // Teammates who vote when asked.
  s.onEvent((e: SessionEvent) => {
    if (e.kind !== "approval.requested") return;
    queueMicrotask(() => {
      const voters = e.payload.call.risk === "irreversible" ? ["ana", "cy"] : ["bo"];
      for (const v of voters) {
        try {
          s.vote(e.branch, v, e.payload.approvalId, "approve");
          say(`  ${v} approved ${e.payload.call.name} (${e.payload.call.risk})`);
        } catch (err) {
          say(`  ${v} could not vote: ${(err as Error).message}`);
        }
      }
    });
  });

  say("# Atelier demo: one agent, four humans, one session");
  s.join(M, ana, "owner");
  s.join(M, bo, "contributor");
  s.join(M, cy, "contributor");
  s.join(M, dee, "observer");
  say(`Ana (owner) is the driver. Bo and Cy contribute. Dee observes.`);

  s.directive(M, "ana", { text: "Build a doubling helper, run its tests, and deploy it" });
  s.directive(M, "bo", { text: "No external dependencies", mode: "constrain" });
  say(`Ana sets the goal; Bo adds a standing constraint.`);
  try {
    s.directive(M, "dee", { text: "Rewrite it in Rust" });
  } catch (err) {
    say(`Dee (observer) tries to steer and is refused: ${(err as Error).message}`);
  }

  say("\n## Turn 1: the agent plans and starts writing");
  await runner.runTurn();
  say(`  ${describeTurn(s)}`);

  say("\n## Concurrent peers disagree: a contention, not a silent override");
  s.directive(M, "bo", { text: "Use arrow functions", scope: "style" });
  s.directive(M, "cy", { text: "Use function declarations", scope: "style" });
  const ctn = Object.values(s.state().contentions).find((c) => !c.resolved);
  say(
    `  Bo and Cy both steer [style] in the same epoch -> contention ${ctn?.id} on scope "style".`,
  );
  say(`  Intent now lists [style] as under discussion; the agent keeps working on other scopes.`);
  await runner.runTurn();
  say(`  ${describeTurn(s)}`);
  say(
    `  PLAN.md mentions style? ${s.readFile(M, "PLAN.md")?.includes("[style]") ? "yes (BUG)" : "no, it is withheld until resolved"}`,
  );
  if (ctn) {
    const winner = ctn.directiveIds.find((id) => s.state().directives[id]?.author === "cy") ?? null;
    s.resolve(M, "ana", ctn.id, winner);
    say(`  Ana (driver) resolves it in Cy's favour; Bo's directive is superseded.`);
  }

  say("\n## Approvals: exec needs one contributor, deploy needs two drivers");
  s.setRole(M, "ana", "cy", "driver");
  say("  Ana makes Cy a second driver so the deploy quorum can be met.");
  await runner.drive();
  say(`  ${describeTurn(s)}`);
  for (const a of Object.values(s.state().approvals)) {
    say(
      `  approval ${a.id}: ${a.call.name} [${a.call.risk}] -> ${a.status} (${Object.entries(a.votes)
        .map(([k, v]) => `${k}:${v}`)
        .join(", ")})`,
    );
  }

  say("\n## Fork: Cy explores a Python version without disturbing main");
  s.fork(M, "cy", "python-spike");
  s.join("python-spike", cy, "contributor");
  s.directive("python-spike", "cy", { text: "Write it in Python", scope: "language" });
  const spike = new Runner(s, "python-spike", agent, new ScriptedModel(), defaultTools());
  await spike.drive();
  say(`  python-spike: ${Object.keys(s.state("python-spike").workspace).sort().join(", ")}`);

  say("\n## Merge: workspace three-way merge plus directive carry-over");
  s.merge(M, "ana", "python-spike");
  const after = s.state();
  say(
    `  main now has ${Object.keys(after.workspace).length} files; conflicts: ${after.openConflicts.join(", ") || "none"}`,
  );
  say(
    `  carried directives re-enter arbitration: steers=${Object.keys(after.intent.steers).join(",")} contended=${after.intent.contendedScopes.join(",") || "none"}`,
  );

  say("\n## Pause, redirect, resume");
  s.directive(M, "bo", { text: "hold on, reviewing", mode: "pause" });
  say(`  Bo pauses: status=${s.state().status}`);
  s.directive(M, "ana", { text: "carry on", mode: "resume" });
  say(`  Ana resumes: status=${s.state().status}`);

  say("\n## Handoff: Ana leaves, Bo takes the wheel with a generated brief");
  const h = s.requestHandoff(M, "ana", "bo");
  if (h.kind === "handoff.requested") s.acceptHandoff(M, "bo", h.payload.handoffId);
  s.leave(M, "ana");
  const brief = handoffBrief(s.state(), { forActor: "bo", events: s.events(M) });
  say(`  driver=${s.state().driver}; brief is ${brief.split("\n").length} lines`);

  say("\n## Fleet: two engineers' agents in one project");
  const fleet = new ProjectHost({
    root,
    projectId: "billing",
    orgId: "northwind",
    teamId: "payments",
    name: "Billing page",
    model: new ScriptedModel(),
    tools: defaultTools(),
    sessionPolicy: {
      approvals: {
        read: "none",
        write: "none",
        exec: "none",
        external: "none",
        irreversible: "none",
      },
      contention: "block",
      maxTurns: 40,
    },
  });
  fleet.project.join("dee", "Dee", "lead");
  const sa = fleet.session("fleet-ana", { title: "Invoice PDF", ownerId: "ana" });
  const sb = fleet.session("fleet-bo", { title: "Tax lines", ownerId: "bo" });
  sa.session.join(M, ana, "owner");
  sb.session.join(M, bo, "owner");
  sa.session.directive(M, "ana", { text: "Build a doubling helper" });
  await sa.drive(M);
  say(
    `  Ana's agent wrote ${Object.keys(sa.session.state().workspace).length} files and auto-claimed them.`,
  );
  sb.session.directive(M, "bo", { text: "Build a doubling helper" });
  await sb.drive(M);
  const blocked = sb.session.state().blockedWrites;
  say(
    `  Bo's agent tried the same files: ${blocked.length} writes refused (first: ${blocked[0]?.path}, held by ${blocked[0]?.holderSessionId}).`,
  );
  fleet.project.directive("dee", { text: "schema freeze until Thursday", mode: "constrain" });
  say(
    `  Dee (lead) issues a project constraint; both sessions now carry it: ${[sa, sb].every((h) => h.session.state().intent.constraints.some((c) => c.origin === "project"))}`,
  );
  const fb = fleet.brief();
  say(
    `  Fleet brief is ${fb.split("\n").length} lines; ledger chain ok: ${fleet.project.ledger.verify().ok}`,
  );
  fleet.close();
  writeFileSync(join(root, "projects", "billing", "fleet-brief.md"), fb);

  say("\n## Verification");
  const check = checkReplay(s.log, M);
  say(
    `  hash chain: ${check.chain.ok ? "ok" : "BROKEN"}; full replay == snapshot resume: ${check.fullHash === check.resumedHash}`,
  );
  host.flush();
  host.close();

  const dir = join(root, "sessions", "demo");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "brief.md"), brief);
  writeFileSync(join(dir, "report.md"), renderReport(s));
  writeFileSync(join(dir, "narrative.md"), `${narrative.join("\n")}\n`);
  say(
    `\nWrote ${dir}/{log.json,brief.md,report.md,narrative.md} and ${root}/projects/billing/{ledger.json,fleet-brief.md}`,
  );
  return { dir, narrative, ok: check.ok };
}

function describeTurn(s: Session): string {
  const st = s.state();
  const t = st.turns[st.turns.length - 1];
  if (!t) return "no turn";
  return `turn ${t.turn} ${t.reason}: ${t.summary} | files: ${Object.keys(st.workspace).sort().join(", ") || "none"}`;
}
