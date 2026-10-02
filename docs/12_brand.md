# Brand: Atelier

*The studio where your team and its agents work on one piece.*

## Name

An atelier is a workshop where a master, assistants and apprentices work on one commission
together: many hands, one piece, with clear authority about who decides. That is the product.
It reads as premium and editorial rather than infrastructural, which suits a tool whose job
is to make agent work a shared, living thing a whole team stands around, and it is one word
every team already knows. The repository, package scope (`@atelier/*`), CLI binary and
environment variables (`ATELIER_*`) all use it.

## Palette

The three Pantone colours the founder chose, with derived tints and functional colours that
harmonise with them. Defined once in `design/tokens.css` and reused by the web app.

| Role | Pantone | Hex | Use |
|---|---|---|---|
| Chocolate Fondant | 19-1432 TCX | `#56352D` | Text on light surfaces, headings, primary buttons |
| Apricot Illusion | 14-1120 TCX | `#E2C4A6` | Warm surfaces, accents, hero wash, selected states |
| Dress Blues | 19-4024 TCX | `#2A3244` | App chrome, dark-mode background, the mark's third stroke |
| Paper | derived | `#F6EEE4` | Light-mode page background |
| Apricot light | derived | `#F0DDC6` | Cards and panels on paper |
| Chocolate deep | derived | `#3E2521` | Hover and pressed states |
| Navy deep / mid | derived | `#1C2230` / `#3A4458` | Dark-mode surfaces and borders |
| Approval amber | functional | `#C98A3B` | Awaiting approval, alerts |
| Success olive | functional | `#6F8B5A` | Running, granted, clean |
| Danger brick | functional | `#B4473A` | Blocked, denied, conflicts |
| Info slate | functional | `#5B7390` | Paused, informational |

Borders are chocolate at 15% alpha; radii are 12px; spacing is an 8px grid; the only
gradient is a subtle apricot wash on hero surfaces. Both themes are first-class: light is
paper and apricot with chocolate text; dark is navy with apricot accents.

## Mark and wordmark

The mark is three strokes, one in each brand colour, converging on one apex into an
abstract "A": many hands, one piece. The wordmark is "Atelier" in Fraunces (a serif with
optical sizes) beside it; UI text is Inter. Files: `design/logo.svg` (mark and wordmark),
`design/mark.svg`, `design/favicon.svg` (mark on navy).

## Voice

Calm, editorial, precise. Sentences, not labels. The product tells people what the agent is
doing and who decided what; it never cheers. Status words are the same everywhere: running,
awaiting approval, blocked, paused, idle.

## Surfaces

The mockups in `design/` show the brand page and component gallery, the web session view,
the project fleet board, the management dashboard, the Slack integration, the mobile
companion (three phone frames) and the desktop shell. Every screen uses the same tokens, so
the web app, the desktop wrapper and the mobile wrapper are visibly one product, in the way
Claude on the web, Claude Desktop and Claude mobile are one product.
