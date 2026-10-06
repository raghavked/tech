/** The command-palette actions of one session page; SessionView registers them. */
import type { SessionState } from "@henosis/kernel";
import type { Actor } from "@henosis/protocol";
import type { HenosisClient } from "../client.js";
import type { PaletteAction } from "../palette.js";
import { ICONS } from "../ui.js";

export function sessionCommands({
  s,
  me,
  client,
  details,
  setDetails,
}: {
  s: SessionState | null;
  me: Actor;
  client: HenosisClient;
  details: boolean;
  setDetails: (v: boolean) => void;
}): PaletteAction[] {
  if (!s) return [];
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const directive = (mode: "steer" | "pause" | "resume", text: string) =>
    client.send({
      type: "directive",
      input: { text, mode, scope: "goal", supersedes: [], interrupt: false },
    });
  const paused = s.intent.control === "paused";
  const out: PaletteAction[] = [
    {
      id: "steer",
      label: "Steer the agent",
      icon: ICONS.send,
      prompt: "What should the agent do?",
      run: (text) => directive("steer", text),
    },
    {
      id: "control",
      label: paused ? "Resume the agent" : "Pause the agent",
      icon: ICONS.terminal,
      run: () => directive(paused ? "resume" : "pause", paused ? "resume" : "pause"),
    },
  ];
  for (const a of Object.values(s.approvals)
    .filter((a) => a.status === "pending")
    .slice(0, 5))
    out.push({
      id: `approve:${a.id}`,
      label: `Approve ${a.call.name} (${a.call.risk})`,
      icon: ICONS.check,
      hint: "pending",
      run: () => client.send({ type: "vote", approvalId: a.id, vote: "approve" }),
    });
  if (s.driver === me.id)
    for (const p of Object.values(s.participants))
      if (p.actor.kind === "human" && p.actor.id !== me.id)
        out.push({
          id: `handoff:${p.actor.id}`,
          label: `Hand off to ${name(p.actor.id)}`,
          icon: ICONS.handoff,
          run: () => client.send({ type: "handoff.request", to: p.actor.id }),
        });
  out.push({
    id: "fork",
    label: "Fork a branch",
    icon: ICONS.branch,
    prompt: "Branch name, like try/idea",
    run: (branch) => client.send({ type: "fork", branch }),
  });
  for (const b of ["main", ...Object.keys(s.branches)])
    if (b !== s.branch)
      out.push({
        id: `merge:${b}`,
        label: `Henosis ${b} into ${s.branch}`,
        icon: ICONS.branch,
        run: () => client.send({ type: "merge", source: b }),
      });
  out.push({
    id: "details",
    label: details ? "Close details" : "Open details",
    icon: ICONS.dots,
    run: () => setDetails(!details),
  });
  return out;
}
