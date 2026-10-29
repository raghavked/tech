import { describe, expect, it } from "vitest";
import { parsePrRef, prKey, prUrl } from "../src/client.js";
import {
  type CommentInput,
  fitBody,
  glyphBar,
  MAX_BODY,
  marker,
  prComment,
  sessionOfMarker,
} from "../src/comment.js";

/** PR #418 in its final state, as the pr-template board shows it. */
const final: CommentInput = {
  sessionId: "pdf-layout-7f2",
  agent: "Ana's agent",
  mode: "Team with Bo and Cy",
  team: "the Payments team",
  url: "https://app.example/#/p/billing/s/pdf-layout-7f2",
  sentence: "Done · 5 of 5 steps.",
  goal: "Add proration rows and tax lines to the invoice PDF, and keep the Billing page and Checkout totals on the same numbers.",
  plan: {
    state: "approved",
    steps: [
      {
        title: "Read the invoice PDF renderer and the tax-line model",
        est: 4000,
        actual: 3100,
        status: "done",
      },
      {
        title: "Add proration rows to the invoice PDF, one per partial period",
        est: 14_000,
        actual: 12_800,
        status: "done",
      },
      {
        title: "Align tax lines in the totals block; round per line, not per total",
        est: 10_000,
        actual: 11_600,
        status: "done",
      },
      {
        title: "Billing page preview and Checkout summary read the same totals",
        est: 12_000,
        actual: 9400,
        status: "done",
      },
      {
        title: "Tests: proration across a month boundary, tax rounding, PDF snapshot",
        est: 12_000,
        actual: 11_300,
        status: "done",
      },
    ],
    ratings: [
      {
        who: "Ana",
        role: "driver",
        rating: 4,
        note: "Proration first, the tax lines follow from it.",
        counts: true,
      },
      {
        who: "Bo",
        role: "contributor",
        rating: 5,
        note: "Step 3 is the one Checkout has been waiting on.",
        counts: true,
      },
    ],
    verdict:
      "✓ Plan approved · 2 ratings · 4.5 average · policy: one rating at 3+ · decided in the fold",
  },
  gate: {
    state: "granted",
    call: "git push origin pdf-layout",
    risk: "irreversible",
    rule: "2 contributors or above rating it 4+ of 5 on average",
    voices: [
      {
        who: "Bo",
        role: "contributor",
        rating: 4,
        note: "Tax lines match the ledger to the cent.",
        counts: true,
      },
      {
        who: "Cy",
        role: "contributor",
        rating: 5,
        note: "Proration rounds the right way across the boundary.",
        counts: true,
      },
      { who: "Dee", role: "observer", rating: null, note: "", counts: false },
    ],
    verdict: "✓ Gate granted · 2 of 2 · 4.5 average",
  },
  tokens: {
    spent: 48_200,
    budget: 80_000,
    input: 31_400,
    output: 9600,
    cache: 7200,
    estimate: 52_000,
    actual: 48_200,
  },
  hash: "3f9a0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8c21e",
  replayUrl: null,
  auditUrl: "https://app.example/api/sessions/pdf-layout-7f2/export.md",
};

