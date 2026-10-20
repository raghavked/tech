/**
 * The open group's stream (chat-view, mention-flow): day dividers as small caps, "New since you
 * looked away · n" as the one warm rule, every human message on the left with "you" as a meta
 * word, the agent's reply as prose behind a navy→chocolate rule, three mention marks, join
 * lines from the member events, read markers as tiny stacks, and the typing line while an
 * agent member answers a mention. The chat never shows tool steps.
 */
import {
  type Answering,
  type ChatEvent,
  type ChatMember,
  type ChatState,
  type Group,
  type Message,
  memberName,
  splitMentions,
} from "@henosis/chat";
import { useEffect, useRef } from "react";
import type { ChatDirectoryListing } from "../api.js";
import { copy } from "../copy.js";
import { paths } from "../router.js";
import { Avatar, ErrorLine, ICONS, Icon, Loader, Mark } from "../ui.js";
import {
  AgentTile,
  dayLabel,
  dayOf,
  joinNames,
  type Live,
  MemberAvatar,
  nameOfIn,
  ownerLine,
  timeOf,
} from "./shared.js";

type Item =
  | { kind: "message"; seq: number; m: Message }
  | {
      kind: "join";
      seq: number;
      e: ChatEvent & { kind: "group.member.added" | "group.member.removed" };
    };

