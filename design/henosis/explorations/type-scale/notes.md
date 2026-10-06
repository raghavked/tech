# Type scale and rhythm

## The idea
Three voices, fourteen named steps, one beat. Instrument Serif says who (titles, people, agents, crews, groups, branches), Instrument Sans says what (messages, briefs, plans, controls, captions) and JetBrains Mono says how much (tool lines, paths, tokens, money, times), so a reader knows the kind of thing before reading the word. Every step is a `--t-*` token used as one `font:` shorthand with a px line height that is a multiple of 4, and prose in the 780px column stops at a 600px measure (about 85 characters of Body) while cards and tables take the full 732px.

## What to keep
- The fourteen steps and their px line heights (Display 40/44, Title 26/32, Name 20/24, Name small 16/20, Body 15.5/24, Text 15/24, UI 14/20, Caption 13/20, Micro 12/16, Kicker 11.5/16, Mono 13/20, Mono small 12.5/16, Figure 28/32, Figure large 40/44). They should move into tokens.css and replace the `15px/1.6` ratios.
- `--measure: 600px` on agent prose in the column; human bubbles already stop at 85%.
- Weight rules: serif 400 + italic only, sans 400/500/600 by job, mono 400 with 500 for a total; `tabular-nums` on every mono number; a true minus and the danger colour for negatives.
- The phone scale that goes up for reading (Body and Text 16/24, Name small 18/24) and down for display (32/36, 22/28); 16px inputs so iOS does not zoom.
- The Tokens-by-agent and invoice tables as the reference for number columns (est, took, budget; qty, amount, tax).

## Open questions
- Is 600px right for the measure, or should it track the column (`min(600px, 82%)`) so the drawer-open layout does not leave agent prose too narrow?
- Body 15.5 versus Text 15: is half a point enough to feel the agent's voice, or should the difference be carried by the missing bubble alone and both sit at 15?
- The 4px baseline grid is a promise for stacked text; cards with 18px padding break it by two pixels. Round card padding to 16/20 or accept the drift inside cards?
- Serif italic is the only emphasis in names; do crews and branches both need it, or should branches move to mono (they are paths)?
- The chip "12.4k tokens" is mono in the top row but the sentence "spent 12.4k tokens" is sans; the rule is stated here but the app currently mixes them, so an audit of SessionView and the rail is the next step.
