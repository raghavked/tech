/** The fleet brief: what every agent in the project is doing, computed from the ledger and the sessions. */
import type { SessionState } from "@fold/kernel";
import { describeRule, ruleFor } from "@fold/kernel";
import { resourceKey } from "./events.js";
import { activeClaims, type ProjectState } from "./state.js";

export interface FleetBriefOptions {
  sinceSeq?: number;
  sessions?: Record<string, SessionState>;
}

export function fleetBrief(p: ProjectState, opts: FleetBriefOptions = {}): string {
  const since = opts.sinceSeq ?? -1;
  const name = (id: string) => p.members[id]?.name ?? id;
  const lines: string[] = [];
  const open = Object.values(p.sessions).filter((s) => s.open);
  const byStatus = new Map<string, number>();
  for (const s of open)
    byStatus.set(
      s.report?.status ?? "unknown",
      (byStatus.get(s.report?.status ?? "unknown") ?? 0) + 1,
    );
  lines.push(`# Fleet brief: ${p.name || p.projectId}`);
  lines.push("");
  lines.push(
    `Ledger at seq ${p.seq}. ${open.length} open sessions: ${[...byStatus].map(([k, v]) => `${v} ${k}`).join(", ") || "none"}.`,
  );
  const leads = Object.values(p.members)
    .filter((m) => m.role !== "member")
    .map((m) => `${m.name} (${m.role})`);
  lines.push(`Leads: ${leads.join(", ") || "none"}.`);
  lines.push("");
  lines.push("## Sessions");
  if (!open.length) lines.push("- none");
  for (const s of open.sort((a, b) => a.registeredSeq - b.registeredSeq)) {
    const r = s.report;
    const held = activeClaims(p)
      .filter((c) => c.sessionId === s.sessionId)
      .map((c) => resourceKey(c.resource));
    const marker = s.registeredSeq > since ? " (new)" : "";
    const crew = s.crew ? ` [crew: ${s.crew}]` : "";
    lines.push(
      `- ${name(s.ownerId)}'s session "${s.title}"${marker}${crew}: ${r ? `${r.status}, turn ${r.turn}, goal: ${r.goal ?? "none"}` : "no report yet"}${held.length ? `; holds ${held.join(", ")}` : ""}${r?.pendingApprovals ? `; ${r.pendingApprovals} approval(s) pending` : ""}`,
    );
    if (r?.summary) lines.push(`  last: ${r.summary.slice(0, 160)}`);
  }
  lines.push("");
  lines.push("## Open items");
  let n = 0;
  for (const c of Object.values(p.contentions).filter((c) => !c.resolved)) {
    n++;
    lines.push(
      `- Contention (${c.kind}) on ${c.resource} between ${c.sessionIds.map((id) => `${name(p.sessions[id]?.ownerId ?? id)}'s session`).join(" and ")}: ${c.detail}`,
    );
  }
  if (opts.sessions) {
    for (const [id, st] of Object.entries(opts.sessions)) {
      for (const a of Object.values(st.approvals).filter((a) => a.status === "pending")) {
        n++;
        lines.push(
          `- Approval pending in ${name(p.sessions[id]?.ownerId ?? id)}'s session: ${a.call.name} [${a.call.risk}] needs ${describeRule(ruleFor(st.policy.approvals, a.call.risk))}`,
        );
      }
      if (st.status === "blocked") {
        n++;
        lines.push(
          `- ${name(p.sessions[id]?.ownerId ?? id)}'s session is blocked (${st.openConflicts.length ? "merge conflicts" : "goal contention"})`,
        );
      }
    }
  }
  for (const v of p.violations.filter((v) => v.seq > since)) {
    n++;
    lines.push(
      `- ${name(p.sessions[v.sessionId]?.ownerId ?? v.sessionId)}'s session was refused a write to ${v.path} (claim ${v.holderClaimId})`,
    );
  }
  if (!n) lines.push("- none");
  lines.push("");
  lines.push("## Project direction");
  const dirs = Object.values(p.directives).filter((d) => d.status === "active");
  if (!dirs.length) lines.push("- none");
  for (const d of dirs)
    lines.push(
      `- [${d.input.mode}/${d.input.scope}] ${d.input.text} (${name(d.author)}${d.targets === "all" ? "" : `, ${d.targets.length} session(s)`})`,
    );
  lines.push("");
  lines.push("## Claims");
  const claims = activeClaims(p);
  if (!claims.length) lines.push("- none");
  for (const c of claims)
    lines.push(
      `- ${resourceKey(c.resource)} (${c.mode}) held by ${name(c.ownerId)}'s session: ${c.reason}`,
    );
  if (since >= 0) {
    lines.push("");
    lines.push(`## Since seq ${since}`);
    const recent = p.notes.filter((x) => x.seq > since);
    if (!recent.length) lines.push("- no notes");
    for (const x of recent) lines.push(`- ${name(x.actor)}: ${x.text}`);
  }
  return `${lines.join("\n")}\n`;
}
