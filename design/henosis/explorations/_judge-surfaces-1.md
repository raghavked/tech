# Judge panel · surfaces · 1

Theme: **surfaces** (slack-templates, pr-template, email-digest, pricing-page): Henosis as it appears
outside its own window, in Slack, on a pull request, in a mailbox and on the marketing site.
Judged against BRIEF.md and tokens.css v5. All twelve folder PNGs were opened and read; because three
of the four boards run past 900 px (the Slack board is 1440×6005, the pricing page 1440×3398, the
digest 1440×2211) each page was also rendered full-height at 1440 in light and dark and at 390 with the
project's Playwright Chromium (those renders carry fallback fonts, so type was judged from the folder
shots). Every number the pages print was recomputed (estimator totals, invoice lines, hours strips,
token sums, averages) and every product claim was checked against the source: `packages/slack/src/
adapter.ts`, `packages/kernel/src/{plans,approvals}.ts`, `packages/fleet/src/brief.ts`,
`apps/web/src/copy.ts`, `apps/web/src/approvalsQueue.ts`, `packages/cli/src/join.ts`,
`docs/08_business_model.md` and `docs/research/pricing-packaging.md`. Scores are 1–10 for on-brief
(vibrant, unity, palette roles), craft (alignment, type, states), truth to the product, and
distinctiveness from claude.ai, ChatGPT and Linear. No exploration was edited.

| Exploration | On-brief | Craft | Truth | Distinct | Overall | Verdict |
|---|---|---|---|---|---|---|
| email-digest | 9 | 8 | 8 | 8 | 8.25 | keep |
| slack-templates | 7 | 8 | 7 | 7 | 7.25 | revise |
| pr-template | 8 | 7 | 7 | 7 | 7.25 | revise |
| pricing-page | 7 | 8 | 5 | 6 | 6.5 | revise |

---

## email-digest · 8.25 · keep

**What it is.** Two emails side by side in a thin mail-client header (sender disc with the mark, from /
to, subject with its preheader). Left, the Monday digest to Ana as lead of Payments: the app's own
sentence at 25 px serif with mono numbers and "3 things need you" in chocolate; three needs-you cards
with the app's stripes; tokens as three tiles and two single-hue bar lists with a one-line reading;
plans and release gates as rows with small stars, estimate → actual and vote dots; a footer that says
why she gets it, a Daily / Weekly / Off segment and "Open the overview". Right, the invite to Cy from
Bo: a navy→chocolate hero with the mark, "Cy, *Bo* invites you to the circle.", one chocolate button
with "7 days · one use" beside it, People and Agents boxes, the "Same manners, same gate" card on
apricot wash, and the agent's `henosis join` line in a navy code block.

- **On-brief 9.** This is the manager overview said on paper and it keeps every role: cream page,
  the hand only on Rate the plan / Vote / Join the circle, apricot for the plan stripe, the wash card
  and the live bars, the one gradient on the invite's hero and nowhere else on that email. Serif on
  every name and title (Payments, *Proration on plan change*, Invoice PDF layout, "member"), sans for
  what is read, mono for every count. Voice is exact: "one more voice and it starts", "nothing happens
  until you open the link", "You get this every Monday at 08:00 because you lead *Payments*". The
  subject line is designed as the sentence's verdict and the preheader as the four counts, which is
  the brief's "calm, specific" voice reaching the inbox row. Dark is correct from the tokens alone:
  surfaces step up, the hand turns apricot, the code block drops to the darker navy, the hero keeps
  its gradient, status tags keep their hue.
