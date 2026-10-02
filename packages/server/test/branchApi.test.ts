import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BranchCompare } from "@fold/kernel";
import type { Actor } from "@fold/protocol";
import { defaultTools, ScriptedModel } from "@fold/runner";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionFile } from "../src/branchApi.js";
import { FoldServer } from "../src/server.js";

const ana: Actor = { id: "ana", kind: "human", name: "Ana" };

describe("branch compare and file routes", () => {
  let root: string;
  let server: FoldServer;
  let base: string;
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "fold-cmp-"));
    server = new FoldServer({ root, model: new ScriptedModel(), tools: defaultTools() });
    const port = await server.listen(0);
    base = `http://127.0.0.1:${port}/api/projects/default/sessions/cmp`;
    const s = server.host("cmp", "Compare me", "default", "ana").session;
    s.join("main", ana, "owner");
    s.writeFile("main", "ana", "a.txt", "one\ntwo");
    s.fork("main", "ana", "try/idea");
    s.writeFile("main", "ana", "a.txt", "1\ntwo\nthree");
    s.writeFile("try/idea", "ana", "a.txt", "ONE\ntwo");
    s.writeFile("try/idea", "ana", "new.txt", "x");
  });
  afterAll(async () => {
    await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("compares two branches: files that differ with counts, and each side's turns", async () => {
    const res = await fetch(`${base}/compare?a=main&b=${encodeURIComponent("try/idea")}`);
    expect(res.status).toBe(200);
    const c = (await res.json()) as BranchCompare;
    expect(c.a).toBe("main");
    expect(c.b).toBe("try/idea");
    expect(c.files).toEqual([
      { path: "a.txt", inA: true, inB: true, plus: 1, minus: 2 },
      { path: "new.txt", inA: false, inB: true, plus: 1, minus: 0 },
    ]);
    expect(c.turns).toEqual({ a: [], b: [] });
    expect(c.conflicts).toEqual([]);
  });

  it("reads one file of a branch, and marks it after a fold left conflict markers", async () => {
    const before = await fetch(`${base}/file?branch=${encodeURIComponent("try/idea")}&path=a.txt`);
    expect(((await before.json()) as SessionFile).content).toBe("ONE\ntwo");

    const s = server.host("cmp").session;
    s.merge("main", "ana", "try/idea");
    expect(s.state("main").openConflicts).toEqual(["a.txt"]);

    const after = await fetch(`${base}/file?branch=main&path=a.txt`);
    const f = (await after.json()) as SessionFile;
    expect(f.conflict).toBe(true);
    expect(f.content).toContain("<<<<<<< ours");
    expect(f.content).toContain(">>>>>>> theirs");
    const c = (await (await fetch(`${base}/compare?a=main&b=try%2Fidea`)).json()) as BranchCompare;
    expect(c.conflicts).toEqual(["a.txt"]);
  });

  it("404s on unknown sessions, branches and paths", async () => {
    expect((await fetch(`${base}/file?branch=main&path=nope.txt`)).status).toBe(404);
    expect((await fetch(`${base}/compare?a=main&b=nope`)).status).toBe(404);
    expect(
      (await fetch(`http://${new URL(base).host}/api/projects/default/sessions/none/compare`))
        .status,
    ).toBe(404);
  });
});
