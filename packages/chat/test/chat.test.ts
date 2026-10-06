import { describe, expect, it } from "vitest";
import { memberKey, memberName } from "../src/events.js";
import { mentionsIn, splitMentions } from "../src/mentions.js";
import { foldChat, groupsOf, unreadByGroup, unreadCount, unreadIn } from "../src/state.js";
import { Chat, type ChatDirectory } from "../src/store.js";

const people: Record<string, string> = { ana: "Ana", bo: "Bo", dee: "Dee", cy: "Cy" };
const sessions: Record<string, { projectId: string; title: string; ownerId: string }> = {
  "s-ana": { projectId: "billing", title: "Ana's agent", ownerId: "ana" },
  "s-bo": { projectId: "billing", title: "Invoice PDF", ownerId: "bo" },
};
const directory: ChatDirectory = {
  person: (id) => (people[id] ? { id, name: people[id] as string } : null),
  agent: (projectId, sessionId) => {
    const s = sessions[sessionId];
    return s && s.projectId === projectId ? { projectId, sessionId, ...s } : null;
  },
  isLead: (id, scope) => id === "dee" && (scope.projectId === "billing" || scope.teamId === "pay"),
};

let clock = 1_700_000_000_000;
const now = () => (clock += 60_000);
const anaAgent = { kind: "agent" as const, projectId: "billing", sessionId: "s-ana" };

describe("groups", () => {
  it("any org member creates a group and is its first member; names and titles are recorded", () => {
    const chat = Chat.create("northwind", { directory, now });
    const g = chat.createGroup("ana", {
      name: "Invoice rollout",
      scope: { projectId: "billing" },
      purpose: "Ship the PDF invoices",
      members: [{ kind: "human", userId: "bo" }, anaAgent],
    });
    expect(g.createdBy).toBe("ana");
    expect(g.members.map(memberKey)).toEqual(["human:ana", "human:bo", "agent:billing/s-ana"]);
    expect(g.members.map(memberName)).toEqual(["Ana", "Bo", "Ana's agent"]);
    expect(() => chat.createGroup("zed", { name: "Nope" })).toThrow(/not in this organisation/);
    expect(chat.log.verify()).toEqual({ ok: true });
  });

  it("members are managed by the creator or a lead; an agent by its session's owner too; anyone leaves", () => {
    const chat = Chat.create("northwind", { directory, now });
    const g = chat.createGroup("ana", { name: "Rollout", scope: { projectId: "billing" } });
    expect(() => chat.addMember("bo", g.id, { kind: "human", userId: "cy" })).toThrow(
      /unauthorized|creator or a lead/,
    );
    chat.addMember("ana", g.id, { kind: "human", userId: "bo" });
    chat.addMember("dee", g.id, { kind: "human", userId: "cy" }); // lead of billing
    // Bo owns s-bo: he may bring his own agent, but not Ana's.
    chat.addMember("bo", g.id, { kind: "agent", projectId: "billing", sessionId: "s-bo" });
    expect(() => chat.addMember("bo", g.id, anaAgent)).toThrow(/owner|lead/);
    chat.addMember("ana", g.id, anaAgent);
    expect(() =>
      chat.addMember("ana", g.id, { kind: "agent", projectId: "billing", sessionId: "s-zed" }),
    ).toThrow(/no session/);
    expect(chat.state().groups[g.id]?.members.length).toBe(5);
    // Adding again is a no-op, not a second row.
    expect(chat.addMember("ana", g.id, { kind: "human", userId: "bo" })).toBeNull();
    // Cy leaves on his own; Bo cannot remove Cy.
    chat.removeMember("cy", g.id, { kind: "human", userId: "cy" });
    expect(() => chat.removeMember("bo", g.id, { kind: "human", userId: "ana" })).toThrow(
      /unauthorized|creator or a lead/,
    );
    chat.removeMember("dee", g.id, { kind: "agent", projectId: "billing", sessionId: "s-bo" });
    expect(chat.state().groups[g.id]?.members.map(memberKey)).toEqual([
      "human:ana",
      "human:bo",
      "agent:billing/s-ana",
    ]);
    chat.rename("dee", g.id, "Invoice rollout", "PDF invoices by Friday");
    expect(() => chat.rename("bo", g.id, "Mine")).toThrow(/unauthorized|creator or a lead/);
    const after = chat.state().groups[g.id];
    expect([after?.name, after?.purpose]).toEqual(["Invoice rollout", "PDF invoices by Friday"]);
  });
});

