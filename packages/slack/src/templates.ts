/**
 * The Slack templates (slack-templates): every message is one sentence first, in the
 * product's voice, with the buttons the app already has and the link into Henosis last.
 *
 * The five-part anatomy for any host: emblem · product name · the sentence · a context line ·
 * actions, then the link last as a link. Never "bot", never "@mention". Names bold, session
 * titles italic, tool names and paths in backticks, one emoji at the front and it is the kind.
 * The `text` fallback carries the whole sentence so push notifications read right. Slack has
 * three button styles only; no star is primary (no surface pre-selects a number with a
 * primary colour), Deny is `danger`, a plain Approve is `primary`.
 *
 * Pure: every function takes plain data and returns `{ text, blocks }`, so the adapter wires
 * and the tests read what Slack would render.
 */

import { compactTokens, describeRule, isRatingsRule } from "@henosis/kernel";
import type { ApprovalRule, PlanStep, Rating, RiskClass } from "@henosis/protocol";
import { DEFAULT_RATING } from "@henosis/protocol";
import type { Block } from "./client.js";
import { mrkdwnLink } from "./links.js";

export interface Rendered {
  text: string;
  blocks: Block[];
}

export interface Button {
  text: string;
  actionId: string;
  value?: string;
  style?: "primary" | "danger";
  url?: string;
}

/** The product name in Slack: the emblem is the app icon; the words carry the brand. */
export const PRODUCT = "Henosis";
export const STARS: Rating[] = [1, 2, 3, 4, 5];
/** Slack mrkdwn has no small type; "(edited)" in italics is the edited state. */
export const EDITED = "_(edited)_";

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const bold = (s: string) => `*${s}*`;
export const italic = (s: string) => `_${s}_`;
export const code = (s: string) => `\`${s}\``;

export function section(text: string): Block {
  return { type: "section", text: { type: "mrkdwn", text } };
}
export function context(text: string): Block {
  return { type: "context", elements: [{ type: "mrkdwn", text }] };
}
export function header(text: string): Block {
  return { type: "header", text: { type: "plain_text", text: text.slice(0, 150) } };
}
export function fields(items: string[]): Block {
  return { type: "section", fields: items.map((text) => ({ type: "mrkdwn", text })) };
}
export function actions(buttons: Button[]): Block {
  return {
    type: "actions",
    elements: buttons.map((b) => ({
      type: "button",
      text: { type: "plain_text", text: b.text },
      action_id: b.actionId,
      ...(b.value !== undefined ? { value: b.value } : {}),
      ...(b.style ? { style: b.style } : {}),
      ...(b.url ? { url: b.url } : {}),
    })),
  };
}

/** The link as the last word of a sentence: " <url|label>", or "" without a URL. */
export const trailingLink = (url: string | null, label: string) =>
  url ? ` ${mrkdwnLink(url, label)}` : "";

// ---- 01 · session started --------------------------------------------------------------

export interface SessionStartedInput {
  owner: string;
  title: string;
  project: string;
  url: string | null;
  planFirst: boolean;
  crew: string | null;
  driver: string | null;
  /** The soft token budget, or null. */
  budget: number | null;
}

/** The root message: the session's address in Slack. Replies in its thread steer the session. */
export function sessionStarted(i: SessionStartedInput): Rendered {
  const sentence = `:henosis: ${bold(`${i.owner}'s agent`)} started ${italic(i.title)} in ${i.project}. Reply in this thread to steer it.`;
  const ctx = [
    i.planFirst ? "plan first" : "no plan gate",
    i.crew ? `crew ${italic(i.crew)}` : "solo",
    i.driver ? `${i.driver} has the baton` : "nobody has the baton yet",
    i.budget ? `budget ${compactTokens(i.budget)}` : "no budget",
  ].join(" · ");
  return {
    text: `${sentence}${trailingLink(i.url, "Open in Henosis")}`,
    blocks: [
      section(sentence),
      context(ctx + (i.url ? ` · ${mrkdwnLink(i.url, "Open in Henosis")}` : "")),
    ],
  };
}

