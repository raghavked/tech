/**
 * Welcome an agent, on the web: the facts of the arrival card and the input of the welcome
 * brief, read from the live session state and the project listing, so the drawer "What it was
 * told" composes the same paragraph the server recorded in the ledger (`@henosis/fleet`'s
 * `welcomeBrief`). Pure, so the facts are unit-tested without React.
 */
import { type BriefRead, isWelcomeBrief, memoryEntriesOf, type WelcomeInput } from "@henosis/fleet";
import {
  describeRule,
  minimumRank,
  planWaiting,
  ruleFor,
  type SessionState,
} from "@henosis/kernel";
import { ROLE_RANK } from "@henosis/protocol";
import type { SessionRow } from "./api.js";

/** The people of the session, the owner first, with whether they hold the release gate. */
export function circleOf(s: SessionState): {
  id: string;
  name: string;
  role: string;
  owner: boolean;
  holdsGate: boolean;
}[] {
  const rank = minimumRank(ruleFor(s.policy.approvals, "irreversible"));
  return Object.values(s.participants)
    .filter((p) => p.actor.kind === "human")
    .sort(
      (a, b) =>
        Number(b.actor.id === s.ownerId) - Number(a.actor.id === s.ownerId) ||
        a.joinedSeq - b.joinedSeq,
    )
    .map((p) => ({
      id: p.actor.id,
      name: p.actor.name,
      role: p.role,
      owner: p.actor.id === s.ownerId,
      holdsGate: rank >= 0 && ROLE_RANK[p.role] >= rank,
    }));
}

/** The other open sessions in the project, crewmates first. */
export function agentsOf(
  s: SessionState,
  rows: readonly SessionRow[],
  nameOf: (id: string) => string,
): WelcomeInput["agents"] {
  const mine = rows.find((r) => r.sessionId === s.sessionId) ?? null;
  const crew = mine?.crew ?? null;
  return rows
    .filter((r) => r.open && r.sessionId !== s.sessionId)
    .map((r) => ({
      title: r.title || r.sessionId,
      ownerName: nameOf(r.ownerId),
      status: r.live ?? r.report?.status ?? null,
      doing: r.report?.goal ?? null,
      crewmate: Boolean(crew) && r.crew === crew,
      holds: [],
    }))
    .sort((a, b) => Number(b.crewmate) - Number(a.crewmate));
}

/** The welcome brief's input from what the browser holds; the server's version adds the claims. */
export function welcomeInputFromSession(
  s: SessionState,
  rows: readonly SessionRow[],
  projectName: string,
  memoryContext: string,
  nameOf: (id: string) => string = (id) => s.participants[id]?.actor.name ?? id,
): WelcomeInput {
  const mine = rows.find((r) => r.sessionId === s.sessionId) ?? null;
  const people = circleOf(s).map(({ name, role, owner, holdsGate }) => ({
    name,
    role,
    owner,
    holdsGate,
  }));
  const ownerName = s.ownerId ? nameOf(s.ownerId) : "nobody";
  if (s.ownerId && !people.some((p) => p.owner))
    people.unshift({ name: ownerName, role: "owner", owner: true, holdsGate: true });
  return {
    agent: {
      title: s.title || s.sessionId,
      ownerName,
      project: projectName,
      crew: mine?.crew ?? null,
      branch: s.branch,
      freshWorkspace: Object.keys(s.workspace).length === 0,
    },
    people,
    agents: agentsOf(s, rows, nameOf),
    manners: {
      planFirst: s.policy.planFirst,
      planMin: s.policy.planApproval.min,
      planAverage: s.policy.planApproval.average,
      gateRule: describeRule(ruleFor(s.policy.approvals, "irreversible")),
      group: null,
      budget: s.policy.tokenBudget,
    },
    context: memoryEntriesOf(memoryContext),
    notTold: ["the groups' history", "the team's chat", "the other projects' memory"],
  };
}

/** The four facts of the arrival card, as words. */
export interface ArrivalFacts {
  /** "Planning" while a plan waits, else the session's status word key. */
  status: string;
  planning: boolean;
  /** Who may mention it: the people here, or anyone on the project when nobody has joined. */
  mentionedBy: string[];
  /** Who holds the gate, by name; empty when nobody here ranks high enough. */
  gate: string[];
  gateRule: string;
  ownerName: string;
  crew: string | null;
  freshWorkspace: boolean;
  files: number;
  goal: string | null;
}

export function arrivalFacts(s: SessionState, rows: readonly SessionRow[]): ArrivalFacts {
  const circle = circleOf(s);
  const mine = rows.find((r) => r.sessionId === s.sessionId) ?? null;
  const files = Object.keys(s.workspace).length;
  return {
    status: s.status,
    planning: planWaiting(s),
    mentionedBy: circle.map((p) => p.name),
    gate: circle.filter((p) => p.holdsGate).map((p) => p.name),
    gateRule: describeRule(ruleFor(s.policy.approvals, "irreversible")),
    ownerName: s.ownerId ? (s.participants[s.ownerId]?.actor.name ?? s.ownerId) : "nobody",
    crew: mine?.crew ?? null,
    freshWorkspace: files === 0,
    files,
    goal: s.intent.goal?.text ?? null,
  };
}

/** The arrival card shows while the agent has not finished a turn: the session is still arriving. */
export function isArriving(s: SessionState): boolean {
  return s.turns.length === 0;
}

/** The welcome brief the ledger recorded for the agent (kind `fleet`), when it is one. */
export function recordedWelcome(briefs: readonly BriefRead[] | undefined): BriefRead | null {
  return (briefs ?? []).find((b) => b.kind === "fleet" && isWelcomeBrief(b.brief)) ?? null;
}
