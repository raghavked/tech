# Cost forecast · notes

## The idea
Cost forecast is the owner's money page: one sentence says what October will cost and who to watch, then one chart proves it (dollars so far as a solid line, the pace carried forward as a dashed line inside a band that widens to ±8% by month end, the soft budget as a dotted line and its 80% hairline in amber with a dot where the pace crosses it), with four stat tiles above it and the pace rule written in the subtitle. The right column is Alerts, because a forecast is only useful if someone is told: five rules with switches that each say who hears and where (Bo by inbox and email, the team's lead, the driver, #payments), and a Fired-this-month list with who acknowledged and what they did about it. Below, By team is one table of tokens, spend, projected spend and a two-layer meter per team (solid is spent, tinted is the pace, a tick at 80%), and the team that is over opens into Where Payments spends: the same $131 by person, by agent and by work, so the lead can see that fourteen retries of a blocked tax-rate lookup are nine of the dollars.

## What to keep
- One money series in the hand (`--accent`), band at 8%, budget dotted in `--ink-3`, the 80% line in `--warn`; input and output keep the usage-charts contract (navy / chocolate stepped into the chart band) and never appear in the forecast itself.
- The pace rule said out loud ("pace from the last five weekdays and two weekend days") and the foot that says the band's top edge touches the budget on a date; a soft budget is "a number people watch, not a gate" on every page that shows one.
- The alert rule grammar: a condition in words, then "to <serif name> · channel"; fired entries carry the time, the acknowledgement in `--ok` and the action taken, so a forecast page doubles as the audit trail.
- The team meter: spent solid, pace tinted, amber at 80%, red tint when the pace passes 100%, and the status pill always with a date ("Over around 27 Oct"), never a bare percentage.
- Text halos (`paint-order: stroke` in the surface colour) on every chart label so labels can sit on lines; a separate 340-wide viewBox for the phone instead of a shrunken desktop chart; the mobile team rows re-laid two-up with the status beside the pace.
- The rail's Cost forecast item carries an amber 1 for the fired alert that nobody but Ana has acknowledged.

## Open questions
- The month-end band is a linear ±8%; after two weeks of data should it narrow, or should it widen for teams whose daily spend is lumpier (Payments swings $4 to $28 a day)?
- Team budgets add up to the workspace budget here ($500 + $450 + $300 + $250 = $1,500). Should the product enforce that, or let the workspace budget stand alone with the team numbers as guidance?
- "Pace lands a team over budget" fires once a day at 08:40 to the lead. Should it also post to the team's group so the people in the sessions see it, or is that the daily digest's job?
- The Tokens chip switches the whole page to token units; does the forecast chart keep its dollar band, or do tokens get their own 1.0M soft budget line as in the usage-charts exploration?
- Rate card: the page prices tokens at the workspace rate card with cache reads at the cache rate but never shows the rates; do they belong in a drawer here or only in Settings?
- Where Payments spends sums the same $131 three ways; "by work" needs a scope per session (Billing page, Checkout, Invoice PDF) that the product does not record yet.