/** "Dee's agent joins the circle." / "Bo joins the circle." (the app's joining line). */
export function joinLine(name: string, agent: boolean): string {
  return agent
    ? `:henosis: ${bold(`${name}'s agent`)} joins the circle.`
    : `${bold(name)} joins the circle.`;
}

export function batonLine(name: string): string {
  return `:handshake: ${bold(name)} has the baton.`;
}

export function refusedWriteLine(path: string, holder: string, claimId: string, where: string) {
  return `:no_entry: Your write to ${code(path)} was refused: ${bold(holder)}'s session holds it (claim ${code(claimId)}). Your agent is working around it.${where ? ` A lead can resolve it in ${where}.` : ""}`;
}

// ---- 02 · approval with rating buttons ---------------------------------------------------

export interface Ballot {
  name: string;
  vote: "approve" | "deny";
  rating: number | null;
  note: string;
}

export interface ApprovalInput {
  projectId: string;
  sessionId: string;
  approvalId: string;
  owner: string;
  call: { name: string; risk: RiskClass; args: Record<string, unknown> };
  rule: ApprovalRule | undefined;
  url: string | null;
  /** Votes so far; the context line names them while the gate is pending. */
  ballots?: Ballot[];
}

/** The route of a vote button: `vote:<project>:<session>:<approval>:<approve|deny>`. */
export const voteRoute = (i: Pick<ApprovalInput, "projectId" | "sessionId" | "approvalId">) =>
  `vote:${i.projectId}:${i.sessionId}:${i.approvalId}`;

