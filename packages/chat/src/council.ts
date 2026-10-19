/**
 * The council's state: the fold of one council's events in the group's log. A council is a
 * deliberation on one task with a chair, a set of member models, a round plan and a budget;
 * what each model said in each round, what people instructed in private, the chair's plan
 * with its dissent, the assignments and their reports, and the tokens it all cost. Pure and
 * total, like the chat reducer it folds into; `councilProtocol` reads this record to say what
 * happens next.
 */
import { addUsage, type Usage, ZERO_USAGE } from "@henosis/protocol";
import type {
  ChatEvent,
  CouncilCite,
  CouncilDissent,
  CouncilMember,
  CouncilOutcome,
  CouncilReportStatus,
  CouncilRound,
  CouncilStance,
  CouncilStep,
} from "./events.js";

export interface CouncilSaid {
  member: CouncilMember;
  text: string;
  usage: Usage;
  cites: CouncilCite[];
  stance: CouncilStance | null;
  seq: number;
}

/** One round as it ran: which kind, which repetition of it, and what every model said. */
export interface CouncilRoundRecord {
  round: CouncilRound;
  index: number;
  startedSeq: number;
  said: CouncilSaid[];
}

export interface CouncilInstruction {
  member: CouncilMember;
  by: string;
  text: string;
  seq: number;
}

export interface CouncilSynthesis {
  planId: string;
  steps: CouncilStep[];
  dissent: CouncilDissent[];
  seq: number;
}

export interface CouncilAssignment {
  stepId: string;
  owner: CouncilMember;
  projectId: string;
  sessionId: string;
  seq: number;
}

export interface CouncilReport {
  stepId: string;
  owner: CouncilMember;
  status: CouncilReportStatus;
  text: string;
  usage: Usage;
  seq: number;
}

/**
 * Where a council stands, as its events say: deliberating while the models answer and
 * discuss; synthesised once the chair's plan is in; working once a step is assigned;
 * concluded when the host or the convener ended it.
 */
export type CouncilStatus = "deliberating" | "synthesised" | "working" | "concluded";

export interface Council {
  id: string;
  groupId: string;
  task: string;
  chair: CouncilMember;
  members: CouncilMember[];
  /** The round plan it was convened with, in order. */
  roundPlan: CouncilRound[];
  /** How many discussion rounds the plan's "discussion" entry stands for. */
  discussionRounds: number;
  budget: number | null;
  by: string;
  convenedSeq: number;
  /** The rounds that have started, in order, with what was said in each. */
  rounds: CouncilRoundRecord[];
  instructions: CouncilInstruction[];
  synthesis: CouncilSynthesis | null;
  /** By step id. */
  assignments: Record<string, CouncilAssignment>;
  /** By step id; the latest report for a step wins, earlier ones are in `reportLog`. */
  reports: Record<string, CouncilReport>;
  reportLog: CouncilReport[];
  /** Every token the council spent: what the models said plus what the assigned work cost. */
  usage: Usage;
  status: CouncilStatus;
  outcome: CouncilOutcome | null;
  summary: string;
  /** Seq of the last event that touched this council. */
  lastSeq: number;
}

/**
 * Fold one event into the councils map. Returns true when the event was a council event (so
 * the caller marks the group touched), false otherwise. Mutates `councils` in place: the chat
 * reducer clones the state before it calls this.
 */
export function reduceCouncils(councils: Record<string, Council>, e: ChatEvent): boolean {
  switch (e.kind) {
    case "council.convened": {
      const p = e.payload;
      councils[p.councilId] = {
        id: p.councilId,
        groupId: p.groupId,
        task: p.task,
        chair: p.chair,
        members: p.members,
        roundPlan: p.rounds,
        discussionRounds: p.discussionRounds,
        budget: p.budget,
        by: p.by,
        convenedSeq: e.seq,
        rounds: [],
        instructions: [],
        synthesis: null,
        assignments: {},
        reports: {},
        reportLog: [],
        usage: ZERO_USAGE,
        status: "deliberating",
        outcome: null,
        summary: "",
        lastSeq: e.seq,
      };
      return true;
    }
    case "council.round.started": {
      const c = councils[e.payload.councilId];
      if (!c) return true;
      if (!c.rounds.some((r) => r.round === e.payload.round && r.index === e.payload.index))
        c.rounds.push({
          round: e.payload.round,
          index: e.payload.index,
          startedSeq: e.seq,
          said: [],
        });
      c.lastSeq = e.seq;
      return true;
    }
    case "council.said": {
      const c = councils[e.payload.councilId];
      if (!c) return true;
      const p = e.payload;
      let r = c.rounds.find((x) => x.round === p.round && x.index === p.index);
      if (!r) {
        // Tolerate a word before its round.started: the round exists from its first answer.
        r = { round: p.round, index: p.index, startedSeq: e.seq, said: [] };
        c.rounds.push(r);
      }
      r.said.push({
        member: p.member,
        text: p.text,
        usage: p.usage,
        cites: p.cites,
        stance: p.stance ?? null,
        seq: e.seq,
      });
      c.usage = addUsage(c.usage, p.usage);
      c.lastSeq = e.seq;
      return true;
    }
    case "council.instructed": {
      const c = councils[e.payload.councilId];
      if (!c) return true;
      c.instructions.push({
        member: e.payload.member,
        by: e.payload.by,
        text: e.payload.text,
        seq: e.seq,
      });
      c.lastSeq = e.seq;
      return true;
    }
    case "council.synthesised": {
      const c = councils[e.payload.councilId];
      if (!c) return true;
      c.synthesis = {
        planId: e.payload.planId,
        steps: e.payload.steps,
        dissent: e.payload.dissent,
        seq: e.seq,
      };
      // A fresh synthesis starts the work over: earlier assignments and reports are history.
      c.assignments = {};
      c.reports = {};
      if (c.status !== "concluded") c.status = "synthesised";
      c.lastSeq = e.seq;
      return true;
    }
    case "council.assigned": {
      const c = councils[e.payload.councilId];
      if (!c) return true;
      c.assignments[e.payload.stepId] = {
        stepId: e.payload.stepId,
        owner: e.payload.owner,
        projectId: e.payload.projectId,
        sessionId: e.payload.sessionId,
        seq: e.seq,
      };
      if (c.status !== "concluded") c.status = "working";
      c.lastSeq = e.seq;
      return true;
    }
    case "council.reported": {
      const c = councils[e.payload.councilId];
      if (!c) return true;
      const report: CouncilReport = {
        stepId: e.payload.stepId,
        owner: e.payload.owner,
        status: e.payload.status,
        text: e.payload.text,
        usage: e.payload.usage,
        seq: e.seq,
      };
      c.reports[e.payload.stepId] = report;
      c.reportLog.push(report);
      c.usage = addUsage(c.usage, e.payload.usage);
      c.lastSeq = e.seq;
      return true;
    }
    case "council.concluded": {
      const c = councils[e.payload.councilId];
      if (!c) return true;
      c.status = "concluded";
      c.outcome = e.payload.outcome;
      c.summary = e.payload.summary;
      // The event carries the total as the host counted it; the fold already has its own.
      c.lastSeq = e.seq;
      return true;
    }
    default:
      return false;
  }
}

/** The councils convened in a group, most recently active first. */
export function councilsOf(
  councils: Record<string, Council>,
  groupId: string,
  status?: CouncilStatus,
): Council[] {
  return Object.values(councils)
    .filter((c) => c.groupId === groupId && (status === undefined || c.status === status))
    .sort((a, b) => b.lastSeq - a.lastSeq);
}
