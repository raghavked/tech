# Realtime fan-out scaling: one session actor, many observers

Date and access date for all sources: 2026-10-02. Vendor docs domains were blocked by the egress proxy; figures from them come from search snippets and are marked UNVERIFIED.

## Why it matters for Henosis

Henosis's unit of truth is a single hash-chained log per session, written by one host and read by everyone. `docs/04_technical_architecture.md` already names the target shape: "a single writer with many observers", moved in Phase 1 into one actor per session (Durable Object, PartyKit room, or Temporal worker). Today `packages/server/src/host.ts` fans out by iterating `this.clients` and calling `send` synchronously, and every join replays the whole branch with `{ type: "snapshot", events: this.session.events(branch) }`. A week-long session has 10k events of a few KB each, so a join is a 20-50 MB push, and a slow laptop on hotel wifi that cannot drain its socket makes the host buffer unboundedly. The web client (`apps/web/src/client.ts`) has no reconnect and no notion of "what I already hold", so every blip is a full re-download. Fleet compounds it: `ProjectHost.subscribe` pushes every project event to every subscriber.

The question is therefore not "which vendor" but what the actor contract must be so the Node host and a hosted actor are the same code: resume-from-seq, bounded per-client queues, cheap idle, and a hard cap on what any one object fans out.

## Prior art

1. **Cloudflare Durable Objects: pricing and limits.** https://developers.cloudflare.com/durable-objects/platform/pricing/ and https://developers.cloudflare.com/durable-objects/platform/limits/ . UNVERIFIED (snippets). Paid plan: $0.15 per million requests, $12.50 per million GB-s, 1M requests and 400k GB-s included. A new WebSocket connection counts as one request; incoming messages are billed at 20:1; outgoing messages and protocol pings are free. Hibernating objects are not billed duration. Soft limit ~1,000 requests/s per object; 32,768 hibernatable WebSockets per object; 32 MiB message size (Oct 2025); SQLite storage 10 GB per object. Cloudflare's worked example: sockets held open without hibernation ~$138/month, with hibernation ~$10/month.
2. **Cloudflare WebSocket Hibernation API.** https://developers.cloudflare.com/durable-objects/reference/websockets/ . UNVERIFIED. The object is evicted from memory between messages while sockets stay open; per-socket `serializeAttachment` survives eviction but is capped at 2,048 bytes, so anything larger must live in storage and be referenced by key. In-memory class fields do not survive.
3. **PartyKit, "Scaling PartyKit servers with Hibernation".** https://docs.partykit.io/guides/scaling-partykit-servers-with-hibernation/ and https://docs.partykit.io/how-partykit-works/ . UNVERIFIED. One room = one Durable Object; without hibernation a room holds about 100 connections, with hibernation up to 32,000. The cost is that `onConnect` state is lost between wakes, so connection metadata goes in tags and attachments.
4. **Liveblocks on Durable Objects.** https://www.cloudflare.com/case-studies/liveblocks and https://liveblocks.io/docs/concepts/how-liveblocks-works . Verified case study page in search; docs UNVERIFIED. Liveblocks left EC2 + MongoDB because sockets and storage would not scale together; each room is one Durable Object, every user is forwarded to it, and the platform handles roughly half a billion messages a day.
5. **Cloudflare Agents SDK, long-running agents.** https://developers.cloudflare.com/agents/concepts/long-running-agents/ . UNVERIFIED. An agent is a Durable Object that hibernates after ~2 minutes idle; `setState()` persists to SQLite and syncs to every connected client; per-connection `connection.setState()` survives hibernation. The closest hosted analogue to a Henosis session.
6. **Figma multiplayer.** https://www.figma.com/blog/how-figmas-multiplayer-technology-works/ . Not fetched; summarised from secondary sources. One process per document; the client downloads the file once, then streams deltas; the server arbitrates conflicts. The shape is Henosis's.
7. **Backpressure in WebSocket streams.** https://skylinecodes.substack.com/p/backpressure-in-websocket-streams . Verified. A client that stops draining accumulates its send queue in server memory; the options are slow the producer, coalesce or drop droppable messages, or close with a defined reason. `bufferedAmount` is the signal.

## What to borrow

- **One object per coordination atom, never a global one.** Session actor per session, project actor per project. A session actor never holds project subscribers; it reports to the project actor, which fans out separately.
- **Download once, deltas after, resume by sequence.** The hash chain makes Henosis's version verifiable, which none of them have.
- **Everything that must survive is in storage; the socket carries a tiny attachment.** Agents SDK's rule maps onto Henosis's `fold(tail, snapshot)` directly.
- **Outgoing is free, incoming is 20:1, duration is the cost.** Design the actor to be awake only while committing an event; the model call and tool execution belong in the runner, not the fan-out actor.
- **Defined slow-consumer policy.** Presence is droppable and coalescable; log events are not droppable, so a client that cannot keep up is closed with a resync code and comes back with `afterSeq`.

## What is unsolved

