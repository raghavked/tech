# Three-colour brands: chocolate, apricot, navy

Reference notes for Henosis. Palette: Chocolate Fondant 19-1432 (#56352D), Apricot Illusion 14-1120 (#E2C4A6), Dress Blues 19-4024 (#2A3244) on a cream canvas; Fraunces for display, Inter for UI. Sources were read in October 2026.

## What the best work does

**It is a four-colour system pretending to be three.** The cream canvas does 70% of the work; the chocolate is ink; apricot is warmth; navy is the one cool anchor. Alison Roman's site runs entirely on three layered creams and a single warm near-black that carries every heading, body line and filled button (https://styles.refero.design/style/b2ace2c1-d6ee-4d57-915e-901224cded11). Houseplant lets one walnut brown flip between text and surface depending on context, with the cream as canvas and no accent at all (https://styles.refero.design/style/7fdd9506-0a85-41a5-b2a7-c5ce1f31d863). Pure Nature Design says it plainly: "three colours doing three jobs", ink never pure black, one oak accent reserved for actions and eyebrows (https://creative-brackets.com/showcases/pure-nature-design/).

**Pantone already pairs the two darks.** The 19-4024 TPG Dress Blues page lists 19-0912 Chocolate Brown as its complementary (https://www.pantone.com/color-finder/19-4024-tpg), and Chocolate Fondant's analogues are Desert Palm and Fig (https://www.pantone.com/color-finder/19-1432-tcx). Modeinfo's Dress Blues palette fills in the lights: Coconut Milk, Hemp, Moonstone, i.e. cream, flax and sand (https://modeinfo.com/PANTONE-SWATCHES-CHIPS-SHEETS/PANTONE-SMART-Color-Swatch-Cards-TCX-Cotton/PANTONE-COTTON-SWATCH-CARD-19-4024-TCX-Dress-Blues.html). Chocolate Fondant is a named key colour for Autumn/Winter 2026-27 (https://c2fashionstudio.com/fashion-trends-2026-2027-for-autumn-winter-c2-fashion-studio-reveals-the-key-colors-for-the-aw2627/).

**Fashion uses the darks as soft blacks and the apricot as the thing they ground.** Who What Wear's spring 2026 list calls midnight blue plus chocolate "softer alternatives to black" (https://www.whowhatwear.com/fashion/spring/spring-fashion-colour-combinations-2026) and, for Peach Fuzz, says chocolate "warms the shade" where equally soft partners wash it out (https://www.whowhatwear.com/how-to-wear-peach-fuzz-pantone-colour-of-the-year-2024). Wdrobe's rule is the proportion rule: pale on pale fails, "one brown or navy item fixes it" (https://wdrobe.app/blog/colors-that-go-with-peach).

**Interiors balance dark colour with rough texture, and spend apricot on one object.** Olga Fradina's Kyiv flat paints the brick deep blue and stains the pine ceiling chocolate, then keeps it from feeling "overweight" with rattan, sisal, bamboo and micro-cement (https://www.dezeen.com/2021/04/05/olga-fradina-uses-dark-colours-and-natural-textures-to-create-cosy-kyiv-apartment/). SILK Apartment puts blue-grey walls and mahogany around a single bright peach sofa (https://www.behance.net/gallery/183791861/SILK-APARTMENT). Dezeen's chocolate lookbook is a texture list: chocolate plaster, leather, linen, corduroy (https://www.dezeen.com/2024/03/31/chocolate-brown-home-interiors-lookbooks/).

**Lacquer is the one shiny surface, never everything.** Veere Grenney's dining room is ten coats of chocolate lacquer, "lickable", against silk-and-linen walls elsewhere (https://www.worldofinteriors.com/story/veere-grenney-redesign-west-london-home). Veranda's lacquered rooms include an apricot ceiling that "casts a flattering glow" and a navy bar with unlacquered brass (https://www.veranda.com/decorating-ideas/g37270917/lacquered-rooms/). Architect George's Double Bay flat keeps one blue and varies gloss, matte and velvet instead of adding colours (https://www.artedomus.com/projects/blue-musings%E2%80%93apartment-in-double-bay-by-architect-george+).

**Print lets the stock be a colour.** Think Packaging is tonal Kraft browns with one bright peach accent (https://bpando.org/2022/03/29/branding-think-packaging/); Hatch is brown ink debossed into uncoated board (https://bpando.org/2016/10/27/hatch-cold-brew-coffee-by-tung-canada/); Grosz Co.Lab's Red Cross range prints a bitmap gradient so the brown stock shows through each ink (https://ballanddoggett.com.au/tag/white-ink/); the COAST anthology is a single ultramarine on kraft (https://www.underconsideration.com/fpo/archives/2013/02/math-paper-press-coast-anthology.php).

**The closest UI precedent is Claude's own.** Anthropic's system is an ivory canvas, warm ink, oat cards and one clay accent used "as punctuation, never as large fills"; its dark mode is a warm near-black with a 60 degree hue tint, "never blue-black"; serif carries address, sans carries structure (https://tastekit.dev/gallery/apps/anthropic, https://brand-atoms.com/brands/anthropic/, https://geist.co/work/anthropic). Henosis should take the discipline, not the hue: our clay is apricot, our ink is chocolate, and navy is the thing Claude does not have.

**Light and dark.** Light: cream canvas, chocolate ink, apricot for warm surfaces and glow, navy for the single committed action. Dark: deepened chocolate canvas, apricot ink at 90%, navy as the elevated surface, cream only as highlight. Never a grey or blue-black dark mode.

## Ten elements for Henosis

1. **Paper-grain canvas.** `filter: url(#grain)` with an SVG `feTurbulence baseFrequency=0.8` at 3% opacity over `#F7F1E8`. Every screen. People and agents write on the same sheet of paper.

2. **Closing-ring presence.** Two SVG arcs, apricot and navy, `stroke-dasharray` animated to close into a full circle when a person and an agent are both active. Session header. The brand mark becomes the live state of the room.

3. **Shared ink.** All messages in Chocolate Fondant on cream; authorship shown only by a 1.5px avatar ring, apricot arc for people, navy arc for agents, same radius, same stroke. Transcript. Nobody's words are a different colour.

4. **Three-cream elevation.** No shadows; `--canvas:#F7F1E8; --card:#FBF7F1; --raised:#FFFDF9` as the only lift. Cards, composer, panels. Depth comes from paper on paper, not from glass or glow.

5. **Hairline ink grid.** `border-top: 1px solid rgba(86,53,45,.18)` between timeline rows and columns. Transcript, task list, settings. Human turns and agent turns sit on one ruled page.

6. **Apricot glow for working.** `box-shadow: 0 0 0 6px rgba(226,196,166,.35)` pulsing with `animation: breathe 2.4s ease-in-out infinite`. Composer and agent status chips. The glow is the same whether a person is typing or an agent is running.

7. **Navy lacquer for committed.** One panel per screen in `#2A3244` with `background-image: linear-gradient(170deg, rgba(255,255,255,.14), transparent 45%)` and `inset 0 1px 0 rgba(255,255,255,.12)`. Artefacts and decisions panel. What the session agreed on is the one glossy object in a matte room.

8. **Debossed labels.** Tags with `box-shadow: inset 0 1px 2px rgba(86,53,45,.25)` and `text-shadow: 0 1px 0 rgba(255,255,255,.5)` on apricot-tinted cream. Tool, skill and role chips. Pressed into the stock like brown ink on board, and identical for human roles and agent tools.

9. **Dithered transitions.** SVG `feTurbulence` plus `feComponentTransfer type=discrete` to turn an apricot-to-cream gradient into a bitmap dither. Marketing and onboarding section breaks. The join between two states is shown as grain, not a hard edge.

10. **Fraunces address, Inter structure.** Greeting and session titles in Fraunces with `font-variation-settings: "opsz" 144, "SOFT" 60, "WONK" 1`; everything a person or agent does in Inter. Home and session start. The serif speaks to the whole room; the sans records what the room did.
