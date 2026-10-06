# Brand: Henosis

*Unity between the people and the agents of a team.*

## Name

Henosis (ἕνωσις) is the Greek word for unity: the moment many become one. In this product
that happens three ways. A session is one shared, living place where several people and
several agents work on the same thing. A branch that comes back is *united* into main. And a
newcomer, human or agent, is brought into the circle of a session that is already under way.
Three syllables, one meaning, and no other company in the category owns it. Package scope
`@henosis/*`, binary `henosis`, environment variables `HENOSIS_*`, deep links `henosis://`.

## Mark

A ring, open at the top, and the bead that completes it. The ring is the team and the session
they share; the gap is the place kept for whoever comes next; the bead is the newcomer settling
into it. On a Dress Blues disc the ring is Apricot Illusion and the bead Chocolate Fondant with
an apricot edge, so the mark carries all three colours of the palette and one idea: someone
joins the circle. It survives at 16 px because the gap is a quarter of the ring and the bead is
the largest single shape. Files: `design/mark.svg`, `design/logo.svg` (mark plus the wordmark
in Instrument Serif), `design/favicon.svg`; inline in the app as `Mark` in `apps/web/src/ui.tsx`.

The mark moves. **Joining** (`.mark.joining`): the bead travels once round the ring and settles
into the gap, then rests a beat before it goes again; this is the loading motion for anything
that connects or joins, and the hero on the home page. **Settling** (`.mark.settle`): the ring
draws itself and the bead drops into the gap once; the rail's mark does this when the app has
loaded. Nothing else about the mark moves. Without motion the bead simply sits in the gap.

A team may change what sits on the disc (see *Team customisation*): the ring and bead, the bead
alone, or a plain dot carrying the team's emblem. The disc and the ring colours follow the team.

## Palette

| Role | Pantone | Hex | Use in the vibrant system |
|---|---|---|---|
| Dress Blues | 19-4024 TCX | `#2A3244` | The surface: the rail in light mode, the disc of the mark, the dark end of every gradient, body text on cream |
| Chocolate Fondant | 19-1432 TCX | `#56352D` | The action: primary buttons, links, the send button, the bead, the warm end of every gradient |
| Apricot Illusion | 14-1120 TCX | `#E2C4A6` | The live colour: the crease, the driver ring, selection, contention, the ring of the mark, every glow |
| Cream | derived | `#FBF7F1` | The canvas in light mode, washed apricot-to-cream at the top |
| Night | derived | `#1C2130` | The canvas in dark mode; the rail goes one step deeper |
| Semantic | tuned | olive `#5F7F4B`, amber `#B9792E`, brick `#A8463A`, slate `#4F6A8C` | running, awaiting, blocked, paused; lightened on the rail and in dark mode |

v5 turns the volume up without adding a colour. The rail is Dress Blues with cream text and
apricot accents, so the navigation reads like a native app's sidebar. The canvas is cream with a
faint radial wash of apricot at the top. Chocolate is the only action colour. Apricot glows
around anything live: the running dot, the driver's avatar, a composer in use, a contention. A
navy-to-chocolate gradient welcomes: the hero, empty states and the new-session button. The
focus ring is chocolate with an apricot halo. Dark mode stays navy with apricot: the canvas is
night, the rail a step deeper, the action colour becomes apricot.

Everything is a token in `design/tokens.css` (the web app's `apps/web/src/tokens.css` is a
verbatim copy). The team colours are custom properties (`--team-accent`, `--team-highlight`,
`--team-surface`, `--team-glow`) that the rest of the system reads, so a team's look is a
handful of properties on `<html>`.

## Type

Instrument Sans at 15 px with a 1.6 line height for everything that is read; Instrument Serif,
upright and regular, for everything that has a name: page titles, session titles, the wordmark,
people's names in the stream and the panel, crew names. JetBrains Mono only inside tool lines
for paths and commands. The serif is what makes a Henosis screen recognisable at a glance next
to claude.ai and ChatGPT, which are sans-only; it is never used for body text.

## Interface register

Henosis's interface stays in the register of claude.ai and ChatGPT, on purpose: one centred
conversation column (760 px), human directives as soft bubbles, the agent's words as plain text,
tool calls as collapsed grey lines ("Ran pnpm vitest · 31 passed, 1 failed"), approvals and
contentions as single notices with two buttons, one rounded composer at the bottom, hairlines,
rows rather than cards, no dashboards of tiles. What v5 adds is a native-feeling rail, warmth on
the canvas, and motion that says what just happened.

## Signature elements

- **The serif for names.** Titles, the wordmark, people and crews are set in Instrument Serif;
  the serif marks what has a name, the sans says what happened.
