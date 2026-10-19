import { usageTotal } from "@henosis/protocol";
import { describe, expect, it } from "vitest";
import { councilsOf } from "../src/council.js";
import {
  answersBefore,
  budgetSpent,
  councilLabel,
  owedIn,
  pendingInstructions,
  roundSequence,
  synthesisMayRun,
} from "../src/councilProtocol.js";
import { ChatEventBody, type CouncilMember, councilMemberKey } from "../src/events.js";
import { foldChat, initialChatState, reduceChat } from "../src/state.js";
import { Chat, type ChatDirectory } from "../src/store.js";
import { CHAT_MESSAGE_TYPES, ChatClientMessage, COUNCIL_EVENT_KINDS } from "../src/wire.js";

const people: Record<string, string> = { ana: "Ana", bo: "Bo", dee: "Dee", cy: "Cy" };
const profiles: Record<string, { name: string; ownerId: string | null }> = {
  "agent:ana": { name: "Ana's agent", ownerId: "ana" },
  "agent:bo": { name: "Bo's agent", ownerId: "bo" },
  "agent:dee": { name: "Dee's agent", ownerId: "dee" },
  "team:pay": { name: "Payments agent", ownerId: null },
};
const directory: ChatDirectory = {
  person: (id) => (people[id] ? { id, name: people[id] as string } : null),
  agent: () => null,
  isLead: (id, scope) => id === "dee" && scope.projectId === "billing",
  profile: (id) =>
    profiles[id] ? { id, ...(profiles[id] as { name: string; ownerId: string | null }) } : null,
};
const model = (profileId: string): CouncilMember => ({
  kind: "agent",
  userId: profiles[profileId]?.ownerId ?? null,
  profileId,
  name: profiles[profileId]?.name ?? profileId,
});
const anaModel = model("agent:ana");
const boModel = model("agent:bo");
const deeModel = model("agent:dee");
const payModel = model("team:pay");
const usage = (n: number) => ({ input: n, output: n, cacheRead: 0, cacheWrite: 0 });

let clock = 1_700_000_000_000;
const now = () => (clock += 60_000);

function setup() {
  const chat = Chat.create("northwind", { directory, now });
  const g = chat.createGroup("ana", {
    name: "Invoice rollout",
    scope: { projectId: "billing" },
    members: [
      { kind: "human", userId: "bo" },
      { kind: "human", userId: "dee" },
    ],
  });
  return { chat, g };
}

describe("council events", () => {
  it("parse with their defaults and are the eight kinds of the contract", () => {
    const convened = ChatEventBody.parse({
      kind: "council.convened",
      payload: {
        councilId: "c1",
        groupId: "g1",
        task: "Ship PDF invoices",
        chair: anaModel,
        members: [anaModel, boModel],
        rounds: ["individual", "discussion", "synthesis", "vote"],
        by: "ana",
      },
    });
    expect(convened.kind === "council.convened" && convened.payload.discussionRounds).toBe(1);
    expect(convened.kind === "council.convened" && convened.payload.budget).toBeNull();
    const said = ChatEventBody.parse({
      kind: "council.said",
      payload: { councilId: "c1", round: "individual", index: 0, member: anaModel, text: "Hi" },
    });
    expect(said.kind === "council.said" && said.payload.usage).toEqual(usage(0));
    expect(said.kind === "council.said" && said.payload.cites).toEqual([]);
    expect(
      ChatEventBody.safeParse({
        kind: "council.said",
        payload: { councilId: "c1", round: "lunch", index: 0, member: anaModel, text: "Hi" },
      }).success,
    ).toBe(false);
    expect([...COUNCIL_EVENT_KINDS].sort()).toEqual([
      "council.assigned",
      "council.concluded",
      "council.convened",
      "council.instructed",
      "council.reported",
      "council.round.started",
      "council.said",
      "council.synthesised",
    ]);
    for (const k of COUNCIL_EVENT_KINDS)
      expect(ChatEventBody.options.some((o) => o.shape.kind.value === k)).toBe(true);
    expect(councilMemberKey(anaModel)).toBe("model:agent:ana");
  });

  it("the wire carries convene, instruct and end with their defaults", () => {
    const m = ChatClientMessage.parse({
      type: "chat.council.convene",
      groupId: "g",
      task: "Ship it",
      members: [anaModel],
    });
    expect(m.type === "chat.council.convene" && m.rounds).toEqual([
      "individual",
      "discussion",
      "synthesis",
      "vote",
    ]);
    expect(m.type === "chat.council.convene" && m.discussionRounds).toBe(1);
    for (const t of ["chat.council.convene", "chat.council.instruct", "chat.council.end"])
      expect(CHAT_MESSAGE_TYPES.has(t)).toBe(true);
  });
});

