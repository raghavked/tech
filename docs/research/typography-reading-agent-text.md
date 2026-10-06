# Typography for reading long agent output

Slug: typography-reading-agent-text. Date: 2026-10-02. Access date for every URL below: 2026-10-02. Several vendor pages (jetbrains.com, type.today, practicaltypography.com, shadcn.io, developer.mozilla.org) were blocked by the egress proxy; facts from them come from search snippets and are marked UNVERIFIED.

## Why it matters for Henosis

Henosis's conversation column is where people spend hours: watching an agent narrate a refactor, reading a handoff brief, scanning twenty collapsed tool lines to find the one that failed. Unlike a chat with a friend, the agent's text is long, mixed (prose, paths, diffs, logs, JSON) and often read by someone who did not write the prompt. Three things follow. The prose measure must be set for sustained reading, not for a bubble. The monospace register must sit visually inside the sans text instead of shouting, because tool lines are most of the log. And the rhythm must survive streaming: text that appears token by token cannot reflow heights or the reader loses their place. Today `design/tokens.css` sets body at 15px/1.6 and agent text at 15.5px, with `.mono` at 13px and no block-code rule; the 760px column is specified but its inner text width is not. This memo fixes those numbers.

## Prior art

1. **Butterick, Practical Typography, "Summary of key rules" and "Line length"** (https://practicaltypography.com/summary-of-key-rules.html, https://practicaltypography.com/line-length.html). Body text: 45-90 characters per line including spaces; line spacing 120-145% of the point size. The measure is counted in characters, so it scales with the face and size, not pixels. (Page blocked; from snippets, UNVERIFIED in detail.)
2. **Anthropic / claude.ai type pairing** (https://type.today/en/journal/anthropic; https://www.webdesignhot.com/design.md/claude-ai/). Styrene (Berton Hasebe) for headlines and UI, Tiempos (Klim) for body; the public design.md-style extractions give body 16-17px at weight 400, labels 15px, serif display at 36-72px at light weights (330-400). The conversation column on claude.ai is a 48rem (768px) max width (from memory, UNVERIFIED). The lesson is a text-optimised serif with a generous x-height for reading, and a neutral grotesque for everything the eye should skip.
3. **Klim, Tiempos design information** (https://klim.co.nz/blog/tiempos-design-information). Tiempos Text is the optical size cut for dense body copy: generous x-height, adnate serifs, disciplined contrast so the colour of the page stays even over long reading. Henosis does not use a serif for body, but this is the benchmark for "even colour" that Instrument Sans must hit.
4. **OpenAI Sans / ChatGPT scale** (https://webdesignerdepot.com/openai-gets-a-fresh-look-new-logo-custom-font-and-a-more-human-feel/; https://www.shadcn.io/design/openai). The extracted scale is 13/14/16/17/18/22/28/48px, weights 400/500/600 only, caption 13px at 1.51, input and body 16px at 1.5, body-lg 18px at 1.32; tracking -0.01em at 22px and below. ChatGPT's message column is `max-w-3xl` (48rem/768px) with 16px prose at roughly 1.75 line height (from memory, UNVERIFIED). The lesson: a short size ladder, three weights, and a column near 768px.
5. **JetBrains Mono** (https://www.jetbrains.com/lp/mono/; https://github.com/JetBrains/JetBrainsMono). Lowercase height is maximised at standard width (the README says "increased x-height"), 8 weights with italics, 142 ligatures (snippet, UNVERIFIED), and the landing page recommends 13px with 1.2 line spacing for code editors (snippet, UNVERIFIED). Because the x-height is deliberately large, JetBrains Mono at the same nominal size looks bigger than most sans faces.
6. **CSS `font-size-adjust`, Baseline since July 2024** (https://web.dev/blog/font-size-adjust?hl=en; https://developer.mozilla.org/docs/Web/CSS/font-size-adjust). Lets a font-size be expressed as an x-height ratio (`ex-height <number>` or `from-font`), so a monospace or fallback face renders with the same lowercase height as the surrounding text. Supported in all current engines.
7. **Instrument Sans** (https://fonts.google.com/specimen/Instrument+Sans/about). Variable, two axes (wght 400-700, wdth), 12 stylistic sets, by Rodrigo Fuenzalida and Jordan Egstad. No optical-size axis, which means one drawing must serve 12px captions and 34px titles; the width axis is the lever for small sizes.

## What to borrow

- **Measure by characters, not pixels.** At 15px Instrument Sans averages about 7.2px per character, so a 760px column is roughly 105 characters: over Butterick's ceiling. The column stays 760px for alignment with the composer, but the text must sit in a narrower inner box, or the size must rise to 16px.
- **One size for all agent prose, three weights, no tracking tricks** (OpenAI). The agent's markdown headings should be weight-and-space changes, not new sizes.
- **Line height tied to measure** (Butterick's 120-145%, ChatGPT's 1.5-1.75 for a wide column). A 76-85 character line wants 1.6-1.65; tighter lines (sidebar, tool lines) want 1.4-1.45.
- **Optical-size thinking without an opsz axis** (Tiempos, Styrene): use Instrument Sans's width axis slightly wider at 12-13px and weight 500 for labels so small text does not look thin on the warm paper.
- **Normalise the mono's x-height to the sans** rather than trusting nominal sizes (JetBrains Mono's large lowercase plus `font-size-adjust`).

## What is unsolved

- Nobody has published measured data on reading streamed text. Line-height and reflow discipline below are inferred from stable-layout practice, not from studies.
- The right treatment for very long tool output (thousands of log lines) inside a 760px column is still an open design question: wrap, scroll, or truncate each loses something.
- Instrument Sans's exact x-height ratio and the width-axis range are not stated on Google Fonts; the 0.52 aspect value below should be measured from the font file before shipping.
- Dark mode on a navy ground (#1F2430) makes thin strokes bloom; whether weight 400 or 450 is correct there needs a side-by-side on real displays.

## Concrete recommendations for Henosis

All land in `design/tokens.css` unless stated; the three HTML mocks in `design/` and the Tauri shell in `apps/desktop` inherit them.

1. **Agent prose at 16px/1.65, inner measure 680px.** Replace `.msg.agent .text { font-size: 15.5px }` with `font-size: 16px; line-height: 1.65` and add `.msg .text { max-width: 680px }` inside the 760px column (the remaining 80px is the gutter for avatar and meta). 680px at 16px Instrument Sans is about 83 characters: inside the 45-90 band. Keep `body` at 15px/1.6 for chrome (sidebar, topbar, meta).
2. **A five-step size ladder, nothing else:** 12 (timestamps), 13 (meta, tool lines, code), 14 (sidebar, human bubbles at 15), 16 (agent prose), 34 serif (title). Add tokens `--t-xs: 12px; --t-sm: 13px; --t-ui: 14px; --t-body: 16px; --t-title: 34px` and have the mocks reference them. Delete the ad-hoc 11.5px and 15.5px.
3. **Headings inside agent markdown change weight and space, not size.** In `.msg.agent .text`: `h1,h2 { font-size: 1em; font-weight: 600; margin: 1.25em 0 0.35em }`, `h3 { font-size: 1em; font-weight: 500 }`, `p + p { margin-top: 0.75em }`, lists at `padding-left: 1.25em` with `li + li { margin-top: 0.25em }`. One paragraph gap of 12px, never a blank line's worth.
4. **Mono normalised to the sans x-height.** Set `code, kbd, .mono { font-family: var(--mono); font-size-adjust: ex-height from-font; font-size: 0.875em; font-variant-numeric: tabular-nums; font-feature-settings: "liga" 0 }` for inline code (16px prose yields 14px mono), and keep ligatures off: an agent quoting `->` or `!=` must show the literal glyphs the engineer will type. Measure the Instrument Sans x-height ratio (expected near 0.52) and, if `from-font` over-adjusts, pin `font-size-adjust: 0.52` on `body` instead so both faces share one lowercase height.
5. **Code blocks and tool output are two different components.** `pre.code { font: 13px/1.55 var(--mono); padding: 12px 14px; background: var(--bg-2); border: 1px solid var(--line); border-radius: var(--radius); overflow-x: auto; white-space: pre; tab-size: 2 }` for source. `pre.log { white-space: pre-wrap; overflow-wrap: anywhere; max-height: calc(24 * 1.55 * 13px); overflow-y: auto }` for stdout, with a "show all" affordance rendered by `packages/protocol`'s tool-result event. Both get the `.folded` corner only when they are the agent's final deliverable, not for every run.
6. **Tool lines at 13px/1.45, Instrument Sans with mono fragments.** The collapsed line ("Ran pnpm vitest · 31 passed, 1 failed") stays in the sans at 13px, `--fg-2`; only the path or command span inside it is `.mono` at `font-size: 1em` (12.5-13px after adjust). Counts use `tabular-nums` so streaming updates do not jitter.
7. **Streaming must not reflow.** Give the agent message `min-height: 1lh` per started line via `contain: layout paint` on the message, render markdown into the existing block rather than replacing it, and never change `line-height` between the streaming and final states. Load fonts with `font-display: swap` plus a metric-matched local fallback (`@font-face { font-family: "Instrument Sans Fallback"; src: local("Arial"); size-adjust: 97%; ascent-override, descent-override }` tuned with Fontaine or Capsize) so the first paint and the webfont paint have the same line count. Lands in `design/tokens.css` and `apps/web`'s document head.
8. **Dark mode weight.** On `[data-theme="dark"]`, set agent prose `font-weight: 450` via the variable axis and `-webkit-font-smoothing: antialiased` stays; verify against the 400 case on a non-retina display before adopting.
9. **Width axis for small text.** `.sidebar .section, .msg .meta, .tool-line { font-variation-settings: "wdth" 104; font-weight: 500 }` to give 12-13px text more air instead of raising its size.
10. **Mobile (secondary):** same tokens, prose 16px/1.6, measure becomes `100vw - 32px`, code blocks switch to `pre-wrap` with `overflow-wrap: anywhere` so a 390px phone never scrolls horizontally. Lands in `design/mobile.html` and `apps/mobile`.

## Sources

- https://practicaltypography.com/summary-of-key-rules.html (UNVERIFIED, blocked)
- https://practicaltypography.com/line-length.html (UNVERIFIED, blocked)
- https://type.today/en/journal/anthropic (UNVERIFIED, blocked)
- https://www.webdesignhot.com/design.md/claude-ai/
- https://klim.co.nz/blog/tiempos-design-information
- https://webdesignerdepot.com/openai-gets-a-fresh-look-new-logo-custom-font-and-a-more-human-feel/
- https://www.shadcn.io/design/openai (UNVERIFIED, blocked)
- https://www.jetbrains.com/lp/mono/ (UNVERIFIED, blocked)
- https://github.com/JetBrains/JetBrainsMono (README fetched)
- https://web.dev/blog/font-size-adjust?hl=en
- https://developer.mozilla.org/docs/Web/CSS/font-size-adjust (UNVERIFIED, blocked)
- https://fonts.google.com/specimen/Instrument+Sans/about
- https://github.com/anthropics/claude-code/issues/57991 (uncapped column complaint, 720-820px proposal)
