import { Chat, type CouncilMember, pendingInstructions } from "@henosis/chat";
import { describe, expect, it } from "vitest";
import {
  COUNCIL_SYNTHESIS_TOOL,
  citesFor,
  councilPrompt,
  parseSaid,
  parseStance,
  parseSynthesis,
  renderCouncilBrief,
} from "../src/council.js";
import { ScriptedModel, scriptedApproach, scriptedStance } from "../src/scripted.js";

const model = (userId: string | null, profileId: string, name: string): CouncilMember => ({
  kind: "agent",
  userId,
  profileId,
  name,
});
const ana = model("ana", "agent:ana", "Ana's agent");
const bo = model("bo", "agent:bo", "Bo's agent");
const pay = model(null, "team:pay", "Payments agent");
const dee = model("dee", "agent:dee", "Dee's agent");

let clock = 1_700_000_000_000;
const now = () => (clock += 60_000);

function convened(task = "Ship PDF invoices by Friday") {
  const chat = Chat.create("northwind", { now });
  const g = chat.createGroup("ana", {
    name: "Rollout",
    members: [
      { kind: "human", userId: "bo" },
      { kind: "human", userId: "dee" },
    ],
  });
  const c = chat.convene("ana", g.id, { task, members: [ana, bo, pay], chair: dee });
  return { chat, id: c.id, council: () => chat.council(c.id) };
}

describe("councilPrompt", () => {
  it("renders the individual round alone: the task, the circle, the manner, no answers", () => {
    const { council } = convened();
    const req = councilPrompt(ana, council(), { round: "individual", index: 0 }, [], {
      persona: "Terse.",
      context: ["Bo: let's decide today"],
    });
    expect(req.council?.round).toBe("individual");
    expect(req.council?.member).toEqual(ana);
    expect(req.council?.answers).toEqual([]);
    expect(req.intent.goal?.text).toBe("Ship PDF invoices by Friday");
    expect(req.planFirst).toBe(false);
    expect(req.tools).toEqual([]);
    expect(req.turn).toBe(0);
    expect(req.title).toBe("Council: Ship PDF invoices by Friday");
    const brief = req.intentText;
    expect(brief).toContain("TASK: Ship PDF invoices by Friday");
    expect(brief).toContain("YOU ARE: Ana's agent (ana's model)");
    expect(brief).toContain("CHAIR: Dee's agent (dee's model)");
    expect(brief).toContain("Payments agent (shared)");
    expect(brief).toContain("YOUR MANNER: Terse.");
    expect(brief).toContain("- Bo: let's decide today");
    expect(brief).toContain("ROUND: individual.");
    expect(brief).not.toContain("SAID SO FAR");
    expect(brief).not.toContain("INSTRUCTED");
    // Same state, same request.
    expect(
      councilPrompt(ana, council(), { round: "individual", index: 0 }, [], {
        persona: "Terse.",
        context: ["Bo: let's decide today"],
      }),
    ).toEqual(req);
  });

  it("the discussion reads every earlier answer and the pending instructions, which it must cite", () => {
    const { chat, id, council } = convened();
    chat.startRound(id, { round: "individual", index: 0 });
    chat.said(id, { round: "individual", index: 0 }, ana, { text: "Tests first." });
    chat.said(id, { round: "individual", index: 0 }, bo, { text: "Smallest slice." });
    chat.said(id, { round: "individual", index: 0 }, pay, { text: "Reuse the exporter." });
    chat.instruct("bo", id, bo, "Insist on Friday");
    chat.instruct("dee", id, bo, "Mention the audit");
    chat.instruct("ana", id, ana, "Not for Bo");
    chat.startRound(id, { round: "discussion", index: 0 });
    const pending = pendingInstructions(council(), bo);
    const req = councilPrompt(bo, council(), { round: "discussion", index: 0 }, pending);
    expect(req.turn).toBe(1);
    expect(req.council?.answers.map((a) => [a.member.name, a.round, a.text])).toEqual([
      ["Ana's agent", "individual", "Tests first."],
      ["Bo's agent", "individual", "Smallest slice."],
      ["Payments agent", "individual", "Reuse the exporter."],
    ]);
    expect(req.council?.instructions).toEqual([
      { by: "bo", text: "Insist on Friday" },
      { by: "dee", text: "Mention the audit" },
    ]);
    expect(req.newDirectives).toEqual([
      "instructed by bo: Insist on Friday",
      "instructed by dee: Mention the audit",
    ]);
    expect(req.history).toHaveLength(3);
    const brief = req.intentText;
    expect(brief).toContain("INSTRUCTED IN PRIVATE");
    expect(brief).toContain("- bo: Insist on Friday");
    expect(brief).not.toContain("Not for Bo");
    expect(brief).toContain("- individual 1, Bo's agent (you): Smallest slice.");
    expect(brief).toContain("ROUND: discussion 1.");
    expect(citesFor(req.council as NonNullable<typeof req.council>)).toEqual([
      { kind: "instruction", by: "bo" },
      { kind: "instruction", by: "dee" },
    ]);
    // Hand the brief to the chat: the member's word carries its cites and its stance.
    const said = parseSaid(
      { text: "DIFFER:\nFriday matters (instructed by bo)." },
      req.council as NonNullable<typeof req.council>,
    );
    expect(said).toEqual({
      text: "DIFFER:\nFriday matters (instructed by bo).",
      stance: "differ",
      cites: [
        { kind: "instruction", by: "bo" },
        { kind: "instruction", by: "dee" },
      ],
    });
    chat.said(id, { round: "discussion", index: 0 }, bo, said);
    expect(pendingInstructions(council(), bo)).toEqual([]);
    expect(pendingInstructions(council(), ana).map((i) => i.text)).toEqual(["Not for Bo"]);
  });

  it("the synthesis prompt is for the chair with the synthesis tool; the vote has no prompt", () => {
    const { chat, id, council } = convened();
    chat.startRound(id, { round: "individual", index: 0 });
    for (const m of [ana, bo, pay])
      chat.said(id, { round: "individual", index: 0 }, m, { text: `${m.name} says` });
    chat.startRound(id, { round: "discussion", index: 0 });
    for (const m of [ana, bo, pay])
      chat.said(id, { round: "discussion", index: 0 }, m, { text: "AGREE", stance: "agree" });
    chat.startRound(id, { round: "synthesis", index: 0 });
    const req = councilPrompt(dee, council(), { round: "synthesis", index: 0 }, []);
    expect(req.tools.map((t) => t.name)).toEqual([COUNCIL_SYNTHESIS_TOOL]);
    expect(req.intentText).toContain("YOU ARE: Dee's agent (dee's model), the chair");
    expect(req.intentText).toContain("ROUND: synthesis.");
    expect(req.council?.answers).toHaveLength(6);
    expect(req.council?.answers[3]?.stance).toBe("agree");
    expect(() => councilPrompt(dee, council(), { round: "vote", index: 0 }, [])).toThrow(/vote/);
    const brief = renderCouncilBrief({
      ...(req.council as NonNullable<typeof req.council>),
      round: "vote",
    });
    expect(brief).toContain("ROUND: vote.");
  });
});