describe("convening", () => {
  it("a group member convenes with the directory's profiles; the chair defaults to the convener's model", () => {
    const { chat, g } = setup();
    const c = chat.convene("bo", g.id, {
      task: "Ship PDF invoices by Friday",
      members: [
        { kind: "agent", userId: "wrong", profileId: "agent:ana", name: "whatever" },
        boModel,
        payModel,
        boModel,
      ],
      budget: 10_000,
    });
    expect(c.groupId).toBe(g.id);
    expect(c.by).toBe("bo");
    expect(c.chair).toEqual(boModel);
    // Names and owners come from the directory, and a member appears once.
    expect(c.members).toEqual([anaModel, boModel, payModel]);
    expect(c.roundPlan).toEqual(["individual", "discussion", "synthesis", "vote"]);
    expect(c.discussionRounds).toBe(1);
    expect(c.budget).toBe(10_000);
    expect(c.status).toBe("deliberating");
    expect(c.rounds).toEqual([]);
    expect(councilLabel(c)).toBe("convened");
    expect(chat.state().groups[g.id]?.lastSeq).toBe(c.convenedSeq);
    expect(councilsOf(chat.state().councils, g.id).map((x) => x.id)).toEqual([c.id]);
    expect(() => chat.convene("cy", g.id, { task: "x", members: [anaModel] })).toThrow(
      /not a member/,
    );
    expect(() => chat.convene("ana", g.id, { task: "  ", members: [anaModel] })).toThrow(
      /needs a task/,
    );
    expect(() => chat.convene("ana", g.id, { task: "x", members: [] })).toThrow(/member model/);
    expect(() => chat.convene("ana", g.id, { task: "x", members: [model("agent:zed")] })).toThrow(
      /no member model/,
    );
    expect(() => chat.convene("ana", g.id, { task: "x", members: [anaModel], budget: 0 })).toThrow(
      /budget/,
    );
    expect(chat.log.verify()).toEqual({ ok: true });
  });

  it("without profiles in the directory, members are taken as given and the first chairs", () => {
    const chat = Chat.create("northwind", { now });
    const g = chat.createGroup("ana", { name: "Open" });
    const c = chat.convene("ana", g.id, { task: "Try", members: [boModel, deeModel] });
    expect(c.members).toEqual([boModel, deeModel]);
    expect(c.chair).toEqual(boModel);
  });
});