describe("mentions", () => {
  const members = [
    { kind: "human" as const, userId: "ana", name: "Ana" },
    { kind: "human" as const, userId: "bo", name: "Bo" },
    { kind: "human" as const, userId: "bob", name: "Bob Ray" },
    anaAgent && { ...anaAgent, title: "Ana's agent" },
  ];
  it("resolves people by name or id and agents by title or session id, longest match first", () => {
    expect(mentionsIn("@Ana's agent, can you take tests? cc @bo", members)).toEqual([
      { kind: "agent", id: "s-ana" },
      { kind: "human", id: "bo" },
    ]);
    expect(mentionsIn("@ana please", members)).toEqual([{ kind: "human", id: "ana" }]);
    expect(mentionsIn("@s-ana status?", members)).toEqual([{ kind: "agent", id: "s-ana" }]);
    expect(mentionsIn("@Bob Ray and @bob", members)).toEqual([{ kind: "human", id: "bob" }]);
    // Word boundaries and e-mail-like text do not mention anyone.
    expect(mentionsIn("@bobby ana@example.com", members)).toEqual([]);
    expect(mentionsIn("no mentions here", members)).toEqual([]);
  });
  it("splits a message into runs so what is highlighted is what was resolved", () => {
    const runs = splitMentions("Hey @Ana's agent, @bo?", members);
    expect(runs.map((r) => [r.text, r.member ? memberKey(r.member) : null])).toEqual([
      ["Hey ", null],
      ["@Ana's agent", "agent:billing/s-ana"],
      [", ", null],
      ["@bo", "human:bo"],
      ["?", null],
    ]);
  });
});

describe("messages and reads", () => {
  it("members post, mentions are recorded, agents reply, read markers give unread counts", () => {
    const chat = Chat.create("northwind", { directory, now });
    const g = chat.createGroup("ana", {
      name: "Rollout",
      scope: { projectId: "billing" },
      members: [{ kind: "human", userId: "bo" }, anaAgent],
    });
    expect(() => chat.post("cy", g.id, "hello")).toThrow(/not a member/);
    const m1 = chat.post("bo", g.id, "@Ana's agent what is the plan?");
    expect(m1.mentions).toEqual([{ kind: "agent", id: "s-ana" }]);
    expect(m1.message.author).toEqual({ kind: "human", userId: "bo" });
    const r = chat.agentReply("billing", "s-ana", g.id, m1.message.id, "Writing the plan.", 3);
    expect(r.kind).toBe("message.agent.replied");
    expect(() =>
      chat.agentReply("billing", "s-bo", g.id, m1.message.id, "I am not here", 1),
    ).toThrow(/not a member/);
    // Ana has not opened the group: Bo's message and the reply are new to her.
    expect(unreadIn(chat.state(), "ana", g.id)).toBe(2);
    const m2 = chat.post("ana", g.id, "Thanks @bo", m1.message.id);
    expect(m2.message.replyTo).toBe(m1.message.id);
    const st = chat.state();
    expect(st.messages[g.id]?.map((m) => m.author.kind)).toEqual(["human", "agent", "human"]);
    expect(st.messages[g.id]?.[1]?.turn).toBe(3);
    // Posting means you saw what came before; Bo has the reply and Ana's answer waiting.
    expect(unreadIn(st, "ana", g.id)).toBe(0);
    expect(unreadIn(st, "bo", g.id)).toBe(2);
    expect(chat.read("ana", g.id)).toBeNull();
    chat.read("bo", g.id);
    expect(unreadCount(chat.state(), "bo")).toBe(0);
    expect(unreadByGroup(chat.state(), "bo")).toEqual({ [g.id]: 0 });
    chat.post("ana", g.id, "one more");
    expect(unreadByGroup(chat.state(), "bo")).toEqual({ [g.id]: 1 });
    expect(groupsOf(chat.state(), "cy")).toEqual([]);
    // The fold of the serialized log is the state we hold.
    const again = Chat.fromSerialized(chat.log.serialize(), { directory });
    expect(again.state()).toEqual(chat.state());
    expect(foldChat(chat.events())).toEqual(chat.state());
    expect(again.log.verify()).toEqual({ ok: true });
  });

  it("the agent's reply is cut at 1200 characters and a reply needs a message that exists", () => {
    const chat = Chat.create("northwind", { directory, now });
    const g = chat.createGroup("ana", { name: "Rollout", members: [anaAgent] });
    const m = chat.post("ana", g.id, "@s-ana go");
    chat.agentReply("billing", "s-ana", g.id, m.message.id, "x".repeat(5000), 1);
    expect(chat.state().messages[g.id]?.[1]?.text.length).toBe(1200);
    expect(() => chat.post("ana", g.id, "reply", "msg_nope")).toThrow(/no message/);
  });
});
