import { describe, expect, it } from "vitest";
import { ageLabel, openShortcut, PER_SECTION, type TrayItem, trayMenuOf } from "./tray.js";

const item = (n: number, kind: string, extra: Partial<TrayItem> = {}): TrayItem => ({
  id: `n${n}`,
  kind,
  who: "Bo's agent",
  verb: "asks to",
  what: `write file-${n}.ts · write`,
  age: n * 60,
  route: `#/p/payments/s/s${n}`,
  ...extra,
});

describe("the tray menu (desktop-tray)", () => {
  it("lists items, not counts: who · verb · what · age under a header with the count", () => {
    const menu = trayMenuOf({
      items: [
        item(1, "approval", { who: "Ana's agent", what: "git push · irreversible" }),
        item(2, "handoff", { who: "Ana", verb: "offers you the baton on", what: "Tax lines" }),
      ],
      recents: [],
      name: "Dee Okafor",
      platform: "macos",
      paused: false,
    });
    expect(menu.sections.map((s) => s.header)).toEqual([
      "Pending approvals · 1",
      "Handoffs offered · 1",
    ]);
    expect(menu.sections[0]?.rows[0]).toMatchObject({
      who: "Ana's agent",
      verb: "asks to",
      what: "git push · irreversible",
      age: "1m",
      text: "Ana's agent asks to git push · irreversible · 1m",
      route: "#/p/payments/s/s1",
    });
    expect(menu.sections[1]?.rows[0]?.text).toBe("Ana offers you the baton on Tax lines · 2m");
    expect(menu.empty).toBeNull();
    expect(menu.badge).toBe(2);
  });

  it("shows five per section then 'and N more… in the queue', and the Mentions section only when there are any", () => {
    const items = Array.from({ length: 8 }, (_, i) => item(i + 1, "approval"));
    const menu = trayMenuOf({ items, recents: [], name: null, platform: "linux", paused: false });
    const approvals = menu.sections[0];
    expect(approvals?.rows).toHaveLength(PER_SECTION);
    expect(approvals?.more).toMatchObject({
      text: "and 3 more… in the queue",
      route: "#/approvals",
    });
    expect(menu.sections.some((s) => s.id === "mentions")).toBe(false);
    const withMention = trayMenuOf({
      items: [
        ...items,
        item(9, "mention", { who: "Cy", verb: "mentioned you in", what: "#billing" }),
      ],
      recents: [],
      name: null,
      platform: "linux",
      paused: false,
    });
    expect(withMention.sections.at(-1)?.header).toBe("Mentions · 1");
    // a mention is in the menu and never in the badge
    expect(withMention.badge).toBe(8);
  });

  it("says 'Nothing awaits you, Ana.' when nothing does", () => {
    const menu = trayMenuOf({
      items: [],
      recents: [],
      name: "Ana",
      platform: "macos",
      paused: false,
    });
    expect(menu.sections).toEqual([]);
    expect(menu.empty).toBe("Nothing awaits you, Ana.");
    expect(menu.badge).toBe(0);
    expect(
      trayMenuOf({ items: [], recents: [], name: null, platform: "macos", paused: false }).empty,
    ).toBe("Nothing awaits you.");
  });

  it("Quick open lists the last five sessions and rooms by name, then Inbox, Approvals queue, New session", () => {
    const recents = [
      { kind: "session" as const, title: "Billing page", route: "#/p/payments/s/billing", at: 5 },
      { kind: "room" as const, title: "billing", route: "#/c/acme/billing", at: 6 },
      { kind: "session" as const, title: "Checkout", route: "#/p/payments/s/checkout", at: 4 },
      { kind: "session" as const, title: "Invoice PDF", route: "#/p/payments/s/pdf", at: 3 },
      { kind: "session" as const, title: "Tax lines", route: "#/p/payments/s/tax", at: 2 },
      { kind: "session" as const, title: "Old one", route: "#/p/payments/s/old", at: 1 },
    ];
    const menu = trayMenuOf({
      items: [item(1, "mention")],
      recents,
      name: "Ana",
      platform: "windows",
      paused: false,
    });
    expect(menu.quickOpen.map((r) => r.text)).toEqual([
      "#billing",
      "Billing page",
      "Checkout",
      "Invoice PDF",
      "Tax lines",
      "Inbox · 1",
      "Approvals queue",
      "New session…",
    ]);
    expect(menu.quickOpen[0]?.route).toBe("#/c/acme/billing");
  });

  it("pauses for an hour, until tomorrow or until you say, and resumes; Open names the platform's keys", () => {
    const live = trayMenuOf({
      items: [],
      recents: [],
      name: "Ana",
      platform: "macos",
      paused: false,
    });
    expect(live.pause.label).toBe("Pause notifications");
    expect(live.pause.options.map((o) => o.text)).toEqual([
      "For an hour",
      "Until tomorrow",
      "Until you say",
    ]);
    expect(live.open).toEqual({ label: "Open Henosis", key: "⌥⇧H" });
    expect(live.quit).toBe("Quit Henosis");
    const paused = trayMenuOf({
      items: [],
      recents: [],
      name: "Ana",
      platform: "windows",
      paused: true,
    });
    expect(paused.pause.label).toBe("Resume notifications");
    expect(paused.pause.options.map((o) => o.id)).toEqual(["resume"]);
    expect(paused.open.key).toBe("Ctrl+Shift+H");
    expect(openShortcut(null)).toBe("Ctrl+Shift+H");
  });

  it("writes an age as now, minutes, hours or days", () => {
    expect(ageLabel(0)).toBe("now");
    expect(ageLabel(59)).toBe("now");
    expect(ageLabel(60)).toBe("1m");
    expect(ageLabel(3599)).toBe("59m");
    expect(ageLabel(3600)).toBe("1h");
    expect(ageLabel(90_000)).toBe("1d");
  });
});
