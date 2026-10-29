import { describe, expect, it } from "vitest";
import { groupHits, PER_KIND, SEARCH_KINDS, type SearchHit, type SearchKind } from "./search.js";

/** A hit of a kind, with just enough to be told apart. */
function hit(kind: SearchKind, n: number): SearchHit {
  return {
    kind,
    id: `${kind}-${n}`,
    orgId: "default",
    title: `${kind} ${n}`,
    where: "Billing page",
    snippet: "",
    route: "#/",
    link: "#/",
  } as SearchHit;
}

const many = (kind: SearchKind, n: number) => Array.from({ length: n }, (_, i) => hit(kind, i + 1));

describe("search: All is a group cut (settled, BACKLOG.md L7)", () => {
  // Hits as the server ranks them: messages first, then sessions, with people and memory between.
  const hits = [
    ...many("message", 5),
    ...many("session", 4),
    ...many("person", 1),
    ...many("memory", 2),
  ];

  it("shows every kind that has hits as a short group in the tab order, with its full count", () => {
    const groups = groupHits(hits, "all");
    expect(groups.map((g) => g.kind)).toEqual(["session", "message", "memory", "person"]);
    expect(groups.map((g) => g.rows.length)).toEqual([3, 3, 2, 1]);
    expect(groups.map((g) => g.all)).toEqual([4, 5, 2, 1]);
    // The counts add up to the result's total, whatever the cut shows.
    expect(groups.reduce((n, g) => n + g.all, 0)).toBe(hits.length);
  });

  it("keeps each group in the hits' own order, so the cut is the top of the ranking, not a re-sort", () => {
    const [sessions] = groupHits(hits, "all").filter((g) => g.kind === "session");
    expect(sessions?.rows.map((h) => h.id)).toEqual(["session-1", "session-2", "session-3"]);
  });

  it("leaves a kind without hits out rather than showing an empty group", () => {
    expect(groupHits(hits, "all").some((g) => g.kind === "agent")).toBe(false);
    expect(groupHits([], "all")).toEqual([]);
  });

  it("a kind's own tab shows every row of that kind and nothing else", () => {
    const groups = groupHits(hits, "message");
    expect(groups).toHaveLength(1);
    expect(groups[0]?.kind).toBe("message");
    expect(groups[0]?.rows).toHaveLength(5);
    expect(groups[0]?.all).toBe(5);
    expect(groupHits(hits, "agent")).toEqual([]);
  });

  it("'Show all N →' is needed exactly when the cut hid something", () => {
    for (const g of groupHits(hits, "all")) expect(g.all > g.rows.length).toBe(g.all > PER_KIND);
  });

  it("the cut is three a kind, and every kind the tabs know is a possible group", () => {
    expect(PER_KIND).toBe(3);
    const all = SEARCH_KINDS.flatMap((k) => many(k, 4));
    const groups = groupHits(all, "all");
    expect(groups.map((g) => g.kind)).toEqual([...SEARCH_KINDS]);
    for (const g of groups) expect(g.rows).toHaveLength(3);
  });
});
