/**
 * The rail: the team's roster, drawn once and used by every page (design/henosis SCREENS.md §1,
 * SYSTEM.md §6). Order: brand · New session on the one gradient · Search (⌘K) · Inbox and
 * Approvals with counts · AGENTS by project, crews first, every card titled by its session ·
 * the project section (Overview, Groups, Memory) · Chats with unread · the me row last.
 * Below 1180 px it folds to 72 px of icons and avatars with a hover card beside the stream
 * (breakpoints.ts, with 40 px of hysteresis so a resize never flaps it); on a phone it is the
 * drawer behind the menu button. `[` and `]` fold and unfold it, and that choice is kept.
 */
import { compactTokens, formatTokens } from "@henosis/kernel";
import { usageTotal } from "@henosis/protocol";
import {
  type CSSProperties,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ShellContext } from "./App.js";
import { api, type Me, type SessionRow } from "./api.js";
import { pendingOf } from "./approvalsQueue.js";
import { useFrame } from "./breakpoints.js";
import { useChatUnread } from "./chat.js";
import { copy } from "./copy.js";
import { railCard } from "./council.js";
import { clearIdentity, type Identity } from "./identity.js";
import { useInbox } from "./inbox.js";
import { notifyPermission, requestNotifications } from "./notify.js";
import { hotkeyLabel, openPalette, publishSidebarSessions } from "./palette.js";
import { useRecents } from "./recents.js";
import { navigate, paths, type Route } from "./router.js";
import { MemoryResults, matchSession, needleOf, searchKeys, useMemorySearch } from "./search.js";
import { isDesktop } from "./shell.js";
import { isTyping, type TargetLike } from "./shortcuts.js";
import { type Theme, useMotion, useTeamThemeValue, useTheme } from "./theme.js";
import {
  type AgentRow,
  Avatar,
  doingOf,
  ICONS,
  Icon,
  Mark,
  markLook,
  Stack,
  TeamPill,
  teamOf,
} from "./ui.js";
import { UpdateRow } from "./update.js";

/**
 * team-theme: the team a route belongs to. A project or a session of a project is in that
 * project's team; the team page is its own; the inbox, memory, settings and home are nobody's.
 */
export function teamOfRoute(route: Route, me: Me | null): string | null {
  if (route.name === "management") return route.teamId;
  if (route.name === "fleet" || route.name === "session")
    return me?.projects.find((p) => p.projectId === route.projectId)?.teamId ?? null;
  return null;
}

// ---- collapsed or not: the frame decides below 1180 (with hysteresis), the person's choice wins ----

const RAIL_KEY = "henosis.rail";
type RailPref = "collapsed" | "expanded" | null;

function readRailPref(): RailPref {
  try {
    const v = localStorage.getItem(RAIL_KEY);
    return v === "collapsed" || v === "expanded" ? v : null;
  } catch {
    return null;
  }
}

// One store, shared by the rail and the Shell's `[` and `]` (shortcuts.ts), so the choice is
// made in one place and outlives the tab.
let railPref: RailPref = readRailPref();
const railListeners = new Set<() => void>();
function subscribeRailPref(fn: () => void): () => void {
  railListeners.add(fn);
  return () => {
    railListeners.delete(fn);
  };
}
function readPref(): RailPref {
  return railPref;
}

/** Pins the rail folded or open; the width decides until this is called. */
export function pinRail(pref: "collapsed" | "expanded"): void {
  railPref = pref;
  try {
    localStorage.setItem(RAIL_KEY, pref);
  } catch {
    // private mode: the choice lasts for this page
  }
  for (const fn of railListeners) fn();
}

function useRailCollapsed(): [boolean, () => void] {
  const frame = useFrame();
  const phone = frame === "phone";
  const narrow = frame !== "full";
  const pref = useSyncExternalStore(subscribeRailPref, readPref, () => null);
  const collapsed = !phone && (pref ? pref === "collapsed" : narrow);
  const toggle = useCallback(() => pinRail(collapsed ? "expanded" : "collapsed"), [collapsed]);
  return [collapsed, toggle];
}

/** `n` opens a new session when nobody is typing; `[` and `]` are the Shell's (shortcuts.ts). */
function useRailKeys(newHref: string): void {
  const ref = useRef(newHref);
  ref.current = newHref;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      if (isTyping(e.target as TargetLike | null)) return;
      if (e.key !== "n") return;
      navigate(ref.current);
      e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
}