describe("parsing replies", () => {
  it("reads the stance from the first line", () => {
    expect(parseStance("AGREE\nbecause")).toBe("agree");
    expect(parseStance("  Differ: the scope")).toBe("differ");
    expect(parseStance("ADD.")).toBe("add");
    expect(parseStance("I agree")).toBeNull();
    expect(parseStance("")).toBeNull();
  });

  it("reads the chair's plan: owners resolve to members, unknown owners fall to the chair", () => {
    const council = { chair: dee, members: [ana, bo, pay] };
    const res = {
      text: "Settled.",
      toolCalls: [
        {
          id: "x",
          name: COUNCIL_SYNTHESIS_TOOL,
          args: {
            steps: [
              { id: "a", title: "Write", owner: "agent:ana", estTokens: 400.4, risk: "write" },
              { title: "Test", detail: "node --test", owner: "agent:bo", risk: "exec" },
              { title: "Tell", owner: "nobody" },
            ],
            rationale: "Small steps.",
            dissent: [
              { member: "agent:bo", text: "Too slow" },
              { member: "ghost", text: "ignored" },
              { member: "team:pay", text: "   " },
            ],
          },
          risk: "read" as const,
        },
      ],
    };
    const plan = parseSynthesis(res, council);
    expect(plan?.steps.map((s) => [s.id, s.title, s.owner.profileId, s.estTokens, s.risk])).toEqual(
      [
        ["a", "Write", "agent:ana", 400, "write"],
        ["s2", "Test", "agent:bo", 0, "exec"],
        ["s3", "Tell", "agent:dee", 0, "write"],
      ],
    );
    expect(plan?.dissent).toEqual([{ member: bo, text: "Too slow" }]);
    expect(plan?.rationale).toBe("Small steps.");
    expect(parseSynthesis({ text: "no plan", toolCalls: [] }, council)).toBeNull();
    expect(
      parseSynthesis(
        {
          text: "",
          toolCalls: [{ id: "x", name: COUNCIL_SYNTHESIS_TOOL, args: { steps: [] }, risk: "read" }],
        },
        council,
      ),
    ).toBeNull();
    expect(
      parseSynthesis(
        {
          text: "",
          toolCalls: [
            {
              id: "x",
              name: COUNCIL_SYNTHESIS_TOOL,
              args: { steps: [{ owner: "agent:ana" }] },
              risk: "read",
            },
          ],
        },
        council,
      ),
    ).toBeNull();
  });
});

