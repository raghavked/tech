# Premium product UI: what the best work does, and ten elements for Henosis

## What the best work does

**Hairlines, not boxes.** Across Linear, Raycast, Resend and Vercel, almost every edge is a 1px line a few steps above the canvas (#23252a on Linear, #2f3031 on Raycast, or white at 6–10% alpha). Vercel draws its border as a ring, `box-shadow: 0 0 0 1px`, so it never changes layout. Sections separate with one horizontal rule or with empty space, never with coloured bands ([PageProofer, Precision Dark](https://pageproofer.com/inspiration/precision-dark/); [Style Gallery, developer-tool direction](https://style.gallery/library/expression/directions/developer-tool/)).

**Depth from light and tone, not drop shadows.** Surfaces step up 1–3 shades from the canvas (Linear: #010102 → #0f1011 → #141516 → #18191a; Raycast: a four-step ladder #1C1C1E → #3C3C3C). Shadows are reserved for things that float: menus, popovers, the command palette, toasts. Where a shadow is used it is a stack of very-low-alpha layers, never one heavy drop ([buildmvpfast, Linear decoded](https://www.buildmvpfast.com/blog/linear-aesthetic-tokens-density-keyboard-first-ux-2026); [protoLabs design philosophy](https://docs.protolabs.studio/dev/design-philosophy); [kiroxy reference gallery](https://github.com/nopperabbo/kiroxy/blob/main/docs/REFERENCE_GALLERY.md)). On light canvases the recipe that reads as "a physical object resting on a surface" is border plus shadow together: `border: 1px solid rgb(0 0 0 / 0.06); box-shadow: 0 1px 2px rgb(0 0 0 / .04), 0 4px 12px rgb(0 0 0 / .04)` ([Dani Asyrofi, Interface Tuning](https://daniasyrofi.com/writing/details-that-make-interfaces-feel-better/)).

**One spacing scale, one radius vocabulary.** A 4px base with 4, 8, 12, 16, 24, 32, 48 is near-universal. Vercel sits on a single 6px radius for buttons, cards and inputs ("engineered, not bubbly"); Arc-style systems use large concentric radii. The rule that separates polished from almost-polished is concentric corners: inner radius = outer radius minus padding, so nested curves stay parallel ([Dani Asyrofi](https://daniasyrofi.com/writing/details-that-make-interfaces-feel-better/); [uiarc design.md](https://uiarc.dev/r/skills/arc/design.md); [Rauno Freiberg, Craft](https://rauno.me/craft)).

**Density is a feature; the type does the spacing.** Linear rows are 32–36px on 13px Inter at 1.4 line height; Raycast rows are 36–40px with 12px horizontal padding and fit seven results without scrolling. Tabular numerals and a mono face for anything a machine would print (IDs, timestamps, SHAs) ([buildmvpfast](https://www.buildmvpfast.com/blog/linear-aesthetic-tokens-density-keyboard-first-ux-2026); [kiroxy](https://github.com/nopperabbo/kiroxy/blob/main/docs/REFERENCE_GALLERY.md)).

**Colour is withheld, then spent.** Chrome is near-monochrome; one accent appears on roughly 5% of any view (Raycast red, Linear indigo, Cron's single orange). Status is a 6–8px dot with a label, never a pill.. Restraint reads as confidence ([Mantlr](https://mantlr.com/blog/stripe-linear-vercel-premium-ui); [Studio Maydit](https://studiomaydit.com/blog/linear-vercel-raycast-aesthetic); [Cron design atlas](https://geoffreymanda.github.io/design-atlas/styles/cron-calendar.html)).

**Motion is short and purposeful.** 100–160ms ease-out on hover and selection, under 300ms for anything structural, no ease-in, no ambient loops except a caret. Family's "dynamic tray" shows the other half: trays that change height so each transition is unmistakable, with a title and a back/dismiss glyph on every one ([Benji Taylor, Family Values](https://benji.org/family-values); [Style Gallery](https://style.gallery/library/expression/directions/developer-tool/)).

**Interaction density, not visual density.** Every element answers hover, focus, keyboard and paste; the UI documents its own shortcuts with `kbd` chips on the row. Visually sparse, behaviourally dense ([Mantlr](https://mantlr.com/blog/stripe-linear-vercel-premium-ui)).

**The warm-editorial counter-camp is where Henosis already lives.** Against dark dev-tool chrome, Anthropic, Granola, PostHog and Notion win differentiation with ivory canvases, warm near-black text (#1A1612, not cool grey), a serif at display sizes, one earth-tone accent and borders tinted toward the paper, `rgba(120,100,75,.12)` ([SeedFlip](https://seedflip.co/blog/anthropic-design-language); [Toimi, SaaS design 2026](https://toimi.pro/blog/best-saas-website-designs/)). The risk is now sameness: The New Yorker catalogued the cliché set: tracked-out eyebrows, italic serif highlights, stacked rounded outlines, ticker bars, neon under-glows. Keep the warmth, refuse the tells ([New Yorker](https://www.newyorker.com/culture/infinite-scroll/the-ai-design-aesthetic-thats-taking-over-the-internet)).

**People and agents in one room now has a grammar.** Atlassian's AMP reserves a shape for agents (hexagon) so circles stay human, leads attribution with the agent and tucks the invoking person behind at a 2px offset, and insists agents appear in presence piles, telepointers and view counts. Liveblocks ships agent presence with a TTL so stale agents vanish. Human+ guidance: highlight what the agent is touching, write an activity line not a spinner, stage agent writes as a pending state with per-change accept/reject ([Atlassian AMP](https://atlassian.design/amp); [Liveblocks presence](https://liveblocks.io/docs/use-cases/presence); [Fancy UI, Designing for Human+](https://ui.particle.academy/docs/designing-human-plus)).

## Ten elements for Henosis

1. **Paper-tinted hairline system.** `--line: rgb(86 53 45 / .10)` as every border, drawn as `box-shadow: 0 0 0 1px var(--line)`; shadows only on floating layers. Every screen. One set of lines holds people and agents in the same frame; nothing is boxed apart.

2. **Two-arc avatar ring.** One SVG `<circle>` with `stroke-dasharray` split into two arcs, Chocolate for the person, Apricot for the agent, `stroke-linecap: round`; the arcs close into a full ring when both are active. Session header and presence pile. The brand mark literally becomes the "who is here" indicator.

3. **Concentric tray stack.** Trays with `--r-outer: 20px` and children at `calc(var(--r-outer) - var(--pad))`, each successive tray a different height, title plus back glyph on every tray. Agent proposals and confirmations. Family's fluidity applied to agent hand-offs so a change of actor is unmistakable.

4. **Surface ladder, not shadows.** Four cream tokens stepping 2–3% in OKLCH lightness (`oklch(97% .012 70)` → `93%`) for canvas, panel, raised, overlay. Workspace and sidebar. Humans and agents sit on identical surfaces; elevation marks importance, never species.

5. **Labelled status dots.** 6px `border-radius: 50%` dots in Dress Blues (person), Apricot (agent working), with a `@keyframes` 1.2s opacity pulse only while an agent is mid-action, always with a text label. Member list, message gutter. Status is information, not decoration.

6. **Activity line instead of spinner.** A 13px Inter line, `font-variant-numeric: tabular-nums`, that reads "Mira is editing the budget" or "Scout is reading 3 files", with a blur-in `filter: blur(4px) → 0` at 140ms. Thread footer and file tree. The agent's work is narrated in the same voice as a colleague's.

7. **Pending-change hunk.** Agent edits render inline with `background: color-mix(in oklch, #E2C4A6 18%, transparent)` and a left `border-inline-start: 2px solid #E2C4A6`, with accept/reject per hunk via `kbd` chips. Document and code views. The person is editor, not rubber stamp; unity means symmetric undo.

8. **Shared-pointer glyph.** Telepointer SVG: a 16px chevron for people, the same chevron with a hexagonal notch for agents, name tag in Inter 12/500, movement interpolated with a spring. Canvas, doc and board. Agents move like teammates but never impersonate them.

9. **Fraunces as attribution, Inter as action.** Display names and session titles in Fraunces `font-variation-settings: "opsz" 144, "SOFT" 50` at 20–28px; every control and label in Inter 13–14px, weights 400/500 only, no uppercase eyebrows. Headers, cards, settings. The serif carries the human register; the sans carries the work both parties do.

10. **Keyboard-first room palette.** A `⌘K` palette using `backdrop-filter: blur(20px) saturate(160%)` over `rgb(250 246 240 / .78)`, 36px rows, `kbd` hint on the right, with people and agents listed in one result set with no mode switch. Everywhere. Addressing a person or an agent is the same gesture.
