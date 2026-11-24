/**
 * The council as the web reads it (docs/19_council.md): the member models a group can convene,
 * the words on the rail card, where the chair's plan lives, and who may see a private
 * instruction. The state itself is the chat reducer's `councils`; everything here is a pure
 * reading of it, so the views stay thin and the flow test can name what it expects.
 */
import {
  type Council,
  type CouncilInstruction,
  type CouncilMember,
  type CouncilRound,
  type CouncilStance,
  type CouncilVote,
  councilLabel,
  councilNext,
  roundSequence,
  sameCouncilMember,
} from "@henosis/chat";
import { personalAgentId } from "@henosis/fleet";
import type { PlanStatus } from "@henosis/protocol";
import type { ChatDirectoryListing, CouncilLookup, CouncilRailRow, ModelRow } from "./api.js";
import { average, copy } from "./copy.js";

/**
 * The member models the convene sheet offers: the server's profiles when it lists them, else
 * one scripted agent per person in the directory (`agent:<userId>`, "<Name>'s agent"), which
 * is what a server without users.json takes on trust and what the fleet resolver maps to a
 * person's own profile when it has one.
 */
export function memberModels(directory: ChatDirectoryListing | null): ModelRow[] {
  if (!directory) return [];
  if (directory.models?.length) return directory.models;
  return directory.people.map((p) => ({
    profileId: personalAgentId(p.id),
    name: `${p.name}'s agent`,
    ownerId: p.id,
    provider: "scripted",
    model: "",
  }));
}

/** The council member a model row stands for. */
export function toMember(m: ModelRow): CouncilMember {
  return { kind: "agent", userId: m.ownerId, profileId: m.profileId, name: m.name };
}

/** Every model in the circle: the members, and the chair when it is not among them. */
export function modelsOf(c: Pick<Council, "chair" | "members">): CouncilMember[] {
  const out = [...c.members];
  if (!out.some((m) => sameCouncilMember(m, c.chair))) out.push(c.chair);
  return out;
}

/** "scripted · claude-x" from a profile row, or the provider alone; "" when nothing is known. */
export function modelWord(row: ModelRow | undefined): string {
  if (!row) return "";
  return copy.council.model(row.provider, row.model);
}

/** The owner's name for a member model, or "shared agent". */
export function ownerWord(m: CouncilMember, nameOf: (userId: string) => string): string {
  return m.userId ? copy.council.modelOf(nameOf(m.userId)) : copy.council.shared;
}

/**
 * The words after "Council · 4 models ·" for a council the web holds: the core's label
 * ("discussion 1 of 1", "working 2 of 3", "concluded: done") with its single-word rounds
 * spelt out.
 */
export function councilWord(c: Council): string {
  return labelWord(councilLabel(c));
}

/** The core's rail label in the product's words; what the server's rail row carries too. */
export function labelWord(label: string): string {
  const L = copy.council.label;
  if (label === "convened") return L.convened;
  if (label === "individual") return L.individual;
  if (label === "synthesis") return L.synthesis;
  if (label === "vote") return L.vote;
  const d = label.match(/^discussion (\d+) of (\d+)$/);
  if (d) return L.discussion(Number(d[1]), Number(d[2]));
  const w = label.match(/^working (\d+) of (\d+)$/);
  if (w) return L.working(Number(w[1]), Number(w[2]));
  const c = label.match(/^concluded: (\w+)$/);
  if (c) return L.concluded(outcomeWord(c[1] ?? ""));
  return label;
}

export function outcomeWord(outcome: string): string {
  const o = copy.council.outcome as Record<string, string>;
  return o[outcome] ?? outcome;
}

/** "Council · 4 models · discussion 1 of 1": the rail card and the group's strip. */
export function councilCard(c: Council): string {
  return copy.council.card(modelsOf(c).length, councilWord(c));
}

/** The same card from the server's rail row. */
export function railCard(row: CouncilRailRow): string {
  return copy.council.card(row.models, labelWord(row.label));
}

