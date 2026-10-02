# Competitive landscape

*Facts gathered 2026-10-02 from vendor docs and press; many vendor sites were reachable only
through search snippets, so items marked (unverified) need a second look before external use.
Sources in `10_sources.md`.*

## The short version

Everyone is bolting multi-user onto a single-user agent. Nobody has shipped the primitive:
a framework-neutral session that several identified humans can watch, steer with attributed
and authorised directives, approve, fork, merge and hand off, with a replayable record.

## First-party agent products

| Vendor | What ships for multiple humans | Gap |
|---|---|---|
| Anthropic Claude Code | Team/Public share links that do not update live; one-way teleport of a cloud session to a terminal; anyone can queue a message into a cloud session from the CLI; Claude Tag makes a Slack thread the session | No presence, no participant identity in the transcript, no approvals routed to a second person; open feature request #60082 (May 2026) asks for exactly this |
| OpenAI Codex | Shared cloud environments and task continuation across devices; Workspace Agents shared within an org | Task ownership is single; no concurrent steering |
| Cursor | Team Followups: teammates can send follow-ups to another user's cloud agent, executing under the creator's integration tokens | Bearer-token-shaped sharing flagged on their own forum; no participant model, no fork |
| Cognition Devin | Markets "Multiplayer Mode": shareable session links, input from multiple people, server-side follow-up queue | Serialises messages; single vendor; no branch or merge, no quorum approvals |
| Slack Code (Salesforce, Aug 2026) | Code channels where a team watches a Claude Code, Devin, Copilot or Vercel agent, gives feedback and signs off | The substrate is a chat channel: no replay, fork, or framework-neutral state; Slack-locked |
| GitHub Copilot | Teams-channel sessions anyone can steer, with changes gated on repo write access; local share is view-only | Copilot-only; no fork or replay |
| Zed Delta (Aug 2026, private beta) | CRDT-synced conversation plus worktree; teammates comment, co-edit prompts, pick up work; syncs third-party harnesses starting with Claude Code | Editor-bound desktop app, coding only; fork and merge of threads unverified |
| Replit | Per-collaborator agent tasks on a shared board, auto-merged | Tasks are single-owner |
| Warp Oz | "Teammates can join running agent sessions" (depth unverified) | Warp-locked |

Devin and Zed are the two to watch. Devin is the proof that customers want it; Zed Delta is
the closest technical analogue and is still an editor feature.

## Agent infrastructure and protocols

LangGraph, Temporal, Inngest, Restate, Trigger.dev, DBOS, Mastra, the OpenAI Agents SDK,
Microsoft Agent Framework, Google ADK, Claude Managed Agents: all offer a durable wait or
an interrupt for *the* human. None has participants, roles, presence, or a transcript where
two humans' interventions are attributed and ordered. Checkpoint history gives single-run
time travel, not branch-and-merge across people. Letta's Conversations API shares one agent's
memory across many users but not a live run. AG-UI, A2A and MCP elicitation all assume one
user.

## Realtime collaboration infrastructure

Liveblocks treats agents as room participants but has no agent runtime or run history.
Cloudflare's Agents SDK on Durable Objects is "multiplayer by default" at the websocket
level and is the right hosting substrate; it is not a framework-neutral session protocol and
has no fork or replay. ElectricSQL's Durable Streams (forkable, humans and agents attach to
one stream) is the most thesis-adjacent infrastructure and is small and early. Temporal
(valued at $12.55B in September 2026) and the collaboration vendors sit on opposite sides of
exactly the join Quorum builds.

## Startups and demand signals

- YC's Fall 2026 request for startups asks for "a production-ready multiplayer AI workspace
  that lets a whole team collaborate with AI agents in real time, the way Figma turned
  design into a shared, live experience."
- a16z Big Ideas 2026: "the collaboration layer becomes the moat."
- Dust ($40M Series B, May 2026) and Stilla ($5M, Jan 2026) brand themselves multiplayer AI;
  both are chat workspaces with shared agents, not session primitives.
- Mosaic (YC S26) started as live multiplayer coding and pivoted to syncing Claude Code,
  Codex and Cursor sessions into shared memory. Dock (YC S26) is multi-agent, not
  multi-human.
- HumanLayer routes single approvals to Slack; it is a gate, not a session.

## Vertical players

Harvey (legal) collaborates on matters and artifacts; Rogo and Hebbia (finance) are
single-analyst; Spekit and Mutiny (sales) build buyer-seller rooms; Sierra, Decagon and
Intercom (support) hand off agent to human with context; Jasper (marketing) has multiplayer
canvases with agents as tools. In every vertical the agent run itself stays single-driver.

## Where Quorum sits

Quorum is the layer under all of the above: session state, arbitration, authority, fork and
replay, exposed over a protocol any harness can speak. The main risk is not demand. It is
that Anthropic, OpenAI or Cognition add native multi-user to their own harnesses (each has
the pieces), and that Slack Code becomes the default cross-vendor surface. The defence is to
be the vendor-neutral kernel those surfaces embed, which none of them has a reason to build.
