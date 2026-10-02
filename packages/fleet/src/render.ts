/** The fleet context a session's model sees: what the other agents in the project are doing. */
import { resourceKey } from "./events.js";
import { activeClaims, type ProjectState } from "./state.js";

export function renderFleetContext(p: ProjectState, sessionId: string): string {
  const others = Object.values(p.sessions).filter((s) => s.open && s.sessionId !== sessionId);
  if (!others.length) return "";
  const name = (id: string) => p.members[id]?.name ?? id;
  const lines = [
    "OTHER AGENTS IN THIS PROJECT (do not touch what they hold; claim before writing shared paths):",
  ];
  for (const s of others) {
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
