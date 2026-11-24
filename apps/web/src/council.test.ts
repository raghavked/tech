/**
 * The council as the web reads it (council.ts): the member models the convene sheet offers,
 * the chair it proposes, the words on the rail card, who may see a private instruction, and
 * the table (the seats with their people, what each seat's name says, the plan and its
 * ratings) with the geometry it is drawn on (councilGeometry.ts).
 */
import type { Council } from "@henosis/chat";
import { ZERO_USAGE } from "@henosis/protocol";
import { describe, expect, it } from "vitest";
import type { ChatDirectoryListing, ModelRow } from "./api.js";
import {
  canSeeInstruction,
  councilCard,
  councilTable,
  defaultChair,
  isManagerModel,
  labelWord,
  memberModels,
  modelsOf,
  type TablePlan,
  voteOf,
} from "./council.js";
import {
  nameLines,
  TABLE_SEAT_CAP,
  TABLE_WIDE_MIN,
  tableGeometry,
  wordSpread,
} from "./councilGeometry.js";

const model = (profileId: string, ownerId: string | null, manages: string[] = []): ModelRow => ({
  profileId,
  name: ownerId ? `${ownerId}'s agent` : "Team agent",
  ownerId,
  provider: "scripted",
  model: "",
  manages,
});

const directory = (
  people: ChatDirectoryListing["people"],
  models?: ModelRow[],
): ChatDirectoryListing => ({ people, agents: [], ...(models ? { models } : {}) });

describe("member models", () => {
  it("offers the server's profiles, else one agent per person in the directory", () => {
    const rows = memberModels(
      directory([{ id: "ana", name: "Ana" }], [model("agent:ana", "ana"), model("team:x", null)]),
    );
    expect(rows.map((r) => r.profileId)).toEqual(["agent:ana", "team:x"]);
    const fallback = memberModels(
      directory([
        { id: "ana", name: "Ana" },
        { id: "bo", name: "Bo" },
      ]),
    );
    expect(fallback).toEqual([
      {
        profileId: "agent:ana",
        name: "Ana's agent",
        ownerId: "ana",
        provider: "scripted",
        model: "",
      },
      { profileId: "agent:bo", name: "Bo's agent", ownerId: "bo", provider: "scripted", model: "" },
    ]);
    expect(memberModels(null)).toEqual([]);
  });

  it("knows a manager's agent by the teams its owner manages", () => {
    expect(isManagerModel(model("agent:mo", "mo", ["default"]))).toBe(true);
    expect(isManagerModel(model("agent:bo", "bo"))).toBe(false);
    expect(isManagerModel({})).toBe(false);
  });
});

describe("the chair the sheet proposes", () => {
  const people = [
    { id: "ana", name: "Ana", teams: ["default"] },
    { id: "mo", name: "Mo", teams: ["default"] },
    { id: "max", name: "Max", teams: ["growth"] },
  ];
  const models = [
    model("agent:ana", "ana"),
    model("agent:bo", "bo"),
    model("agent:max", "max", ["growth"]),
    model("agent:mo", "mo", ["default"]),
    model("team:x", null),
  ];

  it("is the convener's manager's agent: the manager of a team the convener is in", () => {
    expect(defaultChair(directory(people, models), "ana")?.profileId).toBe("agent:mo");
  });

  it("is the convener's own agent when no manager of their teams has one, never their own as manager", () => {
    // Max manages growth, which Ana is not in; Mo manages default but is the convener here.
    expect(
      defaultChair(directory(people, [models[0], models[2]] as ModelRow[]), "ana")?.profileId,
    ).toBe("agent:ana");
    expect(defaultChair(directory(people, models), "mo")?.profileId).toBe("agent:mo");
  });

  it("falls back to the first model, and to nothing before the directory lands", () => {
    expect(defaultChair(directory(people, [model("team:x", null)]), "ana")?.profileId).toBe(
      "team:x",
    );
    expect(defaultChair(null, "ana")).toBeNull();
    expect(defaultChair(directory([], []), "ana")).toBeNull();
  });

  it("reads a person's teams from the directory, so an older server proposes their own agent", () => {
    const old = directory(
      [{ id: "ana", name: "Ana" }],
      models.map(({ manages: _m, ...m }) => m),
    );
    expect(defaultChair(old, "ana")?.profileId).toBe("agent:ana");
  });
});

