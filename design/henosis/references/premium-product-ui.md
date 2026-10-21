# Premium product UI: what the best work does, and ten elements for Henosis

Research pass, October 2026. Sources are the teams' own write-ups where they exist, plus the galleries and the craft essays designers cite.

## What the best work does

**Structure is felt, not seen.** Linear's March 2026 refresh is the clearest statement of current taste: the sidebar dimmed "a few notches" so the work area wins, tabs shrunk to compact rounded chips, icons cut back and coloured icon backgrounds removed, separators that had "quietly proliferated" rounded and softened rather than multiplied ([Linear, A calmer interface](https://linear.app/now/behind-the-latest-design-refresh)). The 2024 redesign set the base: three inputs (base colour, accent, contrast) generate every surface in LCH, so elevation is a lightness step, not a shadow ([Linear, How we redesigned the UI](https://linear.app/now/how-we-redesigned-the-linear-ui)). Measured: hairlines #23252a, 15px/1.6 body, 8px buttons at 36px, 12px cards, a half-pixel inset white highlight on lifted panels ([PageProofer](https://pageproofer.com/inspiration/precision-dark/linear/)).

**Materials, not ad-hoc shadows.** Vercel's Geist names a short ladder: `material-base`/`material-small` at 6px on the page, `material-medium`/`material-large` at 12px, then floating `material-menu` (12px), `material-modal` (12px), `material-fullscreen` (16px); tooltips are the only floating element allowed a stem ([Geist Materials](https://vercel.com/geist/materials)). Colour is equally terse: gray 100–300 are backgrounds, 400–600 borders, 900–1000 text; "draw each border once"; shadows stay translucent so they never leave a grey halo ([Geist Colors](https://vercel.com/geist/colors)). The Web Interface Guidelines add `tabular-nums` for number columns, `text-wrap: balance` on headings, `:focus-visible` rings, "never `transition: all`" ([vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines)).

