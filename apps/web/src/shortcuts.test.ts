import { describe, expect, it } from "vitest";
import {
  isTyping,
  matchShortcut,
  modLabel,
  pressTwoStep,
  registerOf,
  SHORTCUTS,
  stepSession,
  withMod,
} from "./shortcuts.js";

describe("shortcut map", () => {
  it("names every key once", () => {
    const keys = SHORTCUTS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(["/", "a", "d", "h", "f", "i", "j", "k", "?"]);
  });

  it("matches a bare letter outside a text field", () => {
    expect(matchShortcut({ key: "a" }, false, false)).toBe("approve");
    expect(matchShortcut({ key: "/" }, false, false)).toBe("steer");
    expect(matchShortcut({ key: "?", shiftKey: true }, false, false)).toBe("help");
    expect(matchShortcut({ key: "x" }, false, false)).toBeNull();
  });

  it("never fires while typing", () => {
    for (const s of SHORTCUTS) expect(matchShortcut({ key: s.key }, true, false)).toBeNull();
  });

  it("leaves modifier chords to the browser", () => {
    expect(matchShortcut({ key: "a", metaKey: true }, false, true)).toBeNull();
    expect(matchShortcut({ key: "a", ctrlKey: true }, false, false)).toBeNull();
    expect(matchShortcut({ key: "f", altKey: true }, false, false)).toBeNull();
    expect(matchShortcut({ key: "d", isComposing: true }, false, false)).toBeNull();
    expect(matchShortcut({ key: "d", defaultPrevented: true }, false, false)).toBeNull();
  });

  it("opens help with the OS modifier and slash, even while typing", () => {
    expect(matchShortcut({ key: "/", metaKey: true }, true, true)).toBe("help");
    expect(matchShortcut({ key: "/", ctrlKey: true }, true, false)).toBe("help");
    // The other platform's modifier is not the OS modifier.
    expect(matchShortcut({ key: "/", ctrlKey: true }, true, true)).toBeNull();
    expect(matchShortcut({ key: "/", metaKey: true }, true, false)).toBeNull();
    expect(withMod({ key: "/", metaKey: true }, true)).toBe(true);
    expect(modLabel(true)).toBe("⌘");
    expect(modLabel(false)).toBe("Ctrl");
  });

  it("knows a text field from a button", () => {
    expect(isTyping({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTyping({ tagName: "input", type: "search" })).toBe(true);
    expect(isTyping({ tagName: "INPUT", type: "checkbox" })).toBe(false);
    expect(isTyping({ tagName: "INPUT", type: "text", readOnly: true })).toBe(false);
    expect(isTyping({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTyping({ tagName: "SPAN", closest: () => ({}) })).toBe(true);
    expect(isTyping({ tagName: "BUTTON", closest: () => null })).toBe(false);
    expect(isTyping(null)).toBe(false);
  });

  it("steps through the sidebar and wraps", () => {
    const hrefs = ["#/p/a/s/1", "#/p/a/s/2", "#/p/b/s/3"];
    expect(stepSession(hrefs, "#/p/a/s/1", 1)).toBe("#/p/a/s/2");
    expect(stepSession(hrefs, "#/p/b/s/3", 1)).toBe("#/p/a/s/1");
    expect(stepSession(hrefs, "#/p/a/s/1", -1)).toBe("#/p/b/s/3");
    expect(stepSession(hrefs, "#/p/a", 1)).toBe("#/p/a/s/1");
    expect(stepSession(hrefs, "#/p/a", -1)).toBe("#/p/b/s/3");
    expect(stepSession([], "#/", 1)).toBeNull();
  });

  it("takes two presses for an irreversible action from another page, one otherwise", () => {
    // Off-page irreversible gate: the first `a` arms the card, the second sends.
    expect(pressTwoStep(null, "a", true)).toEqual({ fire: false, armed: "a" });
    expect(pressTwoStep("a", "a", true)).toEqual({ fire: true, armed: null });
    // Another key, or esc, leaves it; the next `a` starts over.
    expect(pressTwoStep("a", "d", true)).toEqual({ fire: false, armed: "d" });
    expect(pressTwoStep("a", "Escape", true)).toEqual({ fire: false, armed: null });
    // Rating keys and ↵ on a revisable plan stay one-step.
    expect(pressTwoStep(null, "4", false)).toEqual({ fire: true, armed: null });
    expect(pressTwoStep("a", "Enter", false)).toEqual({ fire: true, armed: null });
  });

  it("registers what each key would do right now", () => {
    const rows = registerOf(
      {
        session: {
          title: "Invoice PDF",
          driving: true,
          others: ["Dee", "Bo"],
          branch: "billing/invoice-pdf",
          waiting: {
            code: "git push origin main",
            risk: "irreversible",
            irreversible: true,
            ratings: true,
            rated: [{ who: "Bo", rating: 4 }],
          },
          offered: null,
        },
        neighbours: { prev: null, next: "Tally" },
      },
      "⌘",
    );
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.approve?.live).toBe(true);
    expect(byId.approve?.now).toBe(
      "approves git push origin main and sends 4 stars, which joins Bo's 4 · irreversible",
    );
    expect(byId.deny?.live).toBe(true);
    expect(byId.handoff?.now).toBe("Offers the baton · Dee and Bo are here");
    expect(byId.handoff?.live).toBe(false);
    expect(byId.next?.now).toBe("Tally");
    expect(byId.previous?.idle).toBe(true);
    expect(byId.help?.pressed).toBe(true);
    expect(byId.help?.now).toBe("⌘ / opens it while you are typing");
    expect(byId.palette?.keys).toEqual(["⌘", "K"]);
    expect(rows.filter((r) => r.live).map((r) => r.id)).toEqual(["approve", "deny"]);
    // Without a session the session keys step back; an offered baton lights `h`.
    const bare = registerOf({}, "Ctrl");
    expect(bare.find((r) => r.id === "approve")?.idle).toBe(true);
    expect(bare.find((r) => r.id === "steer")?.now).toBe("Open a session first");
    const offered = registerOf(
      {
        session: {
          title: "Tally",
          driving: false,
          driver: "Ana",
          others: ["Ana"],
          offered: { from: "Ana" },
        },
      },
      "⌘",
    );
    expect(offered.find((r) => r.id === "handoff")?.live).toBe(true);
    expect(offered.find((r) => r.id === "handoff")?.now).toBe("Takes the baton from Ana");
  });
});
