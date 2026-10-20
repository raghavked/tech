import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Session, stateHash } from "@henosis/kernel";
import { type Actor, DEFAULT_APPROVAL_POLICY, MAIN_BRANCH } from "@henosis/protocol";
import { describe, expect, it } from "vitest";
import { MASK, maskSecrets, paperModel, roleWord, rowCount, shortHash } from "./print.js";

const M = MAIN_BRANCH;
const ana: Actor = { id: "ana", kind: "human", name: "Ana" };
const bo: Actor = { id: "bo", kind: "human", name: "Bo" };
const cy: Actor = { id: "cy", kind: "human", name: "Cy" };
const dee: Actor = { id: "dee", kind: "human", name: "Dee" };
const agent: Actor = { id: "agent", kind: "agent", name: "s1 agent" };
const policy = {
  approvals: DEFAULT_APPROVAL_POLICY,
  contention: "block" as const,
  maxTurns: 50,
  planFirst: true,
  planApproval: { min: 2, average: 3 },
  tokenBudget: 20_000,
};

/**
 * A session with everything paper has a rule for: a goal, a plan rated by two people and approved
 * by the fold, a tool step with a secret in its arguments, a handoff that changes who is driving,
 * a release gate with a rated vote, an unrated voice and the kernel's grant, a fork left alone,
 * and team chat.
 */
function build() {
  const s = Session.create("s1", "Invoice PDF", policy, { ownerId: "ana" });
  s.join(M, ana, "owner");
  s.join(M, agent, "contributor");
  s.join(M, bo, "contributor");
  s.join(M, cy, "contributor");
  s.join(M, dee, "observer");
  s.directive(M, "ana", { text: "One line per tax rate; cents match Checkout." });
  s.proposePlan(M, "agent", {
    steps: [
      { title: "Group lines by rate", estTokens: 4000, risk: "write" },
      { title: "Deploy the layout", estTokens: 6000, risk: "irreversible" },
    ],
  });
  const planId = s.state().activePlanId ?? "";
  s.ratePlan(M, "bo", planId, 4, "reuse prorate, yes");
  s.ratePlan(M, "cy", planId, 5);
  // The plan is approved by the fold (2 at 3+). The agent works: a shell step with a secret.
  s.turnStarted(M, "agent");
  const call = {
    id: "c1",
    name: "shell.run",
    args: { command: "STRIPE_KEY=sk_live_abcdef123456 pnpm fixtures:pull" },
    risk: "read" as const,
  };
  s.modelCompleted(M, "agent", "Pulling the fixtures.", [call], "scripted", {
    input: 1200,
    output: 300,
    cacheRead: 0,
    cacheWrite: 0,
  });
  s.toolRequested(M, "agent", call);
  s.toolCompleted(M, "agent", { callId: "c1", ok: true, output: "212 fixtures" });
  s.turnEnded(M, "agent", "done", "Fixtures pulled.");
  // Ana hands the baton to Bo: from here Bo's acts carry "driving".
  const h = s.requestHandoff(M, "ana", "bo");
  s.acceptHandoff(M, "bo", h.kind === "handoff.requested" ? h.payload.handoffId : "");
  // The release gate: two contributors at 4+. Dee is an observer: a voice, not a vote.
  s.turnStarted(M, "agent");
  const deploy = {
    id: "c2",
    name: "deploy",
    args: { env: "production" },
    risk: "irreversible" as const,
  };
  const approvalId = s.requestApproval(M, "agent", deploy) ?? "";
  s.vote(M, "dee", approvalId, "approve");
  s.vote(M, "bo", approvalId, "approve", 4);
  s.vote(M, "cy", approvalId, "approve", 5, "parity test is the proof");
  s.turnEnded(M, "agent", "done", "Deployed.");
  s.note(M, "bo", "Cy, can you take tests?");
  s.fork(M, "ana", "try/rounding");
  return s;
}

const opts = {
  door: "audit" as const,
  exportedBy: "Bo",
  exportedById: "bo",
  exportedAt: 0,
  agentName: "Ana's agent",
};

describe("maskSecrets", () => {
  it("masks keyed values, bearer tokens and vendor keys, and counts them", () => {
    const r = maskSecrets(
      'STRIPE_KEY=sk_live_abcdef123456 curl -H "Authorization: Bearer eyJhbGciOi" {"token":"t0k3n","path":"a.ts"}',
    );
    expect(r.text).toBe(
      `STRIPE_KEY=${MASK} curl -H "Authorization: Bearer ${MASK}" {"token":${MASK},"path":"a.ts"}`,
    );
    expect(r.masked).toBe(3);
  });
  it("leaves ordinary text alone", () => {
    expect(maskSecrets("read invoice/render.ts · monkey=banana")).toEqual({
      text: "read invoice/render.ts · monkey=banana",
      masked: 0,
    });
  });
});

