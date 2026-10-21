/**
 * The council in Slack (docs/19_council.md, "Slack and CLI"): the root message in the group's
 * channel, every round and every word in its thread with the member and its model named, the
 * chair's plan with the owners and the dissent beside the five stars, the assignments and
 * reports as lines, and the conclusion with the dissent on the record. Same anatomy as the
 * other templates: the sentence first, the context line, the buttons, the link last. Pure.
 */
import { compactTokens } from "@henosis/kernel";
import { mrkdwnLink } from "./links.js";
import {
  actions,
  bold,
  code,
  context,
  EDITED,
  italic,
  plural,
  type Rendered,
  STARS,
  section,
  trailingLink,
} from "./templates.js";

/** A member model as Slack names it: the agent's name and the model it speaks through. */
export interface CouncilModelLabel {
  name: string;
  /** "scripted", "claude", "claude <model>"; "" when the profile is not on file. */
  model: string;
}

/** "*Ana's agent* (scripted)", or the name alone when the model is not on file. */
export function modelLabel(m: CouncilModelLabel): string {
  return m.model ? `${bold(m.name)} (${m.model})` : bold(m.name);
}

export interface CouncilConvenedInput {
  councilId: string;
  group: string;
  by: string;
  task: string;
  chair: CouncilModelLabel;
  members: CouncilModelLabel[];
  rounds: string[];
  discussionRounds: number;
  budget: number | null;
  url: string | null;
}

/** The rounds as words: "individual · discussion ×2 · synthesis · vote". */
export function roundsLine(rounds: string[], discussionRounds: number): string {
  return rounds
    .map((r) =>
      r === "discussion" && discussionRounds !== 1 ? `discussion ×${discussionRounds}` : r,
    )
    .join(" · ");
}

/** The council's root message in the group's channel; every round posts in its thread. */
export function councilConvened(i: CouncilConvenedInput): Rendered {
  const sentence = `:classical_building: ${bold(i.by)} convened a council in ${italic(i.group)} on ${italic(i.task)}: ${plural(i.members.length, "model")} deliberate; ${bold(i.chair.name)} chairs.`;
  const roster = i.members.map((m) => `• ${modelLabel(m)}`).join("\n");
  const ctx = [
    `rounds: ${roundsLine(i.rounds, i.discussionRounds)}`,
    i.budget ? `budget ${compactTokens(i.budget)} tokens` : "no budget",
    `council ${code(i.councilId)}`,
    i.url ? mrkdwnLink(i.url, "Open in Henosis") : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    text: `${sentence}${trailingLink(i.url, "Open in Henosis")}`,
    blocks: [section(sentence), section(roster), context(ctx)],
  };
}

/** The line a round opens with, in the thread. */
export function councilRoundLine(
  round: string,
  index: number,
  discussionRounds: number,
  models: number,
): string {
  switch (round) {
    case "individual":
      return `:speech_balloon: ${bold("Round: individual")} · each of ${plural(models, "model")} answers alone.`;
    case "discussion":
      return `:speech_balloon: ${bold(`Round: discussion ${index + 1} of ${discussionRounds}`)} · each model reads the others and replies.`;
    case "synthesis":
      return `:speech_balloon: ${bold("Round: synthesis")} · the chair writes the plan.`;
    case "vote":
      return `:speech_balloon: ${bold("Round: vote")} · rate the chair's plan.`;
    default:
      return `:speech_balloon: ${bold(`Round: ${round}`)}`;
  }
}

export interface CouncilSaidInput {
  member: CouncilModelLabel;
  round: string;
  index: number;
  stance: "agree" | "differ" | "add" | null;
  text: string;
  /** The people whose private instructions this word answers. */
  cites: string[];
  tokens: number;
}

const STANCE_WORDS = { agree: "agrees", differ: "differs", add: "adds" } as const;

