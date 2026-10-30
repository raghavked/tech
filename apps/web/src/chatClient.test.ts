/**
 * The chat socket while it dials: what a person says or marks read is kept and sent after the
 * subscribe, never thrown at a socket that is still connecting (the composer sends from a React
 * effect, where a throw would unmount the whole chat view).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ChatClient } from "./chatClient.js";

class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances: FakeSocket[] = [];
  readyState = FakeSocket.CONNECTING;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string): void {
    if (this.readyState !== FakeSocket.OPEN) throw new Error("InvalidStateError");
    this.sent.push(data);
  }
  close(): void {
    this.readyState = 3;
  }
  open(): void {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
}

describe("ChatClient.send while the socket is away", () => {
  const noop = () => {};
  beforeEach(() => {
    FakeSocket.instances = [];
    Object.assign(globalThis, {
      WebSocket: FakeSocket,
      addEventListener: noop,
      removeEventListener: noop,
      localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
      sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { visibilityState: "visible", addEventListener: noop, removeEventListener: noop },
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "WebSocket");
  });

  it("keeps what was said while dialling and sends it after the subscribe", () => {
    const c = new ChatClient();
    c.connect("ws://x/ws", "default", "bo", "Bo");
    const ws = FakeSocket.instances[0] as FakeSocket;
    expect(ws.readyState).toBe(FakeSocket.CONNECTING);
    // A socket still connecting would throw on send; the client keeps the message instead.
    expect(() => c.send({ type: "chat.say", groupId: "g", text: "hello" })).not.toThrow();
    expect(() => c.send({ type: "chat.read", groupId: "g" })).not.toThrow();
    // A name check is not worth keeping: the sheet asks again when it needs to.
    c.send({ type: "chat.check", name: "Rollout" });
    expect(c.pending.map((m) => m.type)).toEqual(["chat.say", "chat.read"]);
    ws.open();
    expect(ws.sent.map((s) => (JSON.parse(s) as { type: string }).type)).toEqual([
      "chat.subscribe",
      "chat.say",
      "chat.read",
    ]);
    expect(c.pending).toHaveLength(0);
    // Open: sent at once.
    c.send({ type: "chat.say", groupId: "g", text: "again" });
    expect(ws.sent).toHaveLength(4);
  });

  it("drops what was kept when the client disconnects", () => {
    const c = new ChatClient();
    c.connect("ws://x/ws", "default", "bo", "Bo");
    c.send({ type: "chat.say", groupId: "g", text: "hello" });
    expect(c.pending).toHaveLength(1);
    c.disconnect();
    expect(c.pending).toHaveLength(0);
    // Nothing is kept for a client that is not connecting anywhere.
    c.send({ type: "chat.say", groupId: "g", text: "later" });
    expect(c.pending).toHaveLength(0);
  });
});
