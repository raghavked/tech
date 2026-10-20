/**
 * The council in the terminal (docs/19_council.md, "Slack and CLI"): `henosis council <org> <id>`
 * prints a council's rounds and conclusion from the organisation's chat log, and `henosis
 * report` gains a Council section. Everything here is rendered from the fold of the log,
 * never from a live host, so a council reads the same after a restart as it did live.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  Chat,
  type ChatState,
  type Council,
  type CouncilMember,
  type CouncilRoundRecord,
  councilLabel,
  type SerializedChat,
} from "@henosis/chat";
import { compactTokens } from "@henosis/kernel";
import { usageTotal } from "@henosis/protocol";

/** A chat log file (store/chat/<org>.json) starts with `chat.created`; a session log does not. */
export function isChatLog(data: unknown): data is SerializedChat {
  if (typeof data !== "object" || data === null) return false;
  const events = (data as { events?: Record<string, { kind?: string }[]> }).events;
  const first = events?.main?.[0];
  return first?.kind === "chat.created";
}

/** The chat log of an organisation under a store root, folded. */
export function loadChat(dir: string, orgId: string): Chat {
  const path = resolve(dir, "chat", `${orgId}.json`);
  if (!existsSync(path)) throw new Error(`no chat log for ${orgId}: ${path} does not exist`);
  return loadChatFile(path);
}

/** A chat log by path; anything but a chat log is refused with one line. */
export function loadChatFile(path: string): Chat {
  const full = resolve(path);
  if (!existsSync(full)) throw new Error(`${full} does not exist`);
  const data = JSON.parse(readFileSync(full, "utf8")) as unknown;
  if (!isChatLog(data)) throw new Error(`${full} is not a chat log`);
  return Chat.fromSerialized(data);
}

/** A person's name as the group recorded it, else their id. */
function personName(st: ChatState, c: Council, userId: string): string {
  const g = st.groups[c.groupId];
  for (const m of g?.members ?? [])
    if (m.kind === "human" && m.userId === userId && m.name) return m.name;
  return userId;
}

function memberLine(m: CouncilMember): string {
  return m.userId
    ? `${m.name} (${m.userId}'s model, ${m.profileId})`
    : `${m.name} (shared, ${m.profileId})`;
}

function roundTitle(r: CouncilRoundRecord, c: Council): string {
  if (r.round === "discussion") return `discussion ${r.index + 1} of ${c.discussionRounds}`;
  if (r.index > 0) return `${r.round} ${r.index + 1}`;
  return r.round;
}

function saidLines(st: ChatState, c: Council, r: CouncilRoundRecord): string[] {
  if (!r.said.length) return ["- (no answer yet)"];
  return r.said.map((s) => {
    const stance = s.stance ? ` [${s.stance}]` : "";
    const cites = s.cites.length
      ? ` · instructed by ${s.cites.map((x) => personName(st, c, x.by)).join(", ")}`
      : "";
    return `- ${s.member.name}${stance}: ${s.text} (${compactTokens(usageTotal(s.usage))} tokens${cites})`;
  });
}

/** One council, in full: header, members, every round, the plan with its dissent, the work, the conclusion. */
export function renderCouncil(st: ChatState, c: Council): string {
  const out: string[] = [];
  const group = st.groups[c.groupId];
  out.push(`# Council: ${c.task}`);
  out.push("");
  out.push(
    `convened by ${personName(st, c, c.by)} in ${group?.name ?? c.groupId} · chair ${c.chair.name} · ${c.members.length} model${c.members.length === 1 ? "" : "s"} · rounds: ${c.roundPlan.map((r) => (r === "discussion" && c.discussionRounds !== 1 ? `discussion ×${c.discussionRounds}` : r)).join(", ")} · ${c.budget ? `budget ${compactTokens(c.budget)} tokens` : "no budget"}`,
  );
  out.push(
    `status: ${councilLabel(c)} · ${compactTokens(usageTotal(c.usage))} tokens · id ${c.id}`,
  );
  out.push("");
  out.push("## Members");
  out.push("");
  for (const m of c.members)
    out.push(`- ${memberLine(m)}${m.profileId === c.chair.profileId ? " · chair" : ""}`);
  if (!c.members.some((m) => m.profileId === c.chair.profileId))
    out.push(`- ${memberLine(c.chair)} · chair`);
  out.push("");
  if (c.instructions.length) {
    out.push("## Instructions (private)");
    out.push("");
    for (const i of c.instructions)
      out.push(`- ${personName(st, c, i.by)} to ${i.member.name}: ${i.text}`);
    out.push("");
  }
  let n = 0;
  for (const r of c.rounds) {
    n += 1;
    out.push(`## Round ${n} · ${roundTitle(r, c)}`);
    out.push("");
    if (r.round === "vote") {
      out.push("- the people rate the chair's plan in its session; models do not speak");
    } else out.push(...saidLines(st, c, r));
    out.push("");
    if (r.round === "synthesis" && c.synthesis && c.synthesis.seq >= r.startedSeq) {
      out.push(`### Plan ${c.synthesis.planId}`);
      out.push("");
      c.synthesis.steps.forEach((s, i) => {
        out.push(
          `${i + 1}. ${s.title} — ${s.owner.name} (${s.risk}, ~${compactTokens(s.estTokens)} tokens)${s.detail ? `: ${s.detail}` : ""}`,
        );
      });
      out.push("");
      if (c.synthesis.dissent.length) {
        out.push("Dissent:");
        out.push("");
        for (const d of c.synthesis.dissent) out.push(`- ${d.member.name}: ${d.text}`);
        out.push("");
      }
    }
  }
  if (c.synthesis && (Object.keys(c.assignments).length || c.reportLog.length)) {
    out.push("## Work");
    out.push("");
    for (const s of c.synthesis.steps) {
      const a = c.assignments[s.id];
      const r = c.reports[s.id];
      out.push(
        `- ${s.id} ${s.title} → ${s.owner.name}${a ? ` in ${a.projectId}/${a.sessionId}` : " (not assigned)"}${r ? `: ${r.status}${r.text ? ` — ${r.text}` : ""} (${compactTokens(usageTotal(r.usage))} tokens)` : ""}`,
      );
    }
    out.push("");
  }
  out.push("## Conclusion");
  out.push("");
  if (c.status === "concluded") {
    out.push(`${c.outcome ?? "abandoned"}${c.summary ? `: ${c.summary}` : ""}`);
    if (c.synthesis?.dissent.length) {
      out.push("");
      out.push("Dissent on the record:");
      out.push("");
      for (const d of c.synthesis.dissent) out.push(`- ${d.member.name}: ${d.text}`);
    }
  } else out.push(`not yet: ${councilLabel(c)}`);
  out.push(`${compactTokens(usageTotal(c.usage))} tokens in all.`);
  out.push("");
  return out.join("\n");
}

