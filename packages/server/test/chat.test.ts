import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ChatEvent, type ChatState, foldChat } from "@henosis/chat";
import { defaultTools, ScriptedModel } from "@henosis/runner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
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
};

type Incoming =
  | { type: "chat.snapshot"; orgId: string; events: ChatEvent[] }
  | { type: "chat.event"; event: ChatEvent }
  | { type: "error"; message: string };

/** A chat subscriber over the websocket front door, folding what it receives. */
class ChatClient {
  ws: WebSocket;
  state: ChatState | null = null;
  events: ChatEvent[] = [];
  errors: string[] = [];
  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString()) as Incoming;
      if (m.type === "chat.snapshot") {
        this.events = m.events;
        this.state = foldChat(m.events);
      } else if (m.type === "chat.event") {
        this.events.push(m.event);
        this.state = this.state ? foldChat([m.event], this.state) : null;
      } else if (m.type === "error") this.errors.push(m.message);
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
      await new Promise((r) => setTimeout(r, 40));
    }
    throw new Error(`timeout; errors: ${this.errors.join("; ")}`);
  }
  close(): void {
    this.ws.close();
  }
}

describe("groups and chats", () => {
  let root: string;
  let server: HenosisServer;
  let port: number;
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "henosis-chat-"));
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
          { id: "dee", name: "Dee", teams: [{ teamId: "pay", role: "lead" }] },
          { id: "zed", name: "Zed", orgs: [{ orgId: "other", role: "member" }] },
        ],
      }),
    );
    server = new HenosisServer({
      root,
      model: new ScriptedModel(),
      tools: defaultTools(),
      defaultPolicy: sessionPolicy,
    });
    port = await server.listen(0);
  });
  afterAll(async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("Ana, Bo and Ana's agent share a group; Bo's mention steers the agent and its reply lands in the chat", async () => {
    // Ana's agent: a session with a goal, idle after one finished turn.
    const ph = server.project("billing");
    const sh = ph.session("s-ana", { title: "Ana's agent", ownerId: "ana" });
    sh.session.join("main", { id: "ana", kind: "human", name: "Ana" }, "owner");
    sh.session.directive("main", "ana", { text: "Build a doubling helper" });
    await sh.drive("main");
    expect(sh.session.state().status).toBe("idle");
    const turnsBefore = sh.session.state().turn;

    const url = `ws://127.0.0.1:${port}/ws`;
    const ana = new ChatClient(url);
    const bo = new ChatClient(url);
    await Promise.all([ana.open(), bo.open()]);
    ana.send({ type: "chat.subscribe", orgId: "nw", userId: "ana" });
    bo.send({ type: "chat.subscribe", orgId: "nw", userId: "bo" });
    await ana.until((s) => s.orgId === "nw");
    await bo.until((s) => s.orgId === "nw");

    ana.send({
      type: "chat.create",
      name: "Rollout",
      scope: { projectId: "billing" },
      purpose: "Invoice PDFs by Friday",
      members: [
        { kind: "human", userId: "bo" },
        { kind: "agent", projectId: "billing", sessionId: "s-ana" },
      ],
    });
    const created = await bo.until((s) =>
      Object.values(s.groups).some((g) => g.name === "Rollout"),
    );
    const group = Object.values(created.groups).find((g) => g.name === "Rollout");
    if (!group) throw new Error("no group");
    await bo.until((s) => (s.groups[group.id]?.members.length ?? 0) === 3);
    expect(bo.state?.groups[group.id]?.members).toEqual([
      { kind: "human", userId: "ana", name: "Ana" },
      { kind: "human", userId: "bo", name: "Bo" },
      { kind: "agent", projectId: "billing", sessionId: "s-ana", title: "Ana's agent" },
    ]);
    // Someone outside the organisation cannot be added; Bo is not the creator or a lead.
    bo.send({ type: "chat.add", groupId: group.id, member: { kind: "human", userId: "dee" } });
    ana.send({ type: "chat.add", groupId: group.id, member: { kind: "human", userId: "zed" } });
    await new Promise((r) => setTimeout(r, 200));
    expect(bo.errors.some((e) => /creator or a lead/.test(e))).toBe(true);
    expect(ana.errors.some((e) => /not in this organisation/.test(e))).toBe(true);

    // Bo mentions the agent: the session gets a steer in the scope "chat", authored by Bo.
    bo.send({ type: "chat.say", groupId: group.id, text: "@Ana's agent what is left to do?" });
    const posted = await ana.until((s) => (s.messages[group.id]?.length ?? 0) >= 1);
    const first = posted.messages[group.id]?.[0];
    expect(first?.mentions).toEqual([{ kind: "agent", id: "s-ana" }]);
    const st = sh.session.state();
    const steer = Object.values(st.directives).find((d) => d.input.scope === "chat");
    expect(steer?.author).toBe("bo");
    expect(steer?.input.mode).toBe("steer");
    expect(steer?.input.text).toBe("Bo in #Rollout: @Ana's agent what is left to do?");
    // Bo joined as a contributor by the identity rules (a member of billing), and is not present.
    expect(st.participants.bo?.role).toBe("contributor");
    expect(st.participants.bo?.present).toBe(false);

    // The scripted agent runs a turn and its first words come back into the group.
    const replied = await bo.until((s) =>
      (s.messages[group.id] ?? []).some((m) => m.author.kind === "agent"),
    );
    const reply = (replied.messages[group.id] ?? []).find((m) => m.author.kind === "agent");
    expect(reply?.author).toEqual({ kind: "agent", projectId: "billing", sessionId: "s-ana" });
    expect(reply?.replyTo).toBe(first?.id);
    expect(reply?.text).toContain("to match the team's direction");
    expect(reply?.turn).toBe(turnsBefore + 1);
    await new Promise((r) => setTimeout(r, 300));
    // One reply per mention, not one per model step.
    expect(
      (bo.state?.messages[group.id] ?? []).filter((m) => m.author.kind === "agent"),
    ).toHaveLength(1);

    // Unread: Ana has Bo's message and the reply; Bo only the reply. Reading clears it.
    const unread = async (user: string) =>
      (await (await fetch(`http://127.0.0.1:${port}/api/chat/nw/unread?user=${user}`)).json()) as {
        total: number;
        groups: { groupId: string; name: string; unread: number }[];
      };
    expect((await unread("ana")).total).toBe(2);
    expect((await unread("bo")).groups).toEqual([
      expect.objectContaining({ groupId: group.id, name: "Rollout", unread: 1 }),
    ]);
    ana.send({ type: "chat.read", groupId: group.id });
    await ana.until((s) => (s.reads.ana?.[group.id] ?? -1) >= (s.groups[group.id]?.lastSeq ?? 0));
    expect((await unread("ana")).total).toBe(0);
    expect((await unread("zed")).groups).toEqual([]);

    // A mention of a person is an inbox item with a link to the group.
    ana.send({ type: "chat.say", groupId: group.id, text: "@Bo can you take the tests?" });
    await bo.until((s) => (s.messages[group.id]?.length ?? 0) >= 3);
    const inbox = server.notifier.list("bo");
    const mention = inbox.find((n) => n.kind === "mention");
    expect(mention?.title).toBe("Ana mentioned you in #Rollout");
    expect(mention?.link).toBe(`henosis://c/nw/${group.id}`);

    // The state is on disk and over HTTP, and the directory lists people and live agents.
    const state = (await (await fetch(`http://127.0.0.1:${port}/api/chat/nw`)).json()) as ChatState;
    expect(state.groups[group.id]?.name).toBe("Rollout");
    const onDisk = JSON.parse(readFileSync(join(root, "chat", "nw.json"), "utf8")) as {
      events: { main: ChatEvent[] };
    };
    expect(foldChat(onDisk.events.main).messages[group.id]?.length).toBe(3);
    const dir = (await (await fetch(`http://127.0.0.1:${port}/api/chat/nw/directory`)).json()) as {
      people: { id: string }[];
      agents: { sessionId: string; title: string; live: string | null }[];
    };
    expect(dir.people.map((p) => p.id).sort()).toEqual(["ana", "bo", "dee"]);
    expect(dir.agents).toEqual([
      expect.objectContaining({ sessionId: "s-ana", title: "Ana's agent", live: "idle" }),
    ]);
    ana.close();
    bo.close();
  });

  it("reloads the chat log on start", async () => {
    await server.close();
    const again = new HenosisServer({
      root,
      model: new ScriptedModel(),
      tools: defaultTools(),
      defaultPolicy: sessionPolicy,
    });
    const chat = again.chat("nw");
    expect(chat.chat.log.verify()).toEqual({ ok: true });
    const group = Object.values(chat.state().groups).find((g) => g.name === "Rollout");
    expect(group?.members.length).toBe(3);
    expect(chat.state().messages[group?.id ?? ""]?.length).toBe(3);
    await again.close();
    server = new HenosisServer({ root, model: new ScriptedModel(), tools: defaultTools() });
    port = await server.listen(0);
  });
});
