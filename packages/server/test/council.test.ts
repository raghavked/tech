import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ChatEvent, type ChatState, type Council, foldChat } from "@henosis/chat";
import { type AgentProfile, CHAIR_PERSONA } from "@henosis/fleet";
import {
  addUsage,
  MAIN_BRANCH,
  type SessionEvent,
  type Usage,
  type UsageReport,
  usageTotal,
  ZERO_USAGE,
} from "@henosis/protocol";
import {
  defaultTools,
  type Model,
  type ModelRequest,
  ScriptedModel,
  scriptedApproach,
  scriptedStance,
} from "@henosis/runner";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import type { CouncilView } from "../src/councilHost.js";
import { HenosisServer } from "../src/server.js";

const sessionPolicy = {
  approvals: {
    read: "none",
    write: "none",
    exec: "none",
    external: "none",
    irreversible: "none",
  } as const,
  contention: "block" as const,
  maxTurns: 40,
  planApproval: { min: 2, average: 3 },
};
const M = MAIN_BRANCH;
const TASK = "Ship PDF invoices by Friday";

const ana = { kind: "agent", userId: "ana", profileId: "agent:ana", name: "Ana's agent" } as const;
const bo = { kind: "agent", userId: "bo", profileId: "agent:bo", name: "Bo's agent" } as const;
const dee = { kind: "agent", userId: "dee", profileId: "agent:dee", name: "Dee's chair" } as const;
const pay = { kind: "agent", userId: null, profileId: "team:pay", name: "Payments agent" } as const;

// ---- a model the test can hold: every member and every session waits at the gate ----------

const scripted = new ScriptedModel();
let gate: Promise<void> = Promise.resolve();
let release: () => void = () => {};
const hold = () => {
  gate = new Promise<void>((r) => {
    release = r;
  });
};
const seen: { profileId: string | null; persona: string; round: string }[] = [];
function paced(profile: AgentProfile | null): Model {
  return {
    name: profile ? `member:${profile.id}` : scripted.name,
    async complete(req: ModelRequest) {
      seen.push({
        profileId: profile?.id ?? null,
        persona: req.council?.persona ?? "",
        round: req.council?.round ?? "",
      });
      await gate;
      return scripted.complete(req);
    },
  };
}

// ---- websocket clients -------------------------------------------------------------------

type ChatIncoming =
  | { type: "chat.snapshot"; orgId: string; events: ChatEvent[] }
  | { type: "chat.event"; event: ChatEvent }
  | { type: "error"; message: string };

/** Every socket opened by a test, closed after it, so the server can close whatever happened. */
const sockets: WebSocket[] = [];

class ChatClient {
  ws: WebSocket;
  state: ChatState | null = null;
  errors: string[] = [];
  constructor(url: string) {
    this.ws = new WebSocket(url);
    sockets.push(this.ws);
    this.ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString()) as ChatIncoming;
      if (m.type === "chat.snapshot") this.state = foldChat(m.events);
      else if (m.type === "chat.event")
        this.state = this.state ? foldChat([m.event], this.state) : null;
      else if (m.type === "error") this.errors.push(m.message);
    });
  }
  open(): Promise<void> {
    return new Promise((r) => this.ws.once("open", () => r()));
  }
  send(m: Record<string, unknown>): void {
    this.ws.send(JSON.stringify(m));
  }
  async until(pred: (s: ChatState) => boolean, ms = 10_000): Promise<ChatState> {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (this.state && pred(this.state)) return this.state;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`timeout; errors: ${this.errors.join("; ")}`);
  }
  close(): void {
    this.ws.close();
  }
}

/** A person in a session over the front door: joins, then rates the plan. */
class SessionClient {
  ws: WebSocket;
  joined = false;
  events: SessionEvent[] = [];
  errors: string[] = [];
  constructor(url: string) {
    this.ws = new WebSocket(url);
    sockets.push(this.ws);
    this.ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString()) as
        | { type: "joined" }
        | { type: "event"; event: SessionEvent }
        | { type: "error"; message: string }
        | { type: string };
      if (m.type === "joined") this.joined = true;
      else if (m.type === "event") this.events.push((m as { event: SessionEvent }).event);
      else if (m.type === "error") this.errors.push((m as { message: string }).message);
    });
  }
  open(): Promise<void> {
    return new Promise((r) => this.ws.once("open", () => r()));
  }
  send(m: Record<string, unknown>): void {
    this.ws.send(JSON.stringify(m));
  }
  async untilJoined(ms = 5000): Promise<void> {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline && !this.joined) await new Promise((r) => setTimeout(r, 20));
    if (!this.joined) throw new Error(`not joined; errors: ${this.errors.join("; ")}`);
  }
  close(): void {
    this.ws.close();
  }
}