/** What a model said, posted as that model: the member and its model named, the stance a word. */
export function councilSaid(i: CouncilSaidInput): Rendered {
  const text = i.text.length > 1500 ? `${i.text.slice(0, 1499)}…` : i.text;
  const who = `${modelLabel(i.member)}${i.stance ? ` ${STANCE_WORDS[i.stance]}` : ""}`;
  const ctx = [
    i.round === "discussion" ? `discussion ${i.index + 1}` : i.round,
    `${compactTokens(i.tokens)} tokens`,
    i.cites.length ? `instructed by ${i.cites.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    text: `${who}: ${text}`,
    blocks: [section(`${who}: ${text}`), context(ctx)],
  };
}

export interface CouncilStepLabel {
  title: string;
  owner: CouncilModelLabel;
  risk: string;
  estTokens: number;
}

export interface CouncilDissentLabel {
  member: CouncilModelLabel;
  text: string;
}

export interface CouncilSynthesisInput {
  orgId: string;
  councilId: string;
  planId: string;
  chair: CouncilModelLabel;
  task: string;
  steps: CouncilStepLabel[];
  dissent: CouncilDissentLabel[];
  /** The policy's bar, from the chair's session; null when the plan has no session yet. */
  bar: { min: number; average: number } | null;
  ratings?: { name: string; rating: number }[] | undefined;
  /** Once the people decided: the buttons go, the result line takes their place. */
  decided?: { status: "approved" | "revise" | "rejected"; by: string } | undefined;
  url: string | null;
}

/** The route of a council rating button: `council.rate:<org>:<council>:<plan>`. */
export const councilRateRoute = (
  i: Pick<CouncilSynthesisInput, "orgId" | "councilId" | "planId">,
) => `council.rate:${i.orgId}:${i.councilId}:${i.planId}`;

/** "*Dissent* · *Bo's agent*: …" lines, or "" when every model stands behind the plan. */
export function dissentLines(dissent: CouncilDissentLabel[]): string {
  if (!dissent.length) return "";
  return dissent.map((d) => `${bold("Dissent")} · ${modelLabel(d.member)}: ${d.text}`).join("\n");
}

/**
 * The chair's plan with an owner per step and the dissent beside it; the five stars rate it
 * the way the app's plan card does. The rating is the button's `value`.
 */
export function councilSynthesised(i: CouncilSynthesisInput): Rendered {
  const est = i.steps.reduce((n, s) => n + s.estTokens, 0);
  const sentence = i.decided
    ? i.decided.status === "approved"
      ? `:white_check_mark: ${bold("The council's plan is approved")}${i.decided.by === "policy" ? "" : ` by ${i.decided.by}`}: ${plural(i.steps.length, "step")} for ${italic(i.task)}. ${EDITED}`
      : i.decided.status === "revise"
        ? `:pencil2: ${bold(i.decided.by)} asked the chair for a revised plan for ${italic(i.task)}. ${EDITED}`
        : `:x: ${bold(i.decided.by)} rejected the council's plan for ${italic(i.task)}. ${EDITED}`
    : `:clipboard: ${bold("The chair's plan waits for your rating")}: ${bold(i.chair.name)} proposes ${plural(i.steps.length, "step")}, about ${compactTokens(est)} tokens, for ${italic(i.task)}.`;
  const steps = i.steps
    .map(
      (s, n) =>
        `${n + 1}. ${s.title} — ${modelLabel(s.owner)} (${s.risk}, ~${compactTokens(s.estTokens)})`,
    )
    .join("\n");
  const so = (i.ratings ?? []).map((r) => `${r.name} rated ${r.rating}`).join(" · ");
  const ctx = [
    i.decided
      ? ""
      : i.bar
        ? `needs ${plural(i.bar.min, "rating")} at ${i.bar.average}+ on average`
        : "the chair's session is not open yet",
    so,
    `council ${code(i.councilId)}`,
    i.url ? mrkdwnLink(i.url, "Open in Henosis") : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const dissent = dissentLines(i.dissent);
  const route = councilRateRoute(i);
  return {
    text: `${sentence}${trailingLink(i.url, "Open in Henosis")}`,
    blocks: [
      section(sentence),
      section(steps),
      ...(dissent ? [section(dissent)] : []),
      context(ctx),
      ...(i.decided
        ? []
        : [
            actions(
              STARS.map((n) => ({ text: `${n}★`, actionId: `${route}:${n}`, value: String(n) })),
            ),
          ]),
    ],
  };
}

export function councilAssignedLine(
  owner: CouncilModelLabel,
  title: string,
  url: string | null,
): string {
  return `:bookmark_tabs: ${modelLabel(owner)} takes ${italic(title)}.${trailingLink(url, "Open the session")}`;
}

export function councilReportedLine(
  owner: CouncilModelLabel,
  title: string,
  status: "done" | "blocked" | "revised",
  text: string,
): string {
  const emblem =
    status === "done" ? ":white_check_mark:" : status === "blocked" ? ":no_entry:" : ":pencil2:";
  const verb = status === "done" ? "reports" : status === "blocked" ? "is blocked on" : "revised";
  const said = text.length > 300 ? `${text.slice(0, 299)}…` : text;
  return `${emblem} ${modelLabel(owner)} ${verb} ${italic(title)}${status === "done" ? " done" : ""}${said ? `: ${said}` : "."}`;
}

export interface CouncilConcludedInput {
  task: string;
  outcome: "done" | "abandoned" | "revised";
  summary: string;
  /** Steps done of steps planned; null when there was no plan. */
  steps: { done: number; of: number } | null;
  dissent: CouncilDissentLabel[];
  tokens: number;
  url: string | null;
}

/** The conclusion, with the dissent beside it: who held what against the plan stays on the record. */
export function councilConcluded(i: CouncilConcludedInput): Rendered {
  const emblem =
    i.outcome === "done"
      ? ":checkered_flag:"
      : i.outcome === "abandoned"
        ? ":octagonal_sign:"
        : ":pencil2:";
  const sentence = `${emblem} ${bold(`The council concluded: ${i.outcome}`)} on ${italic(i.task)}.${i.summary ? ` ${i.summary}` : ""}`;
  const dissent = dissentLines(i.dissent);
  const ctx = [
    i.steps ? `${i.steps.done} of ${plural(i.steps.of, "step")} done` : "no plan",
    `${compactTokens(i.tokens)} tokens`,
    i.url ? mrkdwnLink(i.url, "Open in Henosis") : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    text: `${sentence}${dissent ? ` ${dissent.replace(/\n/g, " ")}` : ""}${trailingLink(i.url, "Open in Henosis")}`,
    blocks: [section(sentence), ...(dissent ? [section(dissent)] : []), context(ctx)],
  };
}
