# Merkle proofs for observers: transparency-log techniques for Fold session logs

Date: 2026-10-02. Topic slug: `merkle-proofs-observers`.

## Why it matters for Fold

Fold's session is already a hash-chained log: `eventId()` in `packages/kernel/src/log.ts` commits each event to `prev`, so the head id commits to the whole prefix and `fold verify` detects any edit. What the chain does **not** give is a cheap way for a client that already holds a prefix to check that the server's new head *extends* that prefix. With a plain chain the only proof is the events themselves: a desktop client away for a day must download and re-hash everything it missed before trusting the head, and a client that only wants the brief (mobile, an observer, Slack) cannot check that it sees the same history as the room.

That second case is the real threat. A server (or compromised runner) that shows Ana one history and Bo another breaks arbitration, quorum approvals and handoff briefs silently; approvals bind to a call's content hash, but nothing binds them to a position in a history everyone agrees on. Transparency logs solved exactly this for certificates: a Merkle tree, O(log n) proofs, signed checkpoints, and witnesses that refuse to cosign an inconsistent checkpoint. The same machinery makes "I am looking at the real session" something the desktop client checks in a few hundred bytes, and lets an auditor verify the log later without the server's cooperation.

## Prior art

1. **RFC 9162, Certificate Transparency v2** (IETF, Dec 2021). https://www.rfc-editor.org/rfc/rfc9162.html. Accessed 2026-10-02 (blocked by the egress proxy; UNVERIFIED, from the published text). Defines the Merkle Tree Hash: leaves hashed as `SHA-256(0x00 || entry)`, interior nodes as `SHA-256(0x01 || left || right)`, the tree split at the largest power of two less than n. Inclusion proofs (`log n` sibling hashes) and consistency proofs between sizes m < n (at most `log n + 1` hashes) come with verification algorithms a client can implement in fifty lines.
2. **Russ Cox, "Transparent Logs for Skeptical Clients"** (2019). https://research.swtch.com/tlog. Accessed 2026-10-02 (blocked; UNVERIFIED). The Go checksum database design: a client caches `(size, root)` and demands a consistency proof to the new size before accepting anything.
3. **`golang.org/x/mod/sumdb/tlog`** (Go, maintained). https://pkg.go.dev/golang.org/x/mod/sumdb/tlog. Accessed 2026-10-02 (verified). Reference implementation: `ProveRecord/CheckRecord`, `ProveTree/CheckTree`, `Tile{H,L,N,W}`. Cost model: each append stores at most `1 + log2 n` new hashes; `TreeHash` reads at most `1 + log2 n`.
4. **C2SP `tlog-tiles`** (spec, current). https://github.com/C2SP/C2SP/blob/main/tlog-tiles.md. Accessed 2026-10-02 (verified). Tiles of height 8 (256 hashes, 8 KiB) at `tile/<L>/<N>`, partial tiles `.p/<W>`, entry bundles at `tile/entries/<N>`, a short-cached `checkpoint` and immutable tiles. No proof endpoints: the client fetches tiles and builds its own proofs.
5. **C2SP `tlog-checkpoint`** (spec). https://github.com/C2SP/C2SP/blob/main/tlog-checkpoint.md. Accessed 2026-10-02 (verified). A checkpoint is a signed note: origin line, ASCII tree size, base64 root, blank line, then one or more `— <name> <base64 sig>` lines.
6. **C2SP `tlog-witness`** (spec). https://github.com/C2SP/C2SP/blob/main/tlog-witness.md. Accessed 2026-10-02 (verified). A witness stores the last checkpoint it cosigned per log, accepts `add-checkpoint {old size, consistency proof, checkpoint}`, verifies signature and proof, and returns cosignature lines. Persistent witness state is what defeats split views.
7. **Sigstore Rekor v2 (`rekor-tiles`) on Trillian Tessera** (GA 2025). https://github.com/sigstore/rekor-tiles and https://github.com/transparency-dev/tessera. Accessed 2026-10-02 (READMEs verified; cost claims in https://blog.sigstore.dev/rekor-v2-ga/ UNVERIFIED, blocked). Rekor moved from a per-entry database to tlog-tiles static files, shards roughly every six months with shard keys distributed out of band, builds witnessing in, and dropped its own signed timestamp for an external TSA. Tessera separates sequencing, integration and publishing into asynchronous stages, with synchronous publication when a caller needs a proof immediately.

## What to borrow

- **The tree, not just the chain.** Keep `prev` (it is what fork pointers, replay and `fold verify` use) and add an RFC 9162 Merkle tree over the same leaves. The leaf is the existing event id, so the tree is a pure function of the event sequence and the kernel computes it anywhere.
- **The skeptical-client loop.** The desktop client keeps `(branch, size, root)` as its trust anchor. On reconnect it asks for a consistency proof from its size to the current one and refuses to fold anything until the proof checks. Cost: `~log2 n` hashes; for a 100,000-event session, 17 hashes, 544 bytes.
- **Signed checkpoints as the unit of trust.** Replace "the snapshot is whatever the server sent" with a signed `(origin, size, root)` note that votes and handoff accepts can cite.
- **Witnesses from the people already in the room.** Every connected client already holds a checkpoint; broadcasting `(size, root)` in presence lets clients detect a split view among themselves, and the Slack adapter and the CLI can be persistent witnesses that cosign.
- **Tiles for storage and cold reads.** Hash tiles of 256 nodes match the planned phase 1 JSONL-per-branch layout: immutable files, cached by the desktop shell or a CDN, no proof endpoints to operate.
- **Shard.** A long session is a sequence of bounded shards, each tree's first leaf committing to the previous root, as Rekor does per half-year.

