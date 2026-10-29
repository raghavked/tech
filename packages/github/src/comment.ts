/**
 * The PR comment (pr-template, surfaces panel): a pull request is a session, so Henosis posts
 * exactly one comment and edits it in place as the session moves. Plain Markdown only:
 * tables, bold, code, links and lists, with an HTML marker so the adapter finds its own
 * comment, so it reads the same on GitHub, in e-mail and on a phone. The names are bold not
 * serif, the stars are ★★★★☆ glyphs with the number, a done step is a ✓ in the table, the
 * budget is a glyph bar; nothing here needs a renderer GitHub does not have.
 *
 * The first line is the session's identity and ends with the link; the second is the one
 * sentence that says where the session stands, computed from the rule and what has landed,
 * never restated from the policy. Pure: `prComment` takes plain data and returns the body.
 */
import { compactTokens, describeEstimate, shortHash, starsWithNumber } from "@henosis/kernel";

export const MARKER_PREFIX = "<!-- henosis:session=";

/** The marker the adapter finds its own comment by. */
export function marker(sessionId: string): string {
  return `${MARKER_PREFIX}${sessionId.replace(/[\s>]+/g, "_")} -->`;
}

/** The session id a comment body carries, or null when it is somebody else's comment. */
export function sessionOfMarker(body: string): string | null {
  const m = body.match(/<!-- henosis:session=([^\s>]+) -->/);
  return m?.[1] ?? null;
}

export interface Voice {
  who: string;
  role: string;
  rating: number | null;
  note: string;
  /** False for an approve that is heard but not counted: an observer, or no rating under a ratings rule. */
  counts: boolean;
  /** A deny: the voice that holds the gate. */
  deny?: boolean;
}

export interface PlanPart {
  /** "waits for one rating", "approved", "done", "asked to revise", "rejected" */
  state: string;
  steps: {
    title: string;
    est: number;
    actual: number | null;
    status: "pending" | "running" | "done";
  }[];
  ratings: Voice[];
  /** "✓ Plan approved · 2 ratings · 4.5 average · policy: one rating at 3+ · decided in the fold" */
  verdict: string;
}

export interface GatePart {
  /** "granted", "waits on one more contributor at 4 or above", "held by Dee" */
  state: string;
  call: string;
  risk: string;
  /** The rule in words. */
  rule: string;
  voices: Voice[];
  /** "✓ Gate granted · 2 of 2 · 4.5 average" / "⏳ Waits on Cy · 1 of 2 · 4 average" / "✕ Held by Dee" */
  verdict: string;
}

export interface CommentInput {
  sessionId: string;
  /** "Ana's agent" */
  agent: string;
  /** "Team with Bo and Cy" or "Solo" */
  mode: string;
  /** "the Payments team" */
  team: string;
  url: string | null;
  /** The one sentence: where the session stands. */
  sentence: string;
  goal: string | null;
  plan: PlanPart | null;
  gate: GatePart | null;
  tokens: {
    spent: number;
    budget: number | null;
    input: number;
    output: number;
    cache: number;
    /** The active plan's estimate against what its steps have taken, or null without a plan. */
    estimate: number | null;
    actual: number | null;
  };
  /** The head of the hash chain: "Replays to the same hash". */
  hash: string | null;
  replayUrl: string | null;
  auditUrl: string | null;
}

const bold = (s: string) => `**${s}**`;
const code = (s: string) => `\`${s.replace(/`/g, "'")}\``;
const link = (label: string, url: string | null) => (url ? `[${label}](${url})` : label);
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

/** "▰▰▰▰▰▰▱▱▱▱": ten cells, the lit ones first. */
export function glyphBar(fraction: number, cells = 10): string {
  const n = Math.max(0, Math.min(cells, Math.round(fraction * cells)));
  return "▰".repeat(n) + "▱".repeat(cells - n);
}

function voiceLine(v: Voice): string {
  const said = v.note ? ` · _“${v.note.replace(/[“”]/g, '"')}”_` : "";
  if (v.deny) return `- ${bold(v.who)} ${v.role} · ✕ denied${said}`;
  const vote =
    v.rating !== null
      ? `${starsWithNumber(v.rating)}${v.counts ? "" : " · a voice, not a vote"}`
      : v.counts
        ? "approved"
        : "approved without a rating · a voice, not a vote";
  return `- ${bold(v.who)} ${v.role} · ${vote}${said}`;
}

/** The comment body, marker first, link last on the first line. */
export function prComment(i: CommentInput): string {
  const out: string[] = [];
  out.push(marker(i.sessionId));
  out.push(
    `${bold(i.agent)} · ${i.mode} · ${i.team} · ${link("Open the session", i.url)}`.replace(
      / · Open the session$/,
      "",
    ),
  );
  out.push("");
  out.push(bold(i.sentence));
  if (i.goal) {
    out.push("");
    out.push(i.goal);
  }
  if (i.plan) {
    const done = i.plan.steps.filter((s) => s.status === "done").length;
    out.push("");
    out.push(`### The plan — ${i.plan.state} · ${done} of ${i.plan.steps.length} steps done`);
    out.push("| # | Step | Estimate | Actual | |");
    out.push("|--:|------|---------:|-------:|--|");
    i.plan.steps.forEach((s, n) => {
      const mark = s.status === "done" ? "✓" : s.status === "running" ? "→" : "";
      out.push(
        `| ${n + 1} | ${cell(s.title)} | ${compactTokens(s.est)} | ${s.actual ? compactTokens(s.actual) : "—"} | ${mark} |`,
      );
    });
    if (i.plan.ratings.length) {
      out.push("");
      for (const r of i.plan.ratings) out.push(voiceLine(r));
    }
    out.push("");
    out.push(i.plan.verdict);
  }
  if (i.gate) {
    out.push("");
    out.push(`### Release gate — ${i.gate.state}`);
    out.push(`${code(i.gate.call)} · ${i.gate.risk} · ${i.gate.rule}`);
    if (i.gate.voices.length) {
      out.push("");
      for (const v of i.gate.voices) out.push(voiceLine(v));
    }
    out.push("");
    out.push(i.gate.verdict);
  }
  const t = i.tokens;
  out.push("");
  out.push(
    `### Tokens — ${compactTokens(t.spent)}${t.budget ? ` of ${compactTokens(t.budget)}` : ""}`,
  );
  const parts = [
    t.budget ? `${glyphBar(t.spent / t.budget)} ${Math.round((t.spent / t.budget) * 100)}%` : "",
    `input ${compactTokens(t.input)}`,
    `output ${compactTokens(t.output)}`,
    `cache ${compactTokens(t.cache)}`,
  ].filter(Boolean);
  out.push(parts.join(" · "));
  if (t.estimate !== null) out.push(describeEstimate(t.estimate, t.actual).text);
  out.push("");
  out.push(
    [
      link("Session", i.url),
      i.replayUrl ? link("Replay", i.replayUrl) : "",
      i.auditUrl ? link("Audit record", i.auditUrl) : "",
      `replays to ${code(shortHash(i.hash))}`,
    ]
      .filter(Boolean)
      .join(" · "),
  );
  return `${out.join("\n")}\n`;
}

/** GitHub refuses a comment over 65536 characters; the plan table is what grows. */
export const MAX_BODY = 65_536;

export function fitBody(body: string): string {
  if (body.length <= MAX_BODY) return body;
  const cut = body.slice(0, MAX_BODY - 80);
  return `${cut}\n\n_… the rest is in the session._\n`;
}
