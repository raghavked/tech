/**
 * The members drawer (members-drawer): one add field that offers people and live agents
 * together, its results inline so the list pushes down; role chips (Creator on solid apricot,
 * Host on the wash, Member plain) that are a menu only where you may change them; Leave on your
 * row, Remove on hover with an inline confirm that names what stays; agent rows with owner ·
 * status · what it is on, Open, and the lock where you may not remove; the Changes ledger from
 * the group log, never sent to the agents.
 */
import {
  type ChatEvent,
  type ChatMember,
  type Group,
  type GroupRole,
  isHost,
  memberKey,
  memberName,
  roleOf,
} from "@henosis/chat";
import { compactTokens } from "@henosis/kernel";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useState } from "react";
import type { AgentRow, ChatDirectoryListing } from "../api.js";
import { copy } from "../copy.js";
import { paths } from "../router.js";
import { Avatar, ICONS, Icon, Mark, useJustJoined } from "../ui.js";
import {
  AgentTile,
  type DirAgent,
  type Live,
  Match,
  MemberAvatar,
  nameOfIn,
  statusCls,
  statusWord,
} from "./shared.js";

type Candidate =
  | { kind: "human"; id: string; name: string; agent?: AgentRow }
  | { kind: "agent"; id: string; name: string; row: DirAgent };

