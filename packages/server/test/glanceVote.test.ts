/**
 * Approve or Deny from a widget (widgets): `POST /api/glance/vote` is the App Intent's server
 * half. The same vote as in the session: a plain approve under a release gate sends
 * `DEFAULT_RATING`, under any other rule no rating; a deny never carries one; a person the
 * session has not seated is seated with the role identity gives them; a rank below the rule's
 * is refused, never recorded as a voice that does not count.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_RATING, type GlanceVoteResult } from "@henosis/protocol";
import { defaultTools, ScriptedModel } from "@henosis/runner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GlanceVoteError } from "../src/glance.js";
import { HenosisServer } from "../src/server.js";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("the widget's vote", () => {
  let root: string;
  let server: HenosisServer;
  let port: number;
  const post = (user: string, body: unknown, token: string | null = "t") =>
    fetch(`http://127.0.0.1:${port}/api/glance/vote?user=${encodeURIComponent(user)}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "henosis-glance-vote-"));
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
          { id: "cy", name: "Cy", projects: [{ projectId: "billing", role: "member" }] },
          { id: "ol", name: "Ollie", projects: [] },
        ],
      }),
    );
    server = new HenosisServer({
      root,
      model: new ScriptedModel(),
      tools: defaultTools(),
      token: "t",
    });
    port = await server.listen(0);
  });
  afterAll(async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("casts the same vote the session would, seats a newcomer, and refuses what it cannot count", async () => {
    const host = server.project("billing");
    const sh = host.session("s1", { title: "Helper", ownerId: "ana" });
    sh.session.join("main", { id: "ana", kind: "human", name: "Ana" }, "owner");
    sh.session.join("main", { id: "bo", kind: "human", name: "Bo" }, "contributor");
    sh.session.directive("main", "ana", { text: "Build a doubling helper and deploy it" });
    void sh.drive("main"); // parks at the exec approval; do not await
    for (let i = 0; i < 100 && !Object.values(sh.session.state().approvals).length; i++)
      await wait(50);
    const exec = server.glance("bo").topGate;
    expect(exec?.call.risk).toBe("exec");
    const at = { projectId: "billing", sessionId: "s1", approvalId: exec?.approvalId ?? "" };

    // The route wants the shared token, a POST and a body it can read.
    expect((await post("bo", { ...at, vote: "approve" }, null)).status).toBe(401);
    expect((await fetch(`http://127.0.0.1:${port}/api/glance/vote?user=bo&token=t`)).status).toBe(
      405,
    );
    expect((await post("bo", "{not json")).status).toBe(400);
    const bad = await post("bo", { ...at, vote: "maybe" });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toContain("vote");
    expect((await post("", { ...at, vote: "approve" })).status).toBe(400);

    // A plain approve on an exec gate carries no rating, and one contributor grants it.
    const res = await post("bo", { ...at, vote: "approve" });
    expect(res.status).toBe(200);
    const granted = (await res.json()) as GlanceVoteResult;
    expect(granted.outcome).toBe("granted");
    expect(granted.rating).toBeNull();
    expect(granted.votes).toBe(1);
    expect(granted.needed).toBe(1);
    expect(granted.glance.user).toEqual({ id: "bo", name: "Bo" });
    expect(granted.glance.approvals).toBe(0);
    expect(sh.session.state().approvals[at.approvalId]?.ballots.bo).toMatchObject({
      vote: "approve",
      rating: null,
      note: "from a widget",
    });

    // The server drove the session on: the deploy is a release gate, two raters at 4+.
    for (
      let i = 0;
      i < 100 &&
      !Object.values(sh.session.state().approvals).some(
        (x) => x.call.risk === "irreversible" && x.status === "pending",
      );
      i++
    )
      await wait(50);
    const gate = server.glance("cy").topGate;
    expect(gate?.ratings).toBe(true);
    expect(gate?.needed).toBe(2);
    const atGate = { projectId: "billing", sessionId: "s1", approvalId: gate?.approvalId ?? "" };

    // The same vote again is refused: it was decided.
    const again = await post("bo", { ...at, vote: "approve" });
    expect(again.status).toBe(409);
    expect(((await again.json()) as { error: string }).error).toBe("already granted");

    // Cy has not joined; identity seats her as a contributor, and a plain approve sends the default 4.
    expect(sh.session.state().participants.cy).toBeUndefined();
    const cy = server.glanceVote("cy", { ...atGate, vote: "approve", note: "" });
    expect(cy.outcome).toBe("pending");
    expect(cy.rating).toBe(DEFAULT_RATING);
    expect(cy.votes).toBe(1);
    expect(cy.needed).toBe(2);
    expect(cy.glance.approvals).toBe(0);
    expect(cy.glance.topGate).toBeNull();
    expect(sh.session.state().participants.cy?.role).toBe("contributor");
    expect(sh.session.state().participants.cy?.actor.name).toBe("Cy");
    expect(sh.session.state().approvals[atGate.approvalId]?.ballots.cy?.rating).toBe(
      DEFAULT_RATING,
    );
    expect(server.glance("ana").topGate?.votes).toBe(1);
    expect(server.glance("ana").topGate?.average).toBe(DEFAULT_RATING);
    expect(() => server.glanceVote("cy", { ...atGate, vote: "approve", note: "" })).toThrow(
      "your vote is in",
    );

    // A picked rating rides as given; an observer is refused, not heard as a voice that does not count.
    const ol = await post("ol", { ...atGate, vote: "approve", rating: 5 });
    expect(ol.status).toBe(403);
    expect(((await ol.json()) as { error: string }).error).toContain("the rule wants");
    expect(sh.session.state().participants.ol).toBeUndefined();
    expect((await post("bo", { ...atGate, approvalId: "nope", vote: "approve" })).status).toBe(404);
    expect((await post("bo", { ...atGate, sessionId: "nope", vote: "approve" })).status).toBe(404);
    expect((await post("bo", { ...atGate, projectId: "nope", vote: "approve" })).status).toBe(404);
    try {
      server.glanceVote("bo", { ...atGate, sessionId: "nope", vote: "approve", note: "" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(GlanceVoteError);
      expect((err as GlanceVoteError).status).toBe(404);
    }

    // A deny never carries a rating, and one eligible deny decides the gate.
    const deny = (await (
      await post("bo", { ...atGate, vote: "deny", rating: 2, note: "not this week" })
    ).json()) as GlanceVoteResult;
    expect(deny.outcome).toBe("denied");
    expect(deny.rating).toBeNull();
    expect(sh.session.state().approvals[atGate.approvalId]?.ballots.bo).toMatchObject({
      vote: "deny",
      rating: null,
      note: "not this week",
    });
    expect(deny.glance.needsYou).toBe(0);
    expect(server.glance("ana").needsYou).toBe(0);
  });
});
