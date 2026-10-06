# Market and problem

*Founder notes, 2 October 2026. Most figures come from secondary sources because primary
sites were unreachable from the research environment; each is cited in `10_sources.md` and
marked (verify) where the primary page was not read.*

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

- **Runs are longer.** METR's time-horizon series: the best model as of May 2026 completes
  tasks of "likely at least 16 hours" at 50% reliability and about 3 hours at 80%; the
  long-run doubling time is about 7 months and the recent one about 3.5 months (verify on
  metr.org). Anthropic's 2026 agentic coding report describes horizons of days or weeks with
  strategic human checkpoints; OpenAI reports a roughly 25-hour uninterrupted Codex run
  (verify); Devin is marketed as overnight, multi-day work.
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

## Market sizing inputs

| Input | Figure | Source status |
|---|---|---|
| Developers using agents (any frequency) | 31% to 59% year over year (Stack Overflow pulse, May 2026) | snippet; verify |
| Developers using agents daily at work | 14% to 37% | snippet; verify |
| Developers who block unapproved agent changes | 60% | snippet; verify |
| Agentic capability spend embedded in enterprise software, 2026 | about $202B (Gartner, Jan 2026) | secondary; verify |
| Standalone agentic AI software, 2026 | $7B to $8.5B (Gartner) | secondary; verify |
| Enterprise apps embedding agents by end-2026 | 40%, from under 5% in 2025 (Gartner) | secondary; verify |
| Cognition (Devin) | $48B valuation, Sept 2026; ARR about $900M, Aug 2026 | secondary |
| Cursor (Anysphere) | $29.3B Series D, Jan 2026; ARR about $4B, June 2026; reported $60B acquisition by SpaceX, June 2026 | secondary; acquisition unverified |
| Replit | $9B, March 2026; $525M run-rate, April 2026 | secondary |
| Factory | $1.5B, April 2026; reported $5B, Sept 2026 | TechCrunch; later figure unverified |
| Temporal | $12.55B Series E, Sept 2026; ARR over $250M | secondary |
| Figma | FY2025 revenue $1.06B (+41%); Q2 2026 $370M (+48%) | secondary |

The Gartner gap between embedded and standalone agent spend ($202B versus $8B) says the
definition decides the TAM; Henosis's revenue attaches to session-hours and approvers, which
sits inside whichever definition a buyer uses.

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