- **Fan-out of a 10k-event history to a late joiner.** Snapshot plus tail is still MBs, and a verifying client wants the prefix hash, not just state. Merkle inclusion proofs (named in `04_technical_architecture.md` as future work) would let observers hold a snapshot plus a proof instead of every event. Nobody in the prior art does this.
- **Hibernation vs. a hot runner.** A session with an agent mid-turn cannot hibernate; the DO cost example assumes sparse traffic. A one-week session awake continuously at 128 MB is roughly 0.125 GB x 604,800 s = 75,600 GB-s, about $0.95 per session-week at list price, or ~$4 per session-month. So the hosted actor is not free during active work, and model-call latency must not sit inside the object's request budget.
- **Who holds the socket during handoff and fork.** A forked branch is a new stream on the same object; if branches become their own objects, a client watching both needs two sockets or a multiplexed one. Vendors have no branches, so no answer.
- **Cross-region observers.** DO places the object near the first requester; the other engineers may be far away. Henosis has to decide whether observers get a read replica.

## Concrete recommendations for Henosis

1. **Resume-from-seq in the wire protocol.** In `packages/protocol/src/index.ts` add `afterSeq?: number` and `headId?: string` to `join`, and change `snapshot` to `{ type: "snapshot", branch, fromSeq, events, headId }`. If the client's `headId` does not match the event at `afterSeq`, reply `{ type: "resync", reason: "fork" | "gap" }` and the client drops its cache. Land the `eventsAfter(branch, seq)` accessor in `packages/kernel/src/log.ts`.
2. **Reconnecting client with a held prefix.** In `apps/web/src/client.ts` (the desktop shell reuses it) keep `lastSeq` and `headId`, reconnect with exponential backoff and jitter capped at 30 s, send `join{afterSeq}`, and verify each incoming event's `prev` against the held head before folding. Persist the prefix per session in IndexedDB on web and in the Tauri app data dir on desktop so a cold open of a 10k-event session does not re-download.
3. **Per-client outbox with high-water marks.** In `packages/server/src/server.ts` wrap `ws.send` in a queue that checks `ws.bufferedAmount`; above 1 MiB stop sending presence and coalesce it to the latest entry; above 8 MiB close with code 4409 "resync" and let recommendation 2 recover. `ClientLink.send` in `host.ts` returns `boolean` so the host can observe lag per client. Add ping/pong with a 30 s idle timeout so dead sockets leave the fan-out set.
4. **Snapshot every k events, serve snapshot plus tail.** In `packages/server/src/storage.ts` replace the single `log.json` with append-only JSONL per branch and a state snapshot every 500 events. `joinWithRole` serves the latest snapshot and the tail, and `checkReplay` in `packages/kernel/src/replay.ts` already proves the two hash identically.
5. **Extract the actor contract before choosing a host.** Add `packages/server/src/actor.ts` with `SessionActorPort { storage: LogStore; now(): number; fanout(branch, msg): void; wake(): void }`. `SessionHost` takes the port; `server.ts` provides the Node implementation. A later `packages/server/src/adapters/durableObject.ts` implements the same port with hibernatable WebSockets, keeping `{ actorId, branch, lastAckSeq, role }` in the 2 KB `serializeAttachment` and everything else in SQLite. Keep the runner (`packages/runner`) outside the actor so model latency never blocks a commit.
6. **Split project fan-out from session fan-out.** `packages/server/src/projectHost.ts` should stop pushing every `project.event` to every subscriber; subscribers declare `{ kinds: ["contention", "claim", "brief"] }` on `project.subscribe`, and the fleet brief is pulled on demand. One project actor, many session actors reporting to it by message, never by shared memory.
7. **Cost expectation to put in `docs/08_business_model.md`.** Per active session-month on Durable Objects at list price (UNVERIFIED figures): duration ~$4 if awake continuously, under $0.50 if hibernated between turns; requests negligible (10k events x 30 observers outgoing is free; 10k incoming at 20:1 is 500 requests); storage ~20-50 MB per session. A thousand active sessions is low hundreds of dollars a month; the model calls dominate by two orders of magnitude. A single Node host on a 4 GB VM carries the same sockets; the choice is about operations and placement, not money.

## Sources

- https://developers.cloudflare.com/durable-objects/platform/pricing/ (accessed 2026-10-02, UNVERIFIED, blocked by proxy)
- https://developers.cloudflare.com/durable-objects/platform/limits/ (accessed 2026-10-02, UNVERIFIED)
- https://developers.cloudflare.com/durable-objects/reference/websockets/ (accessed 2026-10-02, UNVERIFIED)
- https://docs.partykit.io/guides/scaling-partykit-servers-with-hibernation/ (accessed 2026-10-02, UNVERIFIED)
- https://docs.partykit.io/how-partykit-works/ (accessed 2026-10-02, UNVERIFIED)
- https://www.cloudflare.com/case-studies/liveblocks (accessed 2026-10-02)
- https://liveblocks.io/docs/concepts/how-liveblocks-works (accessed 2026-10-02, UNVERIFIED)
- https://developers.cloudflare.com/agents/concepts/long-running-agents/ (accessed 2026-10-02, UNVERIFIED)
- https://www.figma.com/blog/how-figmas-multiplayer-technology-works/ (accessed 2026-10-02, via secondary summaries)
- https://skylinecodes.substack.com/p/backpressure-in-websocket-streams (accessed 2026-10-02)