describe("paperModel", () => {
  it("names people with the role they had at that moment", () => {
    const s = build();
    const m = paperModel(s.state(), s.events(), opts);
    const rows = (who: string, did: RegExp) =>
      m.ledger.filter((r) => r.who === who && did.test(r.did));
    // Bo rated the plan as a contributor and voted at the gate while driving.
    expect(rows("Bo", /^Rated the plan/)[0]?.role).toBe("contributor");
    expect(rows("Bo", /^Approved/)[0]?.role).toBe("driving");
    // Ana opened the session as its owner and was driving when she steered.
    expect(rows("Ana", /^Opened/)[0]?.role).toBe("owner");
    expect(rows("Ana", /^Steered goal/)[0]?.role).toBe("driving");
    // The agent is named by the stream's name and carries the agent word.
    expect(rows("Ana's agent", /^Proposed a plan/)[0]?.role).toBe("agent");
    expect(roleWord(s.state(), "bo")).toBe("driving");
  });

  it("prints the kernel's decisions as green rows with the rule inline", () => {
    const s = build();
    const m = paperModel(s.state(), s.events(), opts);
    const kernel = m.ledger.filter((r) => r.kernel);
    expect(kernel.map((r) => r.did)).toEqual(["Plan approved", "Gate granted"]);
    expect(kernel[0]?.rule).toBe("2 at 3+ · got 2, avg 4.5");
    expect(kernel[1]?.rule).toBe(
      "2 contributors or above rating it 4+ of 5 on average · got 2, avg 4.5",
    );
    expect(kernel.every((r) => r.who === "kernel" && r.evidence.kind === "ok")).toBe(true);
    // The gate's ask carries the stripe; the observer's approval is a voice, not a vote.
    expect(m.ledger.find((r) => r.gate)?.did).toMatch(
      /^Asked the release gate: deploy to production/,
    );
    expect(m.ledger.find((r) => r.who === "Dee" && /^Approved/.test(r.did))?.did).toBe(
      "Approved · a voice, not a vote",
    );
    // Ratings print as stars with the number; a note as the quote.
    const cyVote = m.ledger.find((r) => r.who === "Cy" && /^Approved/.test(r.did));
    expect(cyVote?.evidence).toEqual({ kind: "stars", rating: 5 });
    expect(cyVote?.quote).toBe("parity test is the proof");
  });

  it("masks the secret in the tool step, in amber, and counts it on both documents", () => {
    const s = build();
    const m = paperModel(s.state(), s.events(), { ...opts, door: "session" });
    expect(m.masked).toBe(1);
    const agentRow = m.rows.find((r) => r.kind === "agent" && r.steps.length);
    expect(agentRow?.kind).toBe("agent");
    if (agentRow?.kind !== "agent") return;
    expect(agentRow.steps[0]?.text).toBe(`Ran shell: STRIPE_KEY=${MASK} pnpm fixtures:pull`);
    expect(agentRow.steps[0]?.masked).toBe(1);
    const turn = m.ledger.find((r) => /^Finished turn 1/.test(r.did));
    expect(turn?.masked).toBe(1);
    expect(JSON.stringify(m)).not.toContain("sk_live");
  });

  it("says what it leaves out in one line each: team chat, the fork, folded steps", () => {
    const s = build();
    const m = paperModel(s.state(), s.events(), opts);
    expect(m.omissions).toEqual([
      "Team chat, 1 message, stays in the circle.",
      `Branch try/rounding, forked at #${s.state().branches["try/rounding"]?.seq}, never united, not printed.`,
      "1 tool step folded to one line each; the full text is in the log.",
    ]);
    expect(m.ledger.some((r) => r.did === "Said to the team")).toBe(false);
    expect(m.rows.some((r) => r.kind === "human" && /Cy, can you/.test(r.text))).toBe(false);
    // Included, the chat is a row on both documents and the omission line goes.
    const withChat = paperModel(s.state(), s.events(), { ...opts, include: { chat: true } });
    expect(withChat.omissions[0]).not.toMatch(/Team chat/);
    expect(withChat.ledger.find((r) => r.did === "Said to the team")?.quote).toBe(
      "Cy, can you take tests?",
    );
  });

  it("ends both documents with the verify hash and the export's own row", () => {
    const s = build();
    const audit = paperModel(s.state(), s.events(), opts);
    const session = paperModel(s.state(), s.events(), { ...opts, door: "session" });
    // The hash is the fold's, as `henosis verify` prints it: twelve hex, the same on both.
    expect(audit.hash).toBe(stateHash(s.state()));
    expect(session.hash).toBe(audit.hash);
    expect(audit.verifyCommand).toBe(
      `henosis verify sessions/s1/log.json → ${audit.hash.slice(0, 12)}`,
    );
    expect(shortHash(audit.hash)).toHaveLength(12);
    expect(audit.head).toBe(s.state().head);
    // The export is itself the last row of the ledger, on the cream band, in the exporter's role.
    const last = audit.ledger.at(-1);
    expect(last).toMatchObject({
      who: "Bo",
      role: "driving",
      exported: true,
      did: "Printed the audit trail, this page",
    });
    expect(session.ledger.at(-1)?.did).toBe("Exported the session, this page");
    expect(rowCount(audit, "audit")).toBe(audit.ledger.length);
    expect(rowCount(audit, "session")).toBe(audit.rows.length);
  });

  it("carries the plan with its ratings and the gate with its votes as whole rows", () => {
    const s = build();
    const m = paperModel(s.state(), s.events(), { ...opts, door: "session" });
    const plan = m.rows.find((r) => r.kind === "plan");
    expect(plan?.kind).toBe("plan");
    if (plan?.kind !== "plan") return;
    expect(plan.status).toBe("Approved · by the team's ratings");
    expect(plan.ratings).toEqual([
      { who: "Bo", role: "driving", rating: 4, note: "reuse prorate, yes" },
      { who: "Cy", role: "contributor", rating: 5, note: "" },
    ]);
    const gate = m.rows.find((r) => r.kind === "gate");
    expect(gate?.kind).toBe("gate");
    if (gate?.kind !== "gate") return;
    expect(gate.gate).toBe(true);
    expect(gate.votes.map((v) => [v.who, v.role, v.rating, v.voice])).toEqual([
      ["Dee", "observer", null, true],
      ["Bo", "driving", 4, false],
      ["Cy", "contributor", 5, false],
    ]);
    expect(gate.outcome).toMatch(/^Gate granted · 2 contributors or above/);
    expect(m.facts.map((f) => f.v)).toEqual(["2", "1.5k", "0/2", "0"]);
    expect(m.counts.map((c) => c.v)).toEqual(["yes", "1 / 1", "4", "0", "1.5k", "4 · 1"]);
  });
});

