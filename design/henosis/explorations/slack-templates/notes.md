# Slack templates · notes

## The idea
Henosis in Slack is the same team at a third distance: every message is one sentence first, in the product's voice, with the buttons the app already has, and the link into Henosis last. Five templates cover what the adapter posts today and what it should: a session is a thread in its project channel (started, steered by replies, folded progress lines), an approval is five rating buttons with the 4 as Slack's primary because a bare Approve sends 4, a contention is one event seen from three seats (leads with both sides and the numbers that decide, each owner with their own refused write), a mention in a team channel is answered in the thread by "Ana's agent" with what it read and what it cost, and the daily brief is the manager overview said in Slack, computed from the ledger. The board shows each template as Slack renders it, light and dark, with its text fallback, blocks, action_ids and result states beside it.

## What to keep
- The anatomy: emblem on navy in Slack's 36 px square, `Henosis · APP · time`, the sentence, the context line, buttons then the link. Never "bot", never "AI-powered".
- Names bold and session titles italic (the two things the app sets in serif); tool names and paths in backticks; one emoji at the front and it is the kind.
- Rating buttons 1★–5★ as the vote under a ratings rule, 4 as `primary`, Deny as `danger`, "Review in Henosis" as a link; without a ratings rule only Approve and Deny.
- Messages edit themselves after a decision: buttons go, the result line (raters, ratings, average) takes their place with "(edited)"; a thread reply says who answered and how.
- The `text` fallback carries the whole sentence so push notifications read right.
- Contention: no primary button (the app does not pick a winner), `fields` for the two sessions with claim age, step and tokens, "X wins · Y wins · Split the file"; owners get their own line with "Ask Ana for the file · Wait for Dee". Memory conflicts reuse the shape.
- Mention replies post as "<Owner>'s agent", placeholder first then edited into the answer, context says which session, what it read, the cost, and that the session did not change; buttons "Steer the session with this · Remember for the team"; the owner's stream gets one line.
- The brief: sentence summary, Needs you with the answering link, sessions one line each, numbers as `fields`, actions "Open the overview (primary) · Approvals · n · Contentions · n"; one line and no buttons on a quiet morning; `/henosis brief` returns it ephemerally.
- Channels: project channel for sessions, team channel for mentions, management channel for contentions, memory conflicts and the brief; nobody is @mentioned, the context line names whose turn it is.

## Open questions
- The adapter today posts a plain Approve/Deny pair and parses no rating; the rating buttons need `vote:…:approve:<n>` action_ids and `chat.update` on the root after each vote. Does the adapter keep the posted `ts` per approval (it keeps one per session thread now)?
- Who is "Ana's agent" in Slack: a second bot user per member (real @mention, real membership) or the one Henosis app posting with `username` and `icon_url` overrides? The first is honest to "agents are members", the second is what Slack's API makes easy.
- Slack's three button styles cannot carry chocolate or apricot; the emblem is the only brand surface. Should a team's Team-look emblem replace the mark in Slack, as the anatomy card proposes?
- The brief's schedule and "skip when nothing ran" need a scheduler the server does not have; `project.brief()` exists and the slash command already returns it.
- Shot budget: the full board is 1440×6005 and does not fit 300 KB even at half scale, so shot-light is the top viewport, shot-dark is the approval section (`#t-approval`) and shot-mobile is the same section at 390; both full boards were rendered and checked during the work.
