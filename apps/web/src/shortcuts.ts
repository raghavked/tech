/**
 * The keyboard shortcut map, kept free of React and the DOM so it can be unit-tested.
 *
 * Single letters fire only when nobody is typing and no modifier is held, so they never
 * collide with the composer, the sidebar search or the browser's own Cmd/Ctrl chords.
 * One chord, Mod+/ (the OS modifier: ⌘ on a Mac, Ctrl elsewhere), opens the help sheet
 * from anywhere, including inside a text field, because "?" cannot.
 *
 * The sheet is a register, not a cheat card: `registerOf` says what each key would do right
 * now from a `ShortcutContext` the page publishes (the waiting call, the offered baton, the
 * rail neighbours), and marks the keys that would act on something waiting as live.
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
  | "foldRail"
  | "expandRail"
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
  // desktop-compact: [ and ] pin the rail folded or open; the width decides until they are pressed.
  { id: "foldRail", key: "[", label: "Fold the rail", scope: "anywhere" },
  { id: "expandRail", key: "]", label: "Expand the rail", scope: "anywhere" },
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

/** The Mod+/ chord as the composer hint prints it. */
export function helpChordLabel(apple = isApple()): string {
  return apple ? "⌘/" : "Ctrl /";
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

// ---- the two-step press -------------------------------------------------------------------

/**
 * An irreversible action on another page takes two presses: the first lights the card and
 * says "`a` again approves · `esc` leaves it", the second sends. `armed` is the key (or the
 * row) the first press lit; anything else, or `esc`, disarms. Rating keys and ↵ on a revisable
 * plan stay one-step, which is `needsTwo: false`.
 */
export function pressTwoStep(
  armed: string | null,
  key: string,
  needsTwo: boolean,
): { fire: boolean; armed: string | null } {
  if (key === "Escape") return { fire: false, armed: null };
  if (!needsTwo) return { fire: true, armed: null };
  if (armed === key) return { fire: true, armed: null };
  return { fire: false, armed: key };
}

// ---- the register: what a key would do right now ----------------------------------------

export interface WaitingCall {
  /** The call in mono: "git push origin main". */
  code: string;
  risk: string;
  irreversible: boolean;
  /** A release gate: the approve carries a rating; `rated` are the votes already in. */
  ratings: boolean;
  rated: { who: string; rating: number }[];
}

export interface ShortcutContext {
  session?: {
    title: string;
    driving: boolean;
    /** Who drives, when it is not you. */
    driver?: string | null;
    waiting?: WaitingCall | null;
    offered?: { from: string } | null;
    /** The other people here, for "offers the baton to Dee and Bo". */
    others: string[];
    branch?: string;
    detailsOpen?: boolean;
  } | null;
  /** The rail neighbours of the current session, by title. */
  neighbours?: { prev: string | null; next: string | null };
  /** The approvals queue, when it is the page: how many rows wait. */
  queue?: { count: number } | null;
}

export type RegisterGroup = "session" | "composer" | "anywhere" | "queue" | "palette";

export interface KeyRow {
  id: string;
  /** The caps, in order; "or" between alternatives is the sheet's to draw. */
  keys: string[];
  what: string;
  /** The second line: the live state in the stream's vocabulary, or why the key steps back. */
  now: string | null;
  /** Would act on something waiting right now: the apricot wash and the cap in the hand. */
  live: boolean;
  /** Nothing to do: the row steps back. */
  idle: boolean;
  /** The key that opened the sheet: the you-pressed-this treatment. */
  pressed?: boolean;
  group: RegisterGroup;
}

function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The sheet's rows from what the page published; pure so the sheet can be tested. */
export function registerOf(ctx: ShortcutContext, mod: string, defaultRating = 4): KeyRow[] {
  const s = ctx.session ?? null;
  const w = s?.waiting ?? null;
  const rows: KeyRow[] = [];
  const row = (r: Omit<KeyRow, "live" | "idle"> & { live?: boolean; idle?: boolean }) =>
    rows.push({ live: false, idle: false, ...r });

  row({
    id: "steer",
    keys: ["/"],
    what: "Steer the agent",
    now: s ? "Puts the cursor in the composer, Agent side" : "Open a session first",
    idle: !s,
    group: "session",
  });
  if (w) {
    const grants = w.ratings
      ? w.rated.length
        ? `, which joins ${list(w.rated.map((r) => `${r.who}'s ${r.rating}`))}`
        : ""
      : "";
    row({
      id: "approve",
      keys: ["a"],
      what: "Approve the waiting call",
      now: `approves ${w.code}${w.ratings ? ` and sends ${defaultRating} stars${grants}` : ""}${w.irreversible ? " · irreversible" : ""}`,
      live: true,
      group: "session",
    });
    row({
      id: "deny",
      keys: ["d"],
      what: "Deny the waiting call",
      now: `${s?.title ?? "The agent"} stops before ${w.code} and asks what to change`,
      live: true,
      group: "session",
    });
  } else {
    row({
      id: "approve",
      keys: ["a"],
      what: "Approve the waiting call",
      now: s ? "Nothing waits for an approval" : "Open a session first",
      idle: true,
      group: "session",
    });
    row({
      id: "deny",
      keys: ["d"],
      what: "Deny the waiting call",
      now: s ? "Nothing waits for an approval" : "Open a session first",
      idle: true,
      group: "session",
    });
  }
  if (s?.offered)
    row({
      id: "handoff",
      keys: ["h"],
      what: "Accept the fold",
      now: `Takes the baton from ${s.offered.from}`,
      live: true,
      group: "session",
    });
  else if (s?.driving && s.others.length)
    row({
      id: "handoff",
      keys: ["h"],
      what: "Hand off",
      now: `Offers the baton · ${list(s.others)} ${s.others.length === 1 ? "is" : "are"} here`,
      group: "session",
    });
  else
    row({
      id: "handoff",
      keys: ["h"],
      what: "Hand off, or accept the fold",
      now: !s
        ? "Open a session first"
        : s.driving
          ? "Nobody else is here to hand off to"
          : s.driver
            ? `${s.driver} holds the baton`
            : "Nobody is driving",
      idle: true,
      group: "session",
    });
  row({
    id: "fork",
    keys: ["f"],
    what: "Fork a branch",
    now: s
      ? `Off ${s.branch ?? "main"} · Details opens with the name ready`
      : "Open a session first",
    idle: !s,
    group: "session",
  });
  row({
    id: "details",
    keys: ["i"],
    what: s?.detailsOpen ? "Hide details" : "Show details",
    now: s ? "Intent, branches, workspace, usage, memory, brief" : "Open a session first",
    idle: !s,
    group: "session",
  });

  row({
    id: "send",
    keys: ["↵"],
    what: "Send to the agent, or to the team",
    now: "Whichever side of the Agent / Team toggle is on",
    group: "composer",
  });
  row({ id: "newline", keys: ["⇧", "↵"], what: "New line", now: null, group: "composer" });
  row({
    id: "mention",
    keys: ["@"],
    what: "Mention a person or an agent",
    now: s?.others.length ? list([...s.others, "the agent"]) : "Everyone in the session",
    group: "composer",
  });

  row({
    id: "palette",
    keys: [mod, "K"],
    what: "Command palette",
    now: "Actions, sessions, places, people, team memory",
    group: "anywhere",
  });
  const n = ctx.neighbours ?? { prev: null, next: null };
  row({
    id: "next",
    keys: ["j"],
    what: "Next session in the rail",
    now: n.next ? n.next : s ? `${s.title} is last · wraps to the first` : "Nothing in the rail",
    idle: !n.next,
    group: "anywhere",
  });
  row({
    id: "previous",
    keys: ["k"],
    what: "Previous session in the rail",
    now: n.prev ? n.prev : s ? `${s.title} is first · wraps to the last` : "Nothing in the rail",
    idle: !n.prev,
    group: "anywhere",
  });
  row({
    id: "help",
    keys: ["?"],
    what: "This sheet",
    now: `${mod} / opens it while you are typing`,
    pressed: true,
    group: "anywhere",
  });
  row({
    id: "escape",
    keys: ["esc"],
    what: "Close this, the palette, a toast or a drawer",
    now: null,
    group: "anywhere",
  });

  const q = ctx.queue ?? null;
  row({
    id: "queue-move",
    keys: ["j", "k"],
    what: "Move down, move up",
    now: q ? `${q.count} waiting` : null,
    live: Boolean(q && q.count > 0),
    group: "queue",
  });
  row({
    id: "queue-decide",
    keys: ["a", "d"],
    what: "Approve, deny the row under the cursor",
    now: `Under a release gate, approve sends ${defaultRating} stars · an irreversible row takes two presses`,
    live: Boolean(q && q.count > 0),
    group: "queue",
  });
  row({
    id: "queue-rate",
    keys: ["1", "5"],
    what: "Pick a rating first",
    now: "Then a approves with it",
    group: "queue",
  });
  row({
    id: "queue-open",
    keys: ["↵", "o"],
    what: "Open the row's session",
    now: null,
    group: "queue",
  });

  row({
    id: "palette-move",
    keys: ["↑", "↓", "↵", "esc"],
    what: "Move, run, back out",
    now: null,
    group: "palette",
  });
  row({ id: "palette-tab", keys: ["⇥"], what: "Next group", now: null, group: "palette" });
  return rows;
}
