/**
 * The welcome brief: what an agent is told when it joins the circle (welcome-agent, SCREENS.md
 * §19). The circle it enters, its crew, the manners, what sits in its context and what it is not
 * told. Plain facts in, so the server composes it from the ledger at registration (recorded as
 * `session.briefed`, kind `fleet`) and the web composes the same paragraph from its live state;
 * the two must read alike, because the new engineer and the new agent read the same thing.
 */
import { describeRule, formatTokens, minimumRank, ruleFor } from "@henosis/kernel";
import { DEFAULT_SESSION_POLICY, SessionPolicy } from "@henosis/protocol";
import { resourceKey } from "./events.js";
import { activeClaims, type ProjectState } from "./state.js";

export interface WelcomeInput {
  agent: {
    title: string;
    ownerName: string;
    project: string;
    crew: string | null;
    branch: string;
    freshWorkspace: boolean;
  };
  /** The people of the circle, the owner first. */
  people: { name: string; role: string; owner: boolean; holdsGate: boolean }[];
  /** The other agents in the project; crewmates share the crew. */
  agents: {
    title: string;
    ownerName: string;
    status: string | null;
    doing: string | null;
    crewmate: boolean;
    holds: string[];
  }[];
  manners: {
    planFirst: boolean;
    planMin: number;
    planAverage: number;
    /** The release gate's rule in words ("2 contributors or above rating it 4+ of 5 on average"). */
    gateRule: string;
    /** The group it answers in, when it is in one; mentions only. */
    group: string | null;
    budget: number | null;
  };
  /** Team memory entries in its scope chain, attributed. */
  context: { text: string; who: string }[];
  /** What it is not told, in the system's words. */
  notTold: string[];
}

export interface WelcomeSection {
  title: string;
  /** The count or name after the title ("4 people · 2 agents", "Invoice rollout"). */
  note: string;
  lines: string[];
}

export interface WelcomeBrief {
  /** The serif paragraph on navy: the product's own voice, three sentences at most. */
  paragraph: string;
  sections: WelcomeSection[];
  /** The brief as the model reads it; the ledger keeps this text in `session.briefed`. */
  markdown: string;
}

export const WELCOME_HEADING = "## Henosis · you have joined";

/** "Ana, Bo, Cy and Dee". */
function names(xs: readonly string[]): string {
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function welcomeBrief(w: WelcomeInput): WelcomeBrief {
  const people = w.people.map((p) => p.name);
  const gate = w.people.filter((p) => p.holdsGate && !p.owner).map((p) => p.name);
  const circle =
    people.length || w.agents.length
      ? `${names(people)}${people.length && w.agents.length ? ", and " : ""}${
          w.agents.length ? count(w.agents.length, "agent") : ""
        }`
      : "nobody else yet";
  const paragraph = [
    `You join ${w.agent.project}: ${circle}.`,
    `You are ${w.agent.ownerName}'s agent on ${w.agent.title}.`,
    w.manners.planFirst
      ? "Plan first; the people who consume your code open your gate."
      : "The people who consume your code open your gate.",
  ].join(" ");

  const circleLines: string[] = [];
  for (const p of w.people) {
    if (p.owner)
      circleLines.push(
        `${p.name} is your owner${
          p.role === "lead" || p.role === "admin" ? ` and the ${p.role}` : ""
        }. ${p.name} can pause, resume, cancel and hand you on.`,
      );
    else if (p.holdsGate) circleLines.push(`${p.name} holds your release gate (${p.role}).`);
    else circleLines.push(`${p.name} may steer and constrain you (${p.role}).`);
  }
  if (gate.length)
    circleLines.push(
      `${names(gate)} hold your release gate: nothing that cannot be undone goes until they say so.`,
    );
  if (!circleLines.length) circleLines.push("Nobody else is in the circle yet.");

  const mates = w.agents.filter((a) => a.crewmate);
  const crewLines: string[] = w.agent.crew
    ? [
        ...mates.map(
          (a) =>
            `${a.title} (${a.ownerName}'s${a.status ? `, ${a.status}` : ""})${
              a.doing ? ` · ${a.doing}` : ""
            }`,
        ),
        mates.length
          ? "Their claims are visible to you; a denied claim is a contention your owner sees."
          : "Nobody else is in the crew yet.",
      ]
    : ["Solo. Your owner can name a crew to share one task with other agents."];
  for (const a of w.agents.filter((a) => !a.crewmate))
    crewLines.push(
      `Also on ${w.agent.project}: ${a.title}, ${a.ownerName}'s${
        a.status ? ` (${a.status})` : ""
      }${a.holds.length ? `; holds ${a.holds.join(", ")}` : ""}. Claim before writing shared paths.`,
    );

  const manners: string[] = [];
  if (w.manners.planFirst)
    manners.push(
      `Plan before work. Steps, token estimates and risk; the plan waits for ${count(
        w.manners.planMin,
        "rating",
      )} at ${w.manners.planAverage}+ or an owner's Approve.`,
    );
  manners.push(
    `Ask for risky calls. Deleting, paying, sending: a vote; the gate is ${w.manners.gateRule}.`,
  );
  manners.push(
    `In ${w.manners.group ? `#${w.manners.group}` : "a group"} you hear mentions only. Answer there as ${
      w.agent.ownerName
    }'s agent; team chat is never sent to you.`,
  );
  manners.push(
    w.manners.budget
      ? `${formatTokens(w.manners.budget)} tokens, soft. You are told what you have spent; nobody stops you at the line.`
      : "No token budget. You are told what you have spent.",
  );

  const context = w.context.length
    ? w.context.map((c) => (c.who ? `${c.text} (${c.who})` : c.text))
    : ["Nothing remembered in your scope yet."];
  const notTold = w.notTold.length ? [`Not told: ${w.notTold.join(", ")}.`] : [];

  const sections: WelcomeSection[] = [
    {
      title: "The circle",
      note: `${count(w.people.length, "person", "people")} · ${count(w.agents.length, "agent")}`,
      lines: circleLines,
    },
    { title: "Your crew", note: w.agent.crew ?? "solo", lines: crewLines },
    { title: "Manners", note: "", lines: manners },
    {
      title: "In your context",
      note: count(w.context.length, "entry", "entries"),
      lines: [...context, ...notTold],
    },
  ];

  const md: string[] = [WELCOME_HEADING, paragraph, ""];
  md.push(`agent: ${w.agent.title} · owner: ${w.agent.ownerName} · project: ${w.agent.project}`);
  md.push(
    `branch: ${w.agent.branch} · workspace: ${
      w.agent.freshWorkspace ? "fresh" : "carried over"
    } · crew: ${w.agent.crew ?? "solo"}`,
  );
  for (const s of sections) {
    md.push("", `## ${s.title}${s.note ? ` (${s.note})` : ""}`);
    for (const l of s.lines) md.push(`- ${l}`);
  }
  return { paragraph, sections, markdown: `${md.join("\n")}\n` };
}

