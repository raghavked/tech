/** The fleet context a session's model sees: what the other agents in the project are doing. */
import { resourceKey } from "./events.js";
import { activeClaims, type ProjectState } from "./state.js";

export function renderFleetContext(p: ProjectState, sessionId: string): string {
  const others = Object.values(p.sessions).filter((s) => s.open && s.sessionId !== sessionId);
  if (!others.length) return "";
  const name = (id: string) => p.members[id]?.name ?? id;
  const mine = p.sessions[sessionId]?.crew ?? null;
  const mates = mine ? others.filter((s) => s.crew === mine) : [];
  const lines: string[] = [];
  if (mates.length) {
    lines.push(`YOUR CREW "${mine}" (you share this task; coordinate, split the work, report):`);
    for (const s of mates)
      lines.push(
        `  - ${name(s.ownerId)}'s agent: ${s.report?.goal ?? s.title} [${s.report?.status ?? "unknown"}]${s.report?.summary ? `; last: ${s.report.summary.slice(0, 120)}` : ""}`,
      );
  }
  lines.push(
    "OTHER AGENTS IN THIS PROJECT (do not touch what they hold; claim before writing shared paths):",
  );
  for (const s of others) {
    if (mates.includes(s)) continue;
    const held = activeClaims(p)
      .filter((c) => c.sessionId === s.sessionId)
      .map((c) => resourceKey(c.resource));
    lines.push(
      `  - ${name(s.ownerId)}'s agent: ${s.report?.goal ?? s.title} [${s.report?.status ?? "unknown"}]${held.length ? `; holds ${held.join(", ")}` : ""}`,
    );
  }
  const open = Object.values(p.contentions).filter(
    (c) => !c.resolved && c.sessionIds.includes(sessionId),
  );
  for (const c of open)
    lines.push(
      `  ! You are in a fleet contention on ${c.resource}; wait for the lead or work elsewhere.`,
    );
  return lines.join("\n");
}