- **The bead.** The composer and every human message carry a small apricot bead at the
  top-right (`.folded`, and the built-in beads in `tokens.css`): the newcomer's mark, repeated
  where a person's words enter the session. Agent text is plain and has no bead.
- **One crease.** A single hairline in Apricot Illusion between the rail and the canvas; all
  other rules are grey.
- **The glow.** Apricot around anything live: the running dot pulses it, the driver's avatar
  wears it, the composer takes it while someone writes.

Smaller marks that follow from them:

- **Driver ring.** The avatar holding the baton carries a 2 px apricot ring and a soft glow;
  a handoff moves the ring.
- **Status words** with a small dot, never pills: running, awaiting approval, blocked, paused,
  idle. The same five words everywhere, in Slack too.
- **Attribution line** on every memory entry: "added by Ana · session billing-42 · commit 9f3c1a".
- **Solo / Team pill.** The one word on an agent card that says whether one person steers it or
  several, with the avatars of who is in it and "with Bo, Dee". The word crossfades when the
  answer changes. A crew header carries a tiny open ring before its serif name.

## Motion

Motion in Henosis says that someone or something joined, finished, or is still going. It never
decorates. The principles:

1. **The rest state is the end state.** Every animation moves opacity, transform or a stroke
   and ends where the element would sit without it. Turning motion off changes nothing but time.
2. **Three durations, three easings.** 120 ms for a press, 200 ms for a change, 320 ms for an
   arrival; `arrive` decelerates, `leave` accelerates, `move` does both. Loaders loop at 1.4 to
   1.8 s. Nothing needs a fourth number.
3. **Closing is faster than opening.** A card arrives in 320 ms and leaves at once.
4. **Stagger by 36 ms, capped at eight.** The rail's cards slide in one after another.
5. **Two switches, both honoured everywhere.** The system's reduced-motion preference and a
   team's `motion: "calm"` (as `data-motion="calm"` on `<html>`). `--motion` is 1 or 0 for
   anything that must know; `useMotion()` tells a component.

The loaders (`Loader` in `ui.tsx`, classes in `tokens.css`):

- **join** — the mark, bead travelling round the ring into the gap. Connecting, joining,
  reconnecting a session.
- **orbit** — three dots in the three palette colours orbit and converge to one. Short waits.
- **weave** — a 4 px bar of two strands, chocolate and apricot, weaving across. A long operation,
  under the top row.
- **shimmer** — skeleton rows with an apricot sheen. Where a list or a view will be.

The side animations: a rail card slides and fades in; the running dot pulses an apricot halo;
an approval badge pops; an avatar ripples when its person joins the session; a toast slides up;
the check draws itself when an approval is granted; the send button presses and leaves a ring;
the Solo/Team word crossfades; the brand mark's bead settles when the app has loaded; a team's
colours crossfade when a route enters that team.

## Team customisation

A team may make the system its own without leaving the system. A lead or manager of the team
(users.json roles; an org admin may too) sets, in Settings under *Team look*:

- **Colours**: accent, highlight, surface and glow, as `#RRGGBB`. Three presets made only of
  the palette (Fondant, Apricot, Blues) and custom fields with contrast checks: the accent
  against the cream canvas and the text on it (4.5:1), the rail text on the surface (4.5:1),
  the highlight on the surface (3:1). Low contrast is shown, not blocked.
- **Mark**: ring (the mark), bead (the newcomer alone) or dot (a plain disc with the emblem).
- **Motion**: full or calm.
- **Emblem**: one or two letters shown beside the wordmark in the rail.

The rules: the palette stays the default and every field is optional; a theme is a handful of
custom properties on `<html>`, applied only while the route belongs to the team (its page, a
project in it, a session of that project) and crossfaded in half a second; the serif, the
column, the hairlines, the status words and the voice never change. Stored as `theme` on the
team in `orgs.json`, validated by `TeamTheme` in `@henosis/fleet`, read and written through
`GET`/`PUT /api/teams/:teamId/theme`.

## Voice

Calm, specific, in the words of unity. "Ana is driving." "Bo joins the circle." "Bo offers the
baton to you." "Course changed: schema freeze until Thursday." "United pdf-layout into main."
The driver holds *the baton*; a handoff *offers the baton*; a merge *unites* a branch; a
newcomer *joins the circle*. Never "AI-powered".

## Surfaces

`design/index.html` (brand board, motion and components), `web-session.html`,
`web-session-details.html`, `web-project.html`, `web-team.html`, `mobile.html`, `desktop.html`,
all on `design/tokens.css`, which the web app copies verbatim. The desktop and mobile shells load
the same client, so the three are one product the way Claude on the web, Claude Desktop and
Claude mobile are.