describe("the scripted member model", () => {
  it("takes a stance and an approach from a hash of the task and the member", () => {
    const task = "Ship PDF invoices by Friday";
    expect(scriptedStance(task, ana)).toBe(scriptedStance(task, ana));
    expect(scriptedApproach(task, ana)).toEqual(scriptedApproach(task, ana));
    expect(["agree", "differ", "add"]).toContain(scriptedStance(task, ana));
    // Different members or tasks spread over the stances and approaches.
    const members = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((x) =>
      model(x, `agent:${x}`, x),
    );
    const stances = new Set(members.map((m) => scriptedStance(task, m)));
    expect(stances.size).toBeGreaterThan(1);
    const approaches = new Set(members.map((m) => scriptedApproach(task, m).approach));
    expect(approaches.size).toBeGreaterThan(1);
    expect(scriptedApproach("Other task", ana)).not.toEqual(scriptedApproach(task, ana));
  });

  it("answers every round deterministically, cites instructions, and chairs with owners round-robin", async () => {
    const m = new ScriptedModel();
    const { chat, id, council } = convened();
    const task = council().task;
    chat.startRound(id, { round: "individual", index: 0 });
    chat.instruct("bo", id, bo, "Insist on Friday");
    for (const member of [ana, bo, pay]) {
      const req = councilPrompt(
        member,
        council(),
        { round: "individual", index: 0 },
        pendingInstructions(council(), member),
      );
      const a = await m.complete(req);
      const b = await m.complete(req);
      expect(a).toEqual(b);
      expect(a.toolCalls).toEqual([]);
      expect(a.text).toContain(
        `${member.name} on "${task}": I would ${scriptedApproach(task, member).approach}`,
      );
      expect(a.usage?.input).toBeGreaterThan(0);
      chat.said(id, { round: "individual", index: 0 }, member, {
        ...parseSaid(a, req.council as NonNullable<typeof req.council>),
        ...(a.usage ? { usage: a.usage } : {}),
      });
    }
    const boWord = council().rounds[0]?.said[1];
    expect(boWord?.text).toContain("instructed by bo: Insist on Friday");
    expect(boWord?.cites).toEqual([{ kind: "instruction", by: "bo" }]);
    expect(council().usage.input).toBeGreaterThan(0);

    chat.startRound(id, { round: "discussion", index: 0 });
    for (const member of [ana, bo, pay]) {
      const req = councilPrompt(member, council(), { round: "discussion", index: 0 }, []);
      const res = await m.complete(req);
      const said = parseSaid(res, req.council as NonNullable<typeof req.council>);
      expect(said.stance).toBe(scriptedStance(task, member));
      expect(res.text.split("\n")[0]).toBe(scriptedStance(task, member).toUpperCase());
      chat.said(id, { round: "discussion", index: 0 }, member, said);
    }
    const differing = council().rounds[1]?.said.filter((s) => s.stance === "differ") ?? [];

    chat.startRound(id, { round: "synthesis", index: 0 });
    const req = councilPrompt(dee, council(), { round: "synthesis", index: 0 }, []);
    const res = await m.complete(req);
    expect(res.done).toBe(true);
    const plan = parseSynthesis(res, council());
    expect(plan).not.toBeNull();
    const steps = (plan as NonNullable<typeof plan>).steps;
    // One step per member, then the verification step; owners dealt in turn and wrapping.
    expect(steps.map((s) => s.owner.profileId)).toEqual([
      "agent:ana",
      "agent:bo",
      "team:pay",
      "agent:ana",
    ]);
    expect(steps.map((s) => s.id)).toEqual(["s1", "s2", "s3", "s4"]);
    expect(steps[3]?.risk).toBe("exec");
    expect(steps.every((s) => s.estTokens > 0)).toBe(true);
    expect((plan as NonNullable<typeof plan>).dissent.map((d) => d.member.profileId)).toEqual(
      differing.map((d) => d.member.profileId),
    );
    chat.synthesise(id, "plan_1", steps, (plan as NonNullable<typeof plan>).dissent);
    expect(chat.next(id)).toEqual({ kind: "start-round", round: "vote", index: 0 });
    chat.startRound(id, { round: "vote", index: 0 });
    expect(chat.next(id, "approved")).toMatchObject({ kind: "assign" });
    expect(chat.log.verify()).toEqual({ ok: true });
  });
});