export function Stream({
  group,
  state,
  events,
  meId,
  live,
  directory,
  answering,
  readAtOpen,
  errors,
}: {
  group: Group;
  state: ChatState;
  events: ChatEvent[];
  meId: string;
  live: Live;
  directory: ChatDirectoryListing | null;
  answering: Answering[];
  /** The seq this person had read when the group opened: where the warm rule goes. */
  readAtOpen: number;
  errors: string[];
}) {
  const messages = state.messages[group.id] ?? [];
  const nameOf = nameOfIn(group, directory);
  const byId = new Map(messages.map((m) => [m.id, m]));
  const items: Item[] = [
    ...messages.map((m): Item => ({ kind: "message", seq: m.seq, m })),
    ...events
      .filter(
        (e): e is ChatEvent & { kind: "group.member.added" | "group.member.removed" } =>
          (e.kind === "group.member.added" || e.kind === "group.member.removed") &&
          e.payload.groupId === group.id &&
          // The creator's own first row is the group being born, not a join worth a line.
          !(
            e.kind === "group.member.added" &&
            e.payload.member.kind === "human" &&
            e.payload.member.userId === group.createdBy
          ),
      )
      .map((e): Item => ({ kind: "join", seq: e.seq, e })),
  ].sort((a, b) => a.seq - b.seq);
  const isNew = (m: Message) =>
    m.seq > readAtOpen && !(m.author.kind === "human" && m.author.userId === meId);
  const newCount = messages.filter(isNew).length;
  const firstNew = messages.find(isNew);
  const firstMessage = messages[0];
  const showRule =
    firstNew !== undefined && firstMessage !== undefined && firstNew.id !== firstMessage.id;
  // Read markers: under the last message each other person has read, skipping their own.
  const markers = new Map<string, ChatMember[]>();
  for (const p of group.members) {
    if (p.kind !== "human" || p.userId === meId) continue;
    const read = state.reads[p.userId]?.[group.id] ?? -1;
    let at: Message | null = null;
    for (const m of messages) if (m.seq <= read) at = m;
    if (!at || (at.author.kind === "human" && at.author.userId === p.userId)) continue;
    markers.set(at.id, [...(markers.get(at.id) ?? []), p]);
  }
  const end = useRef<HTMLDivElement>(null);
  const lastKey = `${items[items.length - 1]?.seq ?? -1}:${answering.length}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when something lands
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [lastKey]);
  let lastDay = "";
  return (
    <section className="column chatcol" aria-label={copy.chat.messages}>
      <ErrorLine errors={errors} />
      {messages.length === 0 && <p className="empty-line">{copy.chat.empty}</p>}
      {items.map((it) => {
        if (it.kind === "join")
          return <JoinLine key={it.e.id} e={it.e} nameOf={nameOf} live={live} />;
        const m = it.m;
        const day = dayOf(m.at);
        const divider =
          day !== lastDay ? <div className="divider day">{dayLabel(m.at)}</div> : null;
        lastDay = day;
        const rule =
          showRule && firstNew && firstNew.id === m.id ? (
            <div className="divider new">
              <span>{copy.chat.newSince(newCount)}</span>
            </div>
          ) : null;
        const readers = markers.get(m.id);
        return (
          <div key={m.id} className="entry">
            {divider}
            {rule}
            {m.author.kind === "human" ? (
              <HumanMessage m={m} author={m.author} group={group} meId={meId} nameOf={nameOf} />
            ) : (
              <AgentReply
                m={m}
                author={m.author}
                group={group}
                live={live}
                nameOf={nameOf}
                replyTo={m.replyTo ? byId.get(m.replyTo) : undefined}
              />
            )}
            {readers && (
              <div className="readto">
                <span className="stack" aria-hidden="true">
                  {readers.map((p) => (
                    <MemberAvatar
                      key={p.kind === "human" ? p.userId : ""}
                      m={p}
                      live={live}
                      size="xs"
                    />
                  ))}
                </span>
                {copy.chat.readTo(joinNames(readers.map(memberName)))}
              </div>
            )}
          </div>
        );
      })}
      {answering
        .filter((a) => a.groupId === group.id)
        .map((a) => (
          <TypingLine key={a.sessionId} a={a} group={group} live={live} nameOf={nameOf} />
        ))}
      <div ref={end} />
    </section>
  );
}

function HumanMessage({
  m,
  author,
  group,
  meId,
  nameOf,
}: {
  m: Message;
  author: { kind: "human"; userId: string };
  group: Group;
  meId: string;
  nameOf: (id: string) => string;
}) {
  const mine = author.userId === meId;
  return (
    <div className={`msg human${mine ? " mine" : ""}`}>
      <div className="meta">
        <span className="who">{nameOf(author.userId)}</span>
        {mine && <span className="you">{copy.chat.youWord}</span>}
        <span className="when">{timeOf(m.at)}</span>
      </div>
      <div className="text">
        <Runs text={m.text} members={group.members} meId={meId} />
      </div>
    </div>
  );
}

/** Plain prose behind the rule, with the meta line that says exactly where the words came from. */
function AgentReply({
  m,
  author,
  group,
  live,
  nameOf,
  replyTo,
}: {
  m: Message;
  author: { kind: "agent"; projectId: string; sessionId: string };
  group: Group;
  live: Live;
  nameOf: (id: string) => string;
  replyTo: Message | undefined;
}) {
  const member = group.members.find((x) => x.kind === "agent" && x.sessionId === author.sessionId);
  const title = member ? memberName(member) : author.sessionId;
  const row = live.get(author.sessionId);
  const sep = <span className="dot-sep" aria-hidden="true" />;
  return (
    <div className="msg agent">
      <div className="meta">
        <AgentTile id={author.sessionId} title={title} status={row?.live ?? null} size="md" />
        <span className="who">{title}</span>
        <span className="owner">{ownerLine(row, nameOf, author.projectId)}</span>
        {sep}
        <span className="faint">{copy.chat.agentReplied}</span>
        {replyTo?.author.kind === "human" && (
          <>
            {sep}
            <span className="faint reply">
              {copy.chat.inReplyTo(nameOf(replyTo.author.userId))}
            </span>
          </>
        )}
        {m.turn !== null && (
          <>
            {sep}
            <span className="turn">{copy.chat.turn(m.turn)}</span>
          </>
        )}
        <a className="session" href={paths.session(author.projectId, author.sessionId)}>
          <Icon d={ICONS.link} size={12} />
          {copy.chat.inSession}
        </a>
        <span className="when">{timeOf(m.at)}</span>
      </div>
      <div className="body">
        <p className="text">{m.text}</p>
      </div>
    </div>
  );
}

/** "Billing page · Ana's agent ── answering Dee" with the weave, while the mention is out. */
function TypingLine({
  a,
  group,
  live,
  nameOf,
}: {
  a: Answering;
  group: Group;
  live: Live;
  nameOf: (id: string) => string;
}) {
  const member = group.members.find((x) => x.kind === "agent" && x.sessionId === a.sessionId);
  const title = member ? memberName(member) : a.sessionId;
  const row = live.get(a.sessionId);
  return (
    <div className="msg agent typing-line" aria-live="polite">
      <div className="meta">
        <AgentTile id={a.sessionId} title={title} status={row?.live ?? null} size="md" />
        <span className="who">{title}</span>
        <span className="owner">{ownerLine(row, nameOf, a.projectId)}</span>
        <Loader kind="weave" />
        <span className="faint">{copy.chat.answering(nameOf(a.askedBy))}</span>
      </div>
    </div>
  );
}

/** "Bo adds Tax lines, Dee's agent" · "Cy joins" · "Eli left": the member events as lines. */
function JoinLine({
  e,
  nameOf,
  live,
}: {
  e: ChatEvent & { kind: "group.member.added" | "group.member.removed" };
  nameOf: (id: string) => string;
  live: Live;
}) {
  const m = e.payload.member;
  const name = memberName(m);
  const self = m.kind === "human" && m.userId === e.actor;
  const owner = m.kind === "agent" ? live.get(m.sessionId) : undefined;
  return (
    <div className="join-line">
      {e.kind === "group.member.added" ? (
        <Mark size={18} />
      ) : (
        <span className="minus" aria-hidden="true" />
      )}
      <span>
        {e.kind === "group.member.added" ? (
          self ? (
            <>
              <i>{name}</i>
              {copy.chat.joinsCircleOne}
            </>
          ) : (
            <>
              {nameOf(e.actor)} adds <i>{name}</i>
              {owner ? `, ${copy.chat.ownersAgent(nameOf(owner.ownerId))}` : ""}
            </>
          )
        ) : self ? (
          <>
            <i>{name}</i> {copy.chat.left}
          </>
        ) : (
          <>
            {nameOf(e.actor)} removes <i>{name}</i>
          </>
        )}
      </span>
    </div>
  );
}

/** The text with each resolved mention marked by kind; what is marked is exactly what resolved. */
export function Runs({
  text,
  members,
  meId,
}: {
  text: string;
  members: readonly ChatMember[];
  meId: string;
}) {
  return (
    <>
      {splitMentions(text, members).map((r, i) =>
        r.member ? (
          <mark
            // biome-ignore lint/suspicious/noArrayIndexKey: runs have no identity of their own
            key={i}
            className={`mention${r.member.kind === "agent" ? " agent" : r.member.userId === meId ? " you" : ""}`}
          >
            {r.text}
          </mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: runs have no identity of their own
          <span key={i}>{r.text}</span>
        ),
      )}
    </>
  );
}

export { Avatar };