describe("print.css", () => {
  const css = readFileSync(fileURLToPath(new URL("./print.css", import.meta.url)), "utf8");
  it("colours the mark only through custom properties, never by reaching inside it", () => {
    // No rule selects the mark's parts: a `<use>` could not be styled that way (MOTION.md §4.3).
    expect(css).not.toMatch(/\.mark\s+\.(disc|arc|dot)|\.(disc|arc|dot)\s*\{/);
    expect(css).not.toMatch(/\.mark[^{]*\{[^}]*\b(fill|stroke)\s*:/);
    // Every colour the mark takes on paper is a `--mark-*` property.
    const markRules = css.match(/\.paper \.mark \{[^}]*\}/g) ?? [];
    expect(markRules.length).toBeGreaterThan(0);
    for (const rule of markRules)
      for (const line of rule.split("\n").slice(1, -1))
        expect(line.trim()).toMatch(/^--mark-(disc|arc-a|arc-b|dot|dash):/);
  });
  it("is paper: its own tokens, light colour scheme, A4, no apricot, gradient or shadow in print", () => {
    expect(css).toMatch(/\.paper \{[^}]*color-scheme: light/);
    expect(css).toMatch(/@page \{\s*size: A4;\s*margin: 16mm 14mm;/);
    expect(css).not.toMatch(/--apricot|--gradient|--accent\b/);
    const print = css.slice(css.indexOf("@media print"));
    expect(print).not.toMatch(/box-shadow:\s*(?!none\b)\S/);
    // Rows never split: the plan, the gate, a message and a ledger row keep together.
    expect(print).toMatch(
      /\.p-plan,[\s\S]*\.p-gate,[\s\S]*\.p-ledger tr[\s\S]*break-inside: avoid/,
    );
    expect(print).toMatch(/\.p-ledger thead \{\s*display: table-header-group/);
  });
});
