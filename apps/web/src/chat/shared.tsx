/**
 * What the chat pieces share (views/ChatView.tsx, src/chat/*): the live directory as a map, the
 * agent tile with its status dot, the people | agents stack with its seam, names for owners
 * and times, and the matched-letters renderer the pickers use.
 */
import { type ChatMember, type Group, memberKey, memberName } from "@henosis/chat";
import type { ReactNode } from "react";
import type { ChatDirectoryListing } from "../api.js";
import { copy } from "../copy.js";
import { initials } from "../identity.js";
import { Avatar, STATUS } from "../ui.js";

export type DirAgent = ChatDirectoryListing["agents"][number];
/** The organisation's live sessions by session id; what a tile's dot and an owner line read. */
export type Live = Map<string, DirAgent>;

export function liveOf(directory: ChatDirectoryListing | null): Live {
  return new Map((directory?.agents ?? []).map((a) => [a.sessionId, a]));
}

export type StatusCls = "running" | "awaiting" | "blocked" | "paused" | "idle";

/** The dot's class for a session status; anything unknown or not live is idle. */
export function statusCls(status: string | null | undefined): StatusCls {
  switch (status) {
    case "running":
      return "running";
    case "awaiting_approval":
      return "awaiting";
    case "blocked":
      return "blocked";
    case "paused":
      return "paused";
    default:
      return "idle";
  }
}

export function statusWord(status: string | null | undefined): string {
  return STATUS[status ?? "offline"]?.label ?? STATUS.offline?.label ?? String(status ?? "");
}

/** Who owns and where: "Ana's agent" from the directory, or the project name alone. */
export function ownerLine(
  row: DirAgent | undefined,
  nameOf: (userId: string) => string,
  projectName: string,
): string {
  return row ? copy.chat.ownersAgent(nameOf(row.ownerId)) : projectName;
}

/** An agent as a tile: the squircle with two-cap initials and the status dot on its corner. */
export function AgentTile({
  id,
  title,
  status,
  size = "",
  className = "",
  withDot = true,
}: {
  id: string;
  title: string;
  status?: string | null;
  size?: "" | "xs" | "sm" | "md" | "lg";
  className?: string;
  withDot?: boolean;
}) {
  return (
    <span
      className={`avatar agent named${size ? ` ${size}` : ""}${className ? ` ${className}` : ""}`}
      title={`${title} · ${statusWord(status)}`}
      data-id={id}
    >
      {initials(title)}
      {withDot && <i className={`pr ${statusCls(status)}`} />}
    </span>
  );
}

/** A person's initials or the agent tile, from a member row. */
export function MemberAvatar({
  m,
  live,
  size = "",
  withDot = true,
}: {
  m: ChatMember;
  live: Live;
  size?: "" | "xs" | "sm" | "md" | "lg";
  withDot?: boolean;
}) {
  if (m.kind === "human") return <Avatar id={m.userId} name={memberName(m)} />;
  return (
    <AgentTile
      id={m.sessionId}
      title={memberName(m)}
      status={live.get(m.sessionId)?.live ?? null}
      size={size}
      withDot={withDot}
    />
  );
}

/**
 * People first, a hairline seam, then the agents with their status dots. `max` caps each kind;
 * the rest becomes a "+n" coin. The 2 px canvas seam around each agent tile keeps a dot off its
 * neighbour (groups-list fix).
 */
export function MemberStack({
  members,
  live,
  max = 4,
  size = "sm",
}: {
  members: readonly ChatMember[];
  live: Live;
  max?: number;
  size?: "" | "xs" | "sm";
}) {
  const people = members.filter((m) => m.kind === "human");
  const agents = members.filter((m) => m.kind === "agent");
  const morePeople = Math.max(0, people.length - max);
  const moreAgents = Math.max(0, agents.length - max);
  return (
    <span className={`stack mstack${size ? ` ${size}` : ""}`} aria-hidden="true">
      {people.slice(0, max).map((m) => (
        <MemberAvatar key={memberKey(m)} m={m} live={live} size={size} />
      ))}
      {morePeople > 0 && <span className="avatar more">+{morePeople}</span>}
      {people.length > 0 && agents.length > 0 && <span className="seam" />}
      {agents.slice(0, max).map((m) => (
        <MemberAvatar key={memberKey(m)} m={m} live={live} size={size} />
      ))}
      {moreAgents > 0 && <span className="avatar more">+{moreAgents}</span>}
    </span>
  );
}

export function Hash() {
  return <span className="hash">#</span>;
}

/** `text` with the first run that matches `q` in bold chocolate; the whole text when `q` is empty. */
export function Match({ text, q }: { text: string; q: string }): ReactNode {
  const needle = q.trim().toLowerCase();
  if (!needle) return text;
  const at = text.toLowerCase().indexOf(needle);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <b>{text.slice(at, at + needle.length)}</b>
      {text.slice(at + needle.length)}
    </>
  );
}

/** "Ana", "Ana and Cy", "Ana, Cy and Dee". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function nameOfIn(group: Group, directory: ChatDirectoryListing | null) {
  return (userId: string): string =>
    group.members.find(
      (m): m is ChatMember & { kind: "human" } => m.kind === "human" && m.userId === userId,
    )?.name ??
    directory?.people.find((p) => p.id === userId)?.name ??
    userId;
}

// ---- time ------------------------------------------------------------------------------------

export function dayOf(at: number): string {
  return at ? new Date(at).toDateString() : "";
}

export function dayLabel(at: number): string {
  if (!at) return "";
  const d = new Date(at);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return copy.chat.today;
  if (d.toDateString() === yesterday.toDateString()) return copy.chat.yesterday;
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function timeOf(at: number): string {
  return at
    ? new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : "";
}

/** The list's time slot: "now", "4 min", "09:41", "Yesterday", "Mon". */
export function ago(at: number, now = Date.now()): string {
  if (!at) return "";
  const diff = now - at;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
  const d = new Date(at);
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return timeOf(at);
  const yesterday = new Date(now - 86_400_000);
  if (d.toDateString() === yesterday.toDateString()) return copy.chat.yesterday;
  if (diff < 6 * 86_400_000) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