export function describeArgs(args: Record<string, unknown>, max = 120): string {
  const parts = Object.entries(args).map(([k, v]) =>
    typeof v === "string" ? v : `${k}=${JSON.stringify(v)}`,
  );
  const s = parts.join(" ");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function approvalSentence(i: ApprovalInput): string {
  const args = describeArgs(i.call.args);
  const needs = i.rule && typeof i.rule === "object" ? ` Needs ${describeRule(i.rule)}.` : "";
  return `:raised_hand: ${bold("Approval needed")} in ${i.owner}'s session: ${code(i.call.name)} [${i.call.risk}]${args ? ` ${args}` : ""}.${needs}`;
}

function votesSoFar(ballots: Ballot[], ratings: boolean): string {
  if (!ballots.length) return "";
  return ballots
    .map((b) =>
      b.vote === "deny"
        ? `${b.name} denied`
        : ratings && b.rating !== null
          ? `${b.name} rated ${b.rating}`
          : `${b.name} approved`,
    )
    .join(" · ");
}

/**
 * Under a ratings rule the five buttons are the vote: a tap sends `vote(approve, rating)` with
 * that number. The rating is the button's `value`; the handler reads it from there and never
 * from the action_id. Slack needs every action_id in a block to be unique, so the stars carry
 * `:<n>` after the route purely as a disambiguator. Without a ratings rule the message shows
 * Approve and Deny, nothing more; the bare Approve carries no rating, as the app's does.
 */
export function approvalRequested(i: ApprovalInput): Rendered {
  const ratings = i.rule !== undefined && isRatingsRule(i.rule);
  const route = voteRoute(i);
  const buttons: Button[] = ratings
    ? STARS.map((n) => ({ text: `${n}★`, actionId: `${route}:approve:${n}`, value: String(n) }))
    : [{ text: "Approve", actionId: `${route}:approve`, value: "", style: "primary" }];
  buttons.push({ text: "Deny", actionId: `${route}:deny`, value: "", style: "danger" });
  const sentence = approvalSentence(i);
  const so = votesSoFar(i.ballots ?? [], ratings);
  const ctx = [
    ratings ? `${DEFAULT_RATING}★ is what a plain Approve sends` : "any eligible vote decides",
    so,
    i.url ? mrkdwnLink(i.url, "Review in Henosis") : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    text: `${sentence}${trailingLink(i.url, "Review in Henosis")}`,
    blocks: [section(sentence), context(ctx), actions(buttons)],
  };
}

export interface ApprovalDecidedInput {
  call: { name: string };
  status: "granted" | "denied";
  rule: ApprovalRule | undefined;
  ballots: Ballot[];
  url: string | null;
}

/** The decision edits the message in place: buttons go, the result line takes their place. */
export function approvalDecided(i: ApprovalDecidedInput): Rendered {
  const ratings = i.rule !== undefined && isRatingsRule(i.rule);
  const rated = i.ballots.filter((b) => b.vote === "approve" && b.rating !== null);
  const parts: string[] = [];
  if (i.status === "granted") {
    parts.push(`:white_check_mark: ${code(i.call.name)} ${bold("granted")}`);
    const names = i.ballots
      .filter((b) => b.vote === "approve")
      .map((b) => (ratings && b.rating !== null ? `${b.name} ${b.rating}` : b.name));
    if (names.length) parts.push(names.join(", "));
    if (ratings && rated.length) {
      const avg = rated.reduce((n, b) => n + (b.rating ?? 0), 0) / rated.length;
      parts.push(
        `average ${Math.round(avg * 10) / 10} of ${i.rule && isRatingsRule(i.rule) ? i.rule.ratings.average : "?"} needed`,
      );
    }
  } else {
    parts.push(`:x: ${code(i.call.name)} ${bold("denied")}`);
    const deniers = i.ballots.filter((b) => b.vote === "deny");
    if (deniers.length)
      parts.push(deniers.map((b) => (b.note ? `${b.name}: "${b.note}"` : b.name)).join(", "));
    parts.push("The agent waits for a steer.");
  }
  const line = `${parts.join(" · ")} ${EDITED}`;
  return {
    text: line,
    blocks: [section(line), ...(i.url ? [context(mrkdwnLink(i.url, "Open in Henosis"))] : [])],
  };
}

// ---- 02b · plan rating -----------------------------------------------------------------

export interface PlanInput {
  projectId: string;
  sessionId: string;
  planId: string;
  owner: string;
  goal: string;
  steps: Pick<PlanStep, "title" | "risk" | "estTokens">[];
  estTokens: number;
  /** The policy's bar: `min` raters at `average` or above. */
  min: number;
  average: number;
  url: string | null;
  ratings?: { name: string; rating: number }[];
}

export const planRoute = (i: Pick<PlanInput, "projectId" | "sessionId" | "planId">) =>
  `plan:${i.projectId}:${i.sessionId}:${i.planId}`;

/** Plan first: the agent proposes, the people rate with the same five stars, the kernel decides. */
export function planProposed(i: PlanInput): Rendered {
  const sentence = `:clipboard: ${bold("A plan waits for your rating")} in ${i.owner}'s session: ${plural(i.steps.length, "step")}, about ${compactTokens(i.estTokens)} tokens, for ${italic(i.goal)}.`;
  const steps = i.steps
    .map((s, n) => `${n + 1}. ${s.title} (${s.risk}, ~${compactTokens(s.estTokens)})`)
    .join("\n");
  const so = (i.ratings ?? []).map((r) => `${r.name} rated ${r.rating}`).join(" · ");
  const ctx = [
    `needs ${plural(i.min, "rating")} at ${i.average}+ on average`,
    so,
    i.url ? mrkdwnLink(i.url, "Open in Henosis") : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const route = planRoute(i);
  return {
    text: `${sentence}${trailingLink(i.url, "Open in Henosis")}`,
    blocks: [
      section(sentence),
      section(steps),
      context(ctx),
      actions(STARS.map((n) => ({ text: `${n}★`, actionId: `${route}:${n}`, value: String(n) }))),
    ],
  };
}

export interface PlanDecidedInput {
  status: "approved" | "revise" | "rejected";
  by: string;
  ratings: { name: string; rating: number }[];
  url: string | null;
}

export function planDecided(i: PlanDecidedInput): Rendered {
  const who = i.ratings.map((r) => `${r.name} ${r.rating}`).join(", ");
  const line =
    i.status === "approved"
      ? `:white_check_mark: The plan is ${bold("approved")}${who ? ` (${who})` : ""}${i.by === "policy" ? "" : ` by ${i.by}`}. ${EDITED}`
      : i.status === "revise"
        ? `:pencil2: ${bold(i.by)} asked for a revised plan${who ? ` (${who})` : ""}. ${EDITED}`
        : `:x: ${bold(i.by)} rejected the plan${who ? ` (${who})` : ""}. The agent waits for a steer. ${EDITED}`;
  return {
    text: line,
    blocks: [section(line), ...(i.url ? [context(mrkdwnLink(i.url, "Open in Henosis"))] : [])],
  };
}

// ---- 03 · contention ------------------------------------------------------------------

export interface ContentionSide {
  sessionId: string;
  owner: string;
  title: string;
  status: string;
  turn: number;
  tokens: number;
  /** Claims this session holds on the contended resource, as resource keys. */
  holds: string[];
}

export interface ContentionInput {
  projectId: string;
  contentionId: string;
  kind: string;
  resource: string;
  detail: string;
  sides: ContentionSide[];
  /** Who may resolve it, in words ("a lead or an owner"). */
  waitsOn: string;
  url: string | null;
}

export const resolveRoute = (i: Pick<ContentionInput, "projectId" | "contentionId">) =>
  `resolve:${i.projectId}:${i.contentionId}`;

/** No button is primary: the app does not recommend a winner. */
export function contentionOpened(i: ContentionInput): Rendered {
  const names = i.sides.map((s) => bold(s.owner));
  const between =
    names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  const sentence = `:warning: ${bold("Contention")} (${i.kind}) on ${code(i.resource)} between ${between ?? "nobody"}. ${i.detail}`;
  const sideFields = i.sides.map(
    (s) =>
      `${bold(`${s.owner} · ${s.title}`)}\n${s.status} · turn ${s.turn} · ${compactTokens(s.tokens)} tokens${s.holds.length ? ` · holds ${s.holds.map(code).join(", ")}` : ""}`,
  );
  const route = resolveRoute(i);
  return {
    text: `${sentence}${trailingLink(i.url, "Open the project")}`,
    blocks: [
      section(sentence),
      fields(sideFields),
      context(`waits on ${i.waitsOn}${i.url ? ` · ${mrkdwnLink(i.url, "Open the project")}` : ""}`),
      actions(
        i.sides.map((s) => ({
          text: `${s.owner} wins`,
          actionId: `${route}:${s.sessionId}`,
          value: s.sessionId,
        })),
      ),
    ],
  };
}

export interface ContentionResolvedInput {
  resource: string;
  by: string;
  winner: string | null;
  losers: string[];
  note: string;
  url: string | null;
}

export function contentionResolved(i: ContentionResolvedInput): Rendered {
  const line = `:white_check_mark: ${bold(i.by)} resolved it: ${i.winner ? `${bold(`${i.winner} wins`)}.` : "nobody wins."}${i.losers.length ? ` ${i.losers.join(" and ")}'s claims on ${code(i.resource)} release.` : ""}${i.note ? ` ${i.note}` : ""} ${EDITED}`;
  return {
    text: line,
    blocks: [section(line), ...(i.url ? [context(mrkdwnLink(i.url, "Open the project"))] : [])],
  };
}

export interface MemoryConflictInput {
  orgId: string;
  conflictId: string;
  key: string;
  sides: { entryId: string; name: string; claim: string }[];
}

/** Memory conflicts use the contention shape with "X is right" buttons. */
export function memoryConflict(i: MemoryConflictInput): Rendered {
  const sentence = `:thinking_face: ${bold("Team memory disagrees")} on ${code(i.key)}: ${i.sides.map((s) => `${bold(s.name)} says "${s.claim}"`).join(" and ")}.`;
  return {
    text: sentence,
    blocks: [
      section(sentence),
      context("waits on a lead"),
      actions(
        i.sides.map((s) => ({
          text: `${s.name} is right`,
          actionId: `memory:${i.orgId}:${i.conflictId}:${s.entryId}`,
          value: s.entryId,
        })),
      ),
    ],
  };
}

export function memoryResolved(i: { key: string; by: string; winner: string | null }): Rendered {
  const line = `:white_check_mark: ${bold(i.by)} settled ${code(i.key)}: ${i.winner ? `${bold(i.winner)} is right.` : "neither stands."} ${EDITED}`;
  return { text: line, blocks: [section(line)] };
}

// ---- 04 · mention reply ---------------------------------------------------------------

export interface MentionReplyInput {
  owner: string;
  title: string;
  asker: string;
  channel: string;
  answer: string;
  /** Tokens the answering turn cost. */
  tokens: number;
  url: string | null;
  /** The button that keeps the answer as team memory. */
  rememberActionId: string;
  rememberValue: string;
}

/** The placeholder posted at once, edited into the answer: never two messages. */
export function mentionPlaceholder(owner: string): Rendered {
  const line = `${italic("Reading…")} ${bold(`${owner}'s agent`)} is looking.`;
  return { text: line, blocks: [section(line)] };
}

/** Posts as "Owner's agent": the voice belongs to the session, not to the product. */
export function mentionReply(i: MentionReplyInput): Rendered {
  const answer = i.answer.length > 1200 ? `${i.answer.slice(0, 1199)}…` : i.answer;
  const ctx = `from ${italic(i.title)} · steered as ${code("chat")} · ${compactTokens(i.tokens)} tokens${i.url ? ` · ${mrkdwnLink(i.url, "Open the session")}` : ""}`;
  return {
    text: `${bold(`${i.owner}'s agent`)} answered ${i.asker} in ${i.channel}: ${answer}`,
    blocks: [
      section(answer),
      context(ctx),
      actions([
        { text: "Remember for the team", actionId: i.rememberActionId, value: i.rememberValue },
      ]),
    ],
  };
}

export function answeredLine(owner: string, asker: string, channel: string): string {
  return `:speech_balloon: ${bold(`${owner}'s agent`)} answered ${asker} in ${channel}.`;
}

// ---- 05 · daily brief -----------------------------------------------------------------

export interface BriefNeed {
  /** "`git push` in *Ana*'s session waits for one rating at 4+ · Bo rated 4" */
  line: string;
  url: string | null;
  action: string;
}

export interface BriefSession {
  owner: string;
  title: string;
  status: string;
  turn: number;
  tokens: number;
  crew: string | null;
}

export interface DailyBriefInput {
  projectId: string;
  project: string;
  /** The weekday for the header; the ledger keeps no wall clock, so the adapter supplies it. */
  weekday: string;
  seq: number;
  open: number;
  /** "2 running, 1 awaiting approval", from the live statuses. */
  counts: string;
  needs: BriefNeed[];
  sessions: BriefSession[];
  tokens: number;
  budget: number | null;
  plans: { approved: number; waiting: number; average: number | null };
  gates: { granted: number; waiting: number };
  crews: { name: string; owners: string[] }[];
  /** Active project directives on the goal, as the direction line. */
  direction: string | null;
  approvalsWaiting: number;
  contentionsOpen: number;
  url: string | null;
}

/** The sentence the team page and every off-platform surface open with (copy.team.summary). */
export function teamSummary(open: number, projects: number, counts: string, needs: number) {
  return `${plural(open, "open session")} across ${plural(projects, "project")}${counts ? `: ${counts}` : ""}. ${
    needs === 0
      ? "Nothing needs you right now."
      : `${plural(needs, "thing")} need${needs === 1 ? "s" : ""} you.`
  }`;
}

/**
 * The manager overview said in Slack: the sentence, what needs you with the button that
 * answers it, the roster, the numbers as fields. Computed from the ledger, never written by
 * a model. A quiet morning is one line and no buttons.
 */
export function dailyBrief(i: DailyBriefInput): Rendered {
  const summary = teamSummary(i.open, 1, i.counts, i.needs.length);
  if (!i.needs.length && !i.sessions.some((s) => s.status === "running")) {
    const line = `${bold(`${i.project} · ${i.weekday}`)} · ${summary}${i.tokens ? ` ${compactTokens(i.tokens)} tokens so far.` : ""}`;
    return { text: line, blocks: [section(line)] };
  }
  const sentence = `${bold(`${i.project} · ${i.weekday}`)} · ${summary}`;
  const needs = i.needs.length
    ? i.needs.map((n) => `• ${n.line}${n.url ? ` · ${mrkdwnLink(n.url, n.action)}` : ""}`)
    : ["• nothing"];
  const roster = i.sessions.length
    ? i.sessions.map(
        (s) =>
          `• ${bold(s.owner)} · ${italic(s.title)} · ${s.status} · turn ${s.turn} · ${compactTokens(s.tokens)}${s.crew ? ` · crew ${italic(s.crew)}` : ""}`,
      )
    : ["• no open sessions"];
  const numbers = [
    `${bold("Tokens")}\n${compactTokens(i.tokens)}${i.budget ? ` of ${compactTokens(i.budget)}` : ""}${i.sessions.length ? ` · ${i.sessions.map((s) => `${s.owner} ${compactTokens(s.tokens)}`).join(" · ")}` : ""}`,
    `${bold("Plans")}\n${i.plans.approved} approved${i.plans.average !== null ? `, average ${i.plans.average}` : ""} · ${plural(i.plans.waiting, "waits", "wait")} for a rating`,
    `${bold("Release gates")}\n${i.gates.granted} granted · ${plural(i.gates.waiting, "waits", "wait")}`,
    `${bold("Crews")}\n${i.crews.length ? i.crews.map((c) => `${italic(c.name)} is ${c.owners.join(" + ")}`).join(" · ") : "none"}`,
  ];
  const ctx = `computed from the ledger at seq ${i.seq}${i.direction ? ` · direction: ${italic(i.direction)}` : ""} · ${code(`/henosis brief ${i.projectId}`)}`;
  const buttons: Button[] = [];
  if (i.url)
    buttons.push({
      text: "Open the overview",
      actionId: `open:${i.projectId}:overview`,
      url: i.url,
      style: "primary",
    });
  buttons.push({
    text: `Approvals · ${i.approvalsWaiting}`,
    actionId: `open:${i.projectId}:approvals`,
  });
  buttons.push({
    text: `Contentions · ${i.contentionsOpen}`,
    actionId: `open:${i.projectId}:contentions`,
  });
  return {
    text: `${sentence}${trailingLink(i.url, "Open in Henosis")}`,
    blocks: [
      header(`${i.project} · ${i.weekday}`),
      section(summary),
      section(`${bold("Needs you")}\n${needs.join("\n")}`),
      section(`${bold("Sessions")}\n${roster.join("\n")}`),
      fields(numbers),
      context(ctx),
      actions(buttons),
    ],
  };
}

/** The on-demand line `/henosis brief <project>` answers with, only to the asker. */
export function briefNow(i: DailyBriefInput): string {
  const first = i.needs[0];
  return `${bold(`${i.project}, now.`)} ${plural(i.open, "session")} open${i.counts ? ` (${i.counts})` : ""}; ${
    i.needs.length === 0
      ? "nothing needs you."
      : `${i.needs.length === 1 ? "one needs" : `${i.needs.length} need`} you: ${first?.line ?? ""}.`
  }${i.tokens ? ` ${compactTokens(i.tokens)} tokens${i.budget ? ` of ${compactTokens(i.budget)}` : ""}.` : ""}`;
}

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export function weekdayOf(d: Date): string {
  return WEEKDAYS[d.getUTCDay()] ?? "";
}
