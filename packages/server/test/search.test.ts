import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultTools, ScriptedModel } from "@henosis/runner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseQuery, type SearchResult, scoreOf, searchQueryOf, snippetOf } from "../src/search.js";
import { HenosisServer } from "../src/server.js";

describe("search query", () => {
  it("takes the inline filters out of the text", () => {
    expect(parseQuery("proration from:bo in:#billing")).toEqual({
      text: "proration",
      from: "bo",
      in: "#billing",
    });
    expect(parseQuery('tax lines in:"Billing page" kind:messages')).toEqual({
      text: "tax lines",
      in: "Billing page",
      kind: "message",
    });
    expect(parseQuery("  ")).toEqual({ text: "" });
    expect(
      searchQueryOf(new URLSearchParams("q=rounding&org=default&kind=people&limit=5")),
    ).toEqual({ text: "rounding", org: "default", kind: "person", limit: 5 });
  });

  it("scores a match at the start or a word boundary above one inside a word", () => {
    expect(scoreOf("pro", "Proration credits")).toBe(3);
    expect(scoreOf("pro", "the proration")).toBe(2);
    expect(scoreOf("pro", "approve")).toBe(1);
    expect(scoreOf("pro", "tax lines")).toBe(0);
    expect(scoreOf("", "anything")).toBe(0);
  });

  it("cuts a snippet around the first match", () => {
    const long = `${"a ".repeat(100)}proration lands here ${"b ".repeat(100)}`;
    const s = snippetOf("proration", long, 60);
    expect(s.startsWith("…")).toBe(true);
    expect(s.endsWith("…")).toBe(true);
    expect(s).toContain("proration");
    expect(snippetOf("x", "short", 60)).toBe("short");
  });
});

