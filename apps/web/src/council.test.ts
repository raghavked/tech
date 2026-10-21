/**
 * The council as the web reads it (council.ts): the member models the convene sheet offers,
 * the chair it proposes, the words on the rail card and who may see a private instruction.
 */
import type { Council } from "@henosis/chat";
import { ZERO_USAGE } from "@henosis/protocol";
import { describe, expect, it } from "vitest";
import type { ChatDirectoryListing, ModelRow } from "./api.js";
import {
  canSeeInstruction,
  councilCard,
  defaultChair,
  isManagerModel,
  labelWord,
  memberModels,
  modelsOf,
} from "./council.js";

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
