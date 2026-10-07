# Judge panel · onboarding · 1

Theme: **onboarding** (first-run-desktop, welcome-agent, error-states, tour).
Judged against BRIEF.md and tokens.css v5. Every folder PNG was opened and read, with 2× crops of the
first-run side panel, the welcome-agent drawer head, the tour coach mark and the error-states
connection line; each index.html was read for token use, gradient count, mark drawing, hex literals,
scripts (none anywhere) and states. Scores are 1–10 for on-brief (vibrant, unity, palette roles),
craft (alignment, type, states), truth to the product, and distinctiveness from claude.ai, ChatGPT and
Linear. No exploration was edited.

| Exploration | On-brief | Craft | Truth | Distinct | Overall | Verdict |
|---|---|---|---|---|---|---|
| first-run-desktop | 8 | 8 | 7 | 7 | 7.5 | keep |
| welcome-agent | 8 | 6 | 7 | 9 | 7.5 | revise |
| error-states | 7 | 8 | 6 | 7 | 7.0 | keep |
| tour | 8 | 8 | 6 | 6 | 7.0 | revise |

The wave's shared idea is the right one: joining is told by the mark. The first run uses four stages
of it as step markers, the tour closes it one segment per step, the arrival line plays arcs-close,
and the server-down page is the only place it loses its centre. That is a system, not four screens,
and it is the main thing to carry forward.

---

## first-run-desktop · 7.5 · keep

**What it is.** The whole macOS desktop at step 4 of 4: the first-run window (navy side with the
four steps, cream page explaining the tray), the real tray menu dropped open in the menu bar, the Dock
with the badge, and a wash card listing the three things already waiting for Dee before the one
gradient action, "Enter the circle".

**On-brief · 8.** Roles are held cleanly. Navy is the frame (the window's side, the tray icon's disc,
the Dock tile); cream is the page; chocolate is the hand (both switches, the "Approvals and handoffs"
segment, the ✓ gradient button); apricot is the pulse (the current step on `--rail-active`, the hot
row in the tray menu, the pending dot on the tray glyph, the wash card). `gradient-brand` appears
exactly once, on Enter the circle. The four stages of the mark as step markers (faint ring, one arc,
two arcs apart, closed ring with its centre) are the brief's motion principle made static, and the
copy is in voice: *Welcome, Dee.* / *Bo has the baton.* / "Three things already wait for you, Dee."
Deductions: the side panel adds a radial apricot wash on top of the navy (a second, if quiet,
gradient), and the badge red `#E0463A` is a literal that lives nowhere in tokens.

**Craft · 8.** The window is a tight 312 + 648 grid; serif for Welcome / step titles / the wash
headline, sans for what is read, mono for host, user id, tool names. The done-step fold keeps its
facts in one line. The tray menu is drawn as the shell has it (status line, two counted rows with a
serif sub-line, separator, Open / Quit with ⌘ glyphs). Dark is correct: the side goes to `#161B26`,
menu bar and Dock go translucent dark, switches turn apricot (the dark `--accent`), greens lift. Two
nits: the three tiles explain "A dot" in the tray but their picture leads with a red Dock badge, so
the picture contradicts the caption; and the two agent avatars in "Ana, Bo, Cy and two agents are in"
are 26px navy squares with a 10px ring glyph that nearly vanishes against the side.

**Truth · 7.** The shell does have a tray and a `henosis serve` address to connect to, and the window
shows only what the shell needs (server, identity, tray). But the notes concede the tray rows carry
only counts today (the "Next: Bo's agent asks to write…" sub-line needs `/api/notifications` to
return a title), "Badge on the Dock" has no Windows or Linux form, the keychain tick shows even when
the token is empty, and the folded "Payments team · 4 projects" hides the multi-team pick.

**Distinct · 7.** A navy-left / cream-right installer with a step list is a familiar desktop shape
(Arc, Raycast, Linear's desktop first run all lean on it). What is Henosis here is the mark doing the
counting, the tray taught by dropping it open for real, and the wash card that gives the first click
somewhere to go. None of claude.ai, ChatGPT or Linear ends onboarding by naming what already waits.

**The one fix.** Make the middle tile show what its caption says: the apricot pending dot on the tray
glyph, large, with the Dock badge demoted to a second small picture. Replace the three `#E0463A`
literals with a token (`--badge`, red only because the OS is red there) so the loudest pixels on the
screen are declared, not hand-typed.

---

## welcome-agent · 7.5 · revise

**What it is.** #billing the moment Ana's new agent, Checkout, joins: the joining line with the mark
playing arcs-close, an arrival card (what it is on, Status / Mentioned by / Gate / Budget, the hearing
rule, Say hello / Open session / What it was told) with "Who it joined" beside it, Ana's welcome
mention and the agent's first reply, and the "What Checkout was told" drawer showing the welcome
brief the system wrote at turn 0. Mobile shows the line and the card alone.

**On-brief · 8.** The joining line is the hero and it is exactly the brief's selling moment: a mark at
30px, serif sentence, the agent's name in chocolate, mono time. Chocolate is the hand (Say hello,
"holds the gate", the What-it-was-told link); apricot is the pulse (the rail card rising on
`--rail-active`, the ripple on the topbar avatar, the mention chip); the brief card is navy. Voice is
right throughout ("Checkout is in. Bo and Cy hold its gate."). Deduction: three `gradient-brand`
instances share the screen, the rail's New session, the 4px stripe on the arrival card and the
border-image on the agent's reply. Each is small; the rule is still one.

