import { describe, expect, it } from "vitest";
import { MemoryBlobStore, mergeFile, mergeTrees } from "../src/workspace.js";

describe("mergeFile (diff3)", () => {
  it("merges non-overlapping edits", () => {
    const base = "a\nb\nc\nd\ne";
    const ours = "A\nb\nc\nd\ne";
    const theirs = "a\nb\nc\nd\nE";
    expect(mergeFile(base, ours, theirs)).toEqual({ content: "A\nb\nc\nd\nE", conflict: false });
  });
  it("merges insertions on both sides", () => {
    const base = "a\nb\nc";
    const ours = "a\nx\nb\nc";
    const theirs = "a\nb\nc\ny";
    expect(mergeFile(base, ours, theirs)).toEqual({ content: "a\nx\nb\nc\ny", conflict: false });
  });
  it("flags overlapping edits with markers", () => {
    const base = "a\nb\nc";
    const r = mergeFile(base, "a\nB1\nc", "a\nB2\nc");
    expect(r.conflict).toBe(true);
    expect(r.content).toBe("a\n<<<<<<< ours\nB1\n=======\nB2\n>>>>>>> theirs\nc");
  });
  it("identical changes on both sides are not conflicts", () => {
    expect(mergeFile("a\nb", "a\nz", "a\nz")).toEqual({ content: "a\nz", conflict: false });
  });
  it("delete vs modify is a conflict that keeps the modified side", () => {
    expect(mergeFile("a", null, "b")).toEqual({ content: "b", conflict: true });
    expect(mergeFile("a", null, null)).toEqual({ content: null, conflict: false });
  });
  it("handles a new file created on one side", () => {
    expect(mergeFile(null, "new", null)).toEqual({ content: "new", conflict: true });
  });
});

describe("mergeTrees", () => {
  it("applies the three-way rules per path", () => {
    const store = new MemoryBlobStore();
    const h = (s: string) => store.put(s);
    const base = { "a.txt": h("1"), "b.txt": h("x\ny"), "c.txt": h("gone"), "d.txt": h("same") };
    const ours = { "a.txt": h("2"), "b.txt": h("x\ny"), "d.txt": h("same"), "e.txt": h("ours") };
    const theirs = { "a.txt": h("1"), "b.txt": h("x\nY"), "c.txt": h("gone"), "d.txt": h("same2") };
    const r = mergeTrees(base, ours, theirs, store);
    expect(r.tree["a.txt"]).toBe(h("2"));
    expect(r.tree["b.txt"]).toBe(h("x\nY"));
    expect(r.tree["c.txt"]).toBeNull();
    expect(r.tree["d.txt"]).toBe(h("same2"));
    expect(r.tree["e.txt"]).toBe(h("ours"));
    expect(r.conflicts).toEqual([]);
    // both changed d.txt differently
    const ours2 = { ...ours, "d.txt": h("mine") };
    const r2 = mergeTrees(base, ours2, theirs, store);
    expect(r2.conflicts).toEqual(["d.txt"]);
    const merged = r2.blobs[r2.tree["d.txt"] as string];
    expect(merged).toContain("<<<<<<< ours");
  });
});