/** The title of a round's section. */
export function roundTitle(round: CouncilRound, index: number, discussionRounds: number): string {
  const T = copy.council.roundTitle;
  switch (round) {
    case "individual":
      return T.individual;
    case "discussion":
      return T.discussion(index + 1, discussionRounds);
    case "synthesis":
      return T.synthesis;
    case "vote":
      return T.vote;
  }
}

/**
 * Where the chair's plan is, from the council lookup. The host names the session it opened
 * under `plan` (the council view) once the plan is proposed; a server that spells it `session`,
 * `planSession` or at the top level is read the same way.
 */
export function councilSessionOf(
  lookup: CouncilLookup | null | undefined,
): { projectId: string; sessionId: string } | null {
  if (!lookup) return null;
  const raw = lookup as CouncilLookup & {
    planSession?: { projectId?: string; sessionId?: string } | null;
    projectId?: string;
    sessionId?: string;
  };
  const cand = raw.plan ?? raw.session ?? raw.planSession ?? raw;
  if (cand && typeof cand.projectId === "string" && typeof cand.sessionId === "string")
    return { projectId: cand.projectId, sessionId: cand.sessionId };
  return null;
}

/**
 * A private instruction is visible to the person who gave it, the instructed model's owner
 * and the chair's owner.
 */
export function canSeeInstruction(c: Council, i: CouncilInstruction, meId: string): boolean {
  return i.by === meId || i.member.userId === meId || c.chair.userId === meId;
}

/** The instructions a person may see for one model, oldest first. */
export function instructionsFor(c: Council, member: CouncilMember, meId: string) {
  return c.instructions.filter(
    (i) => sameCouncilMember(i.member, member) && canSeeInstruction(c, i, meId),
  );
}

/** The member a profile id names in the council, chair included. */
export function memberOf(c: Council, profileId: string): CouncilMember | null {
  return modelsOf(c).find((m) => m.profileId === profileId) ?? null;
}

/** Is this person the convener or a member model's owner or the chair's owner? */
export function sitsIn(c: Council, meId: string): boolean {
  return c.by === meId || modelsOf(c).some((m) => m.userId === meId);
}

/** A manager's agent: its owner manages a team (users.json), so it chairs by default. */
export function isManagerModel(m: Pick<ModelRow, "manages">): boolean {
  return (m.manages?.length ?? 0) > 0;
}

/**
 * The chair the convene sheet proposes (docs/19_council.md): the convener's manager's agent,
 * a model whose owner manages a team the convener is in (the first in the directory's order
 * when several do, never the convener's own); else the convener's own agent; else the first
 * model; null while the directory has not landed or lists no models.
 */
export function defaultChair(
  directory: ChatDirectoryListing | null,
  meId: string,
): ModelRow | null {
  const models = memberModels(directory);
  if (models.length === 0) return null;
  const teams = directory?.people.find((p) => p.id === meId)?.teams ?? [];
  const manager = models.find(
    (m) =>
      m.ownerId !== null &&
      m.ownerId !== meId &&
      (m.manages ?? []).some((teamId) => teams.includes(teamId)),
  );
  return manager ?? models.find((m) => m.ownerId === meId) ?? models[0] ?? null;
}

// ---- the table (views/CouncilTable.tsx) -------------------------------------------------------

/** What the chair's session says of the plan: its status and each person's rating, by user id. */
export interface TablePlan {
  status: PlanStatus;
  ratings: Record<string, number>;
}

/** A person at the table: a model's owner beside it, or someone in the room without a model. */
export interface TablePerson {
  userId: string;
  name: string;
  initial: string;
  me: boolean;
  /** In the room now, as far as this client can see. */
  present: boolean;
  rating: number | null;
  /** The plan is proposed and this person has not rated it. */
  waited: boolean;
}

/** One word a model said, as the table draws it: an arc from its seat to the centre. */
export interface TableWord {
  round: "individual" | "discussion";
  index: number;
  /** The round's number as people count it: the first round of the council is 1. */
  ordinal: number;
  stance: CouncilStance | null;
  seq: number;
  /** The council's latest word while it deliberates. */
  latest: boolean;
}

