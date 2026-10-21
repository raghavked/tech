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
  councilLabel,
  sameCouncilMember,
} from "@henosis/chat";
import { personalAgentId } from "@henosis/fleet";
import type { ChatDirectoryListing, CouncilLookup, CouncilRailRow, ModelRow } from "./api.js";
import { copy } from "./copy.js";

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
