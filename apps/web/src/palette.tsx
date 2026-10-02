/**
 * The command palette: ⌘K / Ctrl+K opens one centred list of actions, sessions and team
 * memory. Views register the actions that belong to their page with `usePaletteActions`;
 * the sidebar publishes the sessions it lists with `publishSidebarSessions`; memory comes
 * from /api/memory/:org when the palette opens. Everything is keyboard-first; Escape closes.
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
import { useRecents } from "./recents.js";
import { navigate, paths } from "./router.js";
import { setTheme, useTheme } from "./theme.js";
import { attribLine, ICONS, Icon, Status } from "./ui.js";

// ---- actions that pages register -------------------------------------------------------

export interface PaletteAction {
  id: string;
  label: string;
  /** A quiet grey word on the right: "session", "project"... */
  hint?: string;
  icon?: string;
  /** When set, picking the action asks for one line of text first (the placeholder). */
  prompt?: string;
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

// ---- fuzzy matching ------------------------------------------------------------------------

/**
 * Subsequence match, scored: 0 when `needle` is not in `hay` in order; higher for a
 * contiguous run, a match at a word start, and a short haystack.
 */
export function fuzzyScore(needle: string, hay: string): number {
  const n = needle.trim().toLowerCase();
  if (!n) return 1;
  const h = hay.toLowerCase();
  const at = h.indexOf(n);
  if (at >= 0) return 100 + (at === 0 || /\s|[./:_-]/.test(h[at - 1] ?? "") ? 20 : 0) - at / 50;
  let score = 0;
  let i = 0;
  let last = -2;
  for (let j = 0; j < h.length && i < n.length; j++) {
    if (h[j] !== n[i]) continue;
    score += 1;
    if (j === last + 1) score += 2;
    if (j === 0 || /\s|[./:_-]/.test(h[j - 1] ?? "")) score += 3;
    last = j;
    i += 1;
  }
  if (i < n.length) return 0;
  return score + Math.max(0, 20 - h.length / 10);
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

interface Item {
  id: string;
  kind: "action" | "session" | "go" | "memory";
  label: string;
  sub?: string;
  icon?: string;
  hint?: string;
  status?: string | null;
  action?: PaletteAction;
  go?: string;
}

function truncate(s: string, n: number): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
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

  const items = useMemo(
    () => (open ? itemsFor({ q, route, me, registered, sidebar, recents, memory, theme }) : []),
    [open, q, route, me, registered, sidebar, recents, memory, theme],
  );
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
    if (!text) return;
    pending.run(text);
    close();
  };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
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

  return (
    <>
      <button type="button" className="palette-scrim" aria-label="Close commands" onClick={close} />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Commands">
        <label className="q">
          <Icon d={pending ? pending.icon || ICONS.chevron : ICONS.search} size={15} />
          <input
            ref={input}
            type="text"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={current && !pending ? `palette-${current.id}` : undefined}
            placeholder={pending ? pending.prompt : "Type a command or search"}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIndex(0);
            }}
            onKeyDown={onKeyDown}
          />
          {pending ? (
            <span className="k">{pending.label} · Enter</span>
          ) : (
            <span className="k">Esc</span>
          )}
        </label>
        {!pending && (
          <div className="items" id="palette-list" role="listbox" aria-label="Results">
            {flat.length === 0 && <p className="empty">Nothing matches.</p>}
            {items.map((g) => (
              <div key={g.title}>
                <div className="section">{g.title}</div>
                {g.items.map((it) => {
                  const on = current?.id === it.id;
                  return (
                    <button
                      type="button"
                      key={it.id}
                      id={`palette-${it.id}`}
                      role="option"
                      aria-selected={on}
                      className={`item${on ? " on" : ""}`}
                      onMouseEnter={() => setIndex(flat.indexOf(it))}
                      onClick={() => pick(it)}
                    >
                      {it.icon && <Icon d={it.icon} size={14} />}
                      <span className="grow ellipsis">
                        {it.label}
                        {it.sub && <span className="sub"> {it.sub}</span>}
                      </span>
                      {it.status !== undefined ? (
                        <span className="k">
                          <Status status={it.status} />
                        </span>
                      ) : it.hint ? (
                        <span className="k">{it.hint}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ---- what the list holds -------------------------------------------------------------------

interface Group {
  title: string;
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
}): Group[] {
  const projects = me?.projects ?? [];
  const needle = q.trim();
  const rank = <T,>(xs: T[], text: (x: T) => string, max: number): T[] => {
    if (!needle) return xs.slice(0, max);
    return xs
      .map((x) => ({ x, s: fuzzyScore(needle, text(x)) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, max)
      .map((r) => r.x);
  };

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
            run: () => navigate(paths.management(here.teamId)),
          },
        ]
      : []),
    {
      id: "theme",
      label: dark ? "Switch to light theme" : "Switch to dark theme",
      icon: dark ? ICONS.sun : ICONS.moon,
      run: () => setTheme(dark ? "light" : "dark"),
    },
  ];
  const actions: Item[] = rank(
    [...registered, ...global],
    (a) => `${a.label} ${a.hint ?? ""}`,
    needle ? 8 : 40,
  ).map((a) => ({
    id: `a:${a.id}`,
    kind: "action",
    label: a.label,
    icon: a.icon,
    hint: a.hint,
    action: a,
  }));

  // Sessions: what the sidebar lists, then recents it does not.
  const listed = new Set<string>();
  const sessions: Item[] = [];
  for (const [projectId, rows] of Object.entries(sidebar)) {
    for (const r of rows) {
      if (!r.open) continue;
      listed.add(r.sessionId);
      sessions.push({
        id: `s:${projectId}/${r.sessionId}`,
        kind: "session",
        label: r.title || r.sessionId,
        sub: projects.find((p) => p.projectId === projectId)?.name ?? projectId,
        status: r.live ?? "idle",
        go: paths.session(projectId, r.sessionId),
      });
    }
  }
  for (const r of recents) {
    if (listed.has(r.sessionId)) continue;
    sessions.push({
      id: `r:${r.projectId}/${r.sessionId}`,
      kind: "session",
      label: r.title || r.sessionId,
      sub: "recent",
      go: paths.session(r.projectId, r.sessionId),
    });
  }
  const current = route.name === "session" ? route.sessionId : null;
  const switchable = rank(
    sessions.filter((s) => !s.id.endsWith(`/${current}`)),
    (s) => `${s.label} ${s.sub ?? ""}`,
    8,
  );

  // Places: every project and team, by name, only when searching.
  const teams = new Map<string, string>();
  for (const p of projects) teams.set(p.teamId, p.teamName);
  const places: Item[] = needle
    ? rank(
        [
          ...projects.map<Item>((p) => ({
            id: `p:${p.projectId}`,
            kind: "go",
            label: p.name,
            hint: "project",
            go: paths.fleet(p.projectId),
          })),
          ...[...teams].map<Item>(([id, name]) => ({
            id: `t:${id}`,
            kind: "go",
            label: name,
            hint: "team",
            go: paths.management(id),
          })),
        ],
        (p) => `${p.label} ${p.hint}`,
        5,
      )
    : [];

  // Memory: only when searching; a hit opens the project or team it belongs to.
  const mem: Item[] = needle
    ? rank(memory, (e) => `${e.key ?? ""} ${e.content} ${e.tags.join(" ")}`, 6).map((e) => ({
        id: `m:${e.id}`,
        kind: "memory",
        label: truncate(e.key ? `${e.key} · ${e.content}` : e.content, 90),
        sub: attribLine(e),
        icon: ICONS.memory,
        hint: "memory",
        go: e.scope.projectId
          ? paths.fleet(e.scope.projectId)
          : e.scope.teamId
            ? paths.management(e.scope.teamId)
            : undefined,
      }))
    : [];

  const groups: Group[] = [];
  if (actions.length) groups.push({ title: "Actions", items: actions });
  if (switchable.length) groups.push({ title: "Switch session", items: switchable });
  if (places.length) groups.push({ title: "Go to", items: places });
  if (mem.length) groups.push({ title: "Team memory", items: mem });
  return groups;
}