// ---- the rail ----------------------------------------------------------------------------------

/** Memoised: it polls on its own, so a stream event in the main column should not redraw the rail. */
export const Rail = memo(function Rail({
  ctx,
  open,
  onClose,
}: {
  ctx: ShellContext;
  open: boolean;
  onClose: () => void;
}) {
  const { route, identity, me } = ctx;
  const [q, setQ] = useState("");
  const recents = useRecents();
  const inbox = useInbox(identity?.userId ?? null);
  const projects = me?.projects ?? [];
  const sessions = useProjectSessions(
    projects.map((p) => p.projectId),
    route,
  );
  const needle = needleOf(q);
  const hit = (...xs: (string | undefined)[]) =>
    !needle || xs.some((x) => x?.toLowerCase().includes(needle));
  // session-search: owner and goal matching, team memory after two characters, keyboard.
  const searchInput = useRef<HTMLInputElement>(null);
  const listsRef = useRef<HTMLDivElement>(null);
  const memoryHits = useMemorySearch(me, needle);
  const matchRow = (s: SessionRow) =>
    s.open && matchSession(s, needle, me?.user?.id === s.ownerId ? me.user.name : undefined);
  const activeSession = route.name === "session" ? route.sessionId : null;
  const activeProject = route.name === "fleet" ? route.projectId : null;
  const activeTeam = route.name === "management" ? route.teamId : null;
  const activeMemory = route.name === "memory" ? route.orgId : null;
  const activeGroup = route.name === "chat" ? route.groupId : null;
  const activeCouncil = route.name === "chat" ? route.councilId : null;
  const activeGroups = route.name === "chat" && !route.groupId && !route.newGroup;
  // team-theme: the mark wears the current team's style and emblem.
  const look = useTeamThemeValue(identity ? teamOfRoute(route, me) : null);
  const teams = useMemo(() => {
    const out = new Map<string, { id: string; name: string; projects: typeof projects }>();
    for (const p of projects) {
      const t = out.get(p.teamId) ?? { id: p.teamId, name: p.teamName, projects: [] };
      t.projects.push(p);
      out.set(p.teamId, t);
    }
    return [...out.values()];
  }, [projects]);
  const firstProject = projects[0]?.projectId ?? "default";
  // memory-browser: one "Memory" item per org (the default org when none is known).
  const orgs = useMemo(() => {
    const out = new Map<string, string>();
    for (const p of projects) out.set(p.orgId, p.orgName);
    if (out.size === 0) out.set("default", "Default org");
    return [...out.entries()];
  }, [projects]);
  // groups-chats: the person's groups across their orgs, with unread counts, polled quietly.
  const chats = useChatUnread(
    orgs.map(([id]) => id),
    identity?.userId ?? null,
  );
  const firstOrg = orgs[0]?.[0] ?? "default";
  const allRows = Object.values(sessions).flat();
  const listed = new Set(allRows.filter((r) => r.open).map((r) => r.sessionId));
  const recentsShown = recents.filter((r) => !listed.has(r.sessionId) && hit(r.title, r.sessionId));
  const nothingMatches =
    Boolean(needle) &&
    recentsShown.length === 0 &&
    !projects.some((p) => hit(p.name, p.projectId)) &&
    !allRows.some(matchRow);
  // hook: approvals-queue — approvals waiting across every listed project
  const waiting = allRows.reduce((n, r) => n + pendingOf(r), 0);
  const newHref = paths.fleet(firstProject) + (identity ? "?new=1" : "");
  const [collapsed, toggleCollapsed] = useRailCollapsed();
  useRailKeys(newHref);
  const nameOf = (s: SessionRow) => (id: string) =>
    me?.user?.id === id ? copy.roles.you : (nameOfMember(s, id) ?? id);
  // the me row: what I am driving, and my role on the project I am in
  const mine = identity ? allRows.find((r) => r.open && isDriving(r, identity.userId)) : null;
  const role = identity ? roleOf(allRows, identity.userId) : null;
  // the team I am in: the drawer's "who · where" line and the account menu's Team look row
  const whereName = teams[0]?.name ?? projects[0]?.name ?? null;
  let cardIndex = 0;
  const projectBlocks = teams.flatMap((t) =>
    t.projects.map((p) => {
      const rows = (sessions[p.projectId] ?? []).filter(matchRow);
      if (!hit(p.name, p.projectId) && rows.length === 0) return null;
      const groups = groupByCrew(rows);
      const crewCount = groups.filter(([c]) => c !== null).length;
      const soloCount = groups.find(([c]) => c === null)?.[1].length ?? 0;
      return (
        <div key={p.projectId} className="project-block">
          <a
            className={`item project${activeProject === p.projectId ? " active" : ""}`}
            href={paths.fleet(p.projectId)}
          >
            <Icon d={ICONS.project} size={15} />
            <span className="lbl serif">{p.name}</span>
            <span className="hint">
              {rows.length ? copy.shell.crewsAndSolos(crewCount, soloCount) : ""}
            </span>
          </a>
          {groups.map(([crew, members]) => (
            <div key={crew ?? "_solo"} className={crew ? "crew-block" : "solo-block"}>
              {crew && <CrewHeader name={crew} people={peopleOf(members, identity?.userId)} />}
              {members.map((s) => (
                <AgentCard
                  key={s.sessionId}
                  row={s}
                  href={paths.session(p.projectId, s.sessionId)}
                  active={activeSession === s.sessionId}
                  index={cardIndex++}
                  nameOf={nameOf(s)}
                />
              ))}
            </div>
          ))}
        </div>
      );
    }),
  );
  // the collapsed rail: one avatar per agent, in the same order
  const agentSquares = teams.flatMap((t) =>
    t.projects.flatMap((p) => {
      const rows = (sessions[p.projectId] ?? []).filter((r) => r.open);
      if (rows.length === 0) return [];
      return [
        <a
          key={`p:${p.projectId}`}
          className={`sq${activeProject === p.projectId ? " active" : ""}`}
          href={paths.fleet(p.projectId)}
          title={p.name}
          aria-label={p.name}
        >
          <span className="initial">{p.name.trim().charAt(0).toUpperCase() || "?"}</span>
        </a>,
        ...groupByCrew(rows).flatMap(([, members]) =>
          members.map((s) => (
            <AgentSquare
              key={s.sessionId}
              row={s}
              href={paths.session(p.projectId, s.sessionId)}
              active={activeSession === s.sessionId}
              nameOf={nameOf(s)}
            />
          )),
        ),
      ];
    }),
  );
  return (
    <>
      {open && (
        <button
          type="button"
          className="scrim"
          aria-label={copy.shell.closeMenu}
          onClick={onClose}
        />
      )}
      <nav
        className={`sidebar rail${open ? " open" : ""}${collapsed ? " collapsed" : ""}`}
        aria-label={copy.shell.sidebar}
        onKeyDown={(e) =>
          searchKeys(e, {
            clear: () => setQ(""),
            input: searchInput.current,
            lists: listsRef.current,
          })
        }
      >
        <div className="brand-row">
          <a className="brand" href={paths.home()}>
            <Mark size={24} settle {...markLook(look?.mark)} emblem={look?.emblem} />
            <span className="serif wordmark">{copy.product}</span>
            {look?.emblem && (
              <span className="emblem" title={copy.shell.teamEmblem}>
                {look.emblem}
              </span>
            )}
          </a>
          <button
            type="button"
            className="fold"
            title={collapsed ? copy.shell.expand : copy.shell.collapse}
            aria-label={collapsed ? copy.shell.expand : copy.shell.collapse}
            aria-expanded={!collapsed}
            onClick={toggleCollapsed}
          >
            <Icon d={collapsed ? ICONS.expand : ICONS.collapse} size={15} />
          </button>
          {/* the phone drawer's close sits in the one header, beside the brand */}
          <button type="button" className="x" aria-label={copy.shell.closeRail} onClick={onClose}>
            <Icon d={ICONS.close} size={15} />
          </button>
        </div>
        {/* the phone drawer's "who · where" line, under the header */}
        {identity && (
          <div className="sys">
            <span className="who">
              <span className="serif">{identity.name}</span>
              {whereName && <span className="where"> · {whereName}</span>}
            </span>
          </div>
        )}
        <a className="new" href={newHref} title={copy.shell.newSessionKey}>
          <Icon d={ICONS.plus} />
          <span className="lbl">{copy.shell.newSession}</span>
        </a>
        <label className="search" title={copy.shell.searchOrJump}>
          <Icon d={ICONS.search} size={15} />
          <input
            ref={searchInput}
            type="search"
            placeholder={copy.shell.searchOrJump}
            aria-label={copy.shell.searchSessions}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="button" className="kbd" title="Commands" onClick={openPalette}>
            {hotkeyLabel()}
          </button>
        </label>
        {identity && (
          <RailItem
            href={paths.inbox()}
            icon={ICONS.inbox}
            active={route.name === "inbox"}
            count={inbox.unread}
            className="inbox"
          >
            {copy.shell.inbox}
          </RailItem>
        )}
        {identity && (
          <RailItem
            href={paths.approvals()}
            icon={ICONS.approve}
            active={route.name === "approvals"}
            count={waiting}
            className="inbox"
          >
            {copy.shell.approvals}
          </RailItem>
        )}
        <div className="lists" ref={listsRef}>
          {identity && teams.length > 0 && (
            <div className="section rail-section">
              {copy.shell.agents}
              <span className="n">{listed.size ? copy.shell.live(listed.size) : ""}</span>
            </div>
          )}
          {collapsed ? (
            agentSquares
          ) : (
            <>
              {projectBlocks}
              {identity && teams.length > 0 && listed.size === 0 && !needle && (
                <p className="rail-empty">
                  <span className="dot idle" />
                  <span>{copy.shell.noAgents}</span>
                </p>
              )}
            </>
          )}
          {identity && teams.length === 0 && (
            <RailItem
              href={paths.management("default")}
              icon={ICONS.overview}
              active={activeTeam === "default"}
            >
              {copy.shell.defaultTeam}
            </RailItem>
          )}
          {identity &&
            teams.map((t) => (
              <div key={t.id} className="project-section">
                <div className="section rail-section">{t.name}</div>
                <RailItem
                  href={paths.management(t.id)}
                  icon={ICONS.overview}
                  active={activeTeam === t.id}
                >
                  {copy.shell.overview}
                </RailItem>
              </div>
            ))}
          {identity && (
            <RailItem
              href={paths.chat(firstOrg)}
              icon={ICONS.group}
              active={activeGroups}
              count={chats.total}
            >
              {copy.shell.groups}
            </RailItem>
          )}
          {identity &&
            orgs.map(([id, name]) => (
              <RailItem
                key={id}
                href={paths.memory(id)}
                icon={ICONS.memory}
                active={activeMemory === id}
              >
                {orgs.length > 1 ? copy.shell.orgMemory(name) : copy.shell.memory}
              </RailItem>
            ))}
          {identity && (
            <div className="section rail-section">
              {copy.shell.chats}
              <span className="n">{chats.total || ""}</span>
            </div>
          )}
          {identity &&
            orgs.map(([id, name]) =>
              (chats.byOrg[id]?.groups ?? [])
                .filter((g) => hit(g.name, g.purpose))
                .map((g) => (
                  <div key={`${id}/${g.groupId}`}>
                    <a
                      className={`item chatrow${activeGroup === g.groupId && !activeCouncil ? " active" : ""}`}
                      href={paths.chat(id, g.groupId)}
                      title={orgs.length > 1 ? copy.shell.orgChats(name) : g.purpose}
                    >
                      <span className="lbl ellipsis">
                        <span className="hash">#</span>
                        {g.name}
                      </span>
                      {g.unread > 0 && <span className="count">{cap(g.unread)}</span>}
                    </a>
                    {/* the council (docs/19_council.md): a live card under its group, the concluded ones only while open */}
                    {(g.councils ?? [])
                      .filter((c) => c.status !== "concluded" || c.councilId === activeCouncil)
                      .slice(0, 3)
                      .map((c) => (
                        <a
                          key={c.councilId}
                          className={`agent enter council${activeCouncil === c.councilId ? " active" : ""}${collapsed ? " compact" : ""}`}
                          href={paths.council(id, g.groupId, c.councilId)}
                          title={c.task}
                          aria-current={activeCouncil === c.councilId ? "page" : undefined}
                          style={{ "--i": cardIndex++ } as CSSProperties}
                        >
                          <span className="head">
                            <span
                              className={`dot ${c.status === "concluded" ? "closed" : "running"}`}
                            />
                            <span className="t">{c.task}</span>
                          </span>
                          <span className="doing">{railCard(c)}</span>
                        </a>
                      ))}
                  </div>
                )),
            )}
          {identity && (
            <a
              className={`item chatrow new-group${route.name === "chat" && route.newGroup ? " active" : ""}`}
              href={paths.newGroup(firstOrg)}
              title={copy.shell.newGroup}
            >
              <Icon d={ICONS.plus} size={14} />
              <span className="lbl">{copy.shell.newGroup}</span>
            </a>
          )}
          {recentsShown.length > 0 && (
            <div className="section rail-section">{copy.shell.recents}</div>
          )}
          {recentsShown.map((r) => (
            <a
              key={`${r.projectId}/${r.sessionId}`}
              className={`item recent${activeSession === r.sessionId ? " active" : ""}`}
              href={paths.session(r.projectId, r.sessionId)}
              title={r.title || r.sessionId}
            >
              <Icon d={ICONS.session} size={14} />
              <span className="lbl">{r.title || r.sessionId}</span>
            </a>
          ))}
          {nothingMatches && <p className="item faint">No sessions match.</p>}
          {identity && <MemoryResults hits={memoryHits} needle={needle} />}
        </div>
        {/* Desktop shell only: "Restart to update" once a newer build is downloaded. */}
        <UpdateRow />
        <MeRow
          identity={identity}
          route={route}
          driving={mine?.title || mine?.sessionId || null}
          role={role}
          where={whereName}
          collapsed={collapsed}
        />
      </nav>
    </>
  );
});