describe("search over what the team keeps", () => {
  let root: string;
  let server: HenosisServer;
  let port: number;
  const get = async (qs: string) =>
    (await (await fetch(`http://127.0.0.1:${port}/api/search?${qs}`)).json()) as SearchResult;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "henosis-search-"));
    server = new HenosisServer({ root, model: new ScriptedModel(), tools: defaultTools() });
    port = await server.listen(0);
    const host = server.project("default");
    const sh = host.session("s-billing", { title: "Invoice PDF", ownerId: "ana" });
    sh.session.join("main", { id: "ana", kind: "human", name: "Ana" }, "owner");
    sh.session.join("main", { id: "bo", kind: "human", name: "Bo" }, "contributor");
    sh.session.directive("main", "ana", { text: "Render the proration credit as its own line" });
    sh.session.note("main", "bo", "The proration should land before the tax lines");
    const chat = server.chat("default");
    const g = chat.chat.createGroup("ana", {
      name: "billing",
      members: [
        { kind: "human", userId: "ana" },
        { kind: "human", userId: "bo" },
        { kind: "human", userId: "dee" },
      ],
    });
    chat.chat.post("bo", g.id, "Can Ana's agent check the proration rounding on Checkout?");
    server.memory("default").remember({
      scope: { orgId: "default", projectId: "default" },
      key: "proration",
      content: "Prorate on the day boundary in the customer's timezone, never UTC",
      attribution: { userId: "dee", userName: "Dee", sessionId: "s-billing" },
    });
  });
  afterAll(async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("finds sessions, messages, memory, people and agents, with counts that add up", async () => {
    const r = await get("q=proration&org=default");
    expect(r.q).toBe("proration");
    expect(r.scope?.orgId).toBe("default");
    const kinds = new Set(r.hits.map((h) => h.kind));
    expect(kinds.has("session")).toBe(true);
    expect(kinds.has("message")).toBe(true);
    expect(kinds.has("memory")).toBe(true);
    expect(r.total).toBe(Object.values(r.counts).reduce((n, c) => n + c, 0));
    expect(r.total).toBe(r.hits.length);
    const session = r.hits.find((h) => h.kind === "session");
    expect(session?.title).toBe("Invoice PDF");
    expect(session?.route).toBe("#/p/default/s/s-billing");
    const messages = r.hits.filter((h) => h.kind === "message");
    expect(messages.map((m) => m.where).sort()).toEqual([
      "in #billing",
      "in Invoice PDF",
      "to the team in Invoice PDF",
    ]);
    expect(messages.find((m) => m.where === "in #billing")?.who).toBe("Bo");
    const memory = r.hits.find((h) => h.kind === "memory");
    expect(memory?.key).toBe("proration");
    expect(memory?.attribution).toBe("added by Dee · session s-billing");
    expect(memory?.route).toBe("#/memory/default?project=default");
    // People and agents by name: Ana is a person, and "Ana's agent" is her session's agent.
    const people = await get("q=ana&org=default");
    expect(people.hits.find((h) => h.kind === "person")?.title).toBe("Ana");
    expect(people.hits.find((h) => h.kind === "agent")?.title).toBe("Ana's agent");
    expect(people.hits.find((h) => h.kind === "agent")?.where).toBe("in Default project");
  });

  it("narrows by kind and by the from: and in: filters", async () => {
    const only = await get("q=proration&kind=messages");
    expect(only.hits.every((h) => h.kind === "message")).toBe(true);
    expect(only.counts.message).toBe(3);
    const fromBo = await get(`q=${encodeURIComponent("proration from:bo")}`);
    expect(fromBo.hits.filter((h) => h.kind === "message").every((h) => h.who === "Bo")).toBe(true);
    expect(fromBo.counts.message).toBe(2);
    const inGroup = await get(`q=${encodeURIComponent("proration in:#billing")}`);
    expect(inGroup.hits.map((h) => h.kind)).toEqual(["message"]);
    const nothing = await get("q=zzzz-nothing");
    expect(nothing.total).toBe(0);
    expect(nothing.hits).toEqual([]);
    expect((await get("q=")).total).toBe(0);
  });

  it("keeps a search per person and notifies them when something new matches", async () => {
    const base = `http://127.0.0.1:${port}/api/search/saved?user=dee`;
    const saved = (await (
      await fetch(base, { method: "POST", body: JSON.stringify({ q: "rounding", org: "default" }) })
    ).json()) as { saved: { id: string; name: string }; searches: unknown[] };
    expect(saved.saved.name).toBe("rounding");
    expect(saved.searches).toHaveLength(1);
    // The same query kept twice is one saved search.
    await fetch(base, { method: "POST", body: JSON.stringify({ q: "rounding", org: "default" }) });
    const list = (await (await fetch(base)).json()) as { searches: unknown[] };
    expect(list.searches).toHaveLength(1);
    expect(
      (await (await fetch(`http://127.0.0.1:${port}/api/search/saved`)).json()) as unknown,
    ).toEqual({
      error: "user is required",
    });

    const chat = server.chat("default");
    const g = Object.values(chat.state().groups)[0];
    if (!g) throw new Error("no group");
    chat.chat.post("ana", g.id, "The rounding is fixed on Checkout now.");
    const hit = server.notifier.list("dee").find((n) => n.kind === "search");
    expect(hit?.title).toBe("Ana said something that matches “rounding”.");
    expect(hit?.body).toBe("#billing · The rounding is fixed on Checkout now.");
    expect(hit?.route).toBe("#/search?q=rounding");
    // Their own words never come back to them; a note in a session matches too.
    chat.chat.post("dee", g.id, "rounding again");
    expect(server.notifier.list("dee").filter((n) => n.kind === "search")).toHaveLength(1);
    server
      .project("default")
      .hosts.get("s-billing")
      ?.session.note("main", "bo", "rounding: done in the session too");
    expect(server.notifier.list("dee").filter((n) => n.kind === "search")).toHaveLength(2);

    const gone = (await (
      await fetch(`${base.replace("?user=dee", `/${saved.saved.id}?user=dee`)}`, {
        method: "DELETE",
      })
    ).json()) as { ok: boolean; searches: unknown[] };
    expect(gone).toEqual({ ok: true, searches: [] });
  });
});