export function MembersDrawer({
  group,
  meId,
  orgName,
  live,
  directory,
  events,
  projectNameOf,
  onAdd,
  onRemove,
  onRole,
  onClose,
}: {
  group: Group;
  meId: string;
  orgName: string;
  live: Live;
  directory: ChatDirectoryListing | null;
  events: ChatEvent[];
  projectNameOf: (projectId: string) => string;
  onAdd: (m: ChatMember) => void;
  onRemove: (m: ChatMember) => void;
  onRole: (userId: string, role: GroupRole) => void;
  onClose: () => void;
}) {
  const people = group.members.filter(
    (m): m is ChatMember & { kind: "human" } => m.kind === "human",
  );
  const agents = group.members.filter(
    (m): m is ChatMember & { kind: "agent" } => m.kind === "agent",
  );
  const nameOf = nameOfIn(group, directory);
  const host = isHost(group, meId);
  const creator = group.createdBy === meId;
  const inGroup = new Set(group.members.map(memberKey));
  // Who may be added by me: everyone when I hold the keys, else only agents I own.
  const candidates: Candidate[] = [];
  if (host)
    for (const p of directory?.people ?? [])
      if (!inGroup.has(`human:${p.id}`))
        candidates.push({ kind: "human", id: p.id, name: p.name, agent: p.agent });
  for (const a of directory?.agents ?? [])
    if (!inGroup.has(`agent:${a.projectId}/${a.sessionId}`) && (host || a.ownerId === meId))
      candidates.push({ kind: "agent", id: a.sessionId, name: a.title, row: a });
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [also, setAlso] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const needle = q.trim().toLowerCase();
  const matches = needle
    ? candidates
        .filter((c) => {
          const hay = [c.name, c.id, c.kind === "agent" ? nameOf(c.row.ownerId) : ""].map((x) =>
            x.toLowerCase(),
          );
          return hay.some((h) => h.includes(needle));
        })
        .slice(0, 6)
    : [];
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset the cursor when the list changes
  useEffect(() => setSel(0), [matches.length, q]);
  const fresh = useJustJoined(group.members.map(memberKey), 2500);
  const add = (c: Candidate) => {
    if (c.kind === "human") onAdd({ kind: "human", userId: c.id, name: c.name });
    else
      onAdd({
        kind: "agent",
        projectId: c.row.projectId,
        sessionId: c.row.sessionId,
        title: c.row.title,
      });
    setQ("");
  };
  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((v) => (v + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((v) => (v - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = matches[sel];
      if (c) add(c);
    } else if (e.key === "Escape") setQ("");
  };
  const agentsOwnedBy = (userId: string) =>
    agents.filter((a) => live.get(a.sessionId)?.ownerId === userId);
  const ledger = events
    .filter(
      (e) =>
        (e.kind === "group.member.added" ||
          e.kind === "group.member.removed" ||
          e.kind === "group.role.set") &&
        e.payload.groupId === group.id &&
        !(
          e.kind === "group.member.added" &&
          e.payload.member.kind === "human" &&
          e.payload.member.userId === group.createdBy
        ),
    )
    .slice(-6)
    .reverse();
  const creatorName = nameOf(group.createdBy);
  return (
    <>
      <button
        type="button"
        className="scrim sheet-scrim"
        aria-label={copy.chat.closeMembers}
        onClick={onClose}
      />
      <aside className="drawer members" aria-label={copy.chat.members}>
        <div className="drawer-head">
          <span className="serif">{copy.chat.members}</span>
          <span className="sub">
            {copy.chat.peopleCount(people.length)} · {copy.chat.agentCount(agents.length)} · #
            {group.name} · {copy.chat.startedBy(creatorName)}
          </span>
          <button
            type="button"
            className="btn ghost icon sm x"
            aria-label={copy.chat.closeMembers}
            onClick={onClose}
          >
            <Icon d={ICONS.close} size={14} />
          </button>
        </div>
        {candidates.length > 0 && (
          <div className="add">
            <label className="field">
              <Icon d={ICONS.search} size={14} />
              <input
                aria-label={copy.chat.addField}
                placeholder={copy.chat.addField}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKey}
              />
              <kbd>↑↓</kbd>
              <kbd>↵</kbd>
            </label>
            {q.trim() && (
              <div className="picker" role="listbox" aria-label={copy.chat.matches(q.trim())}>
                <div className="ph">
                  {copy.chat.matches(q.trim())}
                  <span className="n">
                    {copy.chat.matchCount(matches.length, candidates.length)}
                  </span>
                </div>
                {matches.length === 0 && <p className="none">{copy.chat.noMatch}</p>}
                {matches.map((c, i) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === sel}
                    className={`opt${i === sel ? " on" : ""}`}
                    key={`${c.kind}:${c.id}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(c)}
                  >
                    {c.kind === "human" ? (
                      <Avatar id={c.id} name={c.name} />
                    ) : (
                      <AgentTile id={c.id} title={c.name} status={c.row.live} size="md" />
                    )}
                    <span className="name">
                      <span className={`t${c.kind === "agent" ? " serif" : ""}`}>
                        <Match text={c.name} q={q} />
                      </span>
                      <span className="s">
                        {c.kind === "human" ? (
                          <>
                            {copy.chat.inOrg(orgName)}
                            {c.agent && (
                              <span className="agentline">
                                {" · "}
                                {copy.chat.brings(c.agent.name, c.agent.modelName)}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className={`status ${statusCls(c.row.live)}`}>
                              {statusWord(c.row.live).toLowerCase()}
                            </span>
                            {" · "}
                            {copy.chat.ownersAgent(nameOf(c.row.ownerId))}
                            {c.row.doing ? <i className="on-it"> {c.row.doing}</i> : null}
                          </>
                        )}
                      </span>
                    </span>
                    <span className="side">
                      {c.kind === "agent" && c.row.tokens ? (
                        <span className="tok">{compactTokens(c.row.tokens)}</span>
                      ) : null}
                      {c.kind === "human" ? copy.chat.person : null}
                      <kbd>↵ {copy.chat.add}</kbd>
                    </span>
                  </button>
                ))}
                <div className="foot">
                  <Icon d={ICONS.plus} size={13} />
                  {copy.chat.mentionFoot}
                  <i>{copy.chat.mentionFootSteers}</i>
                  {copy.chat.mentionFootRest}
                </div>
              </div>
            )}
          </div>
        )}
        <section className="group">
          <h3>
            {copy.chat.people}
            <span className="n">{people.length}</span>
          </h3>
          {people.map((p) => {
            const role = roleOf(group, p.userId) ?? "member";
            const me = p.userId === meId;
            const canChange = creator && !me;
            const canRemove = host && !me;
            const owned = agentsOwnedBy(p.userId);
            // The member model the person brings to a council, with the model it runs on.
            const brings = directory?.people.find((d) => d.id === p.userId)?.agent;
            return (
              <div key={p.userId} className="mrow-wrap">
                <div
                  className={`mrow${fresh.has(memberKey(p)) ? " joined" : ""}${confirm === p.userId ? " asking" : ""}`}
                >
                  <Avatar id={p.userId} name={memberName(p)} />
                  <span className="name">
                    <span className="t">
                      {memberName(p)}
                      {me && <span className="you">{copy.chat.you}</span>}
                    </span>
                    {fresh.has(memberKey(p)) && (
                      <span className="s new">{copy.chat.justJoined}</span>
                    )}
                    {brings && !fresh.has(memberKey(p)) && (
                      <span className="s agentline">
                        {copy.chat.brings(brings.name, brings.modelName)}
                      </span>
                    )}
                  </span>
                  <span className="side">
                    {canChange ? (
                      <button
                        type="button"
                        className={`rolechip ${role} menu`}
                        aria-haspopup="menu"
                        aria-expanded={menu === p.userId}
                        aria-label={`${copy.chat.roleMenu}: ${memberName(p)}`}
                        onClick={() => setMenu(menu === p.userId ? null : p.userId)}
                      >
                        {roleWord(role)}
                        <Icon d={ICONS.chevron} size={12} />
                      </button>
                    ) : (
                      <span className={`rolechip ${role}`}>{roleWord(role)}</span>
                    )}
                    {menu === p.userId && (
                      <div className="rolemenu" role="menu">
                        {(["host", "member"] as const).map((r) => (
                          <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={role === r}
                            className={`o${role === r ? " on" : ""}`}
                            key={r}
                            onClick={() => {
                              onRole(p.userId, r);
                              setMenu(null);
                            }}
                          >
                            <span>
                              <span className="t">{roleWord(r)}</span>
                              <span className="d">
                                {r === "host"
                                  ? copy.chat.roleHostDetail
                                  : copy.chat.roleMemberDetail}
                              </span>
                            </span>
                            {role === r && <Icon d={ICONS.check} size={14} />}
                          </button>
                        ))}
                        <div className="o off" aria-disabled="true">
                          <span>
                            <span className="t">{copy.chat.roleCreator}</span>
                            <span className="d">{copy.chat.roleCreatorFixed(creatorName)}</span>
                          </span>
                        </div>
                      </div>
                    )}
                    {me && (
                      <button
                        type="button"
                        className="btn ghost sm show"
                        aria-label={`${copy.chat.leave}: ${memberName(p)}`}
                        onClick={() => onRemove(p)}
                      >
                        {copy.chat.leave}
                      </button>
                    )}
                    {canRemove && confirm !== p.userId && (
                      <button
                        type="button"
                        className="btn ghost sm danger-text"
                        aria-label={`${copy.chat.remove}: ${memberName(p)}`}
                        onClick={() => {
                          setConfirm(p.userId);
                          setAlso(false);
                        }}
                      >
                        {copy.chat.remove}
                      </button>
                    )}
                  </span>
                </div>
                {confirm === p.userId && (
                  <div
                    className="confirm"
                    role="alertdialog"
                    aria-label={copy.chat.removeAsk(memberName(p), group.name)}
                  >
                    <p>
                      <b>{copy.chat.removeAsk(memberName(p), group.name)}</b>{" "}
                      {copy.chat.removeKeeps(memberName(p))}{" "}
                      {owned[0] && copy.chat.removeAgentStays(memberName(owned[0]), memberName(p))}
                    </p>
                    <div className="actions">
                      <button
                        type="button"
                        className="btn sm danger-solid"
                        onClick={() => {
                          onRemove(p);
                          if (also) for (const a of owned) onRemove(a);
                          setConfirm(null);
                        }}
                      >
                        {copy.chat.removeName(memberName(p))}
                      </button>
                      <button
                        type="button"
                        className="btn ghost sm"
                        onClick={() => setConfirm(null)}
                      >
                        {copy.chat.keep}
                      </button>
                      {owned[0] && (
                        <label className="also">
                          <input
                            type="checkbox"
                            checked={also}
                            onChange={(e) => setAlso(e.target.checked)}
                          />
                          {copy.chat.alsoRemove(memberName(owned[0]))}
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <p className="rule">{copy.chat.peopleRule}</p>
        </section>
        <section className="group">
          <h3>
            {copy.chat.agents}
            <span className="n">{agents.length}</span>
          </h3>
          {agents.map((a) => {
            const row = live.get(a.sessionId);
            const canRemove = host || row?.ownerId === meId;
            const lockNames = [row ? nameOf(row.ownerId) : null, creatorName].filter(
              (n, i, arr): n is string => Boolean(n) && arr.indexOf(n) === i,
            );
            return (
              <div key={memberKey(a)} className={`mrow${fresh.has(memberKey(a)) ? " joined" : ""}`}>
                <MemberAvatar m={a} live={live} />
                <span className="name">
                  <span className="t serif">{memberName(a)}</span>
                  <span className="s">
                    {fresh.has(memberKey(a)) && (
                      <span className="new">{copy.chat.justJoined} · </span>
                    )}
                    {row ? copy.chat.ownersAgent(nameOf(row.ownerId)) : projectNameOf(a.projectId)}
                    {" · "}
                    <span className={`status ${statusCls(row?.live)}`}>
                      {statusWord(row?.live).toLowerCase()}
                    </span>
                    {row?.doing ? <i className="on-it"> {row.doing}</i> : null}
                  </span>
                </span>
                <span className="side">
                  <a className="open" href={paths.session(a.projectId, a.sessionId)}>
                    <Icon d={ICONS.link} size={12} />
                    {copy.chat.open}
                  </a>
                  {canRemove ? (
                    <button
                      type="button"
                      className="btn ghost sm danger-text"
                      aria-label={`${copy.chat.remove}: ${memberName(a)}`}
                      onClick={() => onRemove(a)}
                    >
                      {copy.chat.remove}
                    </button>
                  ) : (
                    <span className="lock" title={copy.chat.agentsRule}>
                      <Icon d={ICONS.handoff} size={12} />
                      {copy.chat.lock(lockNames)}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
          {agents.length === 0 && <p className="rule">{copy.chat.noAgentsToAdd}</p>}
          <p className="rule">{copy.chat.agentsRule}</p>
        </section>
        {ledger.length > 0 && (
          <section className="group">
            <h3>
              {copy.chat.changes}
              <span className="n">{copy.chat.changesWeek(ledger.length)}</span>
            </h3>
            <div className="ledger">
              {ledger.map((e) => (
                <LedgerLine key={e.id} e={e} nameOf={nameOf} meId={meId} />
              ))}
            </div>
            <p className="rule">
              {copy.chat.ledgerFoot} <b>{copy.chat.neverSent}</b>
            </p>
          </section>
        )}
        <p className="note">
          {copy.chat.hearsOnly}
          <b>{copy.chat.hearsOnlyB}</b>
          {copy.chat.hearsOnlyC}
        </p>
      </aside>
    </>
  );
}

function roleWord(role: "creator" | "host" | "member"): string {
  return role === "creator"
    ? copy.chat.roleCreator
    : role === "host"
      ? copy.chat.roleHost
      : copy.chat.roleMember;
}

function LedgerLine({
  e,
  nameOf,
  meId,
}: {
  e: ChatEvent;
  nameOf: (id: string) => string;
  meId: string;
}) {
  const by = (actor: string) => (actor === meId ? copy.chat.youWord : nameOf(actor));
  if (e.kind === "group.role.set")
    return (
      <div className="l">
        <Mark size={14} />
        <span>
          <span className="who">{nameOf(e.payload.userId)}</span>{" "}
          {e.payload.role === "host" ? copy.chat.becameHost : copy.chat.becameMember} ·{" "}
          {copy.chat.byWho(by(e.actor))}
        </span>
      </div>
    );
  if (e.kind !== "group.member.added" && e.kind !== "group.member.removed") return null;
  const m = e.payload.member;
  const self = m.kind === "human" && m.userId === e.actor;
  return (
    <div className="l">
      {e.kind === "group.member.added" ? (
        <Mark size={14} />
      ) : (
        <span className="minus" aria-hidden="true" />
      )}
      <span>
        <span className="who">{memberName(m)}</span>{" "}
        {e.kind === "group.member.added" ? copy.chat.joined : copy.chat.left} ·{" "}
        {self ? copy.chat.leftOnOwn : copy.chat.byWho(by(e.actor))}
      </span>
    </div>
  );
}