async function waitFor<T>(fn: () => T | null | undefined | false, ms = 10_000): Promise<T> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("timeout");
}

const sum = (xs: readonly { usage: Usage }[]) =>
  xs.reduce((t, x) => addUsage(t, x.usage), { ...ZERO_USAGE } as Usage);

describe("the council host", () => {
  let root: string;
  let server: HenosisServer;
  let port: number;
  const url = () => `ws://127.0.0.1:${port}/ws`;
  const http = () => `http://127.0.0.1:${port}`;
  const council = (id: string): Council => server.chat("nw").chat.council(id);
  const view = async (id: string) =>
    (await (await fetch(`${http()}/api/chat/nw/councils/${id}`)).json()) as CouncilView;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "henosis-council-"));
    writeFileSync(
      join(root, "orgs.json"),
      JSON.stringify({
        orgs: [
          {
            id: "nw",
            name: "Northwind",
            teams: [
              { id: "pay", name: "Payments", projects: [{ id: "billing", name: "Billing" }] },
            ],
          },
        ],
      }),
    );
    writeFileSync(
      join(root, "users.json"),
      JSON.stringify({
        users: [
          { id: "ana", name: "Ana", projects: [{ projectId: "billing", role: "member" }] },
          { id: "bo", name: "Bo", projects: [{ projectId: "billing", role: "member" }] },
          {
            id: "dee",
            name: "Dee",
            teams: [{ teamId: "pay", role: "manager" }],
            agent: { name: "Dee's chair" },
          },
        ],
      }),
    );
    writeFileSync(
      join(root, "agents.json"),
      JSON.stringify({
        agents: [{ id: "team:pay", name: "Payments agent", persona: "Speaks for the team." }],
      }),
    );
    server = new HenosisServer({
      root,
      model: paced(null),
      modelFor: paced,
      tools: defaultTools(),
      defaultPolicy: sessionPolicy,
    });
    port = await server.listen(0);
  });
  afterEach(() => {
    release();
    for (const ws of sockets.splice(0)) ws.close();
  });
  afterAll(async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("convenes three models for two rounds, the chair's plan is rated, the steps run and report, and it concludes", async () => {
    const anaWs = new ChatClient(url());
    const boWs = new ChatClient(url());
    await Promise.all([anaWs.open(), boWs.open()]);
    anaWs.send({ type: "chat.subscribe", orgId: "nw", userId: "ana" });
    boWs.send({ type: "chat.subscribe", orgId: "nw", userId: "bo" });
    await anaWs.until((s) => s.orgId === "nw");
    await boWs.until((s) => s.orgId === "nw");
    anaWs.send({
      type: "chat.create",
      name: "Rollout",
      scope: { projectId: "billing" },
      members: [
        { kind: "human", userId: "bo" },
        { kind: "human", userId: "dee" },
      ],
    });
    const created = await boWs.until((s) =>
      Object.values(s.groups).some((g) => g.name === "Rollout"),
    );
    const group = Object.values(created.groups).find((g) => g.name === "Rollout");
    if (!group) throw new Error("no group");
    await boWs.until((s) => (s.groups[group.id]?.members.length ?? 0) === 3);
    boWs.send({ type: "chat.say", groupId: group.id, text: "Let's decide today" });
    await anaWs.until((s) => (s.messages[group.id]?.length ?? 0) === 1);

    // Convene over the websocket. The models are held, so Bo can instruct his while it thinks.
    hold();
    seen.length = 0;
    anaWs.send({
      type: "chat.council.convene",
      groupId: group.id,
      task: TASK,
      members: [ana, bo, pay],
      chair: dee,
      discussionRounds: 2,
    });
    const convened = await boWs.until((s) =>
      Object.values(s.councils).some((c) => c.rounds.length === 1),
    );
    const c0 = Object.values(convened.councils)[0] as Council;
    const id = c0.id;
    expect(c0.chair).toEqual(dee);
    expect(c0.members).toEqual([ana, bo, pay]);
    expect(c0.rounds[0]).toMatchObject({ round: "individual", index: 0, said: [] });
    expect(server.council("nw").active()).toEqual([id]);
    boWs.send({
      type: "chat.council.instruct",
      councilId: id,
      profileId: "agent:bo",
      text: "Push for the smallest slice",
    });
    await anaWs.until((s) => (s.councils[id]?.instructions.length ?? 0) === 1);
    expect(council(id).rounds[0]?.said).toEqual([]);
    release();

    // Deliberation: individual, discussion 1 and 2, synthesis, then the vote opens.
    await anaWs.until((s) => s.councils[id]?.rounds.some((r) => r.round === "vote") ?? false);
    const c1 = council(id);
    expect(c1.status).toBe("synthesised");
    expect(c1.rounds.map((r) => [r.round, r.index, r.said.length])).toEqual([
      ["individual", 0, 3],
      ["discussion", 0, 3],
      ["discussion", 1, 3],
      ["synthesis", 0, 1],
      ["vote", 0, 0],
    ]);
    const individual = c1.rounds[0]?.said ?? [];
    for (const m of [ana, bo, pay]) {
      const s = individual.find((x) => x.member.profileId === m.profileId);
      expect(s?.text).toContain(scriptedApproach(TASK, m).approach);
      expect(s?.cites).toEqual([]);
      expect(usageTotal(s?.usage)).toBeGreaterThan(0);
    }
    // The instruction that landed while Bo's model was thinking is cited in its next round.
    const boFirstDiscussion = c1.rounds[1]?.said.find((s) => s.member.profileId === "agent:bo");
    expect(boFirstDiscussion?.cites).toEqual([{ kind: "instruction", by: "bo" }]);
    expect(boFirstDiscussion?.text).toContain("instructed by bo: Push for the smallest slice");
    const boSecondDiscussion = c1.rounds[2]?.said.find((s) => s.member.profileId === "agent:bo");
    expect(boSecondDiscussion?.cites).toEqual([]);
    for (const r of c1.rounds.slice(1, 3))
      for (const s of r.said) expect(s.stance).toBe(scriptedStance(TASK, s.member));
    // Every word carries usage, and the council's total is their sum.
    const saidUsage = sum(c1.rounds.flatMap((r) => r.said));
    expect(c1.usage).toEqual(saidUsage);
    expect(usageTotal(saidUsage)).toBeGreaterThan(0);
    // Each member spoke through its own profile; the chair in the chair's manner.
    expect(new Set(seen.filter((s) => s.round).map((s) => s.profileId))).toEqual(
      new Set(["agent:ana", "agent:bo", "team:pay", "agent:dee"]),
    );
    expect(seen.filter((s) => s.round === "synthesis").map((s) => s.profileId)).toEqual([
      "agent:dee",
    ]);
    expect(seen.find((s) => s.profileId === "agent:dee")?.persona).toBe(CHAIR_PERSONA);
    expect(seen.find((s) => s.profileId === "team:pay")?.persona).toBe("Speaks for the team.");

    // The synthesis: one step per member and one to verify, owners dealt in turn; dissent recorded.
    const synthesis = c1.synthesis;
    if (!synthesis) throw new Error("no synthesis");
    expect(synthesis.steps.map((s) => s.owner.profileId)).toEqual([
      "agent:ana",
      "agent:bo",
      "team:pay",
      "agent:ana",
    ]);
    const differing = new Set(
      c1.rounds
        .slice(1, 3)
        .flatMap((r) => r.said)
        .filter((s) => s.stance === "differ")
        .map((s) => s.member.profileId),
    );
    expect(new Set(synthesis.dissent.map((d) => d.member.profileId))).toEqual(differing);
    expect(c1.rounds[3]?.said[0]?.member).toEqual(dee);

    // The plan is real: proposed in a council session owned by the chair's owner, in the council's crew.
    const v1 = await view(id);
    expect(v1.label).toBe("vote");
    expect(v1.vote).toBe("pending");
    expect(v1.next).toEqual({ kind: "await-vote", planId: synthesis.planId });
    if (!v1.plan) throw new Error("no plan in the view");
    expect(v1.plan).toMatchObject({
      projectId: "billing",
      planId: synthesis.planId,
      status: "proposed",
    });
    const ph = server.project("billing");
    const chairSession = ph.hosts.get(v1.plan.sessionId);
    if (!chairSession) throw new Error("no council session");
    const cs = chairSession.session.state();
    expect(cs.ownerId).toBe("dee");
    expect(cs.title).toBe(`Council: ${TASK}`);
    expect(cs.policy.planFirst).toBe(true);
    expect(cs.intent.goal).toBeNull();
    const plan = cs.plans[synthesis.planId];
    expect(plan?.goal).toBe(TASK);
    expect(plan?.steps.map((s) => s.title)).toEqual(synthesis.steps.map((s) => s.title));
    expect(ph.state().sessions[v1.plan.sessionId]?.crew).toBe(`Council: ${TASK.slice(0, 48)}`);

    // The vote: Ana and Bo rate the plan over the front door; the policy wants two raters.
    const anaS = new SessionClient(url());
    const boS = new SessionClient(url());
    await Promise.all([anaS.open(), boS.open()]);
    anaS.send({
      type: "join",
      sessionId: v1.plan.sessionId,
      projectId: "billing",
      actor: { id: "ana", kind: "human", name: "Ana" },
      userId: "ana",
    });
    boS.send({
      type: "join",
      sessionId: v1.plan.sessionId,
      projectId: "billing",
      actor: { id: "bo", kind: "human", name: "Bo" },
      userId: "bo",
    });
    await Promise.all([anaS.untilJoined(), boS.untilJoined()]);
    anaS.send({ type: "plan.rate", planId: synthesis.planId, rating: 4 });
    await waitFor(() => chairSession.session.state().plans[synthesis.planId]?.ratings.ana);
    expect((await view(id)).vote).toBe("pending");
    expect(council(id).status).toBe("synthesised");
    // Hold the models again so the instruction relay into a working member session can be seen.
    hold();
    boS.send({ type: "plan.rate", planId: synthesis.planId, rating: 5, note: "ship it" });
    await waitFor(
      () => council(id).status === "working" && Object.keys(council(id).assignments).length === 4,
    );
    anaS.close();
    boS.close();
    const c2 = council(id);
    expect(chairSession.session.state().plans[synthesis.planId]?.status).toBe("approved");

    // Assignments: one member session per owner, in the crew, with a directive per step.
    const byStep = c2.assignments;
    expect(byStep.s1?.sessionId).toBe(byStep.s4?.sessionId);
    expect(new Set(Object.values(byStep).map((a) => a.sessionId)).size).toBe(3);
    for (const a of Object.values(byStep)) {
      expect(a.projectId).toBe("billing");
      const ss = ph.state().sessions[a.sessionId];
      expect(ss?.ownerId).toBe(a.owner.userId ?? "ana");
      expect(ss?.crew).toBe(`Council: ${TASK.slice(0, 48)}`);
      expect(ss?.title).toBe(`${a.owner.name}: ${TASK.slice(0, 48)}`);
    }
    const boHost = ph.hosts.get(byStep.s2?.sessionId ?? "");
    if (!boHost) throw new Error("no member session for Bo's model");
    const boDirective = Object.values(boHost.session.state().directives).find((d) =>
      d.input.text.startsWith("council "),
    );
    expect(boDirective?.author).toBe("bo");
    expect(boDirective?.input.text).toBe(
      `council ${id} step 2: ${synthesis.steps[1]?.title}\n${synthesis.steps[1]?.detail}`,
    );
    expect(boHost.session.state().participants.bo?.role).toBe("owner");
    // A private instruction now lands as a steer in the member's session as well.
    boWs.send({
      type: "chat.council.instruct",
      councilId: id,
      profileId: "agent:bo",
      text: "Keep the tests fast",
    });
    await waitFor(() =>
      Object.values(boHost.session.state().directives).find((d) => d.input.scope === "council"),
    );
    const steer = Object.values(boHost.session.state().directives).find(
      (d) => d.input.scope === "council",
    );
    expect(steer?.author).toBe("bo");
    expect(steer?.input.text).toBe("Bo instructs Bo's agent in the council: Keep the tests fast");
    release();

    // Reports come back as the member sessions finish; the council concludes when every step is done.
    await anaWs.until((s) => s.councils[id]?.status === "concluded");
    const done = council(id);
    expect(done.outcome).toBe("done");
    expect(done.summary.startsWith("4 of 4 steps done")).toBe(true);
    for (const s of synthesis.steps) {
      const r = done.reports[s.id];
      expect(r?.status).toBe("done");
      // The turn's summary, DONE marker off (the fleet refuses the later writers of one path).
      expect(r?.text.length).toBeGreaterThan(0);
      expect(r?.text.startsWith("DONE")).toBe(false);
      expect(usageTotal(r?.usage)).toBeGreaterThan(0);
    }
    expect(done.usage).toEqual(addUsage(saidUsage, sum(done.reportLog)));
    const final = await view(id);
    expect(final.label).toBe("concluded: done");
    expect(final.vote).toBe("approved");
    expect(final.next).toEqual({ kind: "concluded", outcome: "done" });
    expect(final.plan?.ratings).toMatchObject({
      ana: { rating: 4 },
      bo: { rating: 5, note: "ship it" },
    });
    expect(Object.keys(final.sessions).sort()).toEqual(["agent:ana", "agent:bo", "team:pay"]);
    expect(final.sessions["agent:bo"]?.status).toBe("idle");
    expect(server.council("nw").active()).toEqual([]);
    const list = (await (await fetch(`${http()}/api/chat/nw/councils`)).json()) as {
      councils: CouncilView[];
    };
    expect(list.councils.map((v) => v.council.id)).toEqual([id]);
    expect(server.chat("nw").chat.log.verify()).toEqual({ ok: true });

    // Usage: a council row per person (Ana pays for the shared agent she convened), in the totals.
    const report = (await (await fetch(`${http()}/api/usage?org=nw`)).json()) as UsageReport;
    const saidOf = (userId: string) =>
      sum(
        done.rounds.flatMap((r) => r.said).filter((s) => (s.member.userId ?? done.by) === userId),
      );
    expect(report.byCouncil.map((r) => [r.userId, r.name, r.councils, r.usage])).toEqual(
      expect.arrayContaining([
        ["ana", "Ana", 1, saidOf("ana")],
        ["bo", "Bo", 1, saidOf("bo")],
        ["dee", "Dee", 1, saidOf("dee")],
      ]),
    );
    expect(report.byCouncil).toHaveLength(3);
    expect(report.totals).toEqual(addUsage(sum(report.bySession), sum(report.byCouncil)));
    const anaRow = report.byUser.find((u) => u.userId === "ana");
    expect(anaRow?.usage).toEqual(
      addUsage(sum(report.bySession.filter((s) => s.ownerId === "ana")), saidOf("ana")),
    );
    const deeRow = report.byUser.find((u) => u.userId === "dee");
    expect(deeRow?.usage).toEqual(saidOf("dee"));
    const mine = (await (await fetch(`${http()}/api/usage?user=bo`)).json()) as UsageReport;
    expect(mine.byCouncil.map((r) => r.userId)).toEqual(["bo"]);
    const scoped = (await (
      await fetch(`${http()}/api/usage?project=billing`)
    ).json()) as UsageReport;
    expect(scoped.byCouncil).toHaveLength(3);
    const elsewhere = (await (
      await fetch(`${http()}/api/usage?project=nope`)
    ).json()) as UsageReport;
    expect(elsewhere.byCouncil).toEqual([]);
    // Tokens today count what the models said, for the glance.
    expect(usageTotal(server.usageDays.of("dee"))).toBe(usageTotal(saidOf("dee")));
    anaWs.close();
    boWs.close();
  });

  it("stops when the budget is spent: the round that spends it is recorded, nothing after it", async () => {
    const chat = server.chat("nw").chat;
    const group = Object.values(chat.state().groups).find((g) => g.name === "Rollout");
    if (!group) throw new Error("no group");
    const sessionsBefore = server.project("billing").hosts.size;
    const c = chat.convene("bo", group.id, {
      task: "Try something small",
      members: [ana, bo, pay],
      budget: 100,
    });
    await waitFor(() => council(c.id).status === "concluded");
    const done = council(c.id);
    expect(done.outcome).toBe("abandoned");
    expect(done.summary).toMatch(/^budget spent: \d+ of 100 tokens$/);
    expect(usageTotal(done.usage)).toBeGreaterThanOrEqual(100);
    expect(done.rounds.map((r) => [r.round, r.said.length])).toEqual([["individual", 3]]);
    expect(done.synthesis).toBeNull();
    expect(server.project("billing").hosts.size).toBe(sessionsBefore);
  });

  it("the convener ends a council early over the websocket; held answers are dropped", async () => {
    const chat = server.chat("nw").chat;
    const group = Object.values(chat.state().groups).find((g) => g.name === "Rollout");
    if (!group) throw new Error("no group");
    const ws = new ChatClient(url());
    await ws.open();
    ws.send({ type: "chat.subscribe", orgId: "nw", userId: "ana" });
    await ws.until((s) => s.orgId === "nw");
    hold();
    ws.send({
      type: "chat.council.convene",
      groupId: group.id,
      task: "Pause and think",
      members: [ana, bo],
    });
    const st = await ws.until((s) =>
      Object.values(s.councils).some((c) => c.task === "Pause and think" && c.rounds.length === 1),
    );
    const c = Object.values(st.councils).find((x) => x.task === "Pause and think") as Council;
    ws.send({ type: "chat.council.end", councilId: c.id, summary: "changed my mind" });
    await ws.until((s) => s.councils[c.id]?.status === "concluded");
    release();
    await new Promise((r) => setTimeout(r, 100));
    expect(council(c.id)).toMatchObject({ outcome: "abandoned", summary: "changed my mind" });
    expect(council(c.id).rounds[0]?.said).toEqual([]);
    expect(server.council("nw").active()).toEqual([]);
    ws.close();
  });

  it("a rejected plan abandons the council", async () => {
    const chat = server.chat("nw").chat;
    const group = Object.values(chat.state().groups).find((g) => g.name === "Rollout");
    if (!group) throw new Error("no group");
    const c = chat.convene("ana", group.id, {
      task: "Rewrite the exporter",
      members: [ana, bo],
      chair: dee,
      discussionRounds: 0,
    });
    await waitFor(() => council(c.id).synthesis);
    const v = await view(c.id);
    if (!v.plan) throw new Error("no plan");
    const sh = server.project("billing").hosts.get(v.plan.sessionId);
    if (!sh) throw new Error("no council session");
    sh.session.join(M, { id: "dee", kind: "human", name: "Dee" }, "owner");
    sh.session.decidePlan(M, "dee", v.plan.planId, "rejected", "not this week");
    await waitFor(() => council(c.id).status === "concluded");
    expect(council(c.id)).toMatchObject({ outcome: "abandoned", summary: "the plan was rejected" });
    expect((await view(c.id)).vote).toBe("rejected");
  });

  it("a restart resumes a council waiting for its vote and relays the reports it missed", async () => {
    const chat = server.chat("nw").chat;
    const group = Object.values(chat.state().groups).find((g) => g.name === "Rollout");
    if (!group) throw new Error("no group");
    const c = chat.convene("ana", group.id, {
      task: "Add the audit trail",
      members: [ana, bo],
      chair: dee,
    });
    await waitFor(() => council(c.id).rounds.some((r) => r.round === "vote"));
    await server.close();
    server = new HenosisServer({
      root,
      model: paced(null),
      modelFor: paced,
      tools: defaultTools(),
      defaultPolicy: sessionPolicy,
    });
    port = await server.listen(0);
    expect(server.council("nw").active()).toEqual([c.id]);
    const v = await view(c.id);
    expect(v.vote).toBe("pending");
    if (!v.plan) throw new Error("no plan after restart");
    const sh = server.project("billing").hosts.get(v.plan.sessionId);
    if (!sh) throw new Error("the council session did not reopen");
    for (const who of ["ana", "bo"]) {
      sh.session.join(M, { id: who, kind: "human", name: who }, "contributor");
      sh.session.ratePlan(M, who, v.plan.planId, 4);
    }
    await waitFor(() => council(c.id).status === "concluded", 15_000);
    expect(council(c.id).outcome).toBe("done");
    expect(Object.values(council(c.id).reports).every((r) => r.status === "done")).toBe(true);
    expect(server.council("nw").active()).toEqual([]);
  });
});
