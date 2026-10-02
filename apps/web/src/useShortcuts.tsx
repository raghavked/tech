/** Keyboard shortcuts in the page: the keydown hook and the "?" sheet. The map is shortcuts.ts. */
import { useEffect, useRef } from "react";
import {
  isTyping,
  matchShortcut,
  modLabel,
  SHORTCUTS,
  type ShortcutHandlers,
  type TargetLike,
} from "./shortcuts.js";
import { ICONS, Icon } from "./ui.js";

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

/** The "?" sheet: plain rows, label left and key right. Escape or the scrim closes it. */
export function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);
  const mod = modLabel();
  const groups: [string, (typeof SHORTCUTS)[number]["scope"]][] = [
    ["In a session", "session"],
    ["Anywhere", "anywhere"],
  ];
  return (
    <div className="sheet-wrap">
      <button type="button" className="sheet-dim" aria-label="Close" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <div className="row">
          <span className="grow serif">Keyboard shortcuts</span>
          <button
            ref={closeRef}
            type="button"
            className="btn ghost icon sm"
            aria-label="Close"
            onClick={onClose}
          >
            <Icon d={ICONS.close} size={14} />
          </button>
        </div>
        {groups.map(([title, scope]) => (
          <div key={scope}>
            <h3>{title}</h3>
            {SHORTCUTS.filter((s) => s.scope === scope).map((s) => (
              <div className="krow" key={s.id}>
                <span className="grow">{s.label}</span>
                <kbd>{s.key}</kbd>
              </div>
            ))}
            {scope === "anywhere" && (
              <>
                <div className="krow">
                  <span className="grow">Keyboard shortcuts, while typing</span>
                  <span>
                    <kbd>{mod}</kbd>
                    <kbd>/</kbd>
                  </span>
                </div>
                <div className="krow">
                  <span className="grow">Close this</span>
                  <kbd>Esc</kbd>
                </div>
              </>
            )}
          </div>
        ))}
        <p className="small faint">
          Letters only work when you are not typing; press <kbd>/</kbd> to start typing.
        </p>
      </div>
    </div>
  );
}
