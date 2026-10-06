# Token optimisation · notes

## The idea
The optimisation panel is the plan card read as money: three quantities, spent (chocolate), forecast (hatched apricot) and planned (the apricot track with its estimate tick), on one line against the soft budget, then the same three per step so a person sees where the plan was right and where it drifted. The forecast is plain and explained in one sentence (done steps ran 14% under; the rest scales the same), so it never reads as a verdict. Suggestions are verbs the agent proposes and a person performs: compact context, reuse a memory entry someone else wrote, trim a read, raise a budget, each with its gain in mono green and the name of whoever acted; the manager variant sums the same quantities by project, person and agent so Dee reads "Payments is 7% under plan, Checkout will finish over" and acts from the same cards.

## What to keep
- One track, three quantities: spent, forecast (hatched), planned (track + tick). The budget is the end of the track; amber past 80%, red past 100%; never a second bar. "No plan" is spend only.
- Per-step rows: estimate bar above, actual below, on one scale (largest estimate is full width). Under is green, over is amber and says why in the plan card, never red. Running shows "so far" in chocolate with a hatched remainder; pending shows forecast only, hatched, with "~" numbers.
- The forecast line as the panel's hero: "~26.9k of the 40k budget · 4.3k under plan" in serif, the sentence that explains the method lives at the foot.
- Savings as three tiles (under estimate, cache share, saved by a person's compact) plus "why" lines that credit the memory entry and its author.
- Suggestion card: icon, verb, gain, one button in the title row, two lines of why with names in serif. Primary button only on the largest open gain; applied keeps the person's name; dismissed fades and stays; owner-only actions show a waiting button, not a hidden one.
- The panel is a third column at 424px beside the stream, toggled by "Optimise" in the top row, with Session / Project tabs; on mobile it is a sheet over the session with the same blocks, descriptions cut to one line.
- The manager variant: a sentence first, then by project (track, planned, forecast of budget, savings), by person and agent (spent vs plan, cache share, memory entries reused), and the project's open suggestions with "Ask Bo" as the act when the fix belongs to someone else.

## Open questions
- Forecast method: scaling pending steps by the ratio of done steps is honest but naive; should it also use the project's history for the same kind of step (the manager has it), and should the panel say which it used?
- "Compact now" changes what the agent sees mid-plan; does it need the driver's hand only, or can any contributor press it, and should the stream show a notice ("Ana compacted the context · 2.3k saved")?
- "Reuse memory" attaches an entry written by another agent; if the curator later flags it stale, does the saving get retracted in the ledger?
- Savings attributed to a person's compact is a count the kernel can only estimate (tokens the removed context would have cost per remaining turn); is an estimate acceptable in a ledger that otherwise replays to the same number?
- The manager's "Raise budget" sits beside optimisation suggestions; is a budget change an optimisation at all, or does it belong on the project policy page with a link from here?
