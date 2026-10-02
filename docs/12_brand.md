# Brand: Fold

*Bring the team into the fold.*

## Name

A fold is where two things meet and become one. In this product that happens three ways:
a branch merges back (fold), the kernel folds events into state (`fold(events)` is the
reducer's actual name), and a teammate is brought into the fold of a running session. One
syllable, a verb engineers already use, and no other company in the category owns it.
Package scope `@fold/*`, binary `fold`, environment variables `FOLD_*`, deep links
`fold://`.

## Mark

A Dress Blues sheet with its top-right corner folded down. The corner shows Apricot
Illusion on the folded face and Chocolate Fondant on the underside it reveals, with a linen
crease between them. One shape, three brand colours, one meaning: something has been
brought in. It survives at 16 px because the fold is a quarter of the sheet, and it sets on
navy (favicon) by keeping the crease linen. Files: `design/mark.svg`, `design/logo.svg`
(mark plus wordmark in Bricolage Grotesque), `design/favicon.svg`.

## Palette

| Role | Pantone | Hex | Use |
|---|---|---|---|
| Dress Blues | 19-4024 TCX | `#2A3244` | Chrome: top bar, rails, dark-mode ground, the sheet |
| Chocolate Fondant | 19-1432 TCX | `#56352D` | Brand voice: primary buttons in light mode, the human stripe, the underside of the fold |
| Apricot Illusion | 14-1120 TCX | `#E2C4A6` | The single accent: course line, driver ring, selection, contention, the folded corner |
| Linen | derived | `#F3EEE7` | Light-mode content ground (warm, not cream); the crease |
| Navy deep | derived | `#1B2130` | Dark-mode content ground |
| Semantic | tuned | olive `#5F7F4B`, amber `#B9792E`, brick `#A8463A`, slate `#4F6A8C` | running, awaiting, blocked, paused; lightened for dark mode |

The product is dark-first in its chrome and linen in its content, so both themes are
designed rather than inverted. Apricot is used sparingly; when it appears it means "a
human's attention is here": who is driving, what is contended, where the course is.

## Type

Instrument Sans at 15 px with a 1.6 line height for everything that is read; Instrument
Serif, upright and regular, for everything that is named: page titles, session titles, the
wordmark, people's names in the stream and the panel, crew names. JetBrains Mono only inside
tool lines for paths and commands. The serif is what makes a Fold screen recognisable at a
glance next to claude.ai and ChatGPT, which are sans-only; it is never used for body text.

## Interface register

Fold's interface is in the register of claude.ai and ChatGPT, on purpose: a quiet sidebar of
sessions and projects, one centred conversation column (760 px), human directives as soft
bubbles, the agent's words as plain text, tool calls as collapsed grey lines ("Ran pnpm
vitest · 31 passed, 1 failed"), approvals and contentions as single quiet notices with two
buttons, and one rounded composer at the bottom. No inspector, no dashboards of tiles, no
chrome bars. The research behind this (claude.ai's warm canvas and type pairing, ChatGPT's
sidebar and composer, Linear's single-accent discipline) is in `10_sources.md`; the rule
that matters most is that the only strong colour on a screen is the send button.

## Signature elements

Three things carry the brand on every screen; everything else is the quiet register above.

- **The serif for names.** Titles, the wordmark, people and crews are set in Instrument
  Serif; the serif marks what has a name, the sans says what happened.
- **The folded corner.** The composer and every human message carry a small apricot turn at
  the top-right (`.folded` and the built-in corners in `tokens.css`): the mark, repeated
  where a person's words enter the session. Agent text is plain and has no corner.
- **One crease.** A single hairline in Apricot Illusion between the sidebar and the content;
  all other rules are grey.

Smaller marks that follow from them:

- **Driver ring.** The avatar holding the session carries a 2 px apricot ring; handoff moves
  the ring.
- **Status words** with a small dot, never pills: running, awaiting approval, blocked,
  paused, idle. The same five words everywhere, in Slack too.
- **Attribution line** on every memory entry: "added by Ana · session billing-42 · commit
  9f3c1a".
- **The fold itself** as the merge affordance: the branch panel's merge button carries the
  mark.
- **Solo / Team pill.** The one word on an agent card that says whether one person steers
  it or several, with the avatars of who is in it and "with Bo, Dee". A crew header carries a
  tiny folded square before its serif name.

## Voice

Calm, specific. "Ana is driving." "Bo is offered the session." "Course changed: schema
freeze until Thursday." "Folded pdf-layout into main." Never "AI-powered".

## Surfaces

`design/index.html` (brand board and components), `web-session.html`, `web-fleet.html`,
`web-management.html`, `slack.html`, `mobile.html`, `desktop.html`, all on
`design/tokens.css`, which the web app copies verbatim. The desktop and mobile shells load
the same client, so the three are one product the way Claude on the web, Claude Desktop and
Claude mobile are.