**Edges as light.** Raycast's chrome is a 1px border at 5–6% white plus a top inner sheen (`inset 0 1px 1px rgba(255,255,255,.15)`), not a fill; the primary button is a lit keycap of stacked inset shadows; radii cluster at 8 (buttons), 11 (keycaps), 12 (cards), 16 (window) ([devdojo Raycast reference](https://devdojo.com/inspiration/raycast)). Raycast's own post: the search bar grew because "almost every interaction goes through it" ([A fresh look and feel](https://www.raycast.com/blog/a-fresh-look-and-feel)).

**Concentric corners, layered shadow.** Outer radius = inner radius + gap, and an edge drawn as a 1px translucent ring stacked with a contact and an ambient shadow, so it survives tints and photos ([Interface Playbook](https://interfaceplaybook.vercel.app/)). Amie's light stack is canonical: `0 0 0 1px rgba(0,0,0,.06), 0 1px 1px -0.5px rgba(0,0,0,.06), 0 3px 3px -1.5px rgba(0,0,0,.06)` on #FAFAFA, a 4px grid carrying 60px rows and a 74px rail ([Amie reference](https://blakecrosley.com/guides/design/amie)).

**Density is interaction, not pixels.** Linear, Vercel and Stripe look sparse but every element answers hover, focus, keyboard and context: six states per control, designed focus rings, mono for IDs ([Mantlr](https://mantlr.com/blog/stripe-linear-vercel-premium-ui)).

**Fluidity as continuity.** Family's principles are simplicity, fluidity, delight: trays that change height so progress is unmistakable, components that travel between screens rather than duplicate, labels that morph Continue → Confirm through shared letters, delight concentrated in rare moments ([Benji Taylor, Family Values](https://benji.org/family-values)). Underneath: ease-out, under 300ms, transform/opacity only, never animate keyboard-initiated actions; Raycast "has no animations and it feels right" ([Emil Kowalski, Great Animations](https://emilkowal.ski/ui/great-animations)). Rauno Freiberg's craft log is the pixel-level counterpart ([rauno.me/craft](https://rauno.me/craft)).

**Warmth as a position.** Arc's makers wrote the case against sterile optimisation: the corner restaurant's caramel wood and ornaments that "don't serve any function" are the point ([Browser Company, Optimizing for Feelings](https://browsercompany.substack.com/p/optimizing-for-feelings)). Granola proves it in product: cream surfaces, olive accent, a display serif at weight 400 over a humanist text face ([Granola notes](https://github.com/educlopez/design-bites/blob/main/design-mds/granola.ai/DESIGN.md)). Things keeps 95% of the interface neutral and spends colour only on meaning.

**What the galleries reward.** Awwwards 2025: Lando Norris (OFF+BRAND) Site of the Year, Messenger (abeto) Developer Site; product honours go to single-idea pages like Osmo and Anime.js ([winners](https://www.awwwards.com/annual-awards/winners); [product honours](https://www.awwwards.com/websites/winner_category_product/)). Godly's feed is folder animations, animated avatar states, physics pills: motion on one object ([godly.website](https://godly.website/)). Mobbin's 2,108-dashboard study: the best "almost protect you from" the data ([Mobbin](https://mobbin.com/blog/what-good-dashboard-design-looks-like)). Lapa now lists Offloop, "a workspace for people and agents" ([lapa.ninja](https://www.lapa.ninja/)).

**Agents as teammates.** Linear made agents first-class users with a visible agent mark, delegated rather than assigned (a human stays accountable), with six public session states: pending, active, awaitingInput, error, complete, stale ([Linear, Agent Interaction SDK](https://linear.app/now/our-approach-to-building-the-agent-interaction-sdk)).

## Ten elements for Henosis

1. **Dimmed rail, lit session.** Rail canvas one lightness step below the session canvas, no border between: `--rail: oklch(from var(--canvas) calc(l - 0.03) c h)`. Rail. People and agents sit in one navigation tone; only the shared work is bright.

2. **One edge, three layers.** Resting cards use ring + contact + ambient, no `border`: `box-shadow: 0 0 0 1px rgb(86 53 45 / .08), 0 1px 2px rgb(86 53 45 / .06), 0 6px 16px -4px rgb(86 53 45 / .10)` (Chocolate-tinted, never black). Session, Plan card, Approvals. Human and agent messages share the identical edge; authorship is carried by type, not chrome.

3. **Concentric message bubbles.** Outer bubble 22px, inner output block derived from the 13px padding: `.msg .out { border-radius: max(0px, calc(var(--radius-lg) - 13px)); }`. Session. Agent output nests inside a person's turn with parallel curves, one object.

4. **Ring-cut avatar pairs.** A person and an agent sharing a row are 24px circles, the overlap cut by an SVG mask: `<mask><rect fill="#fff"/><circle cx="30" cy="12" r="14" fill="#000"/></mask>`, 2px gap. Team panel, Inbox, Approvals queue. The two arcs of the mark closing into a ring, at component scale.

5. **Session state as one stroke.** Six states (pending, active, waiting, error, complete, stale) as a single 1.5px arc on the avatar ring: `stroke-dasharray` 0→100 in Apricot for active, dashed `4 3` for waiting, Chocolate at 40% for stale. Rail, Session header, Manager overview. Agent liveness uses the same ring language as a person's presence dot.

6. **Hairline veil header.** Sticky session header with `background: color-mix(in oklch, var(--canvas) 82%, transparent); backdrop-filter: blur(16px); box-shadow: inset 0 -1px 0 rgb(86 53 45 / .08)`. Session, Project page. Context (who is here, people and agents) floats over the stream without a box.

7. **Tabular everything the machine prints.** `font-variant-numeric: tabular-nums; font-feature-settings: "tnum", "ss01"` on counts, token meters, timestamps and IDs, mono for IDs only. Usage, Manager overview, Details. Human minutes and agent tokens line up in the same column widths and read as one ledger.

8. **Materials ladder, four rungs.** `--m-base` 6px ring only; `--m-raised` 14px + contact; `--m-menu` 14px + ambient; `--m-sheet` 26px + ambient×2; dark mode swaps the ring to white 8%. Command palette, Approvals, Release gate. A person's sheet and an agent's prompt-for-input share one floating material; nothing an agent raises looks foreign.

9. **Label morph on commit.** Buttons that change meaning (Instruct → Approve, Draft → Release) animate shared glyphs via `view-transition-name` on the label span, 180ms `cubic-bezier(.22,1,.36,1)`, skipped when keyboard-triggered. Release gate, Approvals. A person's decision and an agent's action become one continuous word.

10. **Fraunces as the agent's voice, Inter as the room.** Agent prose in `font-family: var(--serif); font-optical-sizing: auto; font-variation-settings: "opsz" 14, "SOFT" 50`; people in Inter at the same size, leading (14/1.55) and ink. Session, Groups and chats, Memory. Two voices, one measure, one ink: the typographic form of a team.
