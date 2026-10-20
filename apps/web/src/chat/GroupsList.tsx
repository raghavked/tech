/**
 * The chats page (groups-list): a lead sentence instead of a count, filter chips with counts,
 * three scope sections (Team, Projects, Direct) and one row shape: emblem · serif name with the
 * purpose and a scope tag · the attributed last line · time · the people | agents stack · a
 * chocolate count, an apricot @n, or nothing when read. The New group sheet owns that gesture.
 */
import {
  type Answering,
  type ChatMember,
  type ChatState,
  type Group,
  type Message,
  memberName,
  splitMentions,
  unreadIn,
} from "@henosis/chat";
import { useMemo, useState } from "react";
import type { ChatDirectoryListing, Me } from "../api.js";
import { copy } from "../copy.js";
import { EmptyState } from "../empty.js";
import { paths } from "../router.js";
import { Avatar, ICONS, Icon, Loader } from "../ui.js";
import {
  AgentTile,
  ago,
  Hash,
  type Live,
  MemberStack,
  nameOfIn,
  ownerLine,
  statusCls,
} from "./shared.js";

type Filter = "all" | "unread" | "mentions" | "agents";
type Sort = "latest" | "az";

interface RowModel {
  g: Group;
  unread: number;
  mentions: number;
  last: Message | null;
  lastAt: number;
  answering: Answering | undefined;
  section: "team" | "projects" | "direct";
}