**Craft · 6.** The arrival card, facts grid, the seam, the foot and the composer are all precise, and
the mobile cut (facts three across, budget full width, What-it-was-told as a full row) is the right
fold. But the drawer's reason to exist is broken in both themes: the navy brief card renders as a
40px strip and its serif paragraph ("You join *Payments*: Ana, Bo, Cy, Dee, and two agents…") and
foot never appear. Cause: `.brief` is a flex child of the scrolling `.dscroll` column with
`overflow: hidden` and no `flex: none`, so it shrinks to make room for the sections beneath. The
toast also kisses the joining line's right edge, which the notes say it should not.

**Truth · 7.** The hearing rule is the product's actual rule and the same sentence the new-group
sheet uses; the facts are the ledger's. The notes are honest that a standing brief at join is a new
server event (`session.briefed`), that a crew spanning projects is not in the spec, and that "Bo and Cy
have seen it join" needs read markers the log does not keep.

**Distinct · 9.** Slack's "X joined the channel" is one grey line; nothing in claude.ai, ChatGPT or
Linear shows an agent arriving as a member with a gate, a budget, a hearing rule, and a drawer that
lets teammates read what it was told. This is the exploration that most makes the product's argument.

**The one fix.** `.brief { flex: none; }` (or give `.dscroll` children `flex-shrink: 0`), then
re-shoot light and dark so the brief paragraph is visible; that paragraph is the proof that the agent
entered with the same knowledge a new engineer gets. While there, drop the stripe and border-image
gradients to flat chocolate so the rail's New session is the screen's one gradient.

---

## error-states · 7.0 · keep

**What it is.** A board of six bad moments (disconnected, server down, plan rejected / approval
denied, unite conflicts, one afternoon at 1440×900 with four states live, and the phone), under four
rules: say what happened with a time, say what still works, say what Henosis is doing, give one
chocolate action. The 1440 shot is section 05 alone.

