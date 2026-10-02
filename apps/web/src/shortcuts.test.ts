import { describe, expect, it } from "vitest";
import { isTyping, matchShortcut, modLabel, SHORTCUTS, stepSession, withMod } from "./shortcuts.js";

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
});
