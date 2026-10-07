# Manager overview · notes

## The idea
The team page opens with one plain sentence the manager can read in three seconds ("4 open sessions across 2 projects … 3 things need you. This week the team spent 212k tokens, rated 7 plans and held 2 release gates"), and everything below it is that sentence unfolded in the order a manager asks: what needs me, where the week went, what was planned and gated, who is in which crew and group, and the roster of people and agents as one list. Tokens are charted in a single hue (the hand) with the value at the tip, a hover readout and a table twin, so the page reads as a ledger and never as a dashboard of colours; the only colours are the three need-you stripes (apricot plan, navy→chocolate gate, red contention) and the status tags. People and agents sit in the same stat tile ("8 members: 4 people · 4 agents"), the same roster grid and the same group rows, which is the product's point.

## What to keep
- The lede: title, one sentence with the counts in medium weight and the token figure in mono, and the range control (Today / 7 days / 30 days) in the top right driving every number on the page.
- Needs-you as three cards with a kind label, a serif sentence that names the thing in italic, one line of why (the rule or the policy), who, and one action; the gate card carries its vote dots (1 of 2).
- The five stat tiles in a fixed order (Tokens with sparkline, Agents, Plans, Release gates, Members) with a detail line that splits each number (in/out, team/solo, approved/revised/waiting, granted/waiting, people/agents).
- Charts in the app's viz grammar: one hue, surface-gap tracks, 4px data ends, value at the tip, a one-line reading under each bar chart, the area with 10% wash, crosshair readout and a legend that says cache reads are not in the line.
- Plans as rows with the stars, the average in mono, the estimate-vs-actual with green "under" or amber "+38%"; gates with the rule in mono and the votes as avatar + number, plus a dashed empty avatar for the missing voice; a "Gate health" row with the median wait.
- Crews with "together" tokens and who has the baton; groups with the hash name, a stack of members (agents with the agent avatar shape) and the last thing that happened in them.
- Roster cards: people with a green ring when online and their week's tokens, agents with their status and crew; both in the same grid.
- Mobile: rail hidden, one column, stat tiles two-up, bar labels at 92px, tooltips off.

## Open questions
- Is the sentence computed from the ledger allowed to add the week's figures (tokens, plans, gates), or should it stay the live-count sentence the app has today and leave the week to the tiles?
- The area chart buckets turns across all open sessions; a manager may want it by day instead. Which axis matches how people think about spend?
- "Gate health" (median wait for a second vote) is new: is that a number leads want on the overview, or does it belong in the gate policy page?
- Should Plans show closed sessions' plans (Tax rate lookup) on the overview, or only plans of open sessions, with the rest behind "All plans"?
- The hover readout on bars is shown as a static state (Cy); in the app it should sit above the row without covering the neighbour's value. Does it need the percent, or is the mono number enough?
- Per-person tokens next to names in the roster may read as a league table. Keep, or show only in the chart?
