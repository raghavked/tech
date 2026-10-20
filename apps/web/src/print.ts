/**
 * Paper (print-export, L4): the session as a document and its audit trail as a ledger, the two
 * sheets the Export panel previews and prints. Pure. `paperModel` folds the log once more, one
 * event at a time, so every name carries the role it had at that moment, the kernel's decisions
 * are told apart from what people did (and carry the rule that produced them), secrets in tool
 * steps are masked and counted, and whatever the export leaves out is said in one line where it
 * would have been. The verify line carries the hash `henosis verify` prints for the same log.
 */
import {
  type ApprovalRecord,
  compactTokens,
  describeRule,
  fold,
  formatTokens,
  isRatingsRule,
  type PlanRecord,
  ratingSummary,
  ruleFor,
  type SessionState,
  stateHash,
} from "@henosis/kernel";
import type { ApprovalRule, SessionEvent, ToolCall } from "@henosis/protocol";
import { average, copy } from "./copy.js";
import { type Block, blocksOf, describeCall, resultOf } from "./stream/blocks.js";

export type Door = "session" | "audit" | "markdown";

export interface Includes {
  /** Team chat (notes) is off by default: it stays in the circle. */
  chat: boolean;
}

export const DEFAULT_INCLUDES: Includes = { chat: false };

// ---- secrets ------------------------------------------------------------------------------

/** What a masked value prints as, in amber. */
export const MASK = "••••";

const KEYED =
  /("?)([A-Za-z0-9_.-]*?(?:secret|token|passw(?:or)?d|api[_-]?key|private[_-]?key|credentials?|[_-]key)s?)("?)(\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;}\]]+)/gi;