describe("the PR comment", () => {
  it("is plain Markdown: the marker first, the identity line with the link last, the sentence, then the sections", () => {
    const body = prComment(final);
    const lines = body.split("\n");
    expect(lines[0]).toBe("<!-- henosis:session=pdf-layout-7f2 -->");
    expect(lines[1]).toBe(
      "**Ana's agent** · Team with Bo and Cy · the Payments team · [Open the session](https://app.example/#/p/billing/s/pdf-layout-7f2)",
    );
    expect(lines[3]).toBe("**Done · 5 of 5 steps.**");
    expect(lines[5]).toBe(final.goal);
    expect(body).toContain("### The plan — approved · 5 of 5 steps done\n");
    expect(body).toContain(
      "| # | Step | Estimate | Actual | |\n|--:|------|---------:|-------:|--|\n",
    );
    expect(body).toContain(
      "| 1 | Read the invoice PDF renderer and the tax-line model | 4k | 3.1k | ✓ |",
    );
    expect(body).toContain(
      "| 3 | Align tax lines in the totals block; round per line, not per total | 10k | 11.6k | ✓ |",
    );
    // Votes as rows: bold name, role, glyph stars plus the number, the note in italics.
    expect(body).toContain(
      "- **Ana** driver · ★★★★☆ 4 · _“Proration first, the tax lines follow from it.”_",
    );
    expect(body).toContain(
      "- **Bo** contributor · ★★★★★ 5 · _“Step 3 is the one Checkout has been waiting on.”_",
    );
    expect(body).toContain(
      "✓ Plan approved · 2 ratings · 4.5 average · policy: one rating at 3+ · decided in the fold",
    );
    expect(body).toContain(
      "### Release gate — granted\n`git push origin pdf-layout` · irreversible · 2 contributors or above rating it 4+ of 5 on average",
    );
    expect(body).toContain("- **Dee** observer · approved without a rating · a voice, not a vote");
    expect(body).toContain("✓ Gate granted · 2 of 2 · 4.5 average");
    expect(body).toContain(
      "### Tokens — 48.2k of 80k\n▰▰▰▰▰▰▱▱▱▱ 60% · input 31.4k · output 9.6k · cache 7.2k\nest 52k → 48.2k, under",
    );
    expect(body.trimEnd().split("\n").at(-1)).toBe(
      "[Session](https://app.example/#/p/billing/s/pdf-layout-7f2) · [Audit record](https://app.example/api/sessions/pdf-layout-7f2/export.md) · replays to `3f9a…c21e`",
    );
    // Nothing GitHub cannot render: no HTML but the marker, no images, no inline styles.
    expect(body.replace(/<!-- henosis:session=[^>]+ -->/, "")).not.toMatch(/<[a-z]/i);
    expect(body).not.toContain("style=");
  });

  it("carries the ladder's sentences and says what the gate waits for", () => {
    const waiting = prComment({
      ...final,
      sentence: "The plan waits for one rating.",
      plan: {
        ...(final.plan as NonNullable<CommentInput["plan"]>),
        state: "waits for one rating",
        steps: (final.plan as NonNullable<CommentInput["plan"]>).steps.map((s) => ({
          ...s,
          actual: null,
          status: "pending" as const,
        })),
        ratings: [],
        verdict: "⏳ No rating yet · policy: one rating at 3+",
      },
      gate: null,
      tokens: { ...final.tokens, spent: 1200, input: 1000, output: 200, cache: 0, actual: null },
    });
    expect(waiting).toContain("**The plan waits for one rating.**");
    expect(waiting).toContain("### The plan — waits for one rating · 0 of 5 steps done");
    expect(waiting).toContain(
      "| 1 | Read the invoice PDF renderer and the tax-line model | 4k | — |  |",
    );
    expect(waiting).not.toContain("### Release gate");
    expect(waiting).toContain("est 52k");
    const held = prComment({
      ...final,
      sentence: "git push origin pdf-layout waits on one more contributor at 4 or above.",
      gate: {
        ...(final.gate as NonNullable<CommentInput["gate"]>),
        state: "waits on one more contributor at 4 or above",
        voices: [
          { who: "Bo", role: "contributor", rating: 4, note: "", counts: true },
          { who: "Dee", role: "observer", rating: 5, note: "", counts: false },
        ],
        verdict: "⏳ Waits on one more contributor at 4 or above · 1 of 2 · 4 average",
      },
    });
    expect(held).toContain("### Release gate — waits on one more contributor at 4 or above");
    expect(held).toContain("- **Dee** observer · ★★★★★ 5 · a voice, not a vote");
    expect(held).toContain("⏳ Waits on one more contributor at 4 or above · 1 of 2 · 4 average");
    const denied = prComment({
      ...final,
      gate: {
        ...(final.gate as NonNullable<CommentInput["gate"]>),
        state: "held by Dee",
        voices: [
          {
            who: "Dee",
            role: "owner",
            rating: null,
            note: "Not before the tax lines ship.",
            counts: true,
            deny: true,
          },
        ],
        verdict: "✕ Held by Dee · the agent waits for a steer",
      },
    });
    expect(denied).toContain("- **Dee** owner · ✕ denied · _“Not before the tax lines ship.”_");
  });

  it("escapes pipes in a step title and keeps the body under GitHub's limit", () => {
    const body = prComment({
      ...final,
      plan: {
        ...(final.plan as NonNullable<CommentInput["plan"]>),
        steps: [{ title: "Write a | b\nc", est: 100, actual: null, status: "running" }],
      },
    });
    expect(body).toContain("| 1 | Write a \\| b c | 100 | — | → |");
    expect(fitBody(body)).toBe(body);
    const huge = fitBody(`${marker("x")}\n${"y".repeat(MAX_BODY * 2)}`);
    expect(huge.length).toBeLessThanOrEqual(MAX_BODY);
    expect(huge.endsWith("_… the rest is in the session._\n")).toBe(true);
  });

  it("finds its own comment by the marker and reads PR references", () => {
    expect(sessionOfMarker(prComment(final))).toBe("pdf-layout-7f2");
    expect(sessionOfMarker("Looks good to me")).toBeNull();
    expect(marker("s one")).toBe("<!-- henosis:session=s_one -->");
    expect(parsePrRef("northwind/billing#418")).toEqual({
      owner: "northwind",
      repo: "billing",
      number: 418,
    });
    expect(parsePrRef("https://github.com/northwind/billing/pull/418")).toEqual({
      owner: "northwind",
      repo: "billing",
      number: 418,
    });
    expect(() => parsePrRef("418")).toThrow(/owner\/repo#number/);
    expect(prKey({ owner: "a", repo: "b", number: 1 })).toBe("a/b#1");
    expect(prUrl({ owner: "a", repo: "b", number: 1 })).toBe("https://github.com/a/b/pull/1");
    expect(glyphBar(0.6)).toBe("▰▰▰▰▰▰▱▱▱▱");
    expect(glyphBar(1.4)).toBe("▰▰▰▰▰▰▰▰▰▰");
  });
});
