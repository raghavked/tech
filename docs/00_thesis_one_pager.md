# Quorum: the multiplayer kernel for long-running agents

*One-pager. Working codename "Quorum" (the minimum set of people who can decide). Market
facts are founder notes gathered 2 October 2026 and must be re-verified before external use;
see `10_sources.md`.*

## The thesis in one line

Agent runs are becoming hours, days and weeks long, and work at that scale is done by teams.
Every agent product still gives the run to one person. Quorum makes the session itself a
shared, replayable object with defined semantics for many humans steering one agent, and
sells that kernel to every surface and every vertical that needs it.

## What just changed

- **Runs got long.** METR's May 2026 measurement puts the best model's 50%-success task
  horizon at "likely at least 16 hours", with the recent doubling time near 3.5 months
  (figures from secondary summaries; verify on metr.org). Anthropic's 2026 agentic coding
  report describes horizons "expanding from minutes to days or weeks, with agents pausing
  only for strategic human checkpoints"; OpenAI describes a Codex run of about 25 hours
  uninterrupted (unverified); Devin is sold as overnight, multi-day work.
- **The demand is written down.** The request quoted at the top of this repository is Y
  Combinator's Fall 2026 "Multiplayer AI" request for startups (attributed to partner Aaron
  Epstein). a16z's Big Ideas 2026 says "the collaboration layer becomes the moat." Open
  Anthropic issues (#60082, #48828) ask for shared Claude Code sessions and name "context
  loss when handing off work."
- **Supervision is the norm.** Stack Overflow's May 2026 pulse survey: daily agent use at
  work rose from 14% to 37% in a year, 60% of developers block agents from unapproved
  changes, and the survey's own title is "Agents on a leash."
- **Vendors are improvising.** Cursor's Team Followups run a teammate's instruction under
  the session creator's tokens. Claude Code share links do not update live. Devin serialises
  everyone's messages into one queue. Slack Code puts a team around an agent in a channel
  with no replay or fork. Nobody has a participant model, arbitration, or a replayable
  record.

## The insight

A multiplayer agent session is a distributed-systems object, not a chat with more people.
Three things make it one, and none of them exists in any shipped product:

1. **A deterministic, branchable session log** that records model and tool outputs, so a
   session replays, resumes after a crash, forks at a checkpoint, and merges back.
2. **Intent arbitration**: concurrent directives from many humans compose into one intent by
   explicit, order-independent rules; peers who disagree produce a contention the agent
   works around until someone with authority resolves it. The model never has to guess whose
   instruction wins; the kernel has already decided, in the open.
3. **Authority as data**: roles, a transferable driver seat, approvals bound to the hash of
   the exact action, quorum for irreversible actions, and a handoff brief computed from the
   log. "Who told the agent to do that" is a lookup.

This is the join between durable execution (Temporal, valued at $12.55B this September) and
realtime collaboration (Figma, Liveblocks), applied to agents. The two sides are separate
vendors today; the first party harnesses have no reason to build it vendor-neutrally.

## The product, three layers

1. **Kernel.** Pure, tested semantics: log, arbitration, authority, fork and merge, replay,
   brief. Runs in the server, the CLI and the browser identically.
2. **Session service.** One authoritative actor per session, websockets for everyone else,
   persistence, a runner that survives crashes, adapters so any harness runs inside it.
3. **Surfaces.** Web, CLI, Slack thread, PR; then templates for sales, support, legal,
   finance and marketing teams, who already crowd one problem and one agent.

## Why now and why us

The runs got long this year; the RFS was published this quarter; the first-party vendors
are each one feature deep and single-vendor. This repository is a runnable vertical slice of
all three layers with 39 tests, a browser test, and an offline demo that walks a four-person
team through contention, approval, fork, merge and handoff.

## Who pays

Engineering teams first (live co-presence and approvals on multi-hour runs); platform teams
second (one session layer across harnesses, replay and policy); security and compliance
third (attributed, replayable evidence of who authorised what); vertical teams through
templates and partners. Pricing follows the premise that anyone can drop in: per active
session-hour plus per approver seat, with the kernel and protocol open.

## What would kill it

A first party ships native multi-human sessions with fork and quorum, and Slack Code becomes
the default cross-vendor surface. The answer to both is the same: be the neutral,
replayable kernel those surfaces embed, which none of them is positioned to build.