const BEARER = /\b(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/g;
const PREFIXED = /\b(?:sk|ghp|gho|ghs|xox[abp]|AKIA)[-_][A-Za-z0-9\-_]{8,}/g;

/**
 * Masks what looks like a secret: a keyed value (`STRIPE_KEY=…`, `"token": "…"`), a bearer
 * token, a vendor-prefixed key. Returns the text and how many were masked. The runner does not
 * redact today; paper never prints a secret the stream would.
 */
export function maskSecrets(text: string): { text: string; masked: number } {
  let masked = 0;
  const out = text
    .replace(KEYED, (_m, q1: string, key: string, q2: string, sep: string) => {
      masked += 1;
      return `${q1}${key}${q2}${sep}${MASK}`;
    })
    .replace(BEARER, (_m, pre: string) => {
      masked += 1;
      return `${pre}${MASK}`;
    })
    .replace(PREFIXED, () => {
      masked += 1;
      return MASK;
    });
  return { text: out, masked };
}

// ---- the model ------------------------------------------------------------------------------

export interface PaperStep {
  id: string;
  /** "Ran shell: pnpm test", masked. */
  text: string;
  /** The mono result at the right: "exit 0", "12 lines". */
  result: string;
  ok: boolean | null;
  masked: number;
}

export interface PaperVote {
  who: string;
  role: string;
  approve: boolean;
  rating: number | null;
  note: string;
  /** Voted below the rule's rank: "a voice, not a vote". */
  voice: boolean;
}

export type PaperRow =
  | {
      kind: "human";
      id: string;
      who: string;
      role: string;
      text: string;
      scope: string;
      sub: string;
      goal: boolean;
    }
  | {
      kind: "agent";
      id: string;
      who: string;
      text: string;
      steps: PaperStep[];
      turn: number;
      step: { k: number; m: number } | null;
      masked: number;
    }
  | {
      kind: "plan";
      id: string;
      plan: PlanRecord;
      ratings: { who: string; role: string; rating: number; note: string }[];
      /** "Approved · by the team's ratings", "Revision asked · by Ana". */
      status: string;
    }
  | {
      kind: "gate";
      id: string;
      approval: ApprovalRecord;
      ask: string;
      /** A release gate (a ratings rule) carries the ink stripe. */
      gate: boolean;
      rule: string;
      votes: PaperVote[];
      /** "Granted by the rule · 2 raters · 4.5 average", "Denied", "Waiting". */
      outcome: string;
    }
  | { kind: "line"; id: string; text: string }
  | { kind: "omit"; id: string; text: string };

export type Evidence =
  | { kind: "id"; text: string }
  | { kind: "stars"; rating: number }
  | { kind: "ok"; text: string }
  | { kind: "text"; text: string };

export interface LedgerRow {
  seq: number;
  id: string;
  who: string;
  role: string;
  /** The kernel (or the fleet) decided it by a rule: the row prints in one green. */
  kernel: boolean;
  /** A release gate asked: the ink stripe at the left. */
  gate: boolean;
  did: string;
  rule: string | null;
  quote: string | null;
  evidence: Evidence;
  masked: number;
  /** The export's own row, on the cream band at the foot. */
  exported: boolean;
}

export interface PaperModel {
  title: string;
  sessionId: string;
  projectId: string;
  branch: string;
  exportedBy: string;
  exportedAt: number;
  /** Everyone in the circle with their role now: serif names, the role as a word. */
  cast: { who: string; role: string; agent: boolean }[];
  policy: string;
  facts: { k: string; v: string; small: string }[];
  counts: { k: string; v: string }[];
  rows: PaperRow[];
  ledger: LedgerRow[];
  omissions: string[];
  masked: number;
  events: number;
  /** The fold's hash, as `henosis verify` prints it; the chain head beside it. */
  hash: string;
  head: string | null;
  verifyCommand: string;
}

export interface PaperOptions {
  door: Exclude<Door, "markdown">;
  /** Who is exporting: the name on the head and the id whose role the export row carries. */
  exportedBy: string;
  exportedById: string;
  exportedAt: number;
  agentName: string;
  include?: Includes;
}

/** The hash the verify line prints: the fold's sha256, 12 hex like the CLI. */
export function shortHash(hash: string | null | undefined): string {
  return hash ? hash.slice(0, 12) : "—";
}

const ROLE_SYSTEM = new Set(["system", "fleet", "kernel"]);

/** The role word a name carries at a moment: "driving" beats the role; agents are "agent". */
export function roleWord(st: SessionState, actorId: string): string {
  const p = st.participants[actorId];
  if (!p) return ROLE_SYSTEM.has(actorId) ? actorId : "";
  if (p.actor.kind === "agent") return copy.export.roles.agent;
  if (st.driver === actorId) return copy.roles.driving;
  return p.role;
}

function nameIn(st: SessionState, id: string, agentName: string): string {
  const p = st.participants[id];
  if (!p) return id === "system" ? copy.export.roles.kernel : id;
  return p.actor.kind === "agent" ? agentName : p.actor.name;
}

function firstLine(text: string, max = 140): string {
  const line = text.split("\n")[0] ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

function shortId(id: string): string {
  return id.length > 12 ? id.slice(0, 12) : id;
}

function ratingsRuleText(rule: ApprovalRule, a: ApprovalRecord): string {
  const rated = Object.values(a.ballots).filter((b) => b.vote === "approve" && b.rating !== null);
  const avg = rated.length ? rated.reduce((n, b) => n + (b.rating ?? 0), 0) / rated.length : 0;
  const got = rated.length ? ` · got ${rated.length}, avg ${average(avg)}` : "";
  return `${describeRule(rule)}${got}`;
}

function maskCall(call: ToolCall): { text: string; masked: number } {
  const d = describeCall(call);
  const done = maskSecrets(d.done);
  // The args carry what the sentence does not (an env var in a shell command's arguments).
  const args = maskSecrets(JSON.stringify(call.args));
  return { text: done.text, masked: Math.max(done.masked, args.masked) };
}

/**
 * Both documents from one fold. `events` is the branch's log as the client holds it; `s` the
 * state folded from it (what the verify line hashes).
 */
export function paperModel(
  s: SessionState,
  events: readonly SessionEvent[],
  opts: PaperOptions,
): PaperModel {
  const include = opts.include ?? DEFAULT_INCLUDES;
  const w = copy.export;
  const name = (id: string) => nameIn(s, id, opts.agentName);

  // ---- the fold: roles at each moment, the kernel's decisions, masked counts -------------
  const roleAt = new Map<string, string>();
  const ledger: LedgerRow[] = [];
  let st: SessionState | null = null;
  let masked = 0;
  let turnMasked = 0;
  let turnSteps = 0;
  const voteRoles = new Map<string, Map<string, string>>();
  const row = (
    e: SessionEvent,
    actorId: string,
    did: string,
    extra: Partial<Omit<LedgerRow, "seq" | "id" | "did">> = {},
  ) => {
    const after = st ?? s;
    const who = ROLE_SYSTEM.has(actorId)
      ? actorId === "system"
        ? w.roles.kernel
        : actorId
      : name(actorId);
    ledger.push({
      seq: e.seq,
      id: e.id,
      who,
      role: roleAt.get(e.id) ?? roleWord(after, actorId),
      kernel: false,
      gate: false,
      did,
      rule: null,
      quote: null,
      evidence: { kind: "id", text: shortId(e.id) },
      masked: 0,
      exported: false,
      ...extra,
    });
  };

  for (const e of events) {
    const before: SessionState | null = st;
    // The role an actor had as they acted: the state before the event, for a join the event itself.
    if (before) roleAt.set(e.id, roleWord(before, e.actor));
    st = before ? fold([e], before) : fold([e]);
    const after = st;
    if (!before && e.kind === "participant.joined") roleAt.set(e.id, roleWord(after, e.actor));
    switch (e.kind) {
      case "session.created": {
        const p = e.payload.policy;
        const bits = [
          p.planFirst ? w.planFirst : null,
          p.tokenBudget ? w.budget(p.tokenBudget) : null,
        ]
          .filter(Boolean)
          .join(", ");
        row(e, e.payload.ownerId ?? e.actor, bits ? `${w.opened}, ${bits}` : w.opened, {
          role: e.payload.ownerId ? "owner" : w.roles.kernel,
        });
        break;
      }
      case "participant.joined":
        roleAt.set(e.id, e.payload.actor.kind === "agent" ? w.roles.agent : e.payload.role);
        row(e, e.actor, w.joined, { role: roleAt.get(e.id) ?? "" });
        break;
      case "participant.left":
        row(e, e.actor, w.left);
        break;
      case "role.changed":
        row(e, e.payload.by, w.madeRole(name(e.payload.actorId), e.payload.role));
        break;
      case "directive.submitted": {
        const i = e.payload.input;
        const said = maskSecrets(i.text);
        masked += said.masked;
        const did =
          i.mode === "steer"
            ? w.steered(i.scope)
            : i.mode === "constrain"
              ? w.constrained(i.scope)
              : i.mode === "pause"
                ? w.paused
                : i.mode === "resume"
                  ? w.resumed
                  : w.cancelled;
        row(e, e.actor, i.interrupt ? `${did} · ${w.interrupt}` : did, {
          quote: i.mode === "pause" || i.mode === "resume" ? null : firstLine(said.text),
        });
        break;
      }
      case "directive.withdrawn":
        row(e, e.actor, w.withdrew);
        break;
      case "contention.resolved":
        row(e, e.actor, e.payload.winner ? w.picked : w.replaced, {
          evidence: { kind: "id", text: shortId(e.payload.contentionId) },
        });
        break;
      case "project.directive.applied":
        row(e, e.payload.author, w.setDirection, {
          who: name(e.payload.author),
          role: w.roles.lead,
          quote: firstLine(e.payload.input.text),
        });
        break;
      case "project.directive.withdrawn":
        row(e, "system", w.withdrewDirection, { who: w.roles.project, role: w.roles.lead });
        break;
      case "agent.turn.started":
        turnMasked = 0;
        turnSteps = 0;
        break;
      case "agent.tool.requested": {
        turnSteps += 1;
        const m = maskCall(e.payload.call).masked;
        turnMasked += m;
        masked += m;
        break;
      }
      case "agent.tool.completed": {
        const m = maskSecrets(e.payload.result.output).masked;
        turnMasked += m;
        masked += m;
        break;
      }
      case "agent.turn.ended": {
        const t = after.turns.find((x) => x.turn === e.payload.turn);
        const tokens = t ? t.usage.input + t.usage.output : 0;
        row(e, e.actor, w.finishedTurn(e.payload.turn, turnSteps, e.payload.reason), {
          quote: e.payload.summary ? firstLine(e.payload.summary) : null,
          evidence: { kind: "text", text: formatTokens(tokens) },
          masked: turnMasked,
        });
        break;
      }
      case "plan.proposed":
        row(e, e.actor, w.proposed(e.payload.steps.length, e.payload.estTokens), {
          evidence: { kind: "id", text: shortId(e.payload.planId) },
        });
        break;
      case "plan.rated": {
        row(e, e.actor, w.ratedPlan, {
          quote: e.payload.note || null,
          evidence: { kind: "stars", rating: e.payload.rating },
        });
        // The fold decides a plan on the rating that meets the bar, with no second event: the
        // kernel's row follows the person's, with the rule beside it.
        const id = e.payload.planId;
        const plan = after.plans[id];
        if (plan && before?.plans[id]?.status === "proposed" && plan.status === "approved") {
          const pa = after.policy.planApproval;
          const sum = ratingSummary(plan);
          row(e, "system", w.planDecided.approved, {
            who: w.roles.kernel,
            role: w.roles.kernel,
            kernel: true,
            rule: `${pa.min} at ${average(pa.average)}+ · got ${sum.count}, avg ${average(sum.average)}`,
            evidence: { kind: "ok", text: w.fold },
          });
        }
        break;
      }
      case "plan.decided": {
        const plan = after.plans[e.payload.planId];
        if (e.payload.by === "policy") {
          const pa = after.policy.planApproval;
          const sum = plan ? ratingSummary(plan) : { count: 0, average: 0 };
          row(e, "system", w.planDecided[e.payload.status], {
            who: w.roles.kernel,
            role: w.roles.kernel,
            kernel: true,
            rule: `${pa.min} at ${average(pa.average)}+ · got ${sum.count}, avg ${average(sum.average)}`,
            evidence: { kind: "ok", text: w.fold },
          });
        } else
          row(e, e.payload.by, w.planDecidedBy[e.payload.status], {
            who: name(e.payload.by),
            quote: e.payload.note || null,
            evidence: { kind: "id", text: shortId(e.payload.planId) },
          });
        break;
      }
      case "plan.step.completed": {
        const plan = after.plans[e.payload.planId];
        const k = plan ? plan.steps.findIndex((x) => x.id === e.payload.stepId) : -1;
        const title = plan?.steps[k]?.title ?? e.payload.stepId;
        row(e, e.actor, w.finishedStep(k + 1, title), {
          quote: e.payload.note || null,
          evidence: { kind: "text", text: formatTokens(e.payload.tokens) },
        });
        break;
      }
      case "approval.requested": {
        const rule = ruleFor(after.policy.approvals, e.payload.call.risk);
        const gate = isRatingsRule(rule);
        const ask = maskSecrets(describeCall(e.payload.call).ask).text;
        row(
          e,
          e.actor,
          `${gate ? w.askedGate : w.askedApproval}: ${ask} · ${e.payload.call.risk}`,
          {
            gate,
            evidence: { kind: "id", text: shortId(e.payload.approvalId) },
          },
        );
        break;
      }
      case "approval.voted": {
        const id = e.payload.approvalId;
        const a = after.approvals[id];
        const was = before?.approvals[id];
        const rule = a ? ruleFor(after.policy.approvals, a.call.risk) : "none";
        const voice =
          a !== undefined &&
          rule !== "none" &&
          (before?.participants[e.actor]?.role ?? "observer") === "observer";
        const approve = e.payload.vote === "approve";
        const r = roleAt.get(e.id) ?? roleWord(after, e.actor);
        if (!voteRoles.has(id)) voteRoles.set(id, new Map());
        voteRoles.get(id)?.set(e.actor, r);
        row(
          e,
          e.actor,
          `${approve ? w.approved : w.denied}${e.payload.override ? ` · ${w.override}` : ""}${
            voice ? ` · ${copy.approval.voice}` : ""
          }`,
          {
            quote: e.payload.note || null,
            evidence: e.payload.rating
              ? { kind: "stars", rating: e.payload.rating }
              : { kind: "id", text: shortId(e.id) },
          },
        );
        if (a && was && was.status === "pending" && a.status !== "pending") {
          const granted = a.status === "granted";
          const gate = isRatingsRule(rule);
          row(e, "system", granted ? (gate ? w.gateGranted : w.approvalGranted) : w.denied2, {
            who: w.roles.kernel,
            role: w.roles.kernel,
            kernel: true,
            rule: granted
              ? gate
                ? ratingsRuleText(rule, a)
                : describeRule(rule)
              : copy.approval.anyDeny,
            evidence: { kind: "ok", text: w.fold },
          });
        }
        break;
      }
      case "handoff.requested":
        row(e, e.actor, w.offeredBaton(name(e.payload.to)));
        break;
      case "handoff.accepted":
        row(e, e.actor, w.tookBaton);
        break;
      case "handoff.declined":
        row(e, e.actor, w.declinedBaton);
        break;
      case "branch.created":
        row(e, e.actor, w.forked(e.payload.branch, e.payload.fromBranch), {
          evidence: { kind: "id", text: shortId(e.payload.fromCheckpoint) },
        });
        break;
      case "branch.merged":
        row(e, e.actor, w.united(e.payload.source, e.payload.base), {
          evidence: {
            kind: "text",
            text: e.payload.conflicts.length ? w.conflicts(e.payload.conflicts.length) : w.clean,
          },
        });
        break;
      case "workspace.blocked":
        row(e, "fleet", w.refused(e.payload.path), {
          who: w.roles.fleet,
          role: w.roles.fleet,
          kernel: true,
          rule: w.heldBy(e.payload.holderSessionId),
          evidence: { kind: "id", text: shortId(e.payload.claimId) },
        });
        break;
      case "fleet.contention.mirrored":
        row(e, "fleet", w.contention(e.payload.kind, e.payload.resource, e.payload.resolved), {
          who: w.roles.fleet,
          role: w.roles.fleet,
          evidence: { kind: "id", text: shortId(e.payload.contentionId) },
        });
        break;
      case "note.posted":
        if (include.chat)
          row(e, e.actor, w.saidToTeam, { quote: firstLine(maskSecrets(e.payload.text).text) });
        break;
      default:
        break;
    }
  }
  const final = st ?? s;
  ledger.push({
    seq: final.seq + 1,
    id: "export",
    who: opts.exportedBy,
    role: roleWord(final, opts.exportedById),
    kernel: false,
    gate: false,
    did: opts.door === "audit" ? w.exportedAudit : w.exportedSession,
    rule: null,
    quote: null,
    evidence: { kind: "text", text: w.thisPage },
    masked: 0,
    exported: true,
  });

  // ---- the session as a document: the stream's blocks on paper ----------------------------
  const rows: PaperRow[] = [];
  const blocks = blocksOf(events, s, "");
  for (const b of blocks)
    rows.push(...paperRowsOf(b, s, roleAt, voteRoles, opts.agentName, include));

  // ---- what is left out says so --------------------------------------------------------
  const omissions: string[] = [];
  const notes = s.notes.length;
  if (notes && !include.chat) omissions.push(w.chatStays(notes));
  const others = ["main", ...Object.keys(s.branches)].filter((b) => b !== s.branch);
  for (const b of others) {
    const merged = s.merges.find((m) => m.source === b);
    const forkedAt = s.branches[b]?.seq ?? null;
    omissions.push(merged ? w.branchUnited(b, merged.seq) : w.branchNotUnited(b, forkedAt));
  }
  const stepCount = events.filter((e) => e.kind === "agent.tool.requested").length;
  if (stepCount) omissions.push(w.stepsFolded(stepCount));

  // ---- facts and counts ------------------------------------------------------------------
  const plan = s.activePlanId ? s.plans[s.activePlanId] : undefined;
  const used = s.usage.input + s.usage.output;
  const budget = s.policy.tokenBudget;
  const facts = [
    { k: w.facts.turns, v: String(s.turns.length), small: w.facts.events(events.length) },
    {
      k: w.facts.tokens,
      v: compactTokens(used),
      small: budget ? w.facts.ofBudget(compactTokens(budget)) : w.facts.noBudget,
    },
    {
      k: w.facts.plan,
      v: plan
        ? `${plan.steps.filter((x) => x.status === "done").length}/${plan.steps.length}`
        : "—",
      small: plan ? w.facts.stepsDone : w.facts.noPlan,
    },
    {
      k: w.facts.united,
      v: String(s.merges.length),
      small: s.merges.length
        ? s.merges.map((m) => `${m.source} → ${m.base}`).join(", ")
        : w.facts.none,
    },
  ];
  const approvals = Object.values(s.approvals);
  const ratings =
    Object.values(s.plans).reduce((n, p) => n + Object.keys(p.ratings).length, 0) +
    approvals.reduce(
      (n, a) => n + Object.values(a.ballots).filter((b) => b.rating !== null).length,
      0,
    );
  const humans = Object.values(s.participants).filter((p) => p.actor.kind === "human").length;
  const agents = Object.values(s.participants).filter((p) => p.actor.kind === "agent").length;
  const planApproved = Object.values(s.plans).find(
    (p) => p.status === "approved" || p.status === "done",
  );
  const counts = [
    { k: w.counts.planApproved, v: planApproved ? w.counts.yes : w.counts.no },
    {
      k: w.counts.gates,
      v: `${approvals.filter((a) => a.status === "granted").length} / ${approvals.length}`,
    },
    { k: w.counts.ratings, v: String(ratings) },
    { k: w.counts.unites, v: String(s.merges.length) },
    { k: w.counts.tokens, v: compactTokens(used) },
    { k: w.counts.people, v: `${humans} · ${agents}` },
  ];
  const policyBits = [
    s.policy.planFirst ? w.planFirst : null,
    budget ? w.budget(budget) : null,
    w.contentionPolicy(s.policy.contention),
  ].filter((x): x is string => Boolean(x));

  const hash = stateHash(s);
  return {
    title: s.title || s.sessionId,
    sessionId: s.sessionId,
    projectId: s.projectId,
    branch: s.branch,
    exportedBy: opts.exportedBy,
    exportedAt: opts.exportedAt,
    cast: Object.values(s.participants).map((p) => ({
      who: p.actor.kind === "agent" ? opts.agentName : p.actor.name,
      role: roleWord(s, p.actor.id),
      agent: p.actor.kind === "agent",
    })),
    policy: policyBits.join(" · "),
    facts,
    counts,
    rows,
    ledger,
    omissions,
    masked,
    events: events.length,
    hash,
    head: s.head,
    verifyCommand: w.verifyCommand(s.sessionId, shortHash(hash)),
  };
}

function paperRowsOf(
  b: Block,
  s: SessionState,
  roleAt: Map<string, string>,
  voteRoles: Map<string, Map<string, string>>,
  agentName: string,
  include: Includes,
): PaperRow[] {
  const w = copy.export;
  const name = (id: string) => nameIn(s, id, agentName);
  switch (b.kind) {
    case "human":
      if (b.team && !include.chat) return [];
      return [
        {
          kind: "human",
          id: b.id,
          who: b.who,
          role: roleAt.get(b.id) ?? roleWord(s, b.actorId),
          text: maskSecrets(b.text).text,
          scope: b.scope,
          sub: b.team ? copy.stream.toTheTeam : b.sub,
          goal: Boolean(b.goal),
        },
      ];
    case "agent": {
      let masked = 0;
      const steps: PaperStep[] = b.steps.map((st) => {
        const text = maskSecrets(st.done);
        const args = maskSecrets(st.args);
        const m = Math.max(text.masked, args.masked) + maskSecrets(st.output).masked;
        masked += m;
        return { id: st.id, text: text.text, result: resultOf(st), ok: st.ok, masked: m };
      });
      const text = maskSecrets(b.text);
      masked += text.masked;
      return [
        {
          kind: "agent",
          id: b.id,
          who: agentName,
          text: text.text,
          steps,
          turn: b.turn,
          step: b.step,
          masked,
        },
      ];
    }
    case "plan": {
      const plan = s.plans[b.planId];
      if (!plan) return [];
      const ratings = Object.entries(plan.ratings).map(([id, r]) => ({
        who: name(id),
        role: roleWord(s, id),
        rating: r.rating,
        note: r.note,
      }));
      const by =
        plan.decidedBy === null
          ? ""
          : plan.decidedBy === "policy"
            ? ` · ${copy.plan.byPolicy}`
            : ` · ${copy.plan.decidedBy(name(plan.decidedBy))}`;
      return [
        { kind: "plan", id: b.id, plan, ratings, status: `${copy.plan.status[plan.status]}${by}` },
      ];
    }
    case "approval": {
      const a = s.approvals[b.approvalId];
      if (!a) return [];
      const rule = ruleFor(s.policy.approvals, a.call.risk);
      const gate = isRatingsRule(rule);
      const roles = voteRoles.get(a.id);
      const votes: PaperVote[] = Object.entries(a.ballots).map(([id, v]) => {
        const role = roles?.get(id) ?? roleWord(s, id);
        return {
          who: name(id),
          role,
          approve: v.vote === "approve",
          rating: v.rating,
          note: v.note,
          voice: rule !== "none" && role === "observer",
        };
      });
      const outcome =
        a.status === "granted"
          ? gate
            ? `${w.gateGranted} · ${ratingsRuleText(rule, a)}`
            : `${w.approvalGranted} · ${describeRule(rule)}`
          : a.status === "denied"
            ? w.denied2
            : w.waiting;
      return [
        {
          kind: "gate",
          id: b.id,
          approval: a,
          ask: maskSecrets(describeCall(a.call).ask).text,
          gate,
          rule: describeRule(rule),
          votes,
          outcome,
        },
      ];
    }
    case "join":
      return [{ kind: "line", id: b.id, text: w.joinLine(b.who, b.role) }];
    case "divider":
      return [{ kind: "line", id: b.id, text: b.text }];
    default:
      return [];
  }
}

/** How many printed rows a door has: the sheet's meta beside each format. */
export function rowCount(model: PaperModel, door: Door): number {
  return door === "audit" ? model.ledger.length : model.rows.length;
}
