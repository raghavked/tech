/** The command-palette actions of one session page, and the shortcut sheet's context; SessionView registers both. */
import { isRatingsRule, ruleFor, type SessionState } from "@henosis/kernel";
import type { Actor } from "@henosis/protocol";
import { DEFAULT_RATING } from "../approvalsQueue.js";
import type { HenosisClient } from "../client.js";
import { copy } from "../copy.js";
import type { PaletteAction } from "../palette.js";
import type { ShortcutContext } from "../shortcuts.js";
import { ICONS } from "../ui.js";

/** What the "?" sheet needs to say what each key would do right now in this session. */
export function shortcutContextOf(
  s: SessionState | null,
  meId: string,
  detailsOpen: boolean,
  title: string,
): ShortcutContext {
  if (!s) return { session: null };
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const waiting = Object.values(s.approvals).find((a) => a.status === "pending");
  const offered = Object.values(s.handoffs).find((h) => h.status === "pending" && h.to === meId);
  const others = Object.values(s.participants)
    .filter((p) => p.actor.kind === "human" && p.actor.id !== meId && p.present)
    .map((p) => p.actor.name);
  return {
    session: {
      title: s.title || title,
      driving: s.driver === meId,
      driver: s.driver && s.driver !== meId ? name(s.driver) : null,
      waiting: waiting
        ? {
            code: waiting.call.name,
            risk: waiting.call.risk,
            irreversible: waiting.call.risk === "irreversible",
            ratings: isRatingsRule(ruleFor(s.policy.approvals, waiting.call.risk)),
            rated: Object.entries(waiting.ballots)
              .filter(([, b]) => b.vote === "approve" && b.rating !== null)
              .map(([id, b]) => ({ who: name(id), rating: b.rating ?? DEFAULT_RATING })),
          }
        : null,
      offered: offered ? { from: name(offered.from) } : null,
      others,
      branch: s.branch,
      detailsOpen,
    },
  };
}

/** "4" or "" to the default; anything outside 1..5 is the default too. */
export function ratingOf(text: string, fallback = DEFAULT_RATING): number {
  const n = Number.parseInt(text.trim(), 10);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : fallback;
}

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
    .slice(0, 5)) {
    // A release gate asks for the rating first; Enter alone sends the default.
    if (isRatingsRule(ruleFor(s.policy.approvals, a.call.risk)))
      out.push({
        id: `approve:${a.id}`,
        label: copy.approval.approveRated(a.call.name, a.call.risk),
        icon: ICONS.check,
        hint: "pending",
        prompt: copy.approval.ratePrompt,
        allowEmpty: true,
        gate: {
          code: a.call.name,
          rated: Object.entries(a.ballots)
            .filter(([, b]) => b.vote === "approve" && b.rating !== null)
            .map(([id, b]) => ({ who: name(id), rating: b.rating ?? DEFAULT_RATING })),
        },
        run: (text) =>
          client.send({
            type: "vote",
            approvalId: a.id,
            vote: "approve",
            note: "",
            rating: ratingOf(text),
          }),
      });
    else
      out.push({
        id: `approve:${a.id}`,
        label: `Approve ${a.call.name} (${a.call.risk})`,
        icon: ICONS.check,
        hint: "pending",
        run: () => client.send({ type: "vote", approvalId: a.id, vote: "approve", note: "" }),
      });
  }
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
