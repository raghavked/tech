/**
 * Keyboard shortcuts in the page: the keydown hook, the context a page publishes so the "?"
 * sheet can say what each key would do right now, and the sheet itself. The map and the
 * register are shortcuts.ts.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DEFAULT_RATING } from "./approvalsQueue.js";
import { copy } from "./copy.js";
import {
  isApple,
  isTyping,
  type KeyRow,
  matchShortcut,
  modLabel,
  type RegisterGroup,
  registerOf,
  type ShortcutContext,
  type ShortcutHandlers,
  type TargetLike,
} from "./shortcuts.js";
import { ICONS, Icon, Mark } from "./ui.js";

/** Listens on the window; a key does nothing unless a handler for it is given. */
export function useShortcuts(handlers: ShortcutHandlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const id = matchShortcut(e, isTyping(e.target as TargetLike | null));
      if (!id) return;
      const fn = ref.current[id];
      if (!fn) return;
      e.preventDefault();
      fn();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
}

/** Focus the first element matching `selector` once the next render has committed. */
export function focusSoon(selector: string): void {
  setTimeout(() => {
    try {
      document.querySelector<HTMLElement>(selector)?.focus();
    } catch {
      // ignore
    }
  }, 0);
}

/** The session links in the sidebar, top to bottom, as hash routes. */
export function sidebarSessionHrefs(): string[] {
  try {
    return [...document.querySelectorAll<HTMLAnchorElement>(".sidebar a[href*='/s/']")]
      .map((a) => a.getAttribute("href") ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** The rail neighbours of the current session, by the title the rail shows. */
export function sidebarNeighbours(): { prev: string | null; next: string | null } {
  try {
    const links = [...document.querySelectorAll<HTMLAnchorElement>(".sidebar a[href*='/s/']")];
    const current = location.hash.split("?")[0] ?? "";
    const at = links.findIndex((a) => a.getAttribute("href") === current);
    const titleOf = (a: HTMLAnchorElement | undefined) =>
      a ? (a.querySelector(".t")?.textContent ?? a.textContent ?? "").trim() || null : null;
    if (at < 0) return { prev: null, next: titleOf(links[0]) };
    return {
      prev: at > 0 ? titleOf(links[at - 1]) : null,
      next: at < links.length - 1 ? titleOf(links[at + 1]) : null,
    };
  } catch {
    return { prev: null, next: null };
  }
}

// ---- the context a page publishes -------------------------------------------------------

let context: ShortcutContext = {};
const contextListeners = new Set<() => void>();

export function setShortcutContext(patch: ShortcutContext): void {
  context = { ...context, ...patch };
  for (const fn of contextListeners) fn();
}

/** Publish while mounted; the keys given are cleared on unmount. */
export function useShortcutContextPublisher(patch: ShortcutContext): void {
  const key = JSON.stringify(patch);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the identity of `patch`
  useEffect(() => {
    setShortcutContext(patch);
    return () => {
      const cleared: ShortcutContext = {};
      for (const k of Object.keys(patch) as (keyof ShortcutContext)[]) cleared[k] = undefined;
      setShortcutContext(cleared);
    };
  }, [key]);
}

export function useShortcutContext(): ShortcutContext {
  return useSyncExternalStore(
    (fn) => {
      contextListeners.add(fn);
      return () => contextListeners.delete(fn);
    },
    () => context,
    () => context,
  );
}

// ---- the sheet: a register of what each key does right now ------------------------------

const LEFT: RegisterGroup[] = ["session", "composer"];
const RIGHT: RegisterGroup[] = ["anywhere", "queue", "palette"];

export function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const ctx = useShortcutContext();
  const [apple, setApple] = useState(() => isApple());
  const [neighbours, setNeighbours] = useState(() => sidebarNeighbours());
  useEffect(() => {
    closeRef.current?.focus();
    setNeighbours(sidebarNeighbours());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);
  const mod = modLabel(apple);
  const rows = registerOf(
    { ...ctx, neighbours: ctx.neighbours ?? neighbours },
    mod,
    DEFAULT_RATING,
  );
  const s = ctx.session ?? null;
  const col = (groups: RegisterGroup[]) =>
    groups.map((g) => (
      <div className={`grp g-${g}`} key={g}>
        <h3>{copy.sheet.groups[g]}</h3>
        {rows
          .filter((r) => r.group === g)
          .map((r) => (
            <Row key={r.id} r={r} />
          ))}
      </div>
    ));
  return (
    <div className="sheet-wrap">
      <button type="button" className="sheet-dim" aria-label={copy.sheet.close} onClick={onClose} />
      <div className="sheet keys" role="dialog" aria-modal="true" aria-label={copy.sheet.title}>
        <div className="head">
          <Mark size={34} />
          <div className="ttl">
            <h2>{copy.sheet.title}</h2>
            <div className="sub">
              {copy.sheet.subtitle}{" "}
              {s ? (
                <>
                  in <span className="serif">{s.title}</span>
                  <span className="sep">·</span>
                  {s.driving ? copy.sheet.driving : copy.sheet.notDriving(s.driver ?? null)}
                </>
              ) : (
                <span className="faint">· {copy.sheet.noSession}</span>
              )}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="close"
            aria-label={copy.sheet.close}
            onClick={onClose}
          >
            <Icon d={ICONS.close} size={14} />
          </button>
        </div>
        <div className="body">
          <div className="col">{col(LEFT)}</div>
          <div className="col">{col(RIGHT)}</div>
        </div>
        <div className="foot">
          <span className="legend">
            <i />
            <b>{copy.sheet.legend}</b> {copy.sheet.legendSub}
          </span>
          <span className="note">
            {copy.sheet.note} <kbd>/</kbd> {copy.sheet.startsTyping}
          </span>
          <span className="right">
            {copy.sheet.keysAs}
            <span className="seg">
              <button
                type="button"
                className={apple ? "on" : ""}
                aria-pressed={apple}
                onClick={() => setApple(true)}
              >
                ⌘ Mac
              </button>
              <button
                type="button"
                className={apple ? "" : "on"}
                aria-pressed={!apple}
                onClick={() => setApple(false)}
              >
                Ctrl
              </button>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({ r }: { r: KeyRow }) {
  const or = r.id === "queue-open" || r.id === "queue-rate";
  return (
    <div
      className={`krow${r.live ? " live" : ""}${r.idle ? " idle" : ""}${r.pressed ? " pressed" : ""}`}
    >
      <div>
        <div className="what">{r.what}</div>
        {r.now && <div className="now">{r.now}</div>}
      </div>
      <span className="keys">
        {r.keys.map((k, i) => (
          <span key={k} className="k">
            {i > 0 && or && (
              <span className="or">{r.id === "queue-rate" ? "–" : copy.sheet.or}</span>
            )}
            <kbd className={r.pressed ? "pressed" : r.live ? "live" : ""}>{k}</kbd>
          </span>
        ))}
      </span>
    </div>
  );
}