## What is unsolved

- **Branches are not linear logs.** A fork's history is `parent[0..f] ++ own`, so the branch tree at size f equals the parent tree at size f and a consistency proof across the fork point is ordinary. But a merge appends to the target a single event that *references* the source branch; the source's events are not leaves of the target tree. A client that verified the source branch has no proof that the merge event's recorded base and tree match what it saw. Putting the source root in the merge payload is the likely fix, but no transparency-log design covers this.
- **Compaction versus append-only.** Organisation memory compacts; a transparency tree cannot forget. Memory must treat compaction as new events over an uncompacted tree, or forgo proofs.
- **Who holds the signing key.** In phase 0 identity is client-asserted and the server is trusted. A server-signed checkpoint proves nothing against the server; it needs independent cosigners, so the witness step is not optional.
- **Timestamps.** `append()` assigns a logical `ts = head.ts + 1`. Rekor v2 concluded a log should not vouch for wall-clock time; Fold will want an external time source for "approved at" if logs become audit evidence.
- **Latency.** Checkpoints can lag events (Tessera publishes asynchronously). The UI must render on `event` and upgrade once the covering checkpoint arrives.

## Concrete recommendations for Fold

1. **`packages/kernel/src/merkle.ts` (new).** Implement RFC 9162 `leafHash`, `nodeHash`, `rootAt(leaves, n)`, `inclusionProof(i, n)`, `consistencyProof(m, n)`, `verifyInclusion`, `verifyConsistency` on top of the existing `sha256` in `hash.ts`. Leaf = UTF-8 bytes of the event id. Property-test that a fork's root at the fork point equals the parent's root there.
2. **`packages/kernel/src/log.ts`.** Give `ChainLog` an incremental tree per branch: store the `1 + log2 n` frontier hashes per append (the `tlog.StoredHashes` model) rather than recomputing from scratch; expose `root(branch)`, `size(branch)` and the two proof methods. Make `checkpoint.created` carry `{size, root}` so forks and merges reference a tree position, not only an event id, and add the source branch root to the merge payload.
3. **`packages/protocol/src/index.ts`.** Add wire messages: client `resume {branch, size, root}`; server `checkpoint {origin: "<org>/<session>/<branch>", size, root, signatures[]}` in `tlog-checkpoint` note form, `consistency {from, to, hashes[]}`, `events {branch, from, events[]}`, and `inclusion {index, size, hashes[]}` on request. Carry `(size, root)` in `presence` so clients can compare views.
4. **`packages/server/src/host.ts` and `storage.ts`.** Sign checkpoints with a per-deployment key (Ed25519 via WebCrypto, so the kernel stays Node-free). When phase 1 moves to JSONL per branch, write hash tiles of 256 under `store/sessions/<id>/tiles/<branch>/<L>/<N>` and serve them over HTTP with immutable cache headers; keep `checkpoint` uncached. Serve `snapshot` as a checkpoint plus an entry range so it is verifiable rather than trusted.
5. **`apps/web/src/sync.ts` (new, used by `views/SessionView.tsx`) and the Tauri shell.** Keep the trust anchor `(branch, size, root)` in local storage, wrapped in try/catch, and in the desktop shell also in a file so it survives a cleared web view. On reconnect send `resume`, verify consistency before folding, then hash the delivered events and confirm they reach the checkpoint root. On failure render one quiet notice, "History changed since you last connected", keep the old view read-only until a human chooses to re-sync, and never fold unverified events.
6. **`packages/slack/src/adapter.ts` and `packages/cli/src/main.ts`.** Make both persistent witnesses: they keep the last checkpoint per session, demand a consistency proof for each new one, and return a cosignature the server attaches to the note. Extend `fold verify <log.json>` to recompute roots, check every checkpoint and merge payload against them, and print the witness set that cosigned the head.

## Sources

- RFC 9162, Certificate Transparency Version 2.0: https://www.rfc-editor.org/rfc/rfc9162.html (blocked; UNVERIFIED)
- Russ Cox, Transparent Logs for Skeptical Clients: https://research.swtch.com/tlog (blocked; UNVERIFIED)
- golang.org/x/mod/sumdb/tlog: https://pkg.go.dev/golang.org/x/mod/sumdb/tlog
- C2SP tlog-tiles: https://github.com/C2SP/C2SP/blob/main/tlog-tiles.md
- C2SP tlog-checkpoint: https://github.com/C2SP/C2SP/blob/main/tlog-checkpoint.md
- C2SP tlog-witness: https://github.com/C2SP/C2SP/blob/main/tlog-witness.md
- Sigstore rekor-tiles: https://github.com/sigstore/rekor-tiles
- Trillian Tessera: https://github.com/transparency-dev/tessera
- Rekor v2 GA announcement: https://blog.sigstore.dev/rekor-v2-ga/ (blocked; UNVERIFIED, from search snippets)
- Tile-Based Transparency Logs, transparency.dev: https://transparency.dev/articles/tile-based-logs/ (blocked; UNVERIFIED, from search snippets)
- Fold repo: /home/user/tech/packages/kernel/src/log.ts, /home/user/tech/packages/kernel/src/hash.ts, /home/user/tech/packages/protocol/src/index.ts, /home/user/tech/docs/04_technical_architecture.md, /home/user/tech/docs/05_kernel_design.md