export interface TableSeat {
  key: string;
  member: CouncilMember;
  chair: boolean;
  /** The model's owner; null for a shared agent. */
  person: TablePerson | null;
  /** The stance of its latest discussion reply. */
  stance: CouncilStance | null;
  spoke: boolean;
  /** The number of the round it last answered in; null before its first word. */
  answered: number | null;
  /** Has it answered in the round that is running (or, between rounds, at all)? */
  answeredNow: boolean;
  /** What the protocol waits on it for: an answer in the running round, or the plan. */
  thinking: "answer" | "plan" | null;
  /** The number of the round it owes an answer in. */
  owes: number | null;
  /** What it holds against the plan. */
  dissent: string | null;
  /** This person instructed it in private; nobody else's table shows the mark. */
  instructed: boolean;
  words: TableWord[];
  /** The plan's steps it owns, by their number, with whether each reported done. */
  steps: { n: number; done: boolean }[];
  /** The seat's accessible name: "Dee's agent, chair, agrees, answered round 2". */
  label: string;
}

export interface TableGuest extends TablePerson {
  label: string;
}

export type TableCentre =
  | { kind: "forming"; wordsIn: number; wordsExpected: number }
  | { kind: "writing"; chair: string; wordsIn: number }
  | { kind: "none" }
  | {
      kind: "plan";
      steps: number;
      owners: number;
      /** Where the plan stands, and the same in fewer letters for a small disc. */
      state: string;
      short: string;
    };

export interface CouncilTableView {
  seats: TableSeat[];
  /** People in the room, or who rated, with no model at the table. */
  guests: TableGuest[];
  /** Guests the drawing has no gap for. */
  more: number;
  /** How far the models' words close the plan's rim: words said over words expected. */
  wordsFraction: number;
  /** How far the people's ratings close it; 1 once the plan is approved. */
  ratingsFraction: number;
  /** People wear their rating rings: the chair's plan is open and its ratings are known. */
  voting: boolean;
  centre: TableCentre;
  dissent: { key: string; name: string; text: string }[];
  /** Where the council stands, in one line; announced politely when it changes. */
  line: string;
  /** The plan waits for this person's rating. */
  waitsForMe: boolean;
  /** This person's own model at the table while the council runs: the one they may instruct. */
  mine: CouncilMember | null;
}

/** The vote as the protocol reads it, from the plan's status in the chair's session. */
export function voteOf(plan: TablePlan | null): CouncilVote {
  if (!plan || plan.status === "proposed") return "pending";
  if (plan.status === "revise") return "revise";
  if (plan.status === "rejected") return "rejected";
  return "approved";
}

const isDeliberation = (r: CouncilRound): r is "individual" | "discussion" =>
  r === "individual" || r === "discussion";

/** The words the table keeps per seat: the answer alone, then the two latest replies. */
function foldWords(words: TableWord[]): TableWord[] {
  const alone = words.filter((w) => w.round === "individual").slice(-1);
  const replies = words.filter((w) => w.round === "discussion").slice(-2);
  return [...alone, ...replies];
}

/**
 * The council's table, read from its fold, the chair's plan and who is in the room: the chair
 * first, then the members in the order they were convened, each with its person; the people
 * without a model after them. Pure, so the drawing only draws.
 */