/** One row, four states: rest, hover, active (the wash with the inset hairline), focus. */
function RailItem({
  href,
  icon,
  active = false,
  count = 0,
  hint,
  className = "",
  children,
}: {
  href: string;
  icon: string;
  active?: boolean;
  /** Absent at zero; the only solid apricot in the rail: something waits for you. */
  count?: number;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  const label = typeof children === "string" ? children : undefined;
  return (
    <a
      className={`item${className ? ` ${className}` : ""}${active ? " active" : ""}`}
      href={href}
      title={label}
      aria-current={active ? "page" : undefined}
    >
      <Icon d={icon} size={15} />
      <span className="lbl">{children}</span>
      {hint && <span className="hint">{hint}</span>}
      {count > 0 && <span className="count">{cap(count)}</span>}
    </a>
  );
}

/** The crew's line above its cards: a 9 px hollow apricot ring, the name in serif, who is in it. */
function CrewHeader({ name, people }: { name: string; people: string[] }) {
  return (
    <div className="crew">
      <span className="serif">{name}</span>
      <span className="faint">{copy.shell.crewOf(people)}</span>
    </div>
  );
}

/** 99+ cap, mono; a count never shows at zero (the caller checks). */
function cap(n: number): string {
  return n > 99 ? "99+" : String(n);
}

// ---- the agent card ---------------------------------------------------------------------------

/** The status the dot and the lead word agree on: closed once the session is not open. */
function statusOf(row: AgentRow): string {
  if (!row.open) return "closed";
  const s = row.live ?? row.report?.status ?? "idle";
  return s === "cancelled" ? "closed" : s;
}

/**
 * The agent card: one component for the rail, the phone drawer and the collapsed rail's hover
 * card. Head = 8 px status dot · serif session title · the pending count or the Team/Solo pill;
 * `.doing` = italic serif lead + plain tail clamped at two lines; foot = the stack capped at
 * three with the driver ringed, "with Bo", and spend in mono with a 2 px hairline against the
 * plan's estimate that warms past 80 % and goes red past 100 %.
 */
export function AgentCard({
  row,
  href,
  active,
  nameOf,
  index = 0,
  compact = false,
}: {
  row: AgentRow;
  href: string;
  active: boolean;
  nameOf: (id: string) => string;
  /** Position in the rail: staggers the slide-and-fade entrance (`.agent.enter`, `--i`). */
  index?: number;
  /** One doing line (the phone drawer, the hover card). */
  compact?: boolean;
}) {
  const status = statusOf(row);
  const d = doingOf(row);
  const t = teamOf(row);
  const online = row.people.filter((p) => p.online);
  const withNames = t.with.map((p) => p.name);
  const tokens = usageTotal(row.report?.usage);
  const budget = row.report?.plan?.estTokens ?? 0;
  const spent = budget > 0 ? tokens / budget : null;
  const tone = spent === null ? "" : spent > 1 ? " over" : spent >= 0.8 ? " warn" : "";
  // the same rule as approvalsQueue's pendingOf, on the looser AgentRow shape
  const reported = row.report?.pendingApprovals ?? 0;
  const pending = !row.open
    ? 0
    : row.live === "awaiting_approval"
      ? Math.max(1, reported)
      : row.live
        ? 0
        : reported;
  return (
    <a
      className={`agent enter${active ? " active" : ""}${compact ? " compact" : ""}`}
      href={href}
      title={row.sessionId}
      aria-current={active ? "page" : undefined}
      style={{ "--i": index } as CSSProperties}
    >
      <span className="head">
        <span className={`dot ${status}`} />
        <span className="t">{row.title || row.sessionId}</span>
        {pending > 0 && (
          <span className="count sm" title="Approvals waiting" key={pending}>
            {cap(pending)}
          </span>
        )}
        <TeamPill row={row} />
      </span>
      <span className="doing">
        <i>{d.lead}</i> {d.text}
      </span>
      <span className="foot">
        {online.length > 0 && (
          <Stack max={3}>
            {online.map((p) => (
              <Avatar key={p.id} id={p.id} name={p.name} size="xs" driver={p.driving} />
            ))}
          </Stack>
        )}
        <span className="with">
          {t.with.length ? `with ${withNames.join(", ")}` : nameOf(row.ownerId)}
        </span>
        {tokens > 0 && (
          <span
            className={`tokens mono${tone}`}
            title={copy.usage.chip(formatTokens(tokens))}
            style={
              spent === null
                ? undefined
                : ({ "--spent": `${Math.min(100, Math.round(spent * 100))}%` } as CSSProperties)
            }
          >
            {compactTokens(tokens)}
            {spent !== null && <i />}
          </span>
        )}
      </span>
    </a>
  );
}

// ---- the collapsed rail: avatars with the dot at the corner, the card on a 400 ms rest ------

function AgentSquare({
  row,
  href,
  active,
  nameOf,
}: {
  row: AgentRow;
  href: string;
  active: boolean;
  nameOf: (id: string) => string;
}) {
  const [card, setCard] = useState<{ top: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLAnchorElement>(null);
  const status = statusOf(row);
  const driver = row.people.find((p) => p.online && p.driving) ?? row.people[0];
  const name = driver?.name ?? row.title ?? row.sessionId;
  const place = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    // beside the rail at the avatar's height, clamped to the window so it never leaves the screen
    const h = 96;
    const clamp = (y: number) => Math.max(8, Math.min(innerHeight - h - 8, y));
    let top = clamp(r.top + r.height / 2 - h / 2);
    // never over the live message (desktop-compact's one fix): when the card would sit on the
    // stream's last message, it drops below it, or rises above it when there is no room below
    const live = liveMessageRect();
    if (live && top < live.bottom + 6 && top + h > live.top - 6) {
      const below = clamp(live.bottom + 8);
      top = below + h <= innerHeight - 8 && below > live.bottom ? below : clamp(live.top - h - 8);
    }
    setCard({ top });
  };
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const rest = () => {
    clear();
    timer.current = setTimeout(place, 400);
  };
  const leave = () => {
    clear();
    setCard(null);
  };
  // a pending rest must not open the card after the square has gone
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const t = teamOf(row);
  const d = doingOf(row);
  const tokens = usageTotal(row.report?.usage);
  const title = `${row.title || row.sessionId} · ${t.with.length ? `${name}, with ${t.with.map((p) => p.name).join(", ")}` : nameOf(row.ownerId)}`;
  return (
    <a
      ref={ref}
      className={`sq av${active ? " active" : ""}`}
      href={href}
      title={title}
      aria-label={title}
      aria-current={active ? "page" : undefined}
      onMouseEnter={rest}
      onMouseLeave={leave}
      onFocus={place}
      onBlur={leave}
    >
      <Avatar
        id={driver?.id ?? row.sessionId}
        name={name}
        size={32}
        driver={Boolean(driver?.driving)}
      />
      <i className={`st dot ${status}`} />
      {card && (
        <span className="hcard" style={{ top: card.top }} role="tooltip">
          <span className="t">
            <span className="serif">{row.title || row.sessionId}</span>
            <TeamPill row={row} />
          </span>
          <span className="doing">
            <i>{d.lead}</i> {d.text}
          </span>
          <span className="foot">
            <span>
              {t.with.length ? `with ${t.with.map((p) => p.name).join(", ")}` : nameOf(row.ownerId)}
            </span>
            {tokens > 0 && <span className="tokens">{compactTokens(tokens)}</span>}
          </span>
        </span>
      )}
    </a>
  );
}

/** The stream's last message or notice on screen: the live one the hover card must not cover. */
function liveMessageRect(): DOMRect | null {
  try {
    const rows = document.querySelectorAll(".main .msg, .main .notice");
    const last = rows[rows.length - 1];
    if (!last) return null;
    const r = last.getBoundingClientRect();
    return r.height > 0 && r.bottom > 0 && r.top < innerHeight ? r : null;
  } catch {
    return null;
  }
}

// ---- the me row and the account menu ------------------------------------------------------

function MeRow({
  identity,
  route,
  driving,
  role,
  where,
  collapsed,
}: {
  identity: Identity | null;
  route: Route;
  driving: string | null;
  role: string | null;
  where: string | null;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const motion = useMotion();
  const [perm, setPerm] = useState(notifyPermission());
  if (!identity)
    return (
      <a className="me" href={paths.home()}>
        <Avatar id="anon" name="?" missing title={copy.shell.signIn} />
        <span className="meta">
          <span className="serif">{copy.shell.signIn}</span>
        </span>
      </a>
    );
  const themeOpt = (t: Theme, label: string) => (
    <button
      type="button"
      className={`chip${theme === t ? " on" : ""}`}
      aria-pressed={theme === t}
      onClick={() => setTheme(t)}
    >
      {label}
    </button>
  );
  const roleWord = role ?? copy.shell.member;
  return (
    <div className="me-wrap">
      {open && (
        <div className="menu" role="menu" aria-label={copy.account.menu}>
          <div className="mrow">
            <Icon d={ICONS.sun} size={15} />
            <span className="lbl">{copy.account.theme}</span>
            <span className="seg">
              {themeOpt("system", copy.account.themeAuto)}
              {themeOpt("light", copy.account.themeLight)}
              {themeOpt("dark", copy.account.themeDark)}
            </span>
          </div>
          <div className="mrow">
            <Icon d={ICONS.bell} size={15} />
            <span className="lbl">{copy.account.notifications}</span>
            {perm === "granted" && (
              <span className="hint">
                {isDesktop() ? copy.account.notifyOnDesktop : copy.account.notifyShort}
              </span>
            )}
            {perm === "denied" && <span className="hint">{copy.account.notifyBlocked}</span>}
            {perm === "unsupported" && (
              <span className="hint">{copy.account.notifyUnsupported}</span>
            )}
            {perm === "default" && (
              <button
                type="button"
                className="btn sm"
                onClick={() => {
                  requestNotifications().then(setPerm);
                }}
              >
                {copy.account.notifyTurnOn}
              </button>
            )}
          </div>
          <a className="mrow" href={paths.settings()} onClick={() => setOpen(false)}>
            <Icon d={ICONS.pause} size={15} />
            <span className="lbl">{copy.account.calm}</span>
            <span className="hint">{motion === "calm" ? copy.account.on : copy.account.off}</span>
          </a>
          <a className="mrow" href={paths.settings()} onClick={() => setOpen(false)}>
            <Icon d={ICONS.settings} size={15} />
            <span className="lbl">{copy.account.teamLook}</span>
            {where && <span className="hint">{where}</span>}
          </a>
          <a className="mrow" href={paths.settings()} onClick={() => setOpen(false)}>
            <Icon d={ICONS.constrain} size={15} />
            <span className="lbl">{copy.account.settings}</span>
          </a>
          <button
            type="button"
            className="mrow"
            onClick={() => {
              setOpen(false);
              dispatchEvent(new Event("henosis:shortcuts"));
            }}
          >
            <Icon d={ICONS.plan} size={15} />
            <span className="lbl">{copy.account.shortcuts}</span>
            <span className="hint mono">?</span>
          </button>
          {route.name === "session" && (
            // export-session hook: the session menu's Export action
            <a
              className="mrow"
              href={api.exportUrl(route.sessionId)}
              target="_blank"
              rel="noopener"
              onClick={() => setOpen(false)}
            >
              <Icon d={ICONS.export} size={15} />
              <span className="lbl">{copy.account.exportMarkdown}</span>
            </a>
          )}
          <div className="hr" />
          <a className="mrow" href={paths.home()} onClick={() => setOpen(false)}>
            <Icon d={ICONS.person} size={15} />
            <span className="lbl">{copy.account.changeIdentity}</span>
          </a>
          <button
            type="button"
            className="mrow"
            onClick={() => {
              clearIdentity();
              setOpen(false);
            }}
          >
            <Icon d={ICONS.handoff} size={15} />
            <span className="lbl">{copy.account.signOut}</span>
          </button>
        </div>
      )}
      <button
        type="button"
        className="me"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={collapsed ? `${identity.name} · ${copy.account.menu}` : undefined}
        title={collapsed ? `${identity.name} · ${roleWord}` : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar
          id={identity.userId}
          name={identity.name}
          size={collapsed ? 32 : 30}
          driver={Boolean(driving)}
        />
        <span className="meta">
          <span className="serif ellipsis">{identity.name}</span>
          <span className="role ellipsis">
            {driving ? (
              <>
                {roleWord} · {copy.shell.driving} <i className="serif">{driving}</i>
              </>
            ) : (
              <>
                {where ?? copy.product} · {roleWord}
              </>
            )}
          </span>
        </span>
        <Icon d={ICONS.dots} size={14} className="dots" />
      </button>
    </div>
  );
}

// ---- data helpers --------------------------------------------------------------------------

/** Crewed sessions first, grouped under their crew; solo sessions after, under no header. */
export function groupByCrew(rows: SessionRow[]): [string | null, SessionRow[]][] {
  const crews = new Map<string, SessionRow[]>();
  const solo: SessionRow[] = [];
  for (const r of rows) {
    if (r.crew) crews.set(r.crew, [...(crews.get(r.crew) ?? []), r]);
    else solo.push(r);
  }
  const out: [string | null, SessionRow[]][] = [...crews.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  if (solo.length) out.push([null, solo]);
  return out;
}

/** The owner's name as the session's people list knows it (they may be offline). */
function nameOfMember(row: SessionRow, id: string): string | undefined {
  return row.people.find((p) => p.id === id)?.name;
}

/** The people in a crew's sessions, the person reading first as "you", each once. */
function peopleOf(rows: SessionRow[], meId: string | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows)
    for (const p of r.people) {
      if (!p.online || seen.has(p.id)) continue;
      seen.add(p.id);
      if (p.id === meId) out.unshift(copy.roles.you);
      else out.push(p.name);
    }
  return out;
}

function isDriving(row: SessionRow, userId: string): boolean {
  return row.people.some((p) => p.id === userId && p.driving);
}

/** My role as the sessions report it: the first session I am in names it. */
function roleOf(rows: SessionRow[], userId: string): string | null {
  for (const r of rows) {
    const p = r.people.find((x) => x.id === userId);
    if (p?.role) return p.role;
  }
  return null;
}

/** Open sessions per project for the rail; refetched whenever the route changes. */
function useProjectSessions(ids: string[], route: Route): Record<string, SessionRow[]> {
  const [out, setOut] = useState<Record<string, SessionRow[]>>({});
  const key = `${ids.join(",")}|${JSON.stringify(route)}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` names the projects and the route
  useEffect(() => {
    let alive = true;
    const load = () =>
      Promise.all(
        ids.map((id) =>
          api
            .sessions(id)
            .then((rows) => [id, rows] as const)
            .catch(() => [id, []] as const),
        ),
      ).then((pairs) => {
        if (!alive) return;
        const rows = Object.fromEntries(pairs);
        setOut(rows);
        publishSidebarSessions(rows); // hook point (command-palette)
      });
    load();
    // A session registers a moment after its page opens; look again shortly, then now and then.
    const soon = setTimeout(load, 1500);
    const every = setInterval(load, 8_000);
    addEventListener("focus", load);
    addEventListener("henosis:fleet", load);
    return () => {
      alive = false;
      clearTimeout(soon);
      clearInterval(every);
      removeEventListener("focus", load);
      removeEventListener("henosis:fleet", load);
    };
  }, [key]);
  return out;
}