- **Craft 8.** The arithmetic holds everywhere it can be checked: 138k + 74k = 212k by project,
  86 + 58 + 41 + 27 = 212k by person, 148k in + 64k out, the budget tick on Checkout's track sits at
  100k ÷ 138k = 72 % and the bar at 74k ÷ 138k = 54 %, 44k → 61k is +38 %. Cards, tiles, bars and rows
  share one 34 px gutter; the dashed empty avatar for the missing voice is the clearest "1 of 2" in the
  whole set. Mobile is honest (tiles two-up with Budget full width, bars stacked, average stars hidden).
  Two dents. "Release gates · 2 held · 1 granted" heads a list of two rows, one granted and one
  waiting, so "2 held" reads as a third gate that is not there (the sentence says "held 2 release
  gates", meaning both). And the plan "Checkout tax rate lookup" shows 2.5 with three lit stars, since
  the small-star component can only draw whole stars; a half star or "2.5" alone would be truer.
- **Truth 8.** The sentence is `copy.team.summary` word for word ("4 open sessions across 2 projects:
  2 running, 1 awaiting approval, 1 blocked. 3 things need you."), the counts are the overview's
  `counts.*`, needs-you is ordered as the inbox orders it, the gate rule is the kernel's ratings rule,
  the dashed avatar is the queue's missing voice, and "Rate it before you approve" lives in the app.
  No email exists in the product (`notify.ts` has none), and the notes say so; the weekly figures are
  an extension the notes flag. One thing is wrong on the board itself: Cy is invited on Monday 09:52,
  while Monday's digest, sent the same morning, says Cy rated Thursday's gate ("Dee 4, Cy 5") and runs
  an agent on Checkout. The two emails contradict each other about who is in the circle. The invite's
  `henosis join payments --as agent --key …` is also a proposed shape; the CLI's `join` today takes a
  session id and a token.
- **Distinct 8.** Linear's and GitHub's digests are lists of links; Claude and ChatGPT send none. The
  serif sentence as lede, the stripe cards with vote dots, the invite that shows people and agents in
  two matching boxes and gives the agent the same door are ours. The mail-client frame is neutral.
- **The fix that matters.** Make the two emails one story and give the digest its join moment. Date
  the invite the previous Monday (29 Sep, the first day of the digest's week) so Cy joins at its start,
  and add one "Joined" line to the digest ("Cy joined Monday with her agent · crew Invoice rollout is
  Ana + Cy"), which is the brief's selling moment and the one thing the Slack brief carries that this
  digest does not. While there, change "2 held · 1 granted" to "2 gates · 1 granted · 1 waiting".

## slack-templates · 7.25 · revise

**What it is.** A 6005 px board of five Slack templates drawn inside Slack's own canvas, light and
dark: anatomy (emblem · Henosis APP time · sentence · context line · buttons then link), session
started (the thread root and four replies that steer it), approval with five rating buttons and the
4 as Slack-green, contention from three seats (leads, each owner, the memory-conflict twin), a mention
in #billing answered by "Ana's agent", and the daily brief with its quiet-morning and on-demand
forms. Beside each, a sticky spec column with the event, channel, text fallback, blocks, action_ids
and result states.

- **On-brief 7.** On Slack's canvas the palette has one surface, the emblem, and the page uses it
  well: the mark on navy in Slack's 36 px square, the mark again as the `:henosis:` emoji and in the
  context line. The brand lives in the grammar instead: names bold, titles italic (the two things the
  app sets in serif), the sentence first, the link last, never "bot". The board around the mocks is
  right (cream, serif titles, chocolate numbered callouts, the `.notice` stripe when the answer comes
  back into the app). Deductions: there is no join moment anywhere on 6000 px of a surface the brief
  says should show "Ana joins the circle" (the brief's "Joined" field is the only trace); and the
  green 4★ in a row of five white stars reads as a pre-selected value, not a recommendation, which is
  the one place the page lets Slack's palette say something the app would not.
- **Craft 8.** Slack fidelity is careful (Lato, the pink code chips, the APP badge, the thread
  banner, the day pill, "Only visible to you"); the anatomy callouts land on their rows; the spec
  column's `kv` grid and mono action_ids are clean; the mobile cut narrows the client, wraps the star
  row and moves Deny and the link to a second line exactly as the page's own rule says. The
  two-column states grid gives every template its after-state. Small things: the `.states` cards use
  a 14 px gap while the sections above use 32 px, so the states feel like a different page; the brief
  template's two-column `fields` leave "Tokens this week" wrapping onto three lines at 820 px while
  the Plans field beside it has room; and the mention reply's bullet list uses Slack's pink code chips
  for `Pro · 1–14 Oct`, which are dates, not code.
- **Truth 7.** The adapter is read closely: a session is a thread (`attachSession` posts the exact
  sentence template 01 shows), replies are directives with `[scope]`, `/constrain`, `/pause`,
  `/resume`, `/cancel`, lines coalesce at 1.5 s, approvals post into the thread and the root
  `chat.update`s to the result line, contentions go to the management channel with "X wins" buttons,
  memory conflicts with "X is right", `/henosis brief <project>` returns `project.brief()`. Three
  claims are not true. The page says the 4★ is green "because it is the default the app sends for a
  bare Approve, so the quickest tap and the app agree": the web app's `DEFAULT_RATING` is 4, but the
  Slack adapter sends **5** on a bare Approve (`d === "approve" ? 5 : undefined`), so the quickest tap
  and Slack disagree today. "Split the file" and "Keep both" are buttons the kernel has no verb for
  (`resolveContention` takes a winning session). And the mention reply, the join buttons, the expired
  / superseded states and the scheduled brief are proposals the notes do flag.
- **Distinct 7.** Every Slack app looks like a Slack app; what is ours is the sentence grammar, the
  rating row as the vote, a contention seen from three seats, an agent that answers under its owner's
  name with what it read and what it cost, and a brief computed from the ledger. The daily-brief
  shape (header, needs-you, roster, fields) is also Linear's and GitHub's Slack digest shape.
- **The fix that matters.** Make the rating row honest. Drop the primary from the 4★ (the app does
  not recommend a number, by the page's own contention rule "no button is primary"), make the
  adapter's bare Approve send `DEFAULT_RATING` (4) so the sentence about the app becomes true, show
  Approve / Deny only when the rule has no ratings, and carry the rating in `value` under one
  `vote:…:approve` action_id so the five buttons are one handler. Then put the join line the brief
  asks for into template 01's thread ("Dee's agent joins the circle" with the mark), so the surface
  shows the selling moment and not only its aftermath.

## pr-template · 7.25 · revise

**What it is.** One Henosis comment on PR #418 in a neutral GitHub timeline, shown in its final
state: the lead line (Ana's agent · Team with Bo and Cy · the Payments team · Open the session), the
goal, the plan as a table with estimate and actual per step and the two ratings with notes under
it, the release gate with the call in mono, the risk pill, the rule in words and three voices (Dee's
observer approve dimmed as "a voice, not a vote"), tokens as two tiles, and a footer with Session ·
Replay · Audit record, the replay hash and the HTML marker. Beside it, the Markdown template with
apricot placeholders, the four-edit ladder with the current state outlined, and six rules.

- **On-brief 8.** The roles are kept with discipline: serif on Ana's agent, Ana, Bo, Cy, Dee; mono on
  every number, call and hash; apricot only where something is live or waiting (the ladder's current
  state, the placeholders, the budget bar); green and amber for under and over; the hand only on the
  session link. No gradient at all, which is allowed. The words are the product's ("decided in the
  fold", "a voice, not a vote", "Replays to the same hash"). Dark is correct from tokens, though the
  page does not lift the status triplet for dark the way slack-templates and the earlier panels do,
  so "approved · 5 of 5 steps done" and "granted 14:32" sit as dim green pills on the dark comment.
- **Craft 7.** The comment is beautifully set and every figure reconciles: inputs 31.4 + 9.6 + 6.8 +
  0.4 = 48.2k, 48.2 ÷ 80 = 60 %, estimates 4 + 14 + 10 + 12 + 12 = 52k, actuals sum to 48.2k, saved
  3.8k = 7 %, the bar at 93 %, step 3 over by 1.6k, both averages 4.5. The timeline frame, the
  comment's caret, the app badge and "edited 14:33" are GitHub's grammar at the right weights. The
  defect is that the left column is not what the right column produces. The template is "plain
  Markdown: tables, bold, code and links only", but the mock draws serif names, an apricot Team pill,
  a red risk pill, green numbered circles, two CSS bars and a dimmed observer row; none of it survives
  GitHub's renderer, so the page proves a comment the adapter cannot post. The ladder also contradicts
  the comment: state 3 says "Waits on one more contributor at 3 or above" while the gate's rule is
  4+ on average, and it repeats "Approve without a pick sends 4" (true in the app, not in Slack). On
  the phone the plan table scrolls sideways with "Estimate" cut to "Es" and no scroll affordance.
- **Truth 7.** No GitHub adapter exists; the page says "phase 1" and the notes say so. What it draws
  of the kernel is right: steps with estimates and actuals (`PlanStepRecord`), ratings with notes
  (`PlanRating`), "tool calls above `read` are refused until it is approved" (`PLAN_NOT_APPROVED`),
  the ratings rule's words (`describeRule`), and an approve with a null rating counting as a voice
  under a ratings rule (`approvals.ts` counts only rated ballots). The gate ladder's "3 or above" and
  the Slack-side "sends 4" are the two untrue sentences.
- **Distinct 7.** A bot comment that edits itself in place is the Vercel, Codecov and Netlify shape,
  and the estimate / actual table with a check column is close to Vercel's deployment table. Ours is
  the content: ratings with notes, a gate with voices, tokens against the plan, replay to a hash.
  Nothing of claude.ai or ChatGPT.
- **The fix that matters.** Draw the comment as the Markdown will render. Redo the left mock in
  GitHub's own grammar (system sans throughout, `**Ana's agent**` bold not serif, stars as ★★★★☆ 4
  glyphs, ✓ in the table, no pills, no bars, the marker invisible), keep the voice, and let the
  template on the right be literally the source of the left; the page then proves the one thing it
  claims, that the comment reads the same on GitHub, in e-mail and on a phone. Fix the ladder's "3 or
  above" to "4 or above" while there.

## pricing-page · 6.5 · revise

**What it is.** A marketing page: nav, the hero "Pay for the hours the ring is *closed*." with two
price tiles ($0.90 per active session-hour, $24 per approver seat) beside a navy estimator for the
Payments team in September (hours bar in apricot / wash / grey, free waiting line, three seats, Dee's
prorated join row on the rail-active wash, $272.40, apricot CTA); three tiers (Circle $0, Team
metered, Org volume); one Tuesday's session strip with billed and free stretches and the people's
events under it; the September invoice written out with included hours, Dee's proration, VAT and a
footer that says tokens are not on it; six questions; footer.

- **On-brief 7.** The headline is the best sentence in the set and it is the product's own idea:
  waiting is free, so plan-first and gates cost nothing. Serif display, cream page with the wash,
  chocolate on Join the circle and Start with 20 free hours, the navy stage with apricot as the pulse
  (the billed stretches, Dee's ripple, the CTA on navy). The join row is the one highlighted line of
  the estimator, which is the brief's selling moment put on an invoice. Deductions: four gradients on
  one screen (the estimator's radial glow, the Team tier's brand bar, the `gradient-live` hours bar,
  the agent avatar) against "one gradient per screen"; the apricot CTA on navy is the pulse doing the
  hand's job, which the notes admit; in dark the "Active session-hour" tile (`apricot-soft` on
  `#1C2230`) turns into a muddy grey block that reads as disabled.
- **Craft 8.** The numbers reconcile where they are side by side: 212 h × $0.90 = $190.80, 3 × $24
  = $72, 12 ⁄ 30 × $24 = $9.60, total $272.40; the hours bar is 212 : 79 : 64; the strip's seven
  segments sum to 9 h 40 m and its apricot stretches to 5 h 05 m at $4.58; the invoice sums to $254.40
  and $305.28 with VAT. Tiers align on one baseline, the strip's ticks are mono, the invoice's
  second sheet behind it is a nice touch, mobile stacks cleanly with the price tiles full width. The
  one slip is between the two cards that describe the same month: the estimator totals $272.40 for
  "a month like September" and the invoice for September subtotals $254.40, because only the invoice
  subtracts the 20 included hours, while the button under the estimator says "Start with 20 free
  hours". A reader who compares them sees the page disagree with itself by $18.
- **Truth 5.** The product has no plan, seat or meter (the research memo says exactly this), so this
  is a proposal, and the notes say so. Its shape does follow `docs/08` (per active session-hour,
  per approver seat, idle unbilled). But the page contradicts its own premise. The hero says
  "Observers, contributors and agents are free, without limit", and the rule card says "Only people
  who rate plans or grant approvals under a ratings rule take a seat": in the kernel a ratings rule
  names a role (`ratings.of`, commonly contributor), so a contributor who rates is both free and a
  seat. `docs/08` and the memo define the seat by the role lattice (driver and owner), which the page
  never mentions. "Checkout takes a card" borrows the demo project's page name for Henosis's own
  checkout; "Slack thread per session" is true; `GET /api/usage` and `henosis serve` exist;
  "hard monthly cap" and "replay in CI" do not, and the notes flag the cap. Ana is "Ferreira" here and
  "Moreau" in the digest.
- **Distinct 6.** Hero-left, card-right, three tiers, FAQ is the Linear / Vercel pricing page, and
  Linear's own page uses the same "free for everyone who only looks" argument. What is ours is the
  session strip (a meter that teaches itself), the written-out invoice, and Dee's join row. The
  serif display keeps it from reading as Linear, but the bones are the category's.
- **The fix that matters.** Define the seat once, by role, and compute everything from it. A seat is
  a driver or an owner (the kernel's `Role` lattice, `docs/08`, the memo), so "contributors are free"
  stays true and "the first time Dee rates a plan" becomes "the day Dee is made a driver, prorated";
  rewrite the hero tile, the rule card and the FAQ from that one sentence. Then make the estimator and
  the invoice the same ledger: the estimator shows the included-hours line and totals $254.40, or the
  invoice drops it; the two cards for the same month cannot differ.

---

## Carry forward

Patterns the system should adopt from this panel, in priority order.

1. **The sentence first, everywhere outside the window.** Every off-platform surface opens with
   `copy.team.summary` (names bold or serif, numbers mono, "n things need you" in the hand colour);
   the Slack `text` fallback, the email subject + preheader and the PR comment's first line carry it
   whole, so a push notification, an inbox row and a GitHub email all read the same sentence.
2. **One message, edited in place.** A Slack root and a PR comment are the session's address: buttons
   go when the decision lands, the result line takes their place with "(edited)", and a thread reply
   or timeline event says who answered and how. A second message is a bug. Add an `(edited)` state
   to the notice component so the app's own notices can do the same.
3. **The five-part anatomy for any host.** Emblem · product name · the sentence · a context line
   (project, crew, driver, the one number) · actions, then the link last as a link, never a button.
   Never "bot", never "AI-powered"; the person is named in the sentence, nobody is @mentioned.
4. **The needs-you card.** Stripe by kind (apricot plan, navy→chocolate gate, red contention), an
   uppercase kind label, a serif line with the thing in italic, the rule in one sentence, vote dots
   with a dashed empty avatar for the missing voice, one button. Use it in the inbox, the digest, the
   Slack brief and the PR ladder.
5. **Votes as rows.** Serif name, role in faint sans, italic note, glyph stars plus the number; an
   observer's approve dimmed as "a voice, not a vote"; the verdict line computed from the rule
   ("2 of 2 · 4.5 average · policy …"), never restated from the policy.
6. **Estimate → actual as one idiom.** Mono `est 44k → 61k, +38%` in amber or `19k, under` in green;
   bars single-hue with the value at the tip and a dashed tick for the budget; the three-state strip
   (apricot = live or billed, apricot-soft = waiting, surface-3 = paused) is the same triplet as the
   agent dot and should become the usage meter's grammar.
7. **One default rating.** `DEFAULT_RATING = 4` is the product's; the Slack adapter must send it
   (today it sends 5), and no surface pre-selects a number with a primary colour.
8. **Dark lifts the status triplet.** `--ok / --warn / --danger` step up on dark surfaces
   (`#8FC487 / #E2B06A / #E2847A`, as slack-templates and the earlier panels do); move this into
   tokens.css so pages like pr-template stop shipping dim pills.
9. **Mocks render what the host renders.** A Slack, GitHub or email mock is drawn in the host's
   type and controls; the brand lives in the emblem and the words. If the surface cannot do serif,
   the mock does not either.
10. **One cast, one spelling.** Ana Moreau, Bo Lindqvist, Cy Okafor, Dee; the pricing page's "Ana
    Ferreira" is the odd one out. A member cannot be invited on a board where she already voted.