const council = (over: Partial<Council> = {}): Council => ({
  id: "cnc_1",
  groupId: "grp_1",
  task: "Ship it",
  chair: { kind: "agent", userId: "mo", profileId: "agent:mo", name: "Mo's agent" },
  members: [
    { kind: "agent", userId: "ana", profileId: "agent:ana", name: "Ana's agent" },
    { kind: "agent", userId: "bo", profileId: "agent:bo", name: "Bo's agent" },
    { kind: "agent", userId: null, profileId: "team:x", name: "Team agent" },
  ],
  roundPlan: ["individual", "discussion", "synthesis", "vote"],
  discussionRounds: 1,
  budget: null,
  by: "ana",
  convenedSeq: 1,
  rounds: [],
  instructions: [],
  synthesis: null,
  assignments: {},
  reports: {},
  reportLog: [],
  usage: ZERO_USAGE,
  status: "deliberating",
  outcome: null,
  summary: "",
  lastSeq: 1,
  ...over,
});

describe("the rail card", () => {
  it("counts the chair with the members when it is not among them", () => {
    expect(modelsOf(council()).map((m) => m.profileId)).toEqual([
      "agent:ana",
      "agent:bo",
      "team:x",
      "agent:mo",
    ]);
    expect(councilCard(council())).toBe("Council · 4 models · convened");
  });

  it("spells the core's labels in the product's words", () => {
    expect(labelWord("individual")).toBe("answering alone");
    expect(labelWord("discussion 1 of 2")).toBe("discussion 1 of 2");
    expect(labelWord("working 2 of 3")).toBe("working 2 of 3");
    expect(labelWord("concluded: done")).toBe("concluded: done");
    expect(labelWord("something else")).toBe("something else");
  });
});

describe("a private instruction", () => {
  const c = council();
  const i = {
    member: c.members[1] as Council["members"][number],
    by: "cy",
    text: "Be brief",
    seq: 3,
  };
  it("is seen by the person who gave it, the model's owner and the chair's owner", () => {
    expect(canSeeInstruction(c, i, "cy")).toBe(true);
    expect(canSeeInstruction(c, i, "bo")).toBe(true);
    expect(canSeeInstruction(c, i, "mo")).toBe(true);
    expect(canSeeInstruction(c, i, "ana")).toBe(false);
  });
});

