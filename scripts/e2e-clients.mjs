// Two humans join one live session: one sets the goal, the other approves and takes over.

import { fold } from "@henosis/kernel";
import WebSocket from "ws";

const [url, token] = process.argv.slice(2);
const deadline = Date.now() + 30_000;

function client(actor) {
  const ws = new WebSocket(url);
  const opened = new Promise((r) => ws.once("open", r));
  const c = { ws, state: null, brief: null, errors: [] };
  ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.type === "snapshot") c.state = fold(m.events);
    else if (m.type === "event" && c.state) c.state = fold([m.event], c.state);
    else if (m.type === "brief") c.brief = m.markdown;
    else if (m.type === "error") c.errors.push(m.message);
  });
  c.send = (m) => ws.send(JSON.stringify(m));
  c.open = () => opened;
  c.until = async (pred) => {
    while (Date.now() < deadline) {
      if (c.state && pred(c.state)) return c.state;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`timeout: ${pred}`);
  };
  c.join = async () => {
    await c.open();
    c.send({ type: "join", sessionId: "e2e", actor, token, branch: "main" });
    await c.until((s) => Boolean(s.participants[actor.id]));
  };
  return c;
}

const ana = client({ id: "ana", kind: "human", name: "Ana" });
const bo = client({ id: "bo", kind: "human", name: "Bo" });
await ana.join();
await bo.join();
if (ana.state.participants.ana.role !== "owner") throw new Error("first joiner should own");
if (bo.state.participants.bo.role !== "contributor")
  throw new Error("second joiner should contribute");

bo.ws.on("message", (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.type === "event" && m.event.kind === "approval.requested") {
    bo.send({ type: "vote", approvalId: m.event.payload.approvalId, vote: "approve" });
  }
});
const d = (text, extra = {}) => ({
  type: "directive",
  input: { text, mode: "steer", scope: "goal", supersedes: [], interrupt: false, ...extra },
});
ana.send(d("Build a greeter"));
bo.send(d("Keep it tiny", { mode: "constrain" }));
const done = await ana.until(
  (s) => s.turns.length > 0 && s.turns[s.turns.length - 1].summary.startsWith("DONE"),
);
if (!done.workspace["src/build_a_greeter.mjs"]) throw new Error("module not written");
await bo.until((s) => s.seq === done.seq);
if (JSON.stringify(bo.state) !== JSON.stringify(done)) throw new Error("replicas diverged");

ana.send({ type: "handoff.request", to: "bo" });
const pending = await bo.until((s) =>
  Object.values(s.handoffs).some((h) => h.status === "pending"),
);
bo.send({
  type: "handoff.accept",
  handoffId: Object.values(pending.handoffs).find((h) => h.status === "pending").id,
});
await ana.until((s) => s.driver === "bo");
bo.send({ type: "brief" });
while (!bo.brief && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
if (!bo.brief?.includes("Driver: Bo")) throw new Error("brief missing driver");
if (ana.errors.length || bo.errors.length)
  throw new Error(`errors: ${[...ana.errors, ...bo.errors].join("; ")}`);
console.log(
  `live session ok: ${done.seq + 1} events, ${done.turns.length} turns, driver now ${ana.state.driver}`,
);
ana.ws.close();
bo.ws.close();
