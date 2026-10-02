# Brand: Tiller

*The tiller is what a crew's hands rest on to steer. Several hands can hold it; one holds
it at a time; handing it over is a deliberate act.*

## Name

The product's verbs are the tiller's: watch the course, redirect, hand off. A fleet of
agents started by different engineers is a fleet in the literal sense, and the lead who
sets the project's direction sets its course. "Tiller" is one plain word, two syllables,
easy to say in a meeting ("put it in Tiller", "who has the tiller on billing?"), and it
is not a generic AI name. Dress Blues, the navy the founder chose, makes the nautical read
natural without a single anchor or wave in the interface. Package scope `@tiller/*`, binary
`tiller`, environment variables `TILLER_*`, deep links `tiller://`.

## Mark

A navy hull arc, a chocolate tiller bar rising from the stern post and angling toward the
viewer's hand, and an apricot grip where the hand rests. Three strokes, each in one brand
colour, with one meaning: the vessel the crew shares, the lever one person holds, the hand on
it. Drawn as `design/mark.svg`; the wordmark pairs it with "Tiller" in Bricolage Grotesque
(`design/logo.svg`); the favicon sets the mark on navy with linen strokes
(`design/favicon.svg`). The mark survives at 16 px because its three shapes do not touch.

## Palette

| Role | Pantone | Hex | Use |
|---|---|---|---|
| Dress Blues | 19-4024 TCX | `#2A3244` | Chrome: top bar, rails, dark-mode ground, the hull |
| Chocolate Fondant | 19-1432 TCX | `#56352D` | Brand voice: primary buttons in light mode, the human stripe, the tiller bar |
| Apricot Illusion | 14-1120 TCX | `#E2C4A6` | The single accent: course line, driver ring, selection, contention, the grip |
| Linen | derived | `#F3EEE7` | Light-mode content ground (warm, not cream) |
| Navy deep | derived | `#1B2130` | Dark-mode content ground |
| Semantic | tuned | olive `#5F7F4B`, amber `#B9792E`, brick `#A8463A`, slate `#4F6A8C` | running, awaiting, blocked, paused; lightened for dark mode |

The product is dark-first in its chrome and linen in its content, so both themes are
designed rather than inverted. Apricot is used sparingly; when it appears, it means
"a human's attention is here" (who is driving, what is contended, where the course is).

## Type

Bricolage Grotesque for titles and the wordmark (characterful, slightly compressed at
display sizes), Instrument Sans for interface text, JetBrains Mono for the event stream,
keys, paths and every number. The event stream is monospace on purpose: it is a log, and it
should read like one.

## Signature elements

- **Course line.** A 3 px apricot rule under the top bar with a dot per turn and a brighter
  dot per epoch; the catch-up brief points at it ("since you were last here").
- **Driver ring.** The avatar holding the tiller carries a 2 px apricot ring; handoff moves
  the ring.
- **Status pills** with a leading dot: running (pulsing), awaiting approval, blocked,
  paused, idle. The same five words everywhere, in Slack too.
- **Attribution line** on every memory entry: "added by Ana · session billing-42 · commit
  9f3c1a".

## Voice

Calm, specific, maritime only in the verbs. "Ana has the tiller." "Bo is offered the
tiller." "Course changed: schema freeze until Thursday." Never "AI-powered".

## Surfaces

`design/index.html` (brand board and components), `web-session.html`, `web-fleet.html`,
`web-management.html`, `slack.html`, `mobile.html`, `desktop.html`, all on
`design/tokens.css`, which the web app copies verbatim. Desktop and mobile shells load the
same client, so the three are one product the way Claude on the web, Claude Desktop and
Claude mobile are.