describe("the council's table", () => {
  type Member = Council["members"][number];
  const [ana, bo, team] = council().members as [Member, Member, Member];
  const said = (member: Member, seq: number, stance: "agree" | "differ" | "add" | null = null) => ({
    member,
    text: "A word.",
    usage: ZERO_USAGE,
    cites: [],
    stance,
    seq,
  });
  const names: Record<string, string> = { ana: "Ana", bo: "Bo", mo: "Mo", cy: "Cy" };
  const nameOf = (id: string) => names[id] ?? id;
  const table = (c: Council, meId = "ana", plan: TablePlan | null = null, present = [meId]) =>
    councilTable({ council: c, meId, nameOf, present, plan });
  const step = (id: string, owner: Member) => ({
    id,
    title: id,
    detail: "",
    estTokens: 100,
    risk: "write" as const,
    owner,
  });
  const deliberated = council({
    rounds: [
      {
        round: "individual",
        index: 0,
        startedSeq: 2,
        said: [said(ana, 3), said(bo, 4), said(team, 5)],
      },
      {
        round: "discussion",
        index: 0,
        startedSeq: 6,
        said: [said(ana, 7, "agree"), said(bo, 8, "differ"), said(team, 9, "add")],
      },
    ],
    lastSeq: 9,
  });
  const planned = council({
    ...deliberated,
    rounds: [
      ...deliberated.rounds,
      { round: "synthesis", index: 0, startedSeq: 10, said: [] },
      { round: "vote", index: 0, startedSeq: 12, said: [] },
    ],
    synthesis: {
      planId: "plan_1",
      steps: [step("s1", ana), step("s2", bo), step("s3", ana)],
      dissent: [{ member: bo, text: "Round per line." }],
      seq: 11,
    },
    status: "synthesised",
    lastSeq: 12,
  });

  it("seats the chair first, then the members as convened, each with its person", () => {
    const t = table(council());
    expect(t.seats.map((s) => s.key)).toEqual(["agent:mo", "agent:ana", "agent:bo", "team:x"]);
    expect(t.seats.map((s) => s.chair)).toEqual([true, false, false, false]);
    expect(t.seats.map((s) => s.person?.name ?? null)).toEqual(["Mo", "Ana", "Bo", null]);
    expect(t.seats[1]?.person).toMatchObject({ me: true, present: true, initial: "A" });
    expect(t.seats[2]?.person).toMatchObject({ me: false, present: false });
    expect(t.centre).toEqual({ kind: "forming", wordsIn: 0, wordsExpected: 6 });
    expect(t.line).toBe("Each answers alone.");
  });

  it("says who has answered in the running round and who is thinking", () => {
    const c = council({
      rounds: [{ round: "individual", index: 0, startedSeq: 2, said: [said(ana, 3)] }],
      lastSeq: 3,
    });
    const t = table(c);
    const [mo, a, b] = t.seats;
    expect(a).toMatchObject({ answeredNow: true, thinking: null, answered: 1 });
    expect(b).toMatchObject({ answeredNow: false, thinking: "answer", owes: 1 });
    // a chair outside the members answers no round
    expect(mo).toMatchObject({ answeredNow: false, thinking: null });
    expect(a?.label).toBe("Ana's agent, answered round 1, you are in the room");
    expect(b?.label).toBe("Bo's agent, thinking in round 1, Bo is not in the room");
    expect(t.seats[3]?.label).toBe("Team agent, thinking in round 1, shared agent");
    expect(t.line).toBe(
      "Each answers alone. 1 of 3 answered. Bo's agent and Team agent are thinking.",
    );
    expect(a?.words.map((w) => w.latest)).toEqual([true]);
    expect(t.wordsFraction).toBeCloseTo(1 / 6);
  });

  it("names a seat by its model, the chair, its stance and the round it answered", () => {
    const t = table(council({ ...deliberated, chair: bo }), "bo");
    expect(t.seats[0]?.label).toBe(
      "Bo's agent, chair, differs, answered round 2, you are in the room",
    );
    expect(t.seats.map((s) => s.stance)).toEqual(["differ", "agree", "add"]);
    // the discussion is over and the chair has not been asked to write yet: nobody is thinking
    expect(t.seats.every((s) => s.thinking === null && s.answeredNow)).toBe(true);
  });

  it("waits on the chair while it writes the plan", () => {
    const c = council({
      ...deliberated,
      rounds: [...deliberated.rounds, { round: "synthesis", index: 0, startedSeq: 10, said: [] }],
      lastSeq: 10,
    });
    const t = table(c);
    expect(t.seats[0]).toMatchObject({ chair: true, thinking: "plan" });
    expect(t.seats[0]?.label).toBe("Mo's agent, chair, writing the plan, Mo is not in the room");
    expect(t.centre).toEqual({ kind: "writing", chair: "Mo's agent", wordsIn: 6 });
    expect(t.line).toBe("Mo's agent is writing the plan.");
  });

  it("draws the plan with its owners, the dissent and the people's ratings", () => {
    const t = table(planned, "ana", { status: "proposed", ratings: { bo: 4 } }, ["ana", "bo"]);
    expect(t.centre).toEqual({
      kind: "plan",
      steps: 3,
      owners: 2,
      state: "waits for you",
      short: "waits for you",
    });
    const [mo, a, b] = t.seats;
    expect(mo?.label).toBe(
      "Mo's agent, chair, wrote the plan, Mo is not in the room, the plan waits for Mo's rating",
    );
    expect(a?.steps).toEqual([
      { n: 1, done: false },
      { n: 3, done: false },
    ]);
    expect(a?.label).toBe(
      "Ana's agent, agrees, answered round 2, owns steps 1 and 3, you are in the room, the plan waits for your rating",
    );
    expect(b).toMatchObject({ dissent: "Round per line.", stance: "differ" });
    expect(b?.person).toMatchObject({ rating: 4, waited: false, present: true });
    expect(b?.label).toBe(
      "Bo's agent, differs, answered round 2, holds a dissent, owns step 2, Bo is in the room, Bo rated the plan 4",
    );
    expect(t.voting).toBe(true);
    expect(t.waitsForMe).toBe(true);
    expect(t.ratingsFraction).toBeCloseTo(1 / 3);
    expect(t.wordsFraction).toBe(1);
    expect(t.dissent).toEqual([{ key: "agent:bo", name: "Bo's agent", text: "Round per line." }]);
    expect(t.line).toBe(
      "The plan waits for your rating. 1 of 3 at the table rated it. Bo's agent holds a dissent.",
    );
    expect(t.mine?.profileId).toBe("agent:ana");
  });

  it("holds the vote until the chair's session says who rated", () => {
    const t = table(planned);
    expect(t.voting).toBe(false);
    expect(t.waitsForMe).toBe(false);
    expect(t.seats.every((s) => !s.person?.waited)).toBe(true);
    expect(t.line).toBe("The plan is written. Opening it for ratings. Bo's agent holds a dissent.");
  });

  it("seats a person in the room who brought no model, and whoever rated", () => {
    const t = table(planned, "cy", { status: "proposed", ratings: { dee: 5 } }, ["cy"]);
    expect(t.guests.map((g) => g.label)).toEqual([
      "you, you are in the room, the plan waits for your rating",
      "dee, dee is not in the room, dee rated the plan 5",
    ]);
    expect(t.more).toBe(0);
    expect(t.mine).toBeNull();
    // three owners and two guests: one of five rated
    expect(t.ratingsFraction).toBeCloseTo(1 / 5);
    const crowd = table(planned, "cy", null, ["cy", "d1", "d2", "d3", "d4", "d5"]);
    expect(crowd.guests).toHaveLength(4);
    expect(crowd.more).toBe(2);
  });

  it("shows a private instruction only on the table of the person who gave it", () => {
    const c = council({
      ...deliberated,
      instructions: [{ member: bo, by: "cy", text: "Be brief", seq: 6 }],
    });
    const mark = (meId: string) => table(c, meId).seats.find((s) => s.key === "agent:bo");
    expect(mark("cy")?.instructed).toBe(true);
    expect(mark("cy")?.label).toContain("you instructed it in private");
    // the model's owner and the chair's owner may read the instruction, but the mark is not theirs
    for (const other of ["bo", "mo", "ana"]) {
      expect(mark(other)?.instructed).toBe(false);
      expect(mark(other)?.label).not.toContain("instructed");
    }
  });

  it("closes the rim when the plan is approved and counts the work", () => {
    const working = council({
      ...planned,
      status: "working",
      assignments: { s1: { stepId: "s1", owner: ana, projectId: "p", sessionId: "a", seq: 13 } },
      reports: {
        s1: { stepId: "s1", owner: ana, status: "done", text: "", usage: ZERO_USAGE, seq: 14 },
      },
    });
    const t = table(working, "ana", { status: "approved", ratings: { ana: 5, bo: 4 } });
    expect(t.ratingsFraction).toBe(1);
    expect(t.waitsForMe).toBe(false);
    expect(t.seats[1]?.steps).toEqual([
      { n: 1, done: true },
      { n: 3, done: false },
    ]);
    expect(t.centre).toMatchObject({ kind: "plan", state: "1 of 3 done" });
    expect(t.line).toBe("Working. 1 of 3 steps done. Bo's agent holds a dissent.");
    const over = table(council({ ...working, status: "concluded", outcome: "done" }));
    expect(over.line).toBe("Concluded · done.");
    expect(over.centre).toMatchObject({ kind: "plan", state: "done" });
    expect(over.mine).toBeNull();
    expect(over.seats.every((s) => s.thinking === null)).toBe(true);
  });

  it("keeps the answer alone and the two latest replies per seat", () => {
    const long = council({
      discussionRounds: 3,
      rounds: [
        { round: "individual", index: 0, startedSeq: 2, said: [said(ana, 3)] },
        { round: "discussion", index: 0, startedSeq: 4, said: [said(ana, 5, "agree")] },
        { round: "discussion", index: 1, startedSeq: 6, said: [said(ana, 7, "add")] },
        { round: "discussion", index: 2, startedSeq: 8, said: [said(ana, 9, "differ")] },
      ],
      lastSeq: 9,
    });
    const a = table(long).seats[1];
    expect(a?.words.map((w) => [w.round, w.ordinal, w.stance])).toEqual([
      ["individual", 1, null],
      ["discussion", 3, "add"],
      ["discussion", 4, "differ"],
    ]);
    expect(a).toMatchObject({ stance: "differ", answered: 4 });
  });

  it("reads the vote from the plan's status", () => {
    expect(voteOf(null)).toBe("pending");
    expect(voteOf({ status: "proposed", ratings: {} })).toBe("pending");
    expect(voteOf({ status: "revise", ratings: {} })).toBe("revise");
    expect(voteOf({ status: "rejected", ratings: {} })).toBe("rejected");
    expect(voteOf({ status: "approved", ratings: {} })).toBe("approved");
    expect(voteOf({ status: "done", ratings: {} })).toBe("approved");
  });
});