export function councilTable(input: {
  council: Council;
  meId: string;
  nameOf: (userId: string) => string;
  /** The user ids of the people in the room now. */
  present: Iterable<string>;
  plan: TablePlan | null;
}): CouncilTableView {
  const { council: c, meId, nameOf, plan } = input;
  const T = copy.council.table;
  const present = new Set(input.present);
  const next = councilNext(c, voteOf(plan));
  const sequence = roundSequence(c).filter((r) => isDeliberation(r.round));
  const ordinalOf = (round: CouncilRound, index: number) => {
    const at = sequence.findIndex((r) => r.round === round && r.index === index);
    return at < 0 ? index + 1 : at + 1;
  };
  const running = next.kind === "await-answers" ? next : null;
  const ratings = plan?.ratings ?? {};
  const voting = c.synthesis !== null && plan !== null;
  const voteOpen = voting && plan?.status === "proposed" && next.kind === "await-vote";
  let latestSeq = -1;
  if (c.status === "deliberating")
    for (const r of c.rounds)
      if (isDeliberation(r.round)) for (const s of r.said) latestSeq = Math.max(latestSeq, s.seq);

  const person = (userId: string): TablePerson => {
    const name = nameOf(userId);
    const rating = ratings[userId] ?? null;
    return {
      userId,
      name,
      initial: (name.trim()[0] ?? "?").toUpperCase(),
      me: userId === meId,
      present: present.has(userId),
      rating,
      waited: voteOpen && rating === null,
    };
  };
  const personFacts = (p: TablePerson): string[] => [
    p.me ? T.youHere : p.present ? T.here(p.name) : T.away(p.name),
    ...(p.rating !== null ? [p.me ? T.youRated(p.rating) : T.rated(p.name, p.rating)] : []),
    ...(p.waited ? [p.me ? T.waitsForYou : T.waitsFor(p.name)] : []),
  ];

  const models = [c.chair, ...modelsOf(c).filter((m) => !sameCouncilMember(m, c.chair))];
  const seats: TableSeat[] = models.map((member) => {
    const chair = sameCouncilMember(member, c.chair);
    const all: TableWord[] = [];
    for (const r of c.rounds) {
      if (!isDeliberation(r.round)) continue;
      for (const s of r.said)
        if (sameCouncilMember(s.member, member))
          all.push({
            round: r.round,
            index: r.index,
            ordinal: ordinalOf(r.round, r.index),
            stance: s.stance,
            seq: s.seq,
            latest: s.seq === latestSeq,
          });
    }
    all.sort((a, b) => a.seq - b.seq);
    const last = all[all.length - 1] ?? null;
    const stance = [...all].reverse().find((w) => w.stance !== null)?.stance ?? null;
    const owed = running?.owed.some((m) => sameCouncilMember(m, member)) ?? false;
    const thinking = owed ? "answer" : chair && next.kind === "synthesise" ? "plan" : null;
    const owes = owed && running ? ordinalOf(running.round, running.index) : null;
    const wrote = chair && c.synthesis !== null;
    const answeredNow = running
      ? c.members.some((m) => sameCouncilMember(m, member)) && !owed
      : all.length > 0 || wrote;
    const dissent =
      c.synthesis?.dissent.find((d) => sameCouncilMember(d.member, member))?.text ?? null;
    const instructed = c.instructions.some(
      (i) => i.by === meId && sameCouncilMember(i.member, member),
    );
    const steps = (c.synthesis?.steps ?? [])
      .map((st, i) => ({ st, n: i + 1 }))
      .filter(({ st }) => sameCouncilMember(st.owner, member))
      .map(({ st, n }) => ({ n, done: c.reports[st.id]?.status === "done" }));
    const p = member.userId ? person(member.userId) : null;
    const label = [
      member.name,
      ...(chair ? [T.chair] : []),
      ...(stance ? [copy.council.stance[stance]] : []),
      thinking === "plan"
        ? T.writing
        : owes !== null
          ? T.thinkingIn(owes)
          : last
            ? T.answered(last.ordinal)
            : wrote
              ? T.wrote
              : T.silent,
      ...(dissent ? [T.dissents] : []),
      ...(steps.length ? [T.owns(steps.map((s) => s.n))] : []),
      ...(instructed ? [T.instructed] : []),
      ...(p ? personFacts(p) : [copy.council.shared]),
    ].join(", ");
    return {
      key: member.profileId,
      member,
      chair,
      person: p,
      stance,
      spoke: all.length > 0,
      answered: last?.ordinal ?? null,
      answeredNow,
      thinking,
      owes,
      dissent,
      instructed,
      words: foldWords(all),
      steps,
      label,
    };
  });

  const owners = new Set(models.map((m) => m.userId).filter((id): id is string => id !== null));
  const guestIds = [...new Set([...Object.keys(ratings), ...present])]
    .filter((id) => !owners.has(id))
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const guestsAll: TableGuest[] = guestIds.map((id) => {
    const p = person(id);
    return { ...p, label: [p.me ? T.you : p.name, ...personFacts(p)].join(", ") };
  });
  const guests = guestsAll.slice(0, seats.length);

  const wordsExpected = c.members.length * sequence.length;
  let wordsIn = 0;
  for (const r of c.rounds) if (isDeliberation(r.round)) wordsIn += r.said.length;
  const people = owners.size + guestsAll.length;
  const rated = Object.keys(ratings).length;
  const settled = plan !== null && (plan.status === "approved" || plan.status === "done");

  const steps = c.synthesis?.steps ?? [];
  const doneSteps = steps.filter((st) => c.reports[st.id]?.status === "done").length;
  const outcome = outcomeWord(c.outcome ?? "abandoned");
  const waitsForMe = voteOpen && ratings[meId] === undefined;
  let centre: TableCentre;
  if (c.synthesis) {
    const C = T.centre;
    const state =
      c.status === "concluded"
        ? C.concluded(outcome)
        : c.status === "working"
          ? C.working(doneSteps, steps.length)
          : !plan
            ? C.opening
            : plan.status === "proposed"
              ? waitsForMe
                ? C.waitsForYou
                : C.waits
              : C[plan.status];
    centre = {
      kind: "plan",
      steps: steps.length,
      owners: new Set(steps.map((st) => st.owner.profileId)).size,
      state,
      short: state === C.waits ? C.waitsShort : state,
    };
  } else if (next.kind === "synthesise") centre = { kind: "writing", chair: c.chair.name, wordsIn };
  else if (c.status === "concluded" || !c.roundPlan.includes("synthesis"))
    centre = { kind: "none" };
  else centre = { kind: "forming", wordsIn, wordsExpected };

  const L = T.line;
  const dissent = (c.synthesis?.dissent ?? []).map((d) => ({
    key: d.member.profileId,
    name: d.member.name,
    text: d.text,
  }));
  const values = Object.values(ratings);
  const mean = values.length ? average(values.reduce((n, v) => n + v, 0) / values.length) : "";
  let line: string;
  if (c.status === "concluded") line = L.concluded(outcome);
  else if (c.status === "working") line = L.working(doneSteps, steps.length);
  else if (running)
    line = L.answers(
      roundTitle(running.round, running.index, c.discussionRounds),
      c.members.length - running.owed.length,
      c.members.length,
      running.owed.map((m) => m.name),
    );
  else if (next.kind === "synthesise") line = L.writing(c.chair.name);
  else if (c.synthesis && !plan) line = L.opening;
  else if (c.synthesis && plan?.status === "proposed")
    line = waitsForMe ? L.waitsForYou(rated, people) : L.waits(rated, people);
  else if (c.synthesis && plan?.status === "revise") line = L.revise;
  else if (c.synthesis && plan?.status === "rejected") line = L.rejected;
  else if (c.synthesis && settled) line = L.approved(rated, mean);
  else if (next.kind === "start-round")
    line = L.round(roundTitle(next.round, next.index, c.discussionRounds));
  else line = L.convened;
  if (dissent.length && c.status !== "concluded")
    line = `${line} ${L.dissent(dissent.map((d) => d.name))}`;

  return {
    seats,
    guests,
    more: guestsAll.length - guests.length,
    wordsFraction: wordsExpected ? Math.min(1, wordsIn / wordsExpected) : 0,
    ratingsFraction: settled ? 1 : people ? Math.min(1, rated / people) : 0,
    voting,
    centre,
    dissent,
    line,
    waitsForMe,
    mine: c.status === "concluded" ? null : (models.find((m) => m.userId === meId) ?? null),
  };
}