describe("the reducer and the protocol through a whole council", () => {
  it("walks individual, discussion, synthesis, vote, assignment, reports, conclusion", () => {
    const { chat, g } = setup();
    const c0 = chat.convene("ana", g.id, {
      task: "Ship PDF invoices by Friday",
      members: [anaModel, boModel, payModel],
      chair: deeModel,
      discussionRounds: 2,
    });
    const id = c0.id;
    const council = () => chat.council(id);
    expect(roundSequence(council())).toEqual([
      { round: "individual", index: 0 },
      { round: "discussion", index: 0 },
      { round: "discussion", index: 1 },
      { round: "synthesis", index: 0 },
      { round: "vote", index: 0 },
    ]);

    // Individual: start, then everyone owes an answer.
    expect(chat.next(id)).toEqual({ kind: "start-round", round: "individual", index: 0 });
    chat.startRound(id, { round: "individual", index: 0 });
    expect(chat.startRound(id, { round: "individual", index: 0 })).toBeNull();
    expect(chat.next(id)).toEqual({
      kind: "await-answers",
      round: "individual",
      index: 0,
      owed: [anaModel, boModel, payModel],
    });
    expect(councilLabel(council())).toBe("individual");
    // Bo instructs his model in private before it speaks; it is pending until cited.
    chat.instruct("bo", id, "agent:bo", "Push for the smallest slice");
    expect(pendingInstructions(council(), boModel).map((i) => i.text)).toEqual([
      "Push for the smallest slice",
    ]);
    expect(() => chat.instruct("cy", id, boModel, "hi")).toThrow(/not a member/);
    expect(() => chat.instruct("bo", id, "agent:zed", "hi")).toThrow(/not in council/);
    chat.said(id, { round: "individual", index: 0 }, anaModel, { text: "A", usage: usage(10) });
    chat.said(id, { round: "individual", index: 0 }, "agent:bo", {
      text: "B (instructed by Bo)",
      usage: usage(20),
      cites: [{ kind: "instruction", by: "bo" }],
    });
    expect(owedIn(council(), { round: "individual", index: 0 })).toEqual([payModel]);
    expect(synthesisMayRun(council())).toBe(false);
    chat.said(id, { round: "individual", index: 0 }, payModel, { text: "P", usage: usage(5) });
    expect(pendingInstructions(council(), boModel)).toEqual([]);
    expect(council().usage).toEqual(usage(35));
    expect(council().rounds[0]?.said.map((s) => s.text)).toEqual([
      "A",
      "B (instructed by Bo)",
      "P",
    ]);
    expect(council().rounds[0]?.said[1]?.cites).toEqual([{ kind: "instruction", by: "bo" }]);

    // Discussion 1 of 2, then 2 of 2: stances are recorded; the second reads the first.
    expect(chat.next(id)).toEqual({ kind: "start-round", round: "discussion", index: 0 });
    chat.startRound(id, { round: "discussion", index: 0 });
    expect(councilLabel(council())).toBe("discussion 1 of 2");
    expect(answersBefore(council(), { round: "discussion", index: 0 }).map((s) => s.text)).toEqual([
      "A",
      "B (instructed by Bo)",
      "P",
    ]);
    for (const [m, stance] of [
      [anaModel, "agree"],
      [boModel, "differ"],
      [payModel, "add"],
    ] as const)
      chat.said(id, { round: "discussion", index: 0 }, m, { text: `${stance}!`, stance });
    expect(chat.next(id)).toEqual({ kind: "start-round", round: "discussion", index: 1 });
    chat.startRound(id, { round: "discussion", index: 1 });
    expect(answersBefore(council(), { round: "discussion", index: 1 })).toHaveLength(6);
    for (const m of [anaModel, boModel, payModel])
      chat.said(id, { round: "discussion", index: 1 }, m, { text: "agree", stance: "agree" });

    // Synthesis: the chair writes the plan once the round is open.
    expect(chat.next(id)).toEqual({ kind: "start-round", round: "synthesis", index: 0 });
    chat.startRound(id, { round: "synthesis", index: 0 });
    expect(chat.next(id)).toEqual({ kind: "synthesise", index: 0 });
    expect(synthesisMayRun(council())).toBe(true);
    expect(() => chat.synthesise(id, "plan_1", [])).toThrow(/needs steps/);
    expect(() => chat.assign(id, "s1", "billing", "s-ana")).toThrow(/no step/);
    chat.synthesise(
      id,
      "plan_1",
      [
        {
          id: "s1",
          title: "Write the PDF",
          detail: "",
          estTokens: 500,
          risk: "write",
          owner: anaModel,
        },
        { id: "s2", title: "Test it", detail: "", estTokens: 300, risk: "exec", owner: boModel },
      ],
      [{ member: boModel, text: "I would cut the scope further" }],
    );
    expect(council().status).toBe("synthesised");
    expect(council().synthesis?.dissent[0]?.member).toEqual(boModel);

    // Vote: the people rate the plan in the chair's session; the host reports what they said.
    expect(chat.next(id)).toEqual({ kind: "start-round", round: "vote", index: 0 });
    chat.startRound(id, { round: "vote", index: 0 });
    expect(chat.next(id)).toEqual({ kind: "await-vote", planId: "plan_1" });
    expect(chat.next(id, "revise")).toEqual({ kind: "revise", planId: "plan_1", index: 1 });
    expect(chat.next(id, "rejected")).toEqual({
      kind: "stop",
      reason: "rejected",
      outcome: "abandoned",
    });
    // A revision reopens synthesis with the next index, then a fresh vote.
    chat.startRound(id, { round: "synthesis", index: 1 });
    expect(chat.next(id, "revise")).toEqual({ kind: "synthesise", index: 1 });
    chat.synthesise(id, "plan_2", [
      {
        id: "s1",
        title: "Write the PDF",
        detail: "",
        estTokens: 500,
        risk: "write",
        owner: anaModel,
      },
      { id: "s2", title: "Test it", detail: "", estTokens: 300, risk: "exec", owner: boModel },
      {
        id: "s3",
        title: "Tell support",
        detail: "",
        estTokens: 100,
        risk: "write",
        owner: payModel,
      },
    ]);
    expect(chat.next(id, "approved")).toEqual({ kind: "start-round", round: "vote", index: 1 });
    chat.startRound(id, { round: "vote", index: 1 });
    expect(chat.next(id)).toEqual({ kind: "await-vote", planId: "plan_2" });

    // Approved: every step is assigned, then every owner reports.
    const next = chat.next(id, "approved");
    expect(next.kind).toBe("assign");
    expect(next.kind === "assign" && next.steps.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
    expect(() => chat.report(id, "s1", "done")).toThrow(/not been assigned/);
    chat.assign(id, "s1", "billing", "s-ana");
    chat.assign(id, "s2", "billing", "s-bo");
    expect(council().status).toBe("working");
    expect(councilLabel(council())).toBe("working 0 of 3");
    expect(chat.next(id, "approved")).toMatchObject({ kind: "assign", steps: [{ id: "s3" }] });
    chat.assign(id, "s3", "billing", "s-pay");
    expect(chat.next(id, "approved")).toEqual({
      kind: "await-reports",
      stepIds: ["s1", "s2", "s3"],
      blocked: [],
    });
    chat.report(id, "s1", "done", "PDF written", usage(100));
    chat.report(id, "s2", "blocked", "tests need a fixture", usage(40));
    expect(chat.next(id, "approved")).toEqual({
      kind: "await-reports",
      stepIds: ["s2", "s3"],
      blocked: ["s2"],
    });
    chat.report(id, "s2", "done", "fixture added, tests pass", usage(60));
    chat.report(id, "s3", "done");
    expect(council().reportLog).toHaveLength(4);
    expect(council().reports.s2?.status).toBe("done");
    expect(councilLabel(council())).toBe("working 3 of 3");
    expect(chat.next(id, "approved")).toEqual({ kind: "conclude", outcome: "done" });
    expect(usageTotal(council().usage)).toBe(2 * (35 + 200));

    chat.conclude(id, "done", "Shipped");
    const done = council();
    expect([done.status, done.outcome, done.summary]).toEqual(["concluded", "done", "Shipped"]);
    expect(chat.next(id)).toEqual({ kind: "concluded", outcome: "done" });
    expect(councilLabel(done)).toBe("concluded: done");
    expect(() =>
      chat.said(id, { round: "individual", index: 0 }, anaModel, { text: "late" }),
    ).toThrow(/has concluded/);
    // The concluded event records the total; the fold does not count it twice.
    const last = chat.events().at(-1);
    expect(last?.kind === "council.concluded" && last.payload.usage).toEqual(done.usage);

    // Replay: the fold of the serialized log is the state we hold.
    expect(foldChat(chat.events())).toEqual(chat.state());
    expect(Chat.fromSerialized(chat.log.serialize(), { directory }).state()).toEqual(chat.state());
    expect(chat.log.verify()).toEqual({ ok: true });
  });

  it("the budget stops a council; the convener or a lead ends one early", () => {
    const { chat, g } = setup();
    const c = chat.convene("bo", g.id, {
      task: "Try something",
      members: [anaModel, boModel],
      budget: 50,
    });
    chat.startRound(c.id, { round: "individual", index: 0 });
    chat.said(c.id, { round: "individual", index: 0 }, anaModel, { text: "A", usage: usage(20) });
    expect(budgetSpent(chat.council(c.id))).toBe(false);
    chat.said(c.id, { round: "individual", index: 0 }, boModel, { text: "B", usage: usage(10) });
    expect(budgetSpent(chat.council(c.id))).toBe(true);
    expect(chat.next(c.id)).toEqual({ kind: "stop", reason: "budget", outcome: "abandoned" });
    expect(() => chat.endCouncil("ana", c.id)).toThrow(/convener or a lead/);
    chat.endCouncil("dee", c.id); // lead of billing
    expect(chat.council(c.id)).toMatchObject({
      status: "concluded",
      outcome: "abandoned",
      summary: "ended by dee",
    });
    const d = chat.convene("bo", g.id, { task: "Again", members: [boModel] });
    chat.endCouncil("bo", d.id, "changed my mind");
    expect(chat.council(d.id).summary).toBe("changed my mind");
    expect(() => chat.endCouncil("bo", d.id)).toThrow(/has concluded/);
  });

  it("a plan without synthesis concludes after the deliberation; a word before its round opens it", () => {
    const { chat, g } = setup();
    const c = chat.convene("ana", g.id, {
      task: "Just talk",
      members: [anaModel],
      rounds: ["individual"],
      discussionRounds: 0,
    });
    chat.said(c.id, { round: "individual", index: 0 }, anaModel, { text: "A" });
    expect(chat.council(c.id).rounds.map((r) => r.round)).toEqual(["individual"]);
    expect(chat.next(c.id)).toEqual({ kind: "conclude", outcome: "done" });
    // Zero discussion rounds means none in the sequence.
    const d = chat.convene("ana", g.id, {
      task: "Quick",
      members: [anaModel],
      rounds: ["individual", "discussion", "synthesis"],
      discussionRounds: 0,
    });
    expect(roundSequence(chat.council(d.id)).map((r) => r.round)).toEqual([
      "individual",
      "synthesis",
    ]);
  });

  it("folds a council event for an unknown council or an old state without councils", () => {
    const { chat, g } = setup();
    const c = chat.convene("ana", g.id, { task: "T", members: [anaModel] });
    const events = chat.events();
    const convened = events.find((e) => e.kind === "council.convened");
    const legacy = { ...initialChatState() } as ReturnType<typeof initialChatState>;
    // biome-ignore lint/suspicious/noExplicitAny: an older snapshot without the field
    delete (legacy as any).councils;
    const folded = foldChat(events, legacy);
    expect(Object.keys(folded.councils)).toEqual([c.id]);
    const orphan = reduceChat(initialChatState(), {
      ...(convened as NonNullable<typeof convened>),
      kind: "council.said",
      payload: {
        councilId: "nope",
        round: "individual",
        index: 0,
        member: anaModel,
        text: "x",
        usage: usage(0),
        cites: [],
      },
    });
    expect(orphan.councils).toEqual({});
  });
});