**On-brief · 7.** Colour carries weight, not alarm: the connection line is grey, held things are
amber, red appears only where a person said no or two branches disagree, and the card around the red
stays the quiet surface. The gradient is the rail's New session only. Apricot is the pulse where it
should be (the weave under Try now, the driver ring). The mark losing its centre only when the server
is gone, with the dot as a dashed ghost, is a good brand decision and the same drawing the tour uses.
Deductions: the page is a spec board with the screen as one section, where the brief asks for a
finished 1440 screen; and it is a stretch for the onboarding theme (its tie is "the same ghost centre
onboarding shows before you arrive").

**Craft · 8.** The connection line ("Reconnecting · attempt 3 · again in 4s · the stream is as of
14:02 … Try now") is the best single line in the wave. Presence dims to 45% with "as of 14:02", the
agent's half-written message sits at 50%, the composer holds the draft with the amber chip and a grey
send, the Denied notice keeps both votes so the gate's arithmetic shows, struck steps stay visible.
Dark is right (apricot primary on navy, tags soften to their washes). Nits: the mobile chip says "Held
until you are back" while the desktop says "Held until the socket is back"; the board scales the
screen with `zoom: 0.8667`, which is fine for a shot and nothing else.

**Truth · 6.** Several promises are not the app's today, and the notes say so: typed directives are
dropped while the socket is down (holding and replaying "in order, nothing twice" is new behaviour
with an unanswered safe-point question), the attempt count and next delay are not in the snapshot,
"What it last saw" needs a browser cache, and the conflict rows' "moved the subtotal block" is a
model-written summary phase 0 does not have.

**Distinct · 7.** Offline banners and reconnect pills are everywhere (Slack, Linear, Notion). What is
Henosis is the stamped "as of 14:02" on everything stale, the four-part colleague's sentence, the
apart mark, and the denial card that shows the votes rather than an error.

**The one fix.** Make the composer's promise one the app can keep. Either commit the product to the
hold (then the chip, the drawer's "Held for you" and the safe-point rule are the spec) or change the
copy to what happens now: "Not sent · kept here until you are back" with a single Resend. The
drawer's "sent in order, nothing twice" must not ship ahead of the code that does it.

---

## tour · 7.0 · revise

**What it is.** Five coach marks on Dee's real session (rail, stream, plan, gate, composer): a navy
dim, one target lit with the apricot halo, one mark at a time, a five-segment ring in each mark's
corner that closes as the steps go, the centre a dashed ghost until "Close the ring" pops it and the
toast says *Dee is in the circle*. Mobile turns the mark into a bottom sheet.

**On-brief · 8.** The dim is navy at 52% (near-black at 62% in dark), the halo is 3px apricot plus a
10px soft ring, Next is chocolate, the tip sits on apricot wash, the headline is serif in the
product's voice ("Plans come first."). The ring-progress is the mark telling its own story as a step
counter, which is the brief's motion principle again. Deduction, which the notes already see: on the
last step the rail's New session and "Close the ring" are both `gradient-brand` on one screen.

**Craft · 8.** The caret lands on the lit card's edge, the kbd hints (→, esc) are mono in bordered
keys, the ring reads at 28px, Back / Next / Skip are in the right order and weights. The mobile sheet
with a grab handle, the target above it and Skip in the corner is correct. Dark keeps the lit card's
surface and turns the primary apricot on navy. Nits: the stream is pre-scrolled with a
`margin-top: -192px` hack rather than a real scroll position, and the step-3 mark covers the composer
the tour will end on, which is tolerable under the dim.

**Truth · 6.** The tour needs a session with a plan and a release gate; a new contributor's first
session may have neither, and the fallback is an open question. The access claims contradict each
other inside the design: the dim is `aria-hidden` and focus is trapped in the mark, yet "Approve stays
live under the dim" in step 4. A control cannot be both hidden from assistive tech and live. Step 2's
one halo around three messages can also exceed the viewport.

**Distinct · 6.** Coach marks with a dim and a caret are the Appcues / Intercom / Linear-onboarding
shape; the ring counter, the ghost centre, and ending on "Close the ring" are what make it Henosis,
and they are confined to a 28px corner glyph and one button.

**The one fix.** Resolve the Approve-under-dim contradiction by deciding that an arriving approval
ends the tour (not pauses it): the mark closes, the dim lifts, the approval card is lit with the same
halo, and the tour can be reopened from Settings. That keeps the rule "the tour never gets between a
person and a vote" true for keyboard and screen-reader users too, and removes the need for a live
control under an `aria-hidden` layer.

---

## Carry forward

- **One set of mark states, owned by the brand board.** Faint ring → one arc → two arcs apart →
  closed ring with centre (first-run steps); the five-segment ring with a ghost centre (tour); the
  apart arcs with a dashed ghost centre (server gone). Rule: a ghost centre means "not yet in the
  circle, or the circle cannot be seen"; the dot pops only on a join. Draw them as `<symbol>` variants
  so all three screens change from one file.
- **The joining line.** A 30px mark playing arcs-close, a serif sentence with the name in chocolate,
  the time in mono grey. Same line for a person, an agent or a session; the toast is the same sentence
  on navy. Never a grey "X joined" system line.
- **"What it was told."** The welcome brief as a navy serif paragraph, then the ledger sections (the
  circle, the crew, manners, in your context, not told) with a mono fold "As the model reads it" and
  its token cost. Reuse for the handoff brief and for the human onboarding page so the new engineer
  and the new agent read the same brief.
- **"Already waits for you."** An apricot-wash card with a serif headline that names the person and
  rows of avatar + mono tool name, placed wherever a first click needs somewhere to go: the end of
  first run, the tray menu's sub-lines, the empty inbox.
- **The bad-moment sentence.** What happened with a time on it, what still works, what Henosis is
  doing, one chocolate action. Stamp "as of HH:MM" on anything stale and dim presence to 45%. Grey for
  the network, amber for what waits, red only when a person said no or branches disagree, and the card
  stays the quiet surface.
- **The look-here layer.** Navy dim `rgba(42,50,68,.52)` (near-black `.62` in dark), target lit with
  `0 0 0 3px apricot, 0 0 0 10px apricot-28%`, one mark at a time. Usable by the tour, the first
  approval, and the command palette's "show me".
- **Done-step fold.** A finished step keeps its facts in one serif line with mono values
  (`host · team · N projects`, `user · token in the keychain`).
- **The gradient count includes the rail.** New session is already the screen's gradient; a layer or
  card that wants `gradient-brand` either flattens the rail's button beneath it or goes chocolate.
  Stripes and border-images do not get the gradient.
- **Lifted status colours belong in tokens.css.** Three explorations each redeclare `--ok #8FC487`,
  `--warn #E2B06A`, `--danger #E2847A` and their `-soft` washes for dark; move the block into the
  tokens so it stops drifting.
- **Craft rule for cards in scrolling columns.** A card with `overflow: hidden` inside a flex column
  must carry `flex: none`, or it will shrink and swallow its own content (the welcome brief did).
