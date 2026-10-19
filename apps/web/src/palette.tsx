/**
 * The command palette: ⌘K / Ctrl+K lifts one lit surface over the page behind a navy scrim.
 * Five groups in one fixed order answer the five questions a person has mid-session: Actions
 * (on this session), Switch session, Go to, People and agents (on what matched), Team memory.
 * Views register the actions that belong to their page with `usePaletteActions`; the sidebar
 * publishes the sessions it lists with `publishSidebarSessions`; memory comes from
 * /api/memory/:org when the palette opens. Matches are drawn as weight and ink, never a
 * background; ↵ appears only on the highlighted row. Everything is keyboard-first.
 */
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ShellContext } from "./App.js";
import { api, type EntryRecord, type Me, type SessionRow } from "./api.js";
import { DEFAULT_RATING, pendingOf } from "./approvalsQueue.js";
import { copy } from "./copy.js";
import { fuzzyScore, matchSpans } from "./fuzzy.js";
import { useRecents } from "./recents.js";
import { navigate, paths } from "./router.js";
import { setTheme, useTheme } from "./theme.js";
import { attribLine, ICONS, Icon, Mark, Status } from "./ui.js";

export { fuzzyScore };

// ---- actions that pages register -------------------------------------------------------

export interface PaletteAction {
  id: string;
  label: string;
  /** A quiet grey word on the right: "session", "project"... */
  hint?: string;
  icon?: string;
  /** When set, picking the action asks for one line of text first (the placeholder). */
  prompt?: string;
  /** With `prompt`: Enter on an empty line runs it anyway (a rating prompt sends the default). */
  allowEmpty?: boolean;
  /** A release gate: the row carries the pill and a second line with the rating step. */
  gate?: { code: string; rated: { who: string; rating: number }[] };
  /** A quiet subtitle: who asked, where. */
  sub?: string;
  run: (arg: string) => void;
}

const actionSets = new Map<string, PaletteAction[]>();
const actionListeners = new Set<() => void>();
let actionSnapshot: PaletteAction[] = [];

function publishActions(): void {
  actionSnapshot = [...actionSets.values()].flat();
  for (const fn of actionListeners) fn();
}

/** Register a page's actions under `key` for as long as the component is mounted. */
export function usePaletteActions(key: string, actions: PaletteAction[]): void {
  useEffect(() => {
    actionSets.set(key, actions);
    publishActions();
  }, [key, actions]);
  useEffect(
    () => () => {
      actionSets.delete(key);
      publishActions();
    },
    [key],
  );
}

function useRegisteredActions(): PaletteAction[] {
  return useSyncExternalStore(
    (fn) => {
      actionListeners.add(fn);
      return () => actionListeners.delete(fn);
    },
    () => actionSnapshot,
    () => actionSnapshot,
  );
}

// ---- sessions the sidebar lists ----------------------------------------------------------

const sessionListeners = new Set<() => void>();
let sessionSnapshot: Record<string, SessionRow[]> = {};

/** Hook point for the sidebar: hand the palette the sessions it just loaded. */
export function publishSidebarSessions(rows: Record<string, SessionRow[]>): void {
  sessionSnapshot = rows;
  for (const fn of sessionListeners) fn();
}

function useSidebarSessions(): Record<string, SessionRow[]> {
  return useSyncExternalStore(
    (fn) => {
      sessionListeners.add(fn);
      return () => sessionListeners.delete(fn);
    },
    () => sessionSnapshot,
    () => sessionSnapshot,
  );
}

const openListeners = new Set<() => void>();

/** Open the palette from anywhere (a button, a shell menu); the hotkey does the same. */
export function openPalette(): void {
  for (const fn of openListeners) fn();
}

/** "⌘K" on a Mac, "Ctrl K" elsewhere; for hints next to search fields. */
export function hotkeyLabel(): string {
  try {
    return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";
  } catch {
    return "Ctrl K";
  }
}

// ---- the palette ---------------------------------------------------------------------------

type Kind = "action" | "session" | "go" | "person" | "agent" | "memory";

interface Item {
  id: string;
  kind: Kind;
  /** The text that is matched and drawn; `serif` sets it in the serif (a name). */
  label: string;
  serif?: boolean;
  /** A verb before a serif name: "Open project" + Billing page. */
  lead?: string;
  sub?: string;
  icon?: string;
  avatar?: { text: string; agent?: boolean };
  hint?: string;
  status?: string | null;
  pill?: string;
  two?: { stars: number; text: string };
  action?: PaletteAction;
  go?: string;
}

