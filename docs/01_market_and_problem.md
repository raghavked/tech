# Market and problem

*Founder notes, 2 October 2026. Figures marked (verify) are from memory or secondary
sources and must be checked before external use.*

## The problem, concretely

A team of eight starts an agent on a migration at 10:00. By 14:00 it has touched sixty files,
asked for two approvals that the person who started it granted from a phone, and taken a
direction two teammates disagree with. At 18:00 that person logs off. The run continues, or
stops, and nobody else can pick it up without reading a transcript that was never written
for a second reader.

Four failures recur:

1. **Private threads.** The run belongs to the person who started it. Share links are
   read-only snapshots; teleport copies the session one way; Slack threads lose structure.
2. **Unattributed steering.** When a second person does get a message in, it executes under
   the first person's identity and tokens (Cursor) or is queued as if from the same voice
   (Devin). Nobody can say later who asked for what.
3. **Single-gate approvals.** The human in the loop is whoever is holding the session; there
   is no quorum, no routing to a second person, and no binding of the approval to the exact
   action.
4. **No handoff.** Shifts, time zones, and vacations exist. There is no brief, no transfer of
   authority, and no way to fork to try something without disturbing the main run.

## Why it is getting worse

- **Runs are longer.** Cloud sessions and autonomous modes are standard in Claude Code,
  Codex, Devin and Cursor. The task length AI systems complete with 50% reliability has
  doubled roughly every seven months since 2019 (METR, 2025; verify the latest point).
- **More harnesses per team.** Teams use two or three agent products at once; Mosaic (YC S26)
  exists because Claude Code, Codex and Cursor sessions needed one shared place.
- **Regulation is per action.** EU AI Act Article 14 asks for humans who can monitor,
  interpret and override; the oversight guidance is evidence per action, with who, when and
  why. Agent runs without attributed authority will not pass an audit.

## Who has the pain today

- **Engineering teams with multi-hour agent runs.** The first and loudest group; the
  Anthropic issue tracker and the Cursor forum show it.
- **Platform and developer-productivity teams.** They want one record and one policy across
  harnesses.
- **Security and compliance.** They want quorum on irreversible actions and attributable
  logs.
- **Deal desks, support escalation, legal matters, analyst teams, campaign teams.** Several
  people already crowd one task; the agent is becoming the shared worker in the room.

## Market sizing inputs (verify each)

- Developers using AI coding tools: the large majority of professional developers in 2026
  surveys; agents in daily use by a substantial minority and growing.
- Spend: the coding-agent category alone supports multiple vendors at multi-billion
  valuations in 2026 (Cognition at $48B in September, Replit at $9B in March, Factory at
  $4B in July; verify).
- Comparables for "multiplayer" products: Figma's collaboration moat; Liveblocks and
  PartyKit pricing per connection-minute; Slack and Linear as the team surfaces agents are
  being pulled into.
- Infrastructure comparables: Temporal $12.55B (September 2026); Convex $57M Series B
  (August 2026).

Bottom-up for the first product: 10,000 engineering teams running long agent sessions
weekly by 2027, 200 session-hours a month each, at low thousands of dollars per team per
month, is a nine-figure annual revenue pool for the session layer before any vertical.

## What a solution must have

- A session that many identified people can join, with presence and roles.
- Attributed, arbitrated steering with visible conflicts.
- Approvals with policy and quorum, bound to the exact action.
- Fork, merge, replay and handoff with a computed brief.
- Independence from any one harness or chat surface.

Everything shipped today has at most one of these. See `02_competitive_landscape.md`.
