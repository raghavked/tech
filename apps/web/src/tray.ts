/**
 * The tray menu's grammar (design/henosis SCREENS.md §20, desktop-tray), kept free of React
 * and the DOM so the desktop shell (apps/desktop/src-tauri/src/main.rs builds the native menu
 * by the same rules), the first run's "dropped open" copy of it and the unit tests agree:
 *
 *   section headers as disabled rows with the count at the right ("Pending approvals · 2",
 *   "Handoffs offered · 1", "Mentions · 2" only when there are any); one line per item,
 *   who · verb · what · age, five per section then "and N more… in the queue"; Quick open with
 *   the last five sessions and rooms by name plus Inbox, Approvals queue, New session…; Pause
 *   notifications (an hour, until tomorrow, until you say); Open Henosis with the platform's
 *   shortcut; Quit. "Nothing awaits you, Ana." when nothing does. The badge counts approvals
 *   and handoffs only; a mention never badges.
 */

export interface TrayItem {
  id: string;
  kind: string;
  who: string;
  verb: string;
  what: string;
  /** Seconds since it was sent, as the server counts them. */
  age: number;
  /** The client's hash route to the notice. */
  route: string;
  ratings?: boolean;
}

export interface TrayRecent {
  kind: "session" | "room";
  title: string;
  route: string;
  at: number;
}

export interface TrayRow {
  id: string;
  /** The row as a native menu draws it; a surface with the serif face sets `who` in it. */
  text: string;
  who?: string;
  verb?: string;
  what?: string;
  age?: string;
  route: string | null;
  disabled?: boolean;
}

export interface TraySection {
  id: "approvals" | "handoffs" | "mentions";
  header: string;
  rows: TrayRow[];
  /** "and 3 more… in the queue", opening the queue, when the section has more than five. */
  more: TrayRow | null;
}

export interface TrayMenu {
  /** Approvals and handoffs, never mentions. */
  badge: number;
  sections: TraySection[];
  /** "Nothing awaits you, Ana." when the sections are empty. */
  empty: string | null;
  quickOpen: TrayRow[];
  pause: { paused: boolean; label: string; options: TrayRow[] };
  open: { label: string; key: string };
  quit: string;
}

export const PER_SECTION = 5;

/** "now", "2m", "3h", "2d": the age at the right of a row. */
export function ageLabel(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86_400)}d`;
}

/** The global shortcut that brings Henosis forward, as the platform writes it. */
export function openShortcut(platform: string | null | undefined): string {
  return platform === "macos" ? "⌥⇧H" : "Ctrl+Shift+H";
}

export function rowOf(item: TrayItem): TrayRow {
  const age = ageLabel(item.age);
  return {
    id: item.id,
    text: `${item.who} ${item.verb} ${item.what} · ${age}`,
    who: item.who,
    verb: item.verb,
    what: item.what,
    age,
    route: item.route,
  };
}

function section(
  id: TraySection["id"],
  header: string,
  items: TrayItem[],
  moreRoute: string,
): TraySection | null {
  if (items.length === 0) return null;
  const shown = items.slice(0, PER_SECTION);
  const rest = items.length - shown.length;
  return {
    id,
    header: `${header} · ${items.length}`,
    rows: shown.map(rowOf),
    more:
      rest > 0
        ? { id: `more:${id}`, text: `and ${rest} more… in the queue`, route: moreRoute }
        : null,
  };
}

export function trayMenuOf(input: {
  items: TrayItem[];
  recents: TrayRecent[];
  /** The signed-in person's first name, for "Nothing awaits you, Ana." */
  name: string | null;
  platform: string | null;
  paused: boolean;
}): TrayMenu {
  const approvals = input.items.filter((i) => i.kind === "approval");
  const handoffs = input.items.filter((i) => i.kind === "handoff");
  const mentions = input.items.filter((i) => i.kind === "mention");
  const sections = [
    section("approvals", "Pending approvals", approvals, "#/approvals"),
    section("handoffs", "Handoffs offered", handoffs, "#/inbox"),
    section("mentions", "Mentions", mentions, "#/inbox"),
  ].filter((s): s is TraySection => s !== null);
  const recent = [...input.recents]
    .sort((a, b) => b.at - a.at)
    .slice(0, PER_SECTION)
    .map<TrayRow>((r) => ({
      id: `recent:${r.route}`,
      text: r.kind === "room" ? `#${r.title}` : r.title,
      route: r.route,
    }));
  const unread = input.items.length;
  const quickOpen: TrayRow[] = [
    ...recent,
    { id: "inbox", text: unread > 0 ? `Inbox · ${unread}` : "Inbox", route: "#/inbox" },
    { id: "approvals", text: "Approvals queue", route: "#/approvals" },
    { id: "new", text: "New session…", route: "#/?new=1" },
  ];
  const first = input.name?.trim().split(/\s+/)[0];
  return {
    badge: approvals.length + handoffs.length,
    sections,
    empty: sections.length === 0 ? `Nothing awaits you${first ? `, ${first}` : ""}.` : null,
    quickOpen,
    pause: {
      paused: input.paused,
      label: input.paused ? "Resume notifications" : "Pause notifications",
      options: input.paused
        ? [{ id: "resume", text: "Resume now", route: null }]
        : [
            { id: "pause:hour", text: "For an hour", route: null },
            { id: "pause:tomorrow", text: "Until tomorrow", route: null },
            { id: "pause:say", text: "Until you say", route: null },
          ],
    },
    open: { label: "Open Henosis", key: openShortcut(input.platform) },
    quit: "Quit Henosis",
  };
}
