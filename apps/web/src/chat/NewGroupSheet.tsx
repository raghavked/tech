/**
 * The New group sheet (new-group): two halves over the shell. Left, the form: NAME with `#` as
 * a serif prefix and the live "free" check, PURPOSE, SCOPE as radio cards each stating its
 * rule, MEMBERS as one search bar over two pick lists of one shape (people, live agents) with
 * "you · creator" already in, a warn-soft note for a pick that is not running, and the roster
 * footer with "Create #name". Right, "How it will open": the group page in miniature, updated
 * as you pick, with three facts under it. The preview composer has no Team | Agent segment.
 */
import type { ChatMember, ChatScope } from "@henosis/chat";
import { useEffect, useState } from "react";
import type { ChatDirectoryListing, Me } from "../api.js";
import { copy } from "../copy.js";
import { initials } from "../identity.js";
import { Avatar, ICONS, Icon, Mark } from "../ui.js";
import { AgentTile, Hash, joinNames, statusCls, statusWord } from "./shared.js";

export interface NewGroupInput {
  name: string;
  purpose: string;
  scope: ChatScope;
  members: ChatMember[];
}

export function NewGroupSheet({
  orgId,
  orgName,
  me,
  meId,
  meName,
  directory,
  names,
  onCheck,
  onClose,
  onCreate,
}: {
  orgId: string;
  orgName: string;
  me: Me | null;
  meId: string;
  meName: string;
  directory: ChatDirectoryListing | null;
  /** What the server said about names typed so far: true when free. */
  names: Record<string, boolean>;
  onCheck: (name: string) => void;
  onClose: () => void;
  onCreate: (input: NewGroupInput) => void;
}) {
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [scope, setScope] = useState("org");
  const [q, setQ] = useState("");
  const [liveOnly, setLiveOnly] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [just, setJust] = useState<string | null>(null);
  const projects = (me?.projects ?? []).filter((p) => p.orgId === orgId);
  const teams = [...new Map(projects.map((p) => [p.teamId, p.teamName])).entries()];
  const people = (directory?.people ?? []).filter((p) => p.id !== meId);
  const agents = directory?.agents ?? [];
  const nameOf = (id: string) =>
    id === meId ? meName : (directory?.people.find((p) => p.id === id)?.name ?? id);
  const trimmed = name.trim();
  // The name check, a beat after typing stops; the answer lands in `names`.
  useEffect(() => {
    if (!trimmed) return;
    const t = setTimeout(() => onCheck(trimmed), 250);
    return () => clearTimeout(t);
  }, [trimmed, onCheck]);
  const free = trimmed ? names[trimmed] : undefined;
  const needle = q.trim().toLowerCase();
  const shownPeople = people.filter((p) => !needle || p.name.toLowerCase().includes(needle));
  const shownAgents = agents.filter(
    (a) =>
      (!needle ||
        a.title.toLowerCase().includes(needle) ||
        nameOf(a.ownerId).toLowerCase().includes(needle)) &&
      (!liveOnly || a.live === "running"),
  );
  const toggle = (key: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else {
        next.add(key);
        setJust(key);
      }
      return next;
    });
  };
  const pickedPeople = people.filter((p) => picked.has(`human:${p.id}`));
  const pickedAgents = agents.filter((a) => picked.has(`agent:${a.projectId}/${a.sessionId}`));
  const notRunning = pickedAgents.find((a) => a.live !== "running");
  const scopeOf = (): ChatScope => {
    if (scope.startsWith("team:")) return { teamId: scope.slice(5) };
    if (scope.startsWith("project:")) {
      const p = projects.find((x) => x.projectId === scope.slice(8));
      return p ? { teamId: p.teamId, projectId: p.projectId } : { projectId: scope.slice(8) };
    }
    return {};
  };
  const scopeWord = scope.startsWith("team:")
    ? (teams.find(([id]) => id === scope.slice(5))?.[1] ?? copy.chat.tagTeam)
    : scope.startsWith("project:")
      ? (projects.find((p) => p.projectId === scope.slice(8))?.name ?? "")
      : orgName;
  const canCreate = trimmed.length > 0 && free !== false;
  const submit = () => {
    if (!canCreate) return;
    const members: ChatMember[] = [
      ...pickedPeople.map((p): ChatMember => ({ kind: "human", userId: p.id, name: p.name })),
      ...pickedAgents.map(
        (a): ChatMember => ({
          kind: "agent",
          projectId: a.projectId,
          sessionId: a.sessionId,
          title: a.title,
        }),
      ),
    ];
    onCreate({ name: trimmed, purpose: purpose.trim(), scope: scopeOf(), members });
    onClose();
  };
  const scopeCard = (value: string, label: string, rule: string, icon: string) => (
    <label className={`scope${scope === value ? " on" : ""}`} key={value}>
      <input
        type="radio"
        name="scope"
        value={value}
        aria-label={label}
        checked={scope === value}
        onChange={() => setScope(value)}
      />
      <span className="t">
        <Icon d={icon} size={14} />
        <span className="nm">{label}</span>
      </span>
      <span className="s">{rule}</span>
      <span className="r" aria-hidden="true" />
    </label>
  );
  const joinSentence = [...pickedPeople.map((p) => p.name), ...pickedAgents.map((a) => a.title)];
  return (
    <div className="sheet-wrap newgroup-wrap">
      <button type="button" className="sheet-dim" aria-label={copy.chat.cancel} onClick={onClose} />
      <div className="sheet newgroup">
        <form
          className="form"
          aria-label={copy.chat.newGroup}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="head">
            <div>
              <h2>{copy.chat.newGroup}</h2>
              <p className="sub">{copy.chat.newGroupSub}</p>
            </div>
            <button
              type="button"
              className="btn ghost icon sm x"
              aria-label={copy.chat.cancel}
              onClick={onClose}
            >
              <Icon d={ICONS.close} size={14} />
            </button>
          </div>
          <div className="body">
            <div className="two">
              <div className="field">
                <span className="lbl">{copy.chat.name}</span>
                <label className={`namefield${free === false ? " bad" : ""}`}>
                  <span className="hash" aria-hidden="true">
                    #
                  </span>
                  <input
                    aria-label={copy.chat.name}
                    placeholder={copy.chat.nameHint}
                    value={name}
                    maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                  />
                  {trimmed && free === true && (
                    <span className="ok">
                      <Icon d={ICONS.check} size={13} />
                      {copy.chat.nameFree}
                    </span>
                  )}
                  {trimmed && free === false && (
                    <span className="taken">{copy.chat.nameTaken}</span>
                  )}
                </label>
                <span className="help">
                  {copy.chat.nameHelp}
                  <code>#{trimmed || copy.chat.nameHint}</code>.
                </span>
              </div>
              <div className="field">
                <span className="lbl">
                  {copy.chat.purpose}
                  <span className="hint">{copy.chat.optional}</span>
                </span>
                <input
                  className="input"
                  aria-label={copy.chat.purpose}
                  placeholder={copy.chat.purposeHint}
                  value={purpose}
                  maxLength={400}
                  onChange={(e) => setPurpose(e.target.value)}
                />
                <span className="help">{copy.chat.purposeHelp}</span>
              </div>
            </div>
            <fieldset className="field" aria-label={copy.chat.scope}>
              <span className="lbl">
                {copy.chat.scope}
                <span className="hint">{copy.chat.scopeHelp}</span>
              </span>
              <div className="scopes">
                {scopeCard(
                  "org",
                  copy.chat.scopeOrg,
                  copy.chat.scopeOrgRule(orgName),
                  ICONS.columns,
                )}
                {teams.map(([id, teamName]) =>
                  scopeCard(
                    `team:${id}`,
                    copy.chat.scopeTeam(teamName),
                    copy.chat.scopeTeamRule(teamName),
                    ICONS.inbox,
                  ),
                )}
                {projects.map((p) =>
                  scopeCard(
                    `project:${p.projectId}`,
                    copy.chat.scopeProject(p.name),
                    copy.chat.scopeProjectRule(p.name),
                    ICONS.file,
                  ),
                )}
              </div>
            </fieldset>
            <div className="field members">
              <span className="lbl">
                {copy.chat.membersHead}
                <span className="hint">{copy.chat.membersHint}</span>
              </span>
              <label className="search">
                <Icon d={ICONS.search} size={14} />
                <input
                  aria-label={copy.chat.searchMembers}
                  placeholder={copy.chat.searchMembers}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <span className="chips">
                  <button
                    type="button"
                    className={`chip${!liveOnly ? " on" : ""}`}
                    aria-pressed={!liveOnly}
                    onClick={() => setLiveOnly(false)}
                  >
                    {copy.chat.chipEveryone}
                  </button>
                  <button
                    type="button"
                    className={`chip${liveOnly ? " on" : ""}`}
                    aria-pressed={liveOnly}
                    onClick={() => setLiveOnly(true)}
                  >
                    {copy.chat.chipLive}
                  </button>
                </span>
              </label>
              <div className="picks">
                <fieldset className="picklist" aria-label={copy.chat.people}>
                  <span className="lbl">
                    {copy.chat.people}
                    <span className="hint">
                      {copy.chat.picked(pickedPeople.length + 1, people.length + 1)}
                    </span>
                  </span>
                  <label className="pick you">
                    <Avatar id={meId} name={meName} />
                    <span className="meta">
                      <span className="nm">{meName}</span>
                      <span className="s">{copy.chat.youOwner}</span>
                    </span>
                    <input type="checkbox" checked disabled aria-label={meName} />
                    <span className="cb" aria-hidden="true">
                      <Icon d={ICONS.check} size={13} />
                    </span>
                  </label>
                  {shownPeople.map((p) => {
                    const key = `human:${p.id}`;
                    const on = picked.has(key);
                    return (
                      <label
                        className={`pick${on ? " on" : ""}${just === key ? " just" : ""}`}
                        key={key}
                      >
                        <Avatar id={p.id} name={p.name} />
                        <span className="meta">
                          <span className="nm">{p.name}</span>
                          <span className="s">{copy.chat.inOrg(orgName)}</span>
                        </span>
                        <input
                          type="checkbox"
                          aria-label={p.name}
                          checked={on}
                          onChange={() => toggle(key)}
                        />
                        <span className="cb" aria-hidden="true">
                          <Icon d={ICONS.check} size={13} />
                        </span>
                      </label>
                    );
                  })}
                  {directory && people.length === 0 && (
                    <span className="help">{copy.chat.nobodyToAdd}</span>
                  )}
                </fieldset>
                <fieldset className="picklist" aria-label={copy.chat.liveAgents}>
                  <span className="lbl">
                    {copy.chat.liveAgents}
                    <span className="hint">
                      {copy.chat.picked(pickedAgents.length, agents.length)}
                    </span>
                  </span>
                  {shownAgents.map((a) => {
                    const key = `agent:${a.projectId}/${a.sessionId}`;
                    const on = picked.has(key);
                    return (
                      <label
                        className={`pick${on ? " on" : ""}${just === key ? " just" : ""}`}
                        key={key}
                      >
                        <AgentTile
                          id={a.sessionId}
                          title={a.title}
                          status={a.live}
                          size="lg"
                          withDot={false}
                        />
                        <span className="meta">
                          <span className="nm">{a.title}</span>
                          <span className="s">
                            <i>{copy.chat.ownersAgent(nameOf(a.ownerId))}</i> ·{" "}
                            <span className={`st ${statusCls(a.live)}`}>
                              {statusWord(a.live).toLowerCase()}
                            </span>
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          aria-label={a.title}
                          checked={on}
                          onChange={() => toggle(key)}
                        />
                        <span className="cb" aria-hidden="true">
                          <Icon d={ICONS.check} size={13} />
                        </span>
                      </label>
                    );
                  })}
                  {directory && agents.length === 0 && (
                    <span className="help">{copy.chat.noAgentsToAdd}</span>
                  )}
                </fieldset>
              </div>
              {notRunning && (
                <p className="note">
                  <Icon d={ICONS.bell} size={14} />
                  <span>
                    <b>{notRunning.title}</b>
                    {copy.chat.agentNote(statusWord(notRunning.live), nameOf(notRunning.ownerId))}
                  </span>
                </p>
              )}
            </div>
          </div>
          <div className="foot">
            <span className="circle">
              <span className="stack" aria-hidden="true">
                <Avatar id={meId} name={meName} />
                {pickedPeople.slice(0, 3).map((p) => (
                  <Avatar key={p.id} id={p.id} name={p.name} />
                ))}
                {pickedAgents.length > 0 && <span className="seam" />}
                {pickedAgents.slice(0, 3).map((a) => (
                  <AgentTile
                    key={a.sessionId}
                    id={a.sessionId}
                    title={a.title}
                    status={a.live}
                    size="sm"
                  />
                ))}
              </span>
              {copy.chat.inCircle(pickedPeople.length + 1, pickedAgents.length)}
            </span>
            <span className="right">
              <button type="button" className="btn sm" onClick={onClose}>
                {copy.chat.cancel}
              </button>
              <button type="submit" className="btn primary sm" disabled={!canCreate}>
                {copy.chat.create(trimmed || copy.chat.nameHint)}
              </button>
            </span>
          </div>
        </form>
        <aside className="pv" aria-label={copy.chat.howItOpens}>
          <div className="head">
            <span className="lbl">{copy.chat.howItOpens}</span>
            <span className="live">{copy.chat.updatesAsYouPick}</span>
          </div>
          <div className="body">
            <div className="mini">
              <div className="bar">
                <span className="nm">
                  <Hash />
                  {trimmed || copy.chat.nameHint}
                </span>
                {purpose.trim() && <span className="pp">{purpose.trim()}</span>}
                <span className="pill">{scopeWord}</span>
              </div>
              <div className="stream">
                <div className="joined">
                  <Mark size={34} settle />
                  <span className="txt">
                    <b>{meName}</b> starts #{trimmed || copy.chat.nameHint}.
                    {joinSentence.length > 0 && (
                      <>
                        {" "}
                        {joinSentence.map((n, i) => (
                          <span key={n}>
                            <b>{n}</b>
                            {i < joinSentence.length - 2
                              ? ", "
                              : i === joinSentence.length - 2
                                ? " and "
                                : ""}
                          </span>
                        ))}
                        {joinSentence.length === 1
                          ? copy.chat.joinsCircleOne
                          : copy.chat.joinCircle}
                      </>
                    )}
                  </span>
                </div>
                <div className="roster">
                  <span className="avatar">{initials(meName)}</span>
                  {pickedPeople.map((p) => (
                    <span key={p.id} className="avatar">
                      {initials(p.name)}
                    </span>
                  ))}
                  {pickedAgents.length > 0 && <span className="seam" />}
                  {pickedAgents.map((a) => (
                    <AgentTile key={a.sessionId} id={a.sessionId} title={a.title} status={a.live} />
                  ))}
                  <span className="n">
                    {copy.chat.peopleCount(pickedPeople.length + 1)} ·{" "}
                    {copy.chat.agentCount(pickedAgents.length)}
                  </span>
                </div>
                <p className="empty-line">{copy.chat.empty}</p>
              </div>
              <div className="comp">
                {(pickedAgents.length > 0 || pickedPeople.length > 0) && (
                  <div className="mention" aria-hidden="true">
                    {[
                      ...pickedAgents.slice(0, 2).map((a) => ({
                        key: a.sessionId,
                        name: a.title,
                        agent: true,
                        sub: `${copy.chat.ownersAgent(nameOf(a.ownerId))} · ${statusWord(a.live).toLowerCase()}`,
                        live: a.live,
                      })),
                      ...pickedPeople.slice(0, 1).map((p) => ({
                        key: p.id,
                        name: p.name,
                        agent: false,
                        sub: copy.chat.person,
                        live: null,
                      })),
                    ].map((it, i) => (
                      <div className={`it${i === 0 ? " on" : ""}`} key={it.key}>
                        {it.agent ? (
                          <AgentTile
                            id={it.key}
                            title={it.name}
                            status={it.live}
                            size="xs"
                            withDot={false}
                          />
                        ) : (
                          <span className="avatar xs">{initials(it.name)}</span>
                        )}
                        <span className="nm">{it.name}</span>
                        <span className="s">{it.sub}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="line">
                  {pickedAgents[0] ? (
                    <>
                      <span className="m">@{pickedAgents[0].title.slice(0, 1)}</span>
                      <span className="ph">{pickedAgents[0].title.slice(1)}, …</span>
                    </>
                  ) : (
                    <span className="ph">
                      {copy.chat.placeholder(trimmed || copy.chat.nameHint)}
                    </span>
                  )}
                </div>
                <div className="row">
                  <span className="ph small">{copy.chat.placeholderMention}</span>
                  <span className="send" aria-hidden="true">
                    <Icon d={ICONS.send} size={14} />
                  </span>
                </div>
              </div>
            </div>
            <div className="facts">
              <div className="fact">
                <Icon d={ICONS.columns} size={14} />
                <span>
                  <b>{scopeWord}</b> {copy.chat.factFind(scopeWord).slice(scopeWord.length + 1)}
                </span>
              </div>
              <div className="fact">
                <Icon d={ICONS.handoff} size={14} />
                <span>
                  {copy.chat.factMentionA}
                  <i>@{pickedAgents[0]?.title ?? copy.chat.previewAgentName}</i>
                  {copy.chat.factMentionB}
                  <i>
                    {pickedAgents[0]
                      ? copy.chat.ownersAgent(nameOf(pickedAgents[0].ownerId))
                      : copy.chat.ownersAgent(meName)}
                  </i>
                  {copy.chat.factMentionC}
                </span>
              </div>
              <div className="fact">
                <Icon d={ICONS.memory} size={14} />
                <span>{copy.chat.factKept(orgName)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export { joinNames };
