import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Actor, DEFAULT_APPROVAL_POLICY, MAIN_BRANCH } from "@henosis/protocol";
import { defaultTools, ScriptedModel } from "@henosis/runner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportSessionMarkdown, sessionForExport } from "../src/export.js";
import { SessionHost } from "../src/host.js";
import { HenosisServer } from "../src/server.js";

const ana: Actor = { id: "ana", kind: "human", name: "Ana" };
const policy = { approvals: DEFAULT_APPROVAL_POLICY, contention: "block" as const, maxTurns: 50 };

describe("session export", () => {
  let root: string;
  let server: HenosisServer;
  let base: string;
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "henosis-export-"));
    // A session that exists only on disk, written by a host that is then closed.
    const h = new SessionHost({
      root,
      sessionId: "cold",
      model: new ScriptedModel(),
      tools: defaultTools(),
      create: { title: "Cold session", policy },
    });
    h.session.join(MAIN_BRANCH, ana, "owner");
    h.session.directive(MAIN_BRANCH, "ana", { text: "Write the export" });
    h.close();
    server = new HenosisServer({ root, model: new ScriptedModel(), tools: defaultTools() });
    const port = await server.listen(0);
    base = `http://127.0.0.1:${port}`;
  });
  afterAll(async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("serves a persisted session as markdown, inline for a tab", async () => {
    const res = await fetch(`${base}/api/sessions/cold/export.md`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('inline; filename="cold.md"');
    const md = await res.text();
    expect(md.startsWith("# Session report: Cold session\n")).toBe(true);
    expect(md).toContain("| Ana | directive.submitted | [steer/goal] Write the export |");
    expect(md).toContain("# Handoff brief: Cold session");
  });

  it("offers a markdown file when asked to download", async () => {
    const res = await fetch(`${base}/api/sessions/cold/export.md?download=1`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="cold.md"');
  });

  it("renders a live session from its host, including unflushed events", () => {
    const live = server.host("warm", "Warm session", "default", "ana");
    live.session.join(MAIN_BRANCH, ana, "owner");
    live.session.directive(MAIN_BRANCH, "ana", { text: "Still in memory" });
    const src = { root, projects: server.projects };
    expect(sessionForExport(src, "warm")).toBe(live.session);
    expect(exportSessionMarkdown(src, "warm")).toContain("Still in memory");
  });

  it("is 404 for an unknown or malformed session id", async () => {
    expect((await fetch(`${base}/api/sessions/nope/export.md`)).status).toBe(404);
    expect(
      (await fetch(`${base}/api/sessions/${encodeURIComponent("../x")}/export.md`)).status,
    ).toBe(404);
    expect((await fetch(`${base}/api/sessions/cold/export.txt`)).status).toBe(404);
  });
});