function truncate(s: string, n: number): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
}

/** The label with the matched letters in weight and ink. */
export function Highlight({
  text,
  needle,
  className,
}: {
  text: string;
  needle: string;
  className?: string;
}) {
  const spans = matchSpans(needle, text);
  return (
    <span className={className}>
      {spans.map((s, i) =>
        s.match ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the spans are positional
          <b className="m" key={i}>
            {s.text}
          </b>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: the spans are positional
          <span key={i}>{s.text}</span>
        ),
      )}
    </span>
  );
}

export function CommandPalette({ ctx }: { ctx: ShellContext }) {
  const { route, identity, me } = ctx;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState<PaletteAction | null>(null);
  const [memory, setMemory] = useState<EntryRecord[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const registered = useRegisteredActions();
  const sidebar = useSidebarSessions();
  const recents = useRecents();
  const [theme] = useTheme();

  // ⌘K / Ctrl+K anywhere toggles; Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    addEventListener("keydown", onKey);
    openListeners.add(onOpen);
    return () => {
      removeEventListener("keydown", onKey);
      openListeners.delete(onOpen);
    };
  }, [open]);

  // Opening resets the query and loads memory for every org this person can see.
  const orgs = useMemo(() => [...new Set((me?.projects ?? []).map((p) => p.orgId))].sort(), [me]);
  const orgKey = orgs.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `orgKey` is the identity of `orgs`
  useEffect(() => {
    if (!open) return;
    setQ("");
    setIndex(0);
    setPending(null);
    setTimeout(() => input.current?.focus(), 0);
    let alive = true;
    Promise.all(orgs.map((org) => api.memory(org).catch(() => null))).then((feeds) => {
      if (!alive) return;
      setMemory(feeds.flatMap((f) => (f ? f.entries : [])).filter((e) => e.status === "active"));
    });
    return () => {
      alive = false;
    };
  }, [open, orgKey]);

  const built = useMemo(
    () =>
      open
        ? itemsFor({ q, route, me, registered, sidebar, recents, memory, theme })
        : { groups: [], total: 0 },
    [open, q, route, me, registered, sidebar, recents, memory, theme],
  );
  const items = built.groups;
  const flat = items.flatMap((g) => g.items);
  const current = flat[Math.min(index, Math.max(0, flat.length - 1))];

  // biome-ignore lint/correctness/useExhaustiveDependencies: keep the highlighted row in view
  useEffect(() => {
    if (!open || !current) return;
    document.getElementById(`palette-${current.id}`)?.scrollIntoView({ block: "nearest" });
  }, [index, open]);

  if (!open || !identity) return null;

  const close = () => setOpen(false);
  const pick = (it: Item | undefined) => {
    if (!it) return;
    if (it.go) {
      navigate(it.go);
      close();
      return;
    }
    const a = it.action;
    if (!a) {
      close();
      return;
    }
    if (a.prompt) {
      setPending(a);
      setQ("");
      setIndex(0);
      setTimeout(() => input.current?.focus(), 0);
      return;
    }
    a.run("");
    close();
  };
  const submitPending = () => {
    if (!pending) return;
    const text = q.trim();
    if (!text && !pending.allowEmpty) return;
    pending.run(text);
    close();
  };
  const nextGroup = (delta: 1 | -1) => {
    if (items.length === 0) return;
    let at = 0;
    let gi = 0;
    for (let i = 0; i < items.length; i++) {
      const n = items[i]?.items.length ?? 0;
      if (index < at + n) {
        gi = i;
        break;
      }
      at += n;
    }
    const target = (gi + delta + items.length) % items.length;
    let start = 0;
    for (let i = 0; i < target; i++) start += items[i]?.items.length ?? 0;
    setIndex(start);
  };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Tab") {
      e.preventDefault();
      nextGroup(e.shiftKey ? -1 : 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (pending) submitPending();
      else pick(current);
    } else if (e.key === "Escape" && pending) {
      e.preventDefault();
      e.stopPropagation();
      setPending(null);
      setQ("");
    }
  };

  // The scope chip: the session the Actions belong to, with its status dot.
  const scope =
    route.name === "session"
      ? (() => {
          const row = (sidebar[route.projectId] ?? []).find((r) => r.sessionId === route.sessionId);
          return {
            title: row?.title || route.title || route.sessionId,
            status: row?.live ?? row?.report?.status ?? null,
          };
        })()
      : null;
  const orgName = me?.projects[0]?.orgName ?? "";
  const needle = q.trim();

  return (
    <>
      <button type="button" className="palette-scrim" aria-label="Close commands" onClick={close} />
      <div className="palette" role="dialog" aria-modal="true" aria-label={copy.palette.label}>
        <div className="handle" aria-hidden="true" />
        <label className="q">
          <Icon d={pending ? pending.icon || ICONS.chevron : ICONS.search} size={17} />
          <input
            ref={input}
            type="text"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={current && !pending ? `palette-${current.id}` : undefined}
            placeholder={pending ? pending.prompt : copy.palette.placeholder}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIndex(0);
            }}
            onKeyDown={onKeyDown}
          />
          {pending ? (
            <span className="scope">
              <span className="serif">{pending.label}</span>
            </span>
          ) : (
            scope && (
              <span className={`scope${scope.status ? ` ${scope.status}` : ""}`}>
                <span className="serif">{scope.title}</span>
              </span>
            )
          )}
          <kbd>{copy.palette.esc}</kbd>
        </label>
        {!pending && (
          <div className="list" id="palette-list" role="listbox" aria-label="Results">
            {flat.length === 0 && <p className="empty">{copy.palette.nothing}</p>}
            {items.map((g) => (
              <div key={g.title}>
                <div className="section">
                  {g.title}
                  <span className="n">{g.items.length}</span>
                  {g.why && <span className="why">{g.why}</span>}
                </div>
                {g.items.map((it) => {
                  const on = current?.id === it.id;
                  return (
                    <button
                      type="button"
                      key={it.id}
                      id={`palette-${it.id}`}
                      role="option"
                      aria-selected={on}
                      className={`row${on ? " on" : ""}${it.two ? " two" : ""}${it.kind === "memory" ? " mem" : ""}`}
                      onClick={() => pick(it)}
                    >
                      {it.avatar ? (
                        <span className={`avatar sm${it.avatar.agent ? " agent" : ""}`}>
                          {it.avatar.agent ? "" : it.avatar.text}
                        </span>
                      ) : (
                        <Icon d={it.icon ?? ICONS.chevron} size={17} />
                      )}
                      <span className="lab">
                        {it.lead && <span>{it.lead} </span>}
                        <Highlight
                          text={it.label}
                          needle={needle}
                          className={it.serif ? "name" : undefined}
                        />
                        {it.sub && (
                          <span className="sub">
                            <Highlight text={it.sub} needle={needle} />
                          </span>
                        )}
                      </span>
                      <span className="right">
                        {it.pill && <span className="pill risk irreversible sm">{it.pill}</span>}
                        {it.status !== undefined ? (
                          <Status status={it.status} />
                        ) : it.hint ? (
                          <span className="hint">{it.hint}</span>
                        ) : null}
                        <span className="enter">
                          <kbd>↵</kbd>
                        </span>
                      </span>
                      {it.two && (
                        <span className="more">
                          {copy.palette.rateFirst}
                          <span className="stars sm" aria-hidden="true">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <span key={n} className={n <= (it.two?.stars ?? 0) ? "on" : ""}>
                                ★
                              </span>
                            ))}
                          </span>
                          {copy.palette.enterSends(DEFAULT_RATING)}
                          {it.two.text && <span className="long"> · {it.two.text}</span>}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        <div className="foot">
          <span className="k">
            <kbd>↑</kbd>
            <kbd>↓</kbd> {copy.palette.move}
          </span>
          <span className="k">
            <kbd>↵</kbd> {copy.palette.run}
          </span>
          {items.length > 1 && (
            <span className="k tab">
              <kbd>⇥</kbd> {copy.palette.nextGroup}
            </span>
          )}
          <span className="k">
            <kbd>esc</kbd> {copy.palette.close}
          </span>
          <span className="brandline">
            <Mark size={16} />
            <span>{copy.palette.across(flat.length, built.total, orgName)}</span>
          </span>
        </div>
      </div>
    </>
  );
}

// ---- what the list holds -------------------------------------------------------------------

interface Group {
  title: string;
  why?: string;
  items: Item[];
}

function itemsFor({
  q,
  route,
  me,
  registered,
  sidebar,
  recents,
  memory,
  theme,
}: {
  q: string;
  route: ShellContext["route"];
  me: Me | null;
  registered: PaletteAction[];
  sidebar: Record<string, SessionRow[]>;
  recents: ReturnType<typeof useRecents>;
  memory: EntryRecord[];
  theme: ReturnType<typeof useTheme>[0];
}): { groups: Group[]; total: number } {
  const projects = me?.projects ?? [];
  const needle = q.trim();
  let total = 0;
  const rank = <T,>(xs: T[], text: (x: T) => string, max: number): T[] => {
    if (!needle) {
      total += Math.min(xs.length, max);
      return xs.slice(0, max);
    }
    const hits = xs
      .map((x) => ({ x, s: fuzzyScore(needle, text(x)) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s);
    total += hits.length;
    return hits.slice(0, max).map((r) => r.x);
  };
  const nameOfProject = (id: string) => projects.find((p) => p.projectId === id)?.name ?? id;

  // Actions: the page's own first, then the ones every page has.
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      (() => {
        try {
          return matchMedia("(prefers-color-scheme: dark)").matches;
        } catch {
          return false;
        }
      })());
  const here =
    route.name === "session" || route.name === "fleet"
      ? projects.find((p) => p.projectId === route.projectId)
      : undefined;
  const waiting = Object.values(sidebar)
    .flat()
    .reduce((n, r) => n + pendingOf(r), 0);
  const global: PaletteAction[] = [
    {
      id: "new-session",
      label: "New session",
      icon: ICONS.plus,
      run: () => navigate(`${paths.fleet(projects[0]?.projectId ?? "default")}?new=1`),
    },
    ...(here && route.name === "session"
      ? [
          {
            id: "open-project",
            label: `Open project ${here.name}`,
            icon: ICONS.branch,
            hint: copy.palette.hints.project,
            run: () => navigate(paths.fleet(here.projectId)),
          },
        ]
      : []),
    ...(here
      ? [
          {
            id: "open-team",
            label: `Open team ${here.teamName}`,
            icon: ICONS.handoff,
            hint: copy.palette.hints.team,
            run: () => navigate(paths.management(here.teamId)),
          },
        ]
      : []),
    {
      id: "approvals",
      label: copy.palette.approvalsQueue,
      icon: ICONS.check,
      hint: copy.palette.hints.page,
      ...(waiting ? { sub: copy.palette.waitingOnYou(waiting) } : {}),
      run: () => navigate(paths.approvals()),
    },
    {
      id: "inbox",
      label: copy.palette.inbox,
      icon: ICONS.inbox,
      hint: copy.palette.hints.page,
      run: () => navigate(paths.inbox()),
    },
    {
      id: "theme",
      label: dark ? "Switch to light theme" : "Switch to dark theme",
      icon: dark ? ICONS.sun : ICONS.moon,
      run: () => setTheme(dark ? "light" : "dark"),
    },
  ];
  const actions: Item[] = rank(
    [...registered, ...global],
    (a) => `${a.label} ${a.sub ?? ""} ${a.hint ?? ""}`,
    needle ? 8 : 6,
  ).map((a) => ({
    id: `a:${a.id}`,
    kind: "action",
    label: a.label,
    icon: a.icon,
    hint: a.hint,
    sub: a.sub,
    action: a,
    ...(a.gate
      ? {
          pill: "irreversible",
          two: {
            stars: a.gate.rated[0]?.rating ?? DEFAULT_RATING,
            text: a.gate.rated.map((r) => copy.palette.alreadyRated(r.who, r.rating)).join(" · "),
          },
        }
      : {}),
  }));
  if (needle)
    actions.push({
      id: "a:search",
      kind: "action",
      label: copy.palette.searchFor(needle),
      icon: ICONS.search,
      hint: copy.palette.hints.page,
      go: paths.search(needle),
    });

  // Sessions: what the sidebar lists, then recents it does not.
  const listed = new Set<string>();
  const sessions: Item[] = [];
  const people = new Map<string, Item>();
  const agents: Item[] = [];
  for (const [projectId, rows] of Object.entries(sidebar)) {
    for (const r of rows) {
      if (!r.open) continue;
      listed.add(r.sessionId);
      const title = r.title || r.sessionId;
      const ownerName = r.people.find((p) => p.id === r.ownerId)?.name ?? r.ownerId;
      sessions.push({
        id: `s:${projectId}/${r.sessionId}`,
        kind: "session",
        label: title,
        serif: true,
        sub: `${ownerName}'s agent · ${nameOfProject(projectId)}`,
        avatar: { text: "", agent: true },
        status: r.live ?? "idle",
        go: paths.session(projectId, r.sessionId),
      });
      agents.push({
        id: `g:${projectId}/${r.sessionId}`,
        kind: "agent",
        label: `${ownerName}'s agent`,
        serif: true,
        sub: `${title} · ${nameOfProject(projectId)}`,
        avatar: { text: "", agent: true },
        status: r.live ?? "idle",
        go: paths.session(projectId, r.sessionId),
      });
      for (const p of r.people) {
        const have = people.get(p.id);
        const sub = p.driving ? `driving ${title}` : `${p.role} in ${title}`;
        if (!have || (p.driving && !have.sub?.startsWith("driving")))
          people.set(p.id, {
            id: `p:${p.id}`,
            kind: "person",
            label: p.name,
            serif: true,
            sub: `${nameOfProject(projectId)} · ${sub}`,
            avatar: { text: p.name.slice(0, 2) },
            hint: copy.palette.hints.person,
            go: paths.session(projectId, r.sessionId),
          });
      }
    }
  }
  const recent: Item[] = [];
  for (const r of recents) {
    if (listed.has(r.sessionId)) continue;
    recent.push({
      id: `r:${r.projectId}/${r.sessionId}`,
      kind: "session",
      label: r.title || r.sessionId,
      serif: true,
      sub: nameOfProject(r.projectId),
      avatar: { text: "", agent: true },
      hint: "recent",
      go: paths.session(r.projectId, r.sessionId),
    });
  }
  const current = route.name === "session" ? route.sessionId : null;
  const switchable = rank(
    sessions.filter((s) => !s.id.endsWith(`/${current}`)),
    (s) => `${s.label} ${s.sub ?? ""}`,
    needle ? 8 : 5,
  );
  const recentShown = needle
    ? rank(recent, (s) => `${s.label} ${s.sub ?? ""}`, 4)
    : recent.slice(0, 3);

  // Places: every project and team, by name, plus the pages, only when searching.
  const teams = new Map<string, string>();
  for (const p of projects) teams.set(p.teamId, p.teamName);
  const orgsSeen = new Map<string, string>();
  for (const p of projects) orgsSeen.set(p.orgId, p.orgName);
  const places: Item[] = needle
    ? rank(
        [
          ...projects.map<Item>((p) => ({
            id: `p:${p.projectId}`,
            kind: "go",
            label: p.name,
            serif: true,
            icon: ICONS.columns,
            hint: copy.palette.hints.project,
            sub: `${(sidebar[p.projectId] ?? []).filter((r) => r.open).length} sessions`,
            go: paths.fleet(p.projectId),
          })),
          ...[...teams].map<Item>(([id, name]) => ({
            id: `t:${id}`,
            kind: "go",
            label: name,
            serif: true,
            icon: ICONS.handoff,
            hint: copy.palette.hints.team,
            go: paths.management(id),
          })),
          ...[...orgsSeen].map<Item>(([id, name]) => ({
            id: `m:${id}`,
            kind: "go",
            label: `${name} memory`,
            icon: ICONS.memory,
            hint: copy.palette.hints.page,
            go: paths.memory(id),
          })),
        ],
        (p) => `${p.label} ${p.hint}`,
        5,
      )
    : [];

  // People and agents: on what matched.
  const who: Item[] = needle
    ? rank([...people.values(), ...agents], (p) => `${p.label} ${p.sub ?? ""}`, 6)
    : [];

  // Memory: the two newest when nothing is typed; otherwise what matches.
  const mem: Item[] = (
    needle
      ? rank(memory, (e) => `${e.key ?? ""} ${e.content} ${e.tags.join(" ")}`, 6)
      : [...memory].sort((a, b) => b.seq - a.seq).slice(0, 2)
  ).map((e) => ({
    id: `e:${e.id}`,
    kind: "memory",
    label: truncate(e.content, 110),
    lead: e.key ?? undefined,
    sub: attribLine(e),
    icon: ICONS.memory,
    hint: copy.palette.hints.memory,
    go: e.scope.projectId
      ? paths.fleet(e.scope.projectId)
      : e.scope.teamId
        ? paths.management(e.scope.teamId)
        : paths.memory(e.scope.orgId),
  }));
  if (!needle) total += mem.length;

  const groups: Group[] = [];
  if (actions.length)
    groups.push({
      title: copy.palette.actions,
      why: route.name === "session" ? copy.palette.actionsWhy : undefined,
      items: actions,
    });
  if (switchable.length) groups.push({ title: copy.palette.switchSession, items: switchable });
  if (recentShown.length) groups.push({ title: copy.palette.recent, items: recentShown });
  if (places.length) groups.push({ title: copy.palette.goTo, items: places });
  if (who.length)
    groups.push({ title: copy.palette.people, why: copy.palette.peopleWhy, items: who });
  if (mem.length)
    groups.push({
      title: copy.palette.memory,
      why: orgsSeen.values().next().value ?? undefined,
      items: mem,
    });
  return { groups, total };
}
