import { type Actor, DEFAULT_APPROVAL_POLICY, MAIN_BRANCH } from "@quorum/protocol";
import { describe, expect, it } from "vitest";
import { handoffBrief } from "../src/brief.js";
import { checkReplay, replayBranch, resumeFrom, stateHash } from "../src/replay.js";
import { KernelError, Session } from "../src/session.js";

const policy = { approvals: DEFAULT_APPROVAL_POLICY, contention: "block" as const, maxTurns: 50 };
const ana: Actor = { id: "ana", kind: "human", name: "Ana" };
const bo: Actor = { id: "bo", kind: "human", name: "Bo" };
const cy: Actor = { id: "cy", kind: "human", name: "Cy" };
const bot: Actor = { id: "agent", kind: "agent", name: "Agent" };
const M = MAIN_BRANCH;

function setup() {
  const s = Session.create("s1", "Ship the billing page", policy);
  s.join(M, bot, "contributor");
  s.join(M, ana, "owner");
  s.join(M, bo, "contributor");
  s.join(M, cy, "contributor");
  return s;
}

function id(ev: ReturnType<Session["directive"]>): string {
  if (ev.kind !== "directive.submitted") throw new Error("not a directive");
  return ev.payload.directiveId;
}

describe("session commands", () => {
  it("owner joining first becomes driver; observers cannot steer", () => {
    const s = setup();
    expect(s.state().driver).toBe("ana");
    s.join(M, { id: "ol", kind: "human", name: "Ollie" }, "observer");
    expect(() => s.directive(M, "ol", { text: "do x" })).toThrow(KernelError);
    expect(() => s.directive(M, "nobody", { text: "do x" })).toThrow(/not a participant/);
  });

  it("walks a contention from submission to resolution", () => {
    const s = setup();
    s.directive(M, "ana", { text: "Build the billing page with Stripe" });
    s.turnStarted(M, "agent");
    s.turnEnded(M, "agent", "done", "scaffolded");
    const a = id(s.directive(M, "bo", { text: "Use tabs for plans", scope: "ui" }));
    const b = id(s.directive(M, "cy", { text: "Use a dropdown for plans", scope: "ui" }));
    let st = s.state();
    expect(st.intent.contendedScopes).toEqual(["ui"]);
    expect(st.directives[a]?.status).toBe("contended");
    expect(st.status).toBe("idle"); // non-goal contention does not block the session
    const ctn = Object.values(st.contentions)[0];
    expect(ctn?.resolved).toBe(false);
    expect(() => s.resolve(M, "bo", ctn?.id ?? "", a)).toThrow(/driver or an owner/);
    s.resolve(M, "ana", ctn?.id ?? "", b);
    st = s.state();
    expect(st.intent.steers.ui?.text).toBe("Use a dropdown for plans");
    expect(st.directives[a]?.status).toBe("superseded");
    expect(st.intent.contendedScopes).toEqual([]);
  });

  it("goal contention blocks; a replacement directive resolves it", () => {
    const s = setup();
    s.setRole(M, "ana", "bo", "owner");
    s.directive(M, "ana", { text: "Build billing" });
    s.directive(M, "bo", { text: "Build invoicing" });
    expect(s.state().status).toBe("blocked");
    const ctn = Object.values(s.state().contentions)[0];
    s.resolve(M, "ana", ctn?.id ?? "", null, {
      text: "Build billing with invoicing",
      mode: "steer",
      scope: "goal",
      supersedes: [],
      interrupt: false,
    });
    expect(s.state().status).toBe("idle");
    expect(s.state().intent.goal?.text).toBe("Build billing with invoicing");
  });

  it("gates risky tool calls with the approval policy", () => {
    const s = setup();
    s.directive(M, "ana", { text: "deploy" });
    s.turnStarted(M, "agent");
    expect(
      s.requestApproval(M, "agent", { id: "c1", name: "fs.write", args: {}, risk: "write" }),
    ).toBeNull();
    const ap = s.requestApproval(M, "agent", {
      id: "c2",
      name: "deploy",
      args: { env: "prod" },
      risk: "irreversible",
    });
    expect(ap).not.toBeNull();
    expect(s.state().status).toBe("awaiting_approval");
    expect(() => s.vote(M, "agent", ap ?? "", "approve")).toThrow(/only humans/);
    s.vote(M, "bo", ap ?? "", "approve"); // contributor: ineligible for a driver quorum
    expect(s.state().approvals[ap ?? ""]?.status).toBe("pending");
    s.vote(M, "ana", ap ?? "", "approve"); // owner counts, but quorum is 2
    expect(s.state().approvals[ap ?? ""]?.status).toBe("pending");
    s.setRole(M, "ana", "cy", "driver");
    s.vote(M, "cy", ap ?? "", "approve");
    expect(s.state().approvals[ap ?? ""]?.status).toBe("granted");
    expect(s.state().status).toBe("running");
    expect(() => s.vote(M, "bo", ap ?? "", "deny")).toThrow(/already decided/);
  });

  it("hands off the driver token and briefs the newcomer", () => {
    const s = setup();
    s.directive(M, "ana", { text: "Build billing" });
    s.directive(M, "bo", { text: "Never touch prod", mode: "constrain" });
    s.turnStarted(M, "agent");
    s.writeFile(M, "agent", "src/billing.ts", "export const x = 1;");
    s.turnEnded(M, "agent", "done", "wrote billing.ts");
    const h = s.requestHandoff(M, "ana", "cy");
    const hid = h.kind === "handoff.requested" ? h.payload.handoffId : "";
    expect(() => s.acceptHandoff(M, "bo", hid)).toThrow(/someone else/);
    s.acceptHandoff(M, "cy", hid);
    expect(s.state().driver).toBe("cy");
    const brief = handoffBrief(s.state(), { forActor: "cy", events: s.events(M) });
    expect(brief).toContain("Driver: Cy");
    expect(brief).toContain("Goal: Build billing");
    expect(brief).toContain("Never touch prod");
    expect(brief).toContain("src/billing.ts");
    expect(brief).toContain("Turn 1");
  });

  it("forks, diverges, and merges with carried directives and a workspace conflict", () => {
    const s = setup();
    s.directive(M, "ana", { text: "Build billing" });
    s.directive(M, "bo", { text: "REST endpoints", scope: "api" });
    s.writeFile(M, "agent", "README.md", "# Billing\nline\nend");
    s.writeFile(M, "agent", "shared.ts", "a\nb\nc");
    s.fork(M, "bo", "alt");
    expect(s.branches()).toEqual([M, "alt"]);
    // Diverge: main edits README top, alt edits README bottom (clean), both edit shared.ts line b.
    s.writeFile(M, "agent", "README.md", "# Billing v2\nline\nend");
    s.writeFile(M, "agent", "shared.ts", "a\nB-main\nc");
    s.join("alt", ana, "owner");
    s.join("alt", cy, "contributor");
    s.directive("alt", "cy", { text: "GraphQL endpoints", scope: "api" });
    s.directive("alt", "bo", { text: "Add rate limits", mode: "constrain" });
    s.writeFile("alt", "agent", "README.md", "# Billing\nline\nend v2");
    s.writeFile("alt", "agent", "shared.ts", "a\nB-alt\nc");
    s.writeFile("alt", "agent", "new.ts", "new");
    expect(() => s.merge(M, "bo", "alt")).toThrow(/driver or an owner/);
    s.merge(M, "ana", "alt");
    const st = s.state(M);
    expect(s.readFile(M, "README.md")).toBe("# Billing v2\nline\nend v2");
    expect(s.readFile(M, "new.ts")).toBe("new");
    expect(st.openConflicts).toEqual(["shared.ts"]);
    expect(s.readFile(M, "shared.ts")).toContain("<<<<<<< ours");
    expect(st.status).toBe("blocked");
    expect(st.intent.constraints.map((c) => c.text)).toContain("Add rate limits");
    // api scope steered differently by peers on both branches: contention, not silent override.
    expect(st.intent.contendedScopes).toEqual(["api"]);
    expect(Object.values(st.contentions).filter((c) => !c.resolved)).toHaveLength(1);
    // Resolving the file clears the block.
    s.writeFile(M, "ana", "shared.ts", "a\nB-merged\nc");
    expect(s.state(M).openConflicts).toEqual([]);
    expect(s.log.verify()).toEqual({ ok: true });
  });

  it("replays deterministically from the log and from a snapshot", () => {
    const s = setup();
    s.directive(M, "ana", { text: "Build billing" });
    for (let t = 0; t < 5; t++) {
      s.turnStarted(M, "agent");
      s.modelCompleted(
        M,
        "agent",
        `turn ${t}`,
        [{ id: `c${t}`, name: "fs.write", args: { path: `f${t}` }, risk: "write" }],
        "scripted",
      );
      s.writeFile(M, "agent", `f${t}.txt`, `content ${t}`);
      s.toolCompleted(M, "agent", { callId: `c${t}`, ok: true, output: "ok" });
      s.turnEnded(M, "agent", "done", `wrote f${t}`);
      if (t === 2) s.directive(M, "bo", { text: "Add tests", scope: "qa" });
    }
    const live = s.state();
    const replayed = replayBranch(s.log, M);
    expect(stateHash(replayed)).toBe(stateHash(live));
    const events = s.events(M);
    const snap = replayBranch(
      Session.fromSerialized({ ...s.log.serialize(), events: { [M]: events.slice(0, 10) } }).log,
      M,
    );
    expect(stateHash(resumeFrom(snap, events))).toBe(stateHash(live));
    const check = checkReplay(s.log, M);
    expect(check.ok).toBe(true);
    const round = Session.fromSerialized(s.log.serialize());
    expect(stateHash(round.state())).toBe(stateHash(live));
  });
});