describe("the table's geometry", () => {
  it("puts the chair at twelve and every seat on the ring, inside the width it is given", () => {
    for (const [width, seats] of [
      [732, 5],
      [732, 4],
      [358, 5],
      [358, 4],
      [358, 9],
      [732, 12],
    ] as const) {
      const g = tableGeometry(width, seats);
      expect(g.seats).toHaveLength(seats);
      expect(g.seats[0]?.x).toBeCloseTo(g.cx);
      expect(g.seats[0]?.y).toBeCloseTo(g.cy - g.r);
      for (const s of g.seats) {
        expect(Math.hypot(s.x - g.cx, s.y - g.cy)).toBeCloseTo(g.r);
        expect(Math.hypot(s.person.x - g.cx, s.person.y - g.cy)).toBeCloseTo(g.r);
        // the tile, stepped back for a dissent, and its label's anchor stay on the stage
        const reach = s.tile / 2 + Math.abs(s.step.x);
        expect(s.x - reach).toBeGreaterThanOrEqual(0);
        expect(s.x + reach).toBeLessThanOrEqual(width);
        expect(s.label.x).toBeGreaterThanOrEqual(0);
        expect(s.label.x).toBeLessThanOrEqual(width);
        expect(s.y + s.tile / 2).toBeLessThanOrEqual(g.height);
      }
      expect(g.rc).toBeLessThan(g.r - 30);
    }
  });

  it("folds the labels to names on a phone and past seven seats", () => {
    expect(tableGeometry(732, 5).compact).toBe(false);
    expect(tableGeometry(732, TABLE_SEAT_CAP).compact).toBe(false);
    expect(tableGeometry(732, TABLE_SEAT_CAP + 1).compact).toBe(true);
    expect(tableGeometry(TABLE_WIDE_MIN - 1, 5).compact).toBe(true);
    expect(tableGeometry(358, 5).compact).toBe(true);
  });

  it("gives every tile at least 24 px of its own, at any count", () => {
    for (const [width, seats] of [
      [732, 5],
      [358, 5],
      [358, 14],
    ] as const)
      for (const s of tableGeometry(width, seats).seats) expect(s.tile).toBeGreaterThanOrEqual(24);
  });

  it("promises a label beside the ring nine characters on a phone", () => {
    const g = tableGeometry(358, 4);
    expect(g.seats[1]?.label.side).toBe("beside");
    expect(g.seats[1]?.label.nameChars).toBeGreaterThanOrEqual(9);
    expect(g.seats[0]?.label.side).toBe("above");
    expect(g.seats[2]?.label.side).toBe("below");
  });

  it("breaks a name at a space and cuts what still does not fit", () => {
    expect(nameLines("Ana's agent", 18, 1)).toEqual(["Ana's agent"]);
    expect(nameLines("Chat team agent", 9, 2)).toEqual(["Chat team", "agent"]);
    expect(nameLines("Ana's agent", 9, 2)).toEqual(["Ana's", "agent"]);
    expect(nameLines("Reconciliation agent", 9, 2)).toEqual(["Reconcil…"]);
    expect(nameLines("A very long model name", 12, 1)).toEqual(["A very long…"]);
  });

  it("keeps a seat's words inside its sector at any count", () => {
    expect(wordSpread(4)).toBe(24);
    expect(wordSpread(7)).toBeLessThan(180 / 7);
    expect(wordSpread(20)).toBeLessThanOrEqual(180 / 20);
  });
});