export function GroupsList({
  orgId,
  orgName,
  state,
  groups,
  meId,
  live,
  directory,
  answering,
  me,
}: {
  orgId: string;
  orgName: string;
  state: ChatState;
  groups: Group[];
  meId: string;
  live: Live;
  directory: ChatDirectoryListing | null;
  answering: Answering[];
  me: Me | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("latest");
  const rows = useMemo<RowModel[]>(
    () =>
      groups.map((g) => {
        const msgs = state.messages[g.id] ?? [];
        const read = state.reads[meId]?.[g.id] ?? -1;
        const last = msgs[msgs.length - 1] ?? null;
        const mentions = msgs.filter(
          (m) =>
            m.seq > read &&
            !(m.author.kind === "human" && m.author.userId === meId) &&
            m.mentions.some((x) => x.kind === "human" && x.id === meId),
        ).length;
        const humans = g.members.filter((m) => m.kind === "human").length;
        const section: RowModel["section"] =
          g.members.length === 2 &&
          humans >= 1 &&
          g.members.some((m) => m.kind === "human" && m.userId === meId)
            ? "direct"
            : g.scope.projectId
              ? "projects"
              : "team";
        return {
          g,
          unread: unreadIn(state, meId, g.id),
          mentions,
          last,
          lastAt: last?.at ?? 0,
          answering: answering.find((a) => a.groupId === g.id),
          section,
        };
      }),
    [groups, state, meId, answering],
  );
  const counts = {
    all: rows.length,
    unread: rows.filter((r) => r.unread > 0).length,
    mentions: rows.filter((r) => r.mentions > 0).length,
    agents: rows.filter((r) => r.g.members.some((m) => m.kind === "agent")).length,
  };
  const shown = rows
    .filter((r) =>
      filter === "unread"
        ? r.unread > 0
        : filter === "mentions"
          ? r.mentions > 0
          : filter === "agents"
            ? r.g.members.some((m) => m.kind === "agent")
            : true,
    )
    .sort((a, b) => (sort === "az" ? a.g.name.localeCompare(b.g.name) : b.g.lastSeq - a.g.lastSeq));
  const sections: { key: RowModel["section"]; title: string; sub: string; rows: RowModel[] }[] = [
    {
      key: "team",
      title: copy.chat.sectionTeam,
      sub: copy.chat.sectionTeamSub,
      rows: shown.filter((r) => r.section === "team"),
    },
    {
      key: "projects",
      title: copy.chat.sectionProjects,
      sub: [
        ...new Set(shown.filter((r) => r.section === "projects").map((r) => projectName(me, r.g))),
      ]
        .slice(0, 3)
        .join(" · "),
      rows: shown.filter((r) => r.section === "projects"),
    },
    {
      key: "direct",
      title: copy.chat.sectionDirect,
      sub: copy.chat.sectionDirectSub,
      rows: shown.filter((r) => r.section === "direct"),
    },
  ];
  const chip = (f: Filter, label: string, n: number) => (
    <button
      type="button"
      className={`chip${filter === f ? " on" : ""}`}
      aria-pressed={filter === f}
      onClick={() => setFilter(f)}
    >
      {label}
      <span className="n">{n}</span>
    </button>
  );
  return (
    <div className="column page groupspage">
      <h1>{copy.shell.orgChats(orgName)}</h1>
      {rows.length > 0 && (
        <Lead rows={rows} state={state} meId={meId} live={live} directory={directory} />
      )}
      {rows.length === 0 && <EmptyState spot="crew" text={copy.chat.noGroups} />}
      {rows.length > 0 && (
        <div className="filters">
          {chip("all", copy.chat.filterAll, counts.all)}
          {chip("unread", copy.chat.filterUnread, counts.unread)}
          {chip("mentions", copy.chat.filterMentions, counts.mentions)}
          {chip("agents", copy.chat.filterWithAgents, counts.agents)}
          <fieldset className="seg right" aria-label="Sort">
            <button
              type="button"
              className={sort === "latest" ? "on" : ""}
              aria-pressed={sort === "latest"}
              onClick={() => setSort("latest")}
            >
              {copy.chat.sortLatest}
            </button>
            <button
              type="button"
              className={sort === "az" ? "on" : ""}
              aria-pressed={sort === "az"}
              onClick={() => setSort("az")}
            >
              {copy.chat.sortAz}
            </button>
          </fieldset>
        </div>
      )}
      {rows.length > 0 && shown.length === 0 && <p className="muted">{copy.chat.noMatches}</p>}
      {sections
        .filter((s) => s.rows.length > 0)
        .map((s) => (
          <section className="gsection" key={s.key} aria-label={s.title}>
            <header>
              <h2>{s.title}</h2>
              <span className="sub">{s.sub}</span>
              <span className="right">
                {s.key === "direct"
                  ? copy.chat.chatCount(s.rows.length)
                  : copy.chat.groupCount(s.rows.length)}
              </span>
            </header>
            <div className="glist">
              {s.rows.map((r) => (
                <GroupRow
                  key={r.g.id}
                  row={r}
                  orgId={orgId}
                  meId={meId}
                  live={live}
                  directory={directory}
                  me={me}
                />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

function projectName(me: Me | null, g: Group): string {
  return (
    me?.projects.find((p) => p.projectId === g.scope.projectId)?.name ?? g.scope.projectId ?? ""
  );
}

function scopeTag(me: Me | null, g: Group, section: RowModel["section"]): string {
  if (section === "direct") return copy.chat.tagDirect;
  if (g.scope.projectId) return projectName(me, g);
  if (g.scope.teamId)
    return me?.projects.find((p) => p.teamId === g.scope.teamId)?.teamName ?? copy.chat.tagTeam;
  return copy.chat.tagOrg;
}

/** "Nine unread across four groups. Cy's agent answered in #billing, and Ana said your name in #invoice-rollout." */
function Lead({
  rows,
  state,
  meId,
  live,
  directory,
}: {
  rows: RowModel[];
  state: ChatState;
  meId: string;
  live: Live;
  directory: ChatDirectoryListing | null;
}) {
  const unread = rows.reduce((n, r) => n + r.unread, 0);
  let answered: { who: string; group: string; seq: number } | null = null;
  let said: { who: string; group: string; seq: number } | null = null;
  for (const r of rows) {
    const read = state.reads[meId]?.[r.g.id] ?? -1;
    const nameOf = nameOfIn(r.g, directory);
    for (const m of state.messages[r.g.id] ?? []) {
      if (m.seq <= read) continue;
      if (m.author.kind === "agent") {
        if (!answered || m.seq > answered.seq) {
          const agent = r.g.members.find(
            (x) =>
              x.kind === "agent" && x.sessionId === (m.author as { sessionId: string }).sessionId,
          );
          const row = live.get(m.author.sessionId);
          const who = row
            ? copy.chat.ownersAgent(nameOf(row.ownerId))
            : agent
              ? memberName(agent)
              : "";
          answered = { who, group: r.g.name, seq: m.seq };
        }
      } else if (
        m.author.userId !== meId &&
        m.mentions.some((x) => x.kind === "human" && x.id === meId) &&
        (!said || m.seq > said.seq)
      ) {
        said = { who: nameOf(m.author.userId), group: r.g.name, seq: m.seq };
      }
    }
  }
  return (
    <p className="lead">
      {unread === 0 ? copy.chat.leadNone(rows.length) : copy.chat.leadUnread(unread, rows.length)}
      {answered && (
        <>
          {" "}
          <b>{answered.who}</b>
          {copy.chat.leadAnswered}
          <i>#{answered.group}</i>
          {!said && "."}
        </>
      )}
      {said && (
        <>
          {answered ? copy.chat.leadAnd : " "}
          <b>{said.who}</b>
          {copy.chat.leadSaidYourName}
          <i>#{said.group}</i>.
        </>
      )}
    </p>
  );
}

function GroupRow({
  row,
  orgId,
  meId,
  live,
  directory,
  me,
}: {
  row: RowModel;
  orgId: string;
  meId: string;
  live: Live;
  directory: ChatDirectoryListing | null;
  me: Me | null;
}) {
  const { g, unread, mentions, last, answering } = row;
  const nameOf = nameOfIn(g, directory);
  const other =
    row.section === "direct"
      ? (g.members.find((m) => !(m.kind === "human" && m.userId === meId)) ?? null)
      : null;
  return (
    <a
      className={`grouprow${unread > 0 ? " unread" : " read"}`}
      href={paths.chat(orgId, g.id)}
      aria-label={`#${g.name}${g.purpose ? ` · ${g.purpose}` : ""}`}
    >
      <Emblem g={g} section={row.section} other={other} live={live} />
      <span className="head">
        <span className="name">
          <Hash />
          {g.name}
        </span>
        {g.purpose && <span className="purpose">{g.purpose}</span>}
        <span className="scope">{scopeTag(me, g, row.section)}</span>
      </span>
      <span className="last">
        {answering ? (
          <AnsweringLine a={answering} g={g} live={live} nameOf={nameOf} />
        ) : last ? (
          <LastLine m={last} g={g} meId={meId} live={live} nameOf={nameOf} />
        ) : (
          <span className="q faint">{copy.chat.empty}</span>
        )}
      </span>
      <span className="side">
        <span className="when">{answering ? "now" : ago(row.lastAt)}</span>
        <span className="bottom">
          <MemberStack members={g.members} live={live} />
          {mentions > 0 ? (
            <span className="count at">@{mentions}</span>
          ) : unread > 0 ? (
            <span className="count">{unread}</span>
          ) : null}
        </span>
      </span>
    </a>
  );
}

function Emblem({
  g,
  section,
  other,
  live,
}: {
  g: Group;
  section: RowModel["section"];
  other: ChatMember | null;
  live: Live;
}) {
  if (section === "direct" && other) {
    if (other.kind === "human")
      return (
        <span className="em direct">
          <Avatar id={other.userId} name={memberName(other)} />
        </span>
      );
    return (
      <span className="em direct agent">
        <AgentTile
          id={other.sessionId}
          title={memberName(other)}
          status={live.get(other.sessionId)?.live ?? null}
          size="lg"
        />
      </span>
    );
  }
  return <span className={`em ${g.scope.projectId ? "project" : "team"}`}>#</span>;
}

function LastLine({
  m,
  g,
  meId,
  live,
  nameOf,
}: {
  m: Message;
  g: Group;
  meId: string;
  live: Live;
  nameOf: (id: string) => string;
}) {
  const who =
    m.author.kind === "human" ? (
      <span className="who">
        {m.author.userId === meId ? copy.chat.youWord : nameOf(m.author.userId)}
      </span>
    ) : (
      <span className="who agent">
        <em>
          {ownerLine(
            live.get(m.author.sessionId),
            nameOf,
            memberName(
              g.members.find(
                (x) =>
                  x.kind === "agent" &&
                  x.sessionId === (m.author as { sessionId: string }).sessionId,
              ) ?? { kind: "agent", projectId: m.author.projectId, sessionId: m.author.sessionId },
            ),
          )}
        </em>
      </span>
    );
  return (
    <>
      {who}
      <span className="q">
        {runsWithOffsets(m.text, g.members).map((r) =>
          r.member ? (
            <span
              key={r.at}
              className={r.member.kind === "human" && r.member.userId === meId ? "me" : ""}
            >
              {r.text}
            </span>
          ) : (
            <span key={r.at}>{r.text}</span>
          ),
        )}
      </span>
    </>
  );
}

/** The mention runs keyed by where they start in the text, so React has a stable key per run. */
function runsWithOffsets(text: string, members: readonly ChatMember[]) {
  let at = 0;
  return splitMentions(text, members).map((r) => {
    const out = { ...r, at };
    at += r.text.length;
    return out;
  });
}

function AnsweringLine({
  a,
  g,
  live,
  nameOf,
}: {
  a: Answering;
  g: Group;
  live: Live;
  nameOf: (id: string) => string;
}) {
  const agent = g.members.find((x) => x.kind === "agent" && x.sessionId === a.sessionId);
  const row = live.get(a.sessionId);
  const who = row
    ? copy.chat.ownersAgent(nameOf(row.ownerId))
    : agent
      ? memberName(agent)
      : a.sessionId;
  return (
    <span className="typing">
      <Loader kind="weave" className={statusCls(row?.live)} />
      {copy.chat.isAnswering(who, nameOf(a.askedBy))}
    </span>
  );
}

export { ICONS, Icon };
