/**
 * The handoff brief: a deterministic catch-up document computed from the log, in the spirit
 * of clinical shift-handoff formats (situation, background, what happened, what is open,
 * what is needed). No model call is involved, so two replicas produce the same brief.
 */
import type { SessionEvent } from "@henosis/protocol";
import { describeRule, ruleFor } from "./approvals.js";
import type { SessionState } from "./state.js";

export interface BriefOptions {
  /** Produce the "since you were last here" sections relative to this actor's last seen seq. */
  forActor?: string;
  /** Override the since-seq explicitly. */
  sinceSeq?: number;
  /** Events of the branch, used for the activity sections. */
  events?: readonly SessionEvent[];
  maxTurns?: number;
}

export function handoffBrief(state: SessionState, opts: BriefOptions = {}): string {
  const name = (id: string) => state.participants[id]?.actor.name ?? id;
  const since =
    opts.sinceSeq ?? (opts.forActor ? (state.participants[opts.forActor]?.lastSeenSeq ?? -1) : -1);
  const lines: string[] = [];
  lines.push(`# Handoff brief: ${state.title || state.sessionId}`);
  lines.push("");
  lines.push(`Branch \`${state.branch}\` at seq ${state.seq}. Status: **${state.status}**.`);
  lines.push(
    `Driver: ${state.driver ? name(state.driver) : "nobody"}. Present: ${
      Object.values(state.participants)
        .filter((p) => p.present && p.actor.kind === "human")
        .map((p) => `${p.actor.name} (${p.role})`)
        .join(", ") || "nobody"
    }.`,
  );
  lines.push("");

  lines.push("## Situation");
  lines.push(state.intent.goal ? `Goal: ${state.intent.goal.text}` : "Goal: not set.");
  const scopes = Object.keys(state.intent.steers).sort();
  if (scopes.length) {
    lines.push("Direction by scope:");
    for (const sc of scopes) {
      const r = state.intent.steers[sc];
      if (r) lines.push(`- [${sc}] ${r.text} (${name(r.author)})`);
    }
  }
  if (state.intent.constraints.length) {
    lines.push("Constraints:");
    for (const c of state.intent.constraints) lines.push(`- ${c.text} (${name(c.author)})`);
  }
  lines.push("");

  lines.push("## Open items");
  let open = 0;
  for (const c of Object.values(state.contentions).filter((c) => !c.resolved)) {
    open++;
    lines.push(`- Contention on [${c.scope}] between:`);
    for (const id of c.directiveIds) {
      const d = state.directives[id];
      if (d) lines.push(`  - ${name(d.author)}: "${d.input.text}"`);
    }
  }
  for (const a of Object.values(state.approvals).filter((a) => a.status === "pending")) {
    open++;
    const rule = ruleFor(state.policy.approvals, a.call.risk);
    lines.push(
      `- Approval pending for ${a.call.name} (${a.call.risk}; needs ${describeRule(rule)}): ${JSON.stringify(a.call.args)}`,
    );
  }
  for (const h of Object.values(state.handoffs).filter((h) => h.status === "pending")) {
    open++;
    lines.push(`- Handoff pending from ${name(h.from)} to ${name(h.to)}`);
  }
  for (const path of state.openConflicts) {
    open++;
    lines.push(`- Merge conflict markers in ${path}`);
  }
  const shadowed = Object.values(state.directives).filter((d) => d.status === "shadowed");
  for (const d of shadowed) {
    open++;
    lines.push(
      `- Shadowed (lower authority) suggestion from ${name(d.author)} on [${d.input.scope}]: "${d.input.text}"`,
    );
  }
  if (!open) lines.push("- none");
  lines.push("");

  const maxTurns = opts.maxTurns ?? 8;
  const recent = state.turns.slice(-maxTurns);
  lines.push(`## What the agent did (last ${recent.length} turns)`);
  if (!recent.length) lines.push("- no turns yet");
  for (const t of recent) {
    const marker = t.startedSeq > since ? " (new)" : "";
    lines.push(
      `- Turn ${t.turn}${marker}: ${t.summary || t.modelText.slice(0, 120) || "(no summary)"} [${t.toolCalls.length} tool calls, ${t.reason}]`,
    );
  }
  if (state.currentTurn) {
    lines.push(
      `- Turn ${state.currentTurn.turn} (in progress): ${state.currentTurn.toolCalls.length} tool calls so far`,
    );
  }
  lines.push("");

  if (opts.events) {
    const changed = new Set<string>();
    const decisions: string[] = [];
    for (const e of opts.events) {
      if (e.seq <= since) continue;
      if (e.kind === "workspace.changed")
        for (const p of Object.keys(e.payload.changes)) changed.add(p);
      if (e.kind === "branch.merged") for (const p of Object.keys(e.payload.tree)) changed.add(p);
      if (e.kind === "directive.submitted")
        decisions.push(
          `${name(e.actor)} [${e.payload.input.mode}/${e.payload.input.scope}]: ${e.payload.input.text}`,
        );
      if (e.kind === "contention.resolved")
        decisions.push(`${name(e.actor)} resolved contention ${e.payload.contentionId}`);
      if (e.kind === "approval.voted")
        decisions.push(`${name(e.actor)} voted ${e.payload.vote} on ${e.payload.approvalId}`);
      if (e.kind === "handoff.accepted") decisions.push(`${name(e.actor)} took over as driver`);
      if (e.kind === "note.posted") decisions.push(`${name(e.actor)} noted: ${e.payload.text}`);
    }
    lines.push(since >= 0 ? `## Since seq ${since}` : "## Decisions and changes");
    if (decisions.length) {
      lines.push("Decisions:");
      for (const d of decisions) lines.push(`- ${d}`);
    }
    if (changed.size) {
      lines.push("Files changed:");
      for (const p of [...changed].sort())
        lines.push(`- ${p}${p in state.workspace ? "" : " (deleted)"}`);
    }
    if (!decisions.length && !changed.size) lines.push("- nothing new");
    lines.push("");
  }

  lines.push("## Workspace");
  const paths = Object.keys(state.workspace).sort();
  lines.push(paths.length ? paths.map((p) => `- ${p}`).join("\n") : "- empty");
  return `${lines.join("\n")}\n`;
}
