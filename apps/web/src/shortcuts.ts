/**
 * The keyboard shortcut map, kept free of React and the DOM so it can be unit-tested.
 *
 * Single letters fire only when nobody is typing and no modifier is held, so they never
 * collide with the composer, the sidebar search or the browser's own Cmd/Ctrl chords.
 * One chord, Mod+/ (the OS modifier: ⌘ on a Mac, Ctrl elsewhere), opens the help sheet
 * from anywhere, including inside a text field, because "?" cannot.
 */

export type ShortcutId =
  | "steer"
  | "approve"
  | "deny"
  | "handoff"
  | "fork"
  | "details"
  | "next"
  | "previous"
  | "help";

export interface Shortcut {
  id: ShortcutId;
  /** The `KeyboardEvent.key` value that fires it. */
  key: string;
  /** What the help sheet says. */
  label: string;
  /** Where it applies; the sheet groups rows by this. */
  scope: "session" | "anywhere";
}

export const SHORTCUTS: readonly Shortcut[] = [
  { id: "steer", key: "/", label: "Steer the agent", scope: "session" },
  { id: "approve", key: "a", label: "Approve the waiting call", scope: "session" },
  { id: "deny", key: "d", label: "Deny the waiting call", scope: "session" },
  { id: "handoff", key: "h", label: "Hand off, or accept the fold", scope: "session" },
  { id: "fork", key: "f", label: "Fork a branch", scope: "session" },
  { id: "details", key: "i", label: "Show or hide details", scope: "session" },
  { id: "next", key: "j", label: "Next session", scope: "anywhere" },
  { id: "previous", key: "k", label: "Previous session", scope: "anywhere" },
  { id: "help", key: "?", label: "Keyboard shortcuts", scope: "anywhere" },
];

export type ShortcutHandlers = Partial<Record<ShortcutId, () => void>>;

/** The subset of a KeyboardEvent the matcher reads. */
export interface KeyLike {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
}

/** The subset of an event target the matcher reads. */
export interface TargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  readOnly?: boolean;
  type?: string;
  closest?: (selector: string) => unknown;
}

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const BUTTON_INPUTS = new Set(["button", "submit", "reset", "checkbox", "radio", "range"]);

/** True when a keystroke would land in a field the person is typing into. */
export function isTyping(target: TargetLike | null | undefined): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toUpperCase();
  if (!tag || !TYPING_TAGS.has(tag)) {
    return Boolean(target.closest?.('[contenteditable=""], [contenteditable="true"]'));
  }
  if (tag === "INPUT" && target.type && BUTTON_INPUTS.has(target.type)) return false;
  return !target.readOnly;
}

/** Whether this is an Apple platform, where the OS modifier is ⌘ rather than Ctrl. */
export function isApple(platform?: string): boolean {
  const p =
    platform ??
    (() => {
      try {
        const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
        return nav.userAgentData?.platform ?? nav.platform ?? "";
      } catch {
        return "";
      }
    })();
  return /mac|iphone|ipad|ipod/i.test(p);
}

/** The OS modifier as the help sheet prints it. */
export function modLabel(apple = isApple()): string {
  return apple ? "⌘" : "Ctrl";
}

/** True when the OS modifier (and only that one) is held. */
export function withMod(e: KeyLike, apple = isApple()): boolean {
  return apple ? Boolean(e.metaKey) && !e.ctrlKey : Boolean(e.ctrlKey) && !e.metaKey;
}

/**
 * The shortcut a keystroke names, or null. `typing` says whether the target is a text field;
 * only the Mod+/ chord passes through a text field.
 */
export function matchShortcut(e: KeyLike, typing: boolean, apple = isApple()): ShortcutId | null {
  if (e.defaultPrevented || e.isComposing) return null;
  if (e.key === "/" && withMod(e, apple) && !e.altKey) return "help";
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return null;
  const hit = SHORTCUTS.find((s) => s.key === e.key);
  return hit ? hit.id : null;
}

/** The sidebar's session links in the order shown; `href` is the hash route. */
export function stepSession(
  hrefs: readonly string[],
  current: string,
  delta: 1 | -1,
): string | null {
  if (hrefs.length === 0) return null;
  const at = hrefs.indexOf(current);
  if (at < 0) return delta > 0 ? (hrefs[0] ?? null) : (hrefs[hrefs.length - 1] ?? null);
  const next = (at + delta + hrefs.length) % hrefs.length;
  return hrefs[next] ?? null;
}
