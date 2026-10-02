import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultTools, ScriptedModel } from "@fold/runner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ProjectHost } from "../src/projectHost.js";
import { FoldServer } from "../src/server.js";

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

describe("project host", () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "fold-proj-"));
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("two engineers' sessions collide on one path: the second is refused, the project records it, and a lead directive reaches both", async () => {
    const host = new ProjectHost({
      root,
      projectId: "billing",
      orgId: "nw",
      teamId: "pay",
      name: "Billing",
      model: new ScriptedModel(),
      tools: defaultTools(),
      sessionPolicy,
    });
    host.project.join("dee", "Dee", "lead");
    const a = host.session("s-ana", { title: "Build a doubling helper", ownerId: "ana" });
    const b = host.session("s-bo", { title: "Build a doubling helper", ownerId: "bo" });
    const events: string[] = [];
    host.subscribe({ userId: "dee", send: (m) => events.push(m.type) });
    a.session.join("main", { id: "ana", kind: "human", name: "Ana" }, "owner");
    b.session.join("main", { id: "bo", kind: "human", name: "Bo" }, "owner");
    expect(host.state().members.ana?.role).toBe("member");

    // Same goal => the scripted model writes the same module path in both sessions.
    a.session.directive("main", "ana", { text: "Build a doubling helper" });
    await a.drive("main");
    b.session.directive("main", "bo", { text: "Build a doubling helper" });
    await b.drive("main");

    const sa = a.session.state();
    const sb = b.session.state();
    expect(sa.workspace["src/build_a_doubling_helper.mjs"]).toBeDefined();
    expect(sb.blockedWrites.map((w) => w.path)).toContain("PLAN.md");
    expect(sb.blockedWrites.some((w) => w.holderSessionId === "s-ana")).toBe(true);
    const ps = host.state();
    expect(ps.violations.length).toBeGreaterThan(0);
    const anaClaims = Object.values(ps.claims).filter(
      (c) => c.sessionId === "s-ana" && c.status === "active",
    );
    expect(anaClaims.map((c) => (c.resource.type === "path" ? c.resource.pattern : ""))).toContain(
      "PLAN.md",
    );
    expect(ps.sessions["s-ana"]?.report?.status).toBe("idle");
    expect(events).toContain("project.event");
    // The failed write reached Bo's agent as a tool result it could read.
    const failed = sb.turns
      .flatMap((t) => t.toolResults)
      .find((r) => !r.ok && r.output.includes("held by Ana's session"));
    expect(failed).toBeDefined();

    // Lead directive propagates into both sessions above their owners.
    host.project.directive("dee", { text: "schema freeze until Thursday", mode: "constrain" });
    expect(a.session.state().intent.constraints.map((c) => c.text)).toContain(
      "schema freeze until Thursday",
    );
    expect(b.session.state().intent.constraints.map((c) => c.text)).toContain(
      "schema freeze until Thursday",
    );
    const brief = host.brief();
    expect(brief).toContain("Ana's session");
    expect(brief).toContain("schema freeze until Thursday");
    expect(brief).toContain("refused a write");

    // Persistence: a new host reloads the ledger and the sessions of this project.
    host.close();
    const again = new ProjectHost({
      root,
      projectId: "billing",
      orgId: "nw",
      teamId: "pay",
      name: "Billing",
      model: new ScriptedModel(),
      tools: defaultTools(),
      sessionPolicy,
    });
    expect(again.project.ledger.verify()).toEqual({ ok: true });
    expect([...again.hosts.keys()].sort()).toEqual(["s-ana", "s-bo"]);
    expect(again.state().violations.length).toBe(ps.violations.length);
    again.close();
  });

  it("derives roles from users.json over the websocket front door", async () => {
    const root2 = mkdtempSync(join(tmpdir(), "fold-srv2-"));
    writeFileSync(
      join(root2, "orgs.json"),
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
      join(root2, "users.json"),
      JSON.stringify({
        users: [
          { id: "dee", name: "Dee", teams: [{ teamId: "pay", role: "lead" }] },
          { id: "ana", name: "Ana", projects: [{ projectId: "billing", role: "member" }] },
        ],
      }),
    );
    const server = new FoldServer({
      root: root2,
      model: new ScriptedModel(),
      tools: defaultTools(),
    });
    const port = await server.listen(0);
    const { default: WebSocket } = await import("ws");
    const open = (userId: string) =>
      new Promise<{ ws: InstanceType<typeof WebSocket>; msgs: Record<string, unknown>[] }>(
        (resolve) => {
          const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
          const msgs: Record<string, unknown>[] = [];
          ws.on("message", (raw) => msgs.push(JSON.parse(raw.toString())));
          ws.on("open", () => {
            ws.send(
              JSON.stringify({
                type: "join",
                sessionId: "s1",
                actor: { id: userId, kind: "human", name: userId },
                branch: "main",
                userId,
                projectId: "billing",
                title: "S1",
              }),
            );
            setTimeout(() => resolve({ ws, msgs }), 300);
          });
        },
      );
    const ana = await open("ana");
    const dee = await open("dee");
    const roles = (m: Record<string, unknown>[]) => {
      const snap = m.find((x) => x.type === "snapshot") as
        | { events: { kind: string; payload: { actor?: { id: string }; role?: string } }[] }
        | undefined;
      return Object.fromEntries(
        (snap?.events ?? [])
          .filter((e) => e.kind === "participant.joined")
          .map((e) => [e.payload.actor?.id, e.payload.role]),
      );
    };
    expect(roles(ana.msgs).ana).toBe("owner"); // she started it
    expect(roles(dee.msgs).dee).toBe("owner"); // lead of the team
    const res = await fetch(`http://127.0.0.1:${port}/api/projects/billing/sessions`);
    const list = (await res.json()) as { sessionId: string; ownerId: string }[];
    expect(list.map((s) => [s.sessionId, s.ownerId])).toEqual([["s1", "ana"]]);
    const me = (await (await fetch(`http://127.0.0.1:${port}/api/me?user=dee`)).json()) as {
      projects: { projectId: string }[];
    };
    expect(me.projects.map((p) => p.projectId)).toEqual(["billing"]);
    ana.ws.close();
    dee.ws.close();
    await server.close();
    rmSync(root2, { recursive: true, force: true });
  });
});
