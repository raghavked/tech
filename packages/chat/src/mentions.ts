/**
 * `@name` parsing against a group's members. A person is matched by name or user id, an agent
 * by its session title or session id; the longest match at each `@` wins, so "@Ana's agent"
 * beats "@Ana" when both are members. Matching ignores case. A match must end at a word
 * boundary so "@bo" does not catch "@bob".
 */
import {
  type ChatMember,
  type Mention,
  memberId,
  memberKey,
  memberName,
  sameMember,
} from "./events.js";
import type { Group } from "./state.js";

interface Candidate {
  member: ChatMember;
  text: string;
}

function candidates(members: readonly ChatMember[]): Candidate[] {
  const out: Candidate[] = [];
  for (const m of members) {
    const names = new Set([memberName(m), memberId(m)]);
    for (const text of names) if (text) out.push({ member: m, text: text.toLowerCase() });
  }
  // Longest first so the greedy scan prefers the fuller name.
  return out.sort((a, b) => b.text.length - a.text.length);
}

const isWordChar = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}_]/u.test(c);

/**
 * Every member mentioned in `text`, once each, in order of first mention. Takes a group or a
 * plain member list.
 */
export function mentionsIn(text: string, group: Group | readonly ChatMember[]): Mention[] {
  const members = Array.isArray(group)
    ? (group as readonly ChatMember[])
    : (group as Group).members;
  const cands = candidates(members);
  const lower = text.toLowerCase();
  const found: ChatMember[] = [];
  for (let i = 0; i < lower.length; i++) {
    if (lower[i] !== "@") continue;
    if (i > 0 && isWordChar(lower[i - 1])) continue;
    const rest = lower.slice(i + 1);
    const hit = cands.find((c) => rest.startsWith(c.text) && !isWordChar(rest[c.text.length]));
    if (hit && !found.some((m) => sameMember(m, hit.member))) found.push(hit.member);
  }
  return found.map((m) => ({ kind: m.kind, id: memberId(m) }));
}

/** The member a mention points at, if still in the group. */
export function memberOfMention(group: Group, mention: Mention): ChatMember | undefined {
  return group.members.find((m) => m.kind === mention.kind && memberId(m) === mention.id);
}

/**
 * Split a message into plain runs and mention runs for rendering: `[{text}, {text, member}]`.
 * The same matching as `mentionsIn`, so what is highlighted is exactly what was resolved.
 */
export function splitMentions(
  text: string,
  members: readonly ChatMember[],
): { text: string; member?: ChatMember }[] {
  const cands = candidates(members);
  const lower = text.toLowerCase();
  const out: { text: string; member?: ChatMember }[] = [];
  let plain = "";
  for (let i = 0; i < text.length; i++) {
    if (lower[i] === "@" && !(i > 0 && isWordChar(lower[i - 1]))) {
      const rest = lower.slice(i + 1);
      const hit = cands.find((c) => rest.startsWith(c.text) && !isWordChar(rest[c.text.length]));
      if (hit) {
        if (plain) out.push({ text: plain });
        plain = "";
        out.push({ text: text.slice(i, i + 1 + hit.text.length), member: hit.member });
        i += hit.text.length;
        continue;
      }
    }
    plain += text[i];
  }
  if (plain) out.push({ text: plain });
  return out;
}

export { memberKey };
