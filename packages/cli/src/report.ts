/** Markdown session report rendered from the log: who did what, when, with what effect. */
import type { Session } from "@atelier/kernel";
import { handoffBrief } from "@atelier/kernel";

export function renderReport(s: Session): string {
  const out: string[] = [];
  const name = (branch: string, id: string) => s.state(branch).participants[id]?.actor.name ?? id;
  out.push(`# Session report: ${s.state().title}`);
  out.push("");
  for (const branch of s.branches()) {
    const st = s.state(branch);
    out.push(
      `## Branch ${branch} (${st.seq + 1} events, status ${st.status}, ${st.turns.length} turns)`,
    );
    out.push("");
    out.push("| seq | actor | event | detail |");
    out.push("|---|---|---|---|");
    for (const e of s.log.ownEvents(branch)) {
      let detail = "";
      switch (e.kind) {
        case "directive.submitted":
          detail = `[${e.payload.input.mode}/${e.payload.input.scope}] ${e.payload.input.text}`;
          break;
        case "agent.turn.ended":
          detail = `${e.payload.reason}: ${e.payload.summary}`;
          break;
        case "agent.tool.requested":
          detail = `${e.payload.call.name} ${JSON.stringify(e.payload.call.args).slice(0, 80)}`;
          break;
        case "agent.tool.completed":
          detail = `${e.payload.result.ok ? "ok" : "FAILED"}: ${e.payload.result.output.split("\n")[0]?.slice(0, 80)}`;
          break;
        case "approval.requested":
          detail = `${e.payload.approvalId} ${e.payload.call.name} [${e.payload.call.risk}]`;
          break;
        case "approval.voted":
          detail = `${e.payload.vote} on ${e.payload.approvalId}`;
          break;
        case "contention.resolved":
          detail = `${e.payload.contentionId} -> ${e.payload.winner ?? "replacement"}`;
          break;
        case "workspace.changed":
          detail = Object.keys(e.payload.changes).join(", ");
          break;
        case "branch.merged":
          detail = `from ${e.payload.source}; conflicts: ${e.payload.conflicts.join(", ") || "none"}; carried ${e.payload.carried.length}`;
          break;
        case "participant.joined":
          detail = `${e.payload.actor.name} as ${e.payload.role}`;
          break;
        case "role.changed":
          detail = `${e.payload.actorId} -> ${e.payload.role}`;
          break;
        case "handoff.requested":
          detail = `to ${e.payload.to}`;
          break;
        case "checkpoint.created":
          detail = `${e.payload.checkpointId} ${e.payload.label}`;
          break;
        case "agent.model.completed":
          detail = `${e.payload.toolCalls.length} tool calls: ${e.payload.text.slice(0, 80)}`;
          break;
        default:
          detail = "";
      }
      out.push(
        `| ${e.seq} | ${name(branch, e.actor)} | ${e.kind} | ${detail.replace(/\|/g, "\\|")} |`,
      );
    }
    out.push("");
  }
  out.push(handoffBrief(s.state(), { events: s.events() }));
  return `${out.join("\n")}\n`;
}