/** One line per council, most recently active first. */
export function renderCouncilList(st: ChatState): string {
  const all = Object.values(st.councils).sort((a, b) => b.lastSeq - a.lastSeq);
  if (!all.length) return "no councils\n";
  return `${all
    .map(
      (c) =>
        `${c.id}  ${councilLabel(c).padEnd(22)} ${st.groups[c.groupId]?.name ?? c.groupId} · ${c.task.slice(0, 60)} · ${c.members.length} models · ${compactTokens(usageTotal(c.usage))} tokens`,
    )
    .join("\n")}\n`;
}

/**
 * The Council section of a report: every council in the chat log, or only those that touch
 * a session (the chair's plan proposed in it, or a step assigned to it) when `sessionId` is
 * given. Empty string when there is nothing to say.
 */
export function councilSection(st: ChatState, sessionId?: string): string {
  const all = Object.values(st.councils)
    .filter(
      (c) => !sessionId || Object.values(c.assignments).some((a) => a.sessionId === sessionId),
    )
    .sort((a, b) => a.convenedSeq - b.convenedSeq);
  if (!all.length) return "";
  const out: string[] = ["## Council", ""];
  for (const c of all) {
    out.push(`### ${c.task}`);
    out.push("");
    out.push(
      `${st.groups[c.groupId]?.name ?? c.groupId} · chair ${c.chair.name} · ${c.members.map((m) => m.name).join(", ")} · ${councilLabel(c)} · ${compactTokens(usageTotal(c.usage))} tokens`,
    );
    out.push("");
    for (const r of c.rounds) {
      if (r.round === "vote") continue;
      out.push(
        `- ${roundTitle(r, c)}: ${r.said.map((s) => `${s.member.name}${s.stance ? ` [${s.stance}]` : ""}`).join(", ") || "nobody yet"}`,
      );
    }
    if (c.synthesis) {
      out.push(
        `- plan ${c.synthesis.planId}: ${c.synthesis.steps.map((s) => `${s.title} (${s.owner.name})`).join("; ")}`,
      );
      for (const d of c.synthesis.dissent) out.push(`- dissent, ${d.member.name}: ${d.text}`);
    }
    for (const r of c.reportLog) {
      const step = c.synthesis?.steps.find((s) => s.id === r.stepId);
      out.push(
        `- ${r.owner.name} on ${step?.title ?? r.stepId}: ${r.status}${r.text ? ` — ${r.text}` : ""}`,
      );
    }
    if (c.status === "concluded")
      out.push(`- concluded: ${c.outcome ?? "abandoned"}${c.summary ? ` — ${c.summary}` : ""}`);
    out.push("");
  }
  return out.join("\n");
}

/** The report of a chat log: the organisation, its groups, and the Council section. */
export function renderChatReport(chat: Chat): string {
  const st = chat.state();
  const out: string[] = [`# Chat report: ${st.orgId}`, ""];
  const groups = Object.values(st.groups).sort((a, b) => a.createdSeq - b.createdSeq);
  const n = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;
  out.push(
    `${n(st.seq + 1, "event")} · ${n(groups.length, "group")} · ${n(Object.keys(st.councils).length, "council")}`,
  );
  out.push("");
  for (const g of groups)
    out.push(
      `- ${g.name}: ${n(g.members.length, "member")}, ${n((st.messages[g.id] ?? []).length, "message")}`,
    );
  if (groups.length) out.push("");
  const council = councilSection(st);
  if (council) out.push(council);
  else out.push("## Council\n\nno councils yet\n");
  return out.join("\n");
}