/** True when a `session.briefed` text is a welcome brief (and not an older bare fleet context). */
export function isWelcomeBrief(text: string): boolean {
  return text.startsWith(WELCOME_HEADING);
}

/** A rough token count for "as the model reads it": four characters a token. */
export function briefTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** The entries of a rendered memory context ("  - [key] text (who)"), attributed. */
export function memoryEntriesOf(context: string): { text: string; who: string }[] {
  const out: { text: string; who: string }[] = [];
  for (const line of context.split("\n")) {
    const m = line.match(/^\s+[-!]\s(.*?)(?:\s\(([^()]*)\))?$/);
    if (!m) continue;
    const text = (m[1] ?? "").replace(/^\[[^\]]+\]\s/, "");
    out.push({ text, who: m[2] ?? "" });
  }
  return out;
}

export interface WelcomeFromProjectOptions {
  policy: SessionPolicy;
  branch?: string;
  freshWorkspace?: boolean;
  /** The team memory rendered for the session's scope (`MemoryAccess.context()`), parsed here. */
  memoryContext?: string;
  group?: string | null;
}

/** The rank a project role takes inside a session (identity.ts: leads and admins own, members contribute). */
function sessionRankOf(role: string): number {
  return role === "member" ? 1 : 3;
}

/**
 * The welcome brief's facts from the project ledger: the members, the other open sessions and
 * their claims, the crew, and the session's policy. The server records the result at
 * registration; `fleetBrief` lists the read.
 */
export function welcomeInputOf(
  p: ProjectState,
  sessionId: string,
  opts: WelcomeFromProjectOptions,
): WelcomeInput {
  const me = p.sessions[sessionId];
  const name = (id: string) => p.members[id]?.name ?? id;
  const ownerId = me?.ownerId ?? "";
  // A policy from an older log or a partial default fills in what it lacks.
  const parsed = SessionPolicy.safeParse(opts.policy);
  const policy = parsed.success ? parsed.data : DEFAULT_SESSION_POLICY;
  const gateRule = ruleFor(policy.approvals, "irreversible");
  const gateRank = minimumRank(gateRule);
  const people = Object.values(p.members)
    .sort((a, b) => Number(b.userId === ownerId) - Number(a.userId === ownerId))
    .map((m) => ({
      name: m.name,
      role: m.role,
      owner: m.userId === ownerId,
      holdsGate: gateRank >= 0 && sessionRankOf(m.role) >= gateRank,
    }));
  if (ownerId && !p.members[ownerId])
    people.unshift({ name: name(ownerId), role: "member", owner: true, holdsGate: gateRank >= 0 });
  const claims = activeClaims(p);
  const agents = Object.values(p.sessions)
    .filter((s) => s.open && s.sessionId !== sessionId)
    .map((s) => ({
      title: s.title,
      ownerName: name(s.ownerId),
      status: s.report?.status ?? null,
      doing: s.report?.goal ?? null,
      crewmate: Boolean(me?.crew) && s.crew === me?.crew,
      holds: claims.filter((c) => c.sessionId === s.sessionId).map((c) => resourceKey(c.resource)),
    }));
  return {
    agent: {
      title: me?.title ?? sessionId,
      ownerName: name(ownerId),
      project: p.name || p.projectId,
      crew: me?.crew ?? null,
      branch: opts.branch ?? "main",
      freshWorkspace: opts.freshWorkspace ?? true,
    },
    people,
    agents,
    manners: {
      planFirst: policy.planFirst,
      planMin: policy.planApproval.min,
      planAverage: policy.planApproval.average,
      gateRule: describeRule(gateRule),
      group: opts.group ?? null,
      budget: policy.tokenBudget,
    },
    context: memoryEntriesOf(opts.memoryContext ?? ""),
    notTold: ["the groups' history", "the team's chat", "the other projects' memory"],
  };
}
