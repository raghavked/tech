# Judge panel · chat · 1

Theme: **chat** (groups-list, chat-view, new-group, members-drawer, mention-flow).
Judged against BRIEF.md and tokens.css v5, with every PNG opened (light, dark, mobile) and each page's
style and markup read. Scores are 1–10 for on-brief (vibrant, unity, palette roles), craft (alignment,
type, states), truth to the product, and distinctiveness from claude.ai, ChatGPT and Linear. Explorations
were not edited.

| Exploration | On-brief | Craft | Truth | Distinct | Overall | Verdict |
|---|---|---|---|---|---|---|
| new-group | 9 | 9 | 8 | 9 | 8.8 | keep |
| mention-flow | 8 | 7 | 10 | 9 | 8.5 | keep |
| groups-list | 9 | 8 | 8 | 8 | 8.3 | keep |
| chat-view | 8 | 7 | 9 | 7 | 7.8 | revise |
| members-drawer | 8 | 5 | 9 | 8 | 7.5 | revise |

Shared facts, checked once: all five use `../../tokens.css` plus a page style, no scripts, no "AI-powered";
all five draw the two-arc mark (disc, arc a, arc b, centre dot) and never the ring-and-bead. Four of the five
repeat the same dark-mode override block (lifted `--ok`/`--warn`/`--danger` and a `--mention-agent: #3A4458`),
which is the clearest sign that it belongs in tokens.css. The shell (navy rail with the same four agent
cards, cream canvas, Chats active) is identical markup across the four screens, so the rows below spend their
words on what each page adds. One cross-page slip: the rail's Chats count is 9 on groups-list and 6 on
chat-view and members-drawer; the stream shows the same morning in #billing on three pages, so pick one.

---

## new-group · 8.8 · keep

**What it is.** A two-half sheet over the shell: name, purpose, scope and members on the left; on the
right "How it will open", a live miniature of the group page that redraws as you pick, with the joining
line ("Bo starts #proration. Ana, Cy, Billing page and Checkout join the circle."), the roster, the empty
hint, a composer and three facts in the product voice. Light, dark and a full-screen mobile cut.

- **On-brief 9.** The palette roles are exact: chocolate only on "Create #proration", the picked checks and
  the radio; apricot only where something is live or chosen (the name field's glow, the picked scope
  card's wash, the ring on a picked avatar, the status dots); navy on the agent squircles and the mark's
  disc. One gradient (the agent avatars; the New session button is behind the scrim). The joining line
  with the mark animating arcs-close is the brief's "selling moment is joining" put where it belongs: the
  moment you make a circle. Serif on every name, sans on every rule, mono on `#proration`.
- **Craft 9.** The best-built page of the five. The two pick lists are one row shape across people and
  agents (avatar, serif name, owner-or-role line, status, check), the "you · owner" row is correctly greyed
  and unpickable, the warn note sits under the lists and names the exact consequence, the footer's
  roster-sentence-Cancel-primary row is on one baseline. The scope cards carry their rule in one sentence
  each and the chosen card is the only warm surface on the form. Dark is correct everywhere, including
  the `free` check and the apricot primary. Mobile is honest: cards stack, the preview folds into a
  footer link, buttons go full width. The one slip: the mobile members search field is apricot-washed
  while the desktop one is white, so on the phone it reads as focused or selected when it is neither.
- **Truth 8.** Scope, owner-unpickable, the gate rule for Checkout, "replies come back as Ana's agent,
  never as Ana", "Kept in the Payments ledger, attributed and replayable" are all product. One wrong
  detail: the preview's composer carries a **Team | Agent** segment. That toggle is the session composer's
  (it chooses whether words go to the agent or to the people in the room); a group has no mode, and the
  chat-view composer on the sister page rightly has none. The notes' open question about whether the
  scope rule is even accurate (do all members of the scope see the group?) also needs an answer before
  the cards' sentences are shipped.
- **Distinct 9.** No competitor previews the room as you build it, and none lists live agents with their
  owner and state beside people as equal members. The mark in the joining line and the three facts make
  this unmistakably Henosis.
- **The fix that matters.** Take the Team | Agent segment out of the preview composer and put the chat
  composer's own hint there ("#proration · 3 people · 2 agents" or "@ mentions a person or an agent"),
  so the sheet promises exactly the composer the group will have.

## mention-flow · 8.5 · keep

**What it is.** A storyboard, not a screen: one sentence followed from Bo's chair (#billing, the @ list
open) to Cy's chair (the session, the steer arriving with its origin tag and the inbox toast) to Dee's
chair (the reply back in #billing with its meta line), then the four-event ledger and the four edge
states (paused, plan waits, contention, not in the session), and a key for the three marks.

- **On-brief 8.** The three marks are the palette roles made into vocabulary: the agent mention on navy
  with the agent's corner, the origin tag on apricot-soft with the hash in apricot-deep, the reply meta in
  faint sans with a mono turn. Each frame keeps one gradient (the session node's edge, the agent tiles),
  which is within the rule per screen though the board as a whole shows three. The board header is a true
  hero: serif headline with the italic chocolate `#billing`, the key as a cream card.
- **Craft 7.** The frames are drawn with care (the dashed "Its next words answer Bo in #billing as well as
  here" chip, the "Reached Checkout · Cy's agent · steer in turn 13 · Open session" line, the ledger in
  navy mono). Three misses. The dark screenshot stops at 900px and shows only the header and the first
  40px of two frames, so dark was not looked at for any of the three screens, the ledger or the edge
  cards; the mobile cut shows only the header too. Frame 1 bottom-anchors the stream and leaves ~150px of
  empty cream above "Today". The 14px avatars in the frame titlebars use mixed case ("An", "Bp", "Ck"),
  which at that size reads "Ar" and gives Checkout the initials Ck here and CO on every other page.
- **Truth 10.** The strongest truth on the panel. `chat.message → directive.submitted (origin chat, rank
  contributor) → turn.started (applied at the safe point) → chat.message (replyTo, turn 13)` is the real
  event chain; "arbitrated like any steer (rank, scope, contention); never sent as a team message", "Bo
  can read Checkout · cannot steer from inside it", "the chat never shows tool steps; Open session is the
  only bridge", the paused and plan-waits lines. The open question on rank (does a group role lift a
  mention above contributor?) is the right one to send to the founder.
- **Distinct 9.** A sentence that keeps its attribution across three surfaces, with the system's
  guarantees written beside each hop, exists nowhere else. The ledger-as-design-object is ours.
- **The fix that matters.** Retake dark and mobile at the board's full height and look at them, then fix
  what that shows (the titlebar initials to two caps, Checkout to CO, the empty band above "Today" in
  frame 1). The patterns are right; the evidence for half of them is missing.

## groups-list · 8.3 · keep

**What it is.** The Chats page: a lead sentence in the product voice, filter chips with counts, and the
groups in three scopes (Team, Projects, Direct), each row one shape with an emblem, the serif name and
purpose, the attributed last line, time, the people | agents stack and a badge. The New group sheet sits
open as a panel on the right. Light, dark and a 390px cut.

- **On-brief 9.** Chocolate is the hand (New group, the + on mobile, the unread counts); apricot is the
  pulse (the `@1` badge, the selected chip, the mention in the last line, the weave under "Bo's agent is
  answering Cy…"); navy frames. Read rows lose their card and emblem colour, which is a clean way to make
  "unread" the warm state rather than bolding alone. The lead sentence ("Cy's agent answered in #billing,
  and Ana said your name in #invoice-rollout") is the brief's voice doing the job of a count. Two
  gradients on the desktop screen (New session and the unread team emblem); the emblem could be flat navy.
- **Craft 8.** The row grid is exact and holds at every width, mobile included, where the row drops the
  purpose and the stack but keeps time and badge right-aligned. The last-line attribution (serif name,
  italic chocolate "Cy's agent", `code` for branch and tool names) is a small typographic system that
  works. Two misses: the agent tiles in the stacks overlap by 6px while each carries a corner status dot,
  so the dot of "BP" lands on "IP" and the stack reads as a smear at row scale; and the open New group
  panel takes 370px of a 1440 screen, so the last line truncates at about 45 characters ("The tax lines
  now render from the invoice totals; …"), which is exactly the text the lead sentence promised you
  could read.
- **Truth 8.** Scopes, "Cy's agent" attribution, unread versus mention, the quiet group's bell-off, the
  agent "answering" as a live state are all real or near. Two things the notes already doubt: Direct
  chats with an agent (the spec has agents in groups, not one-to-one), and whether the list knows an
  agent is "answering" (a live event) or only the open group does. The side panel also re-draws the
  new-group sheet in a thinner form (chips instead of rule cards, no preview), so two versions of the same
  gesture now exist.
- **Distinct 8.** Slack's list is channels; this is circles with the agents visible and alive in every
  row. Rows that cool when read, serif names and the apricot `@` are not in Linear's or claude.ai's
  register.
- **The fix that matters.** Close the New group panel on this page (the new-group exploration owns that
  sheet) and give the width back to the rows so the last line reads whole; then give the agent tiles a 2px
  seam of canvas and move the status dot to the tile's outer corner so it never sits on its neighbour.

## chat-view · 7.8 · revise

**What it is.** #billing open: the header with `#billing` and the split stack, the stream (Ana's
bubble with an agent mention, Billing page's reply as plain prose behind the navy→chocolate rule with a
plan chip, the "New since you looked away · 2" rule, your message, read markers, Dee's reply with a quote,
the typing line), the @ completion over the composer, and the Members drawer. Light, dark and mobile.

- **On-brief 8.** The agent reply is the brief's "agents are members, not tools" drawn as type: prose, a
  serif name, the owner in faint sans, the dot-separated meta with a mono turn and an outlined "Open
  session" chip. Apricot is the pulse where it should be (the live dots, the "New since you looked away"
  rule as the only warm rule, the Members button's pressed state, the selected @ row); chocolate on the
  send and the mention text. The agent mention on navy with the agent's corner is the one new colour role
  in the set and it is right. The drawer's scope and started cards are flat and quiet.
- **Craft 7.** The stream's three shapes (bubble, prose-behind-rule, quote) are well spaced, the plan
  chip's columns are tidy, the Enter / Shift+Enter / @ hint line is a good foot. But the screenshot was
  taken with the @ list open and that list covers the two states the notes name as keepers: the typing
  line ("Billing page · Ana's agent ── answering Dee · turn 13") is cut to "answe", and "Dee read to here"
  peeks out from behind the popover. The Members drawer's "Add a person" select with "Everyone in the
  organisation is already here" beneath it is a control that explains it is useless; hide it when it is.
  Mobile is good, the @ list spanning the composer width.
- **Truth 9.** Per-person read markers from the server's reads, "New since you looked away" from your own
  read seq, the plan chip that links rather than repeats, "an agent here hears only what mentions it",
  "Billing page read this group three times today", "Mentioning an agent steers its session". All real.
- **Distinct 7.** The weakest point on the panel. Your own messages sit on the right in a warmer bubble
  (`.msg.human.mine .text { align-self: flex-end }`), which is the iMessage, WhatsApp and ChatGPT shape;
  the tokens put every human message left (`align-self: flex-start`) and the session pages do the same.
  Once "you" is a side, the rest (cream page, serif names, warm primary) reads as a familiar messenger.
  Everything that makes it ours (the split stack, the rule, the meta line, read markers as stacks) is
  on the left already.
- **The fix that matters.** Put your messages on the left with every other person's, keep "you" as the
  small word in the meta (which is already there), and let the warmer wash be the only sign it is yours.
  Then retake the light shot once with the @ list closed so the typing line and the read markers are seen.

## members-drawer · 7.5 · revise

**What it is.** The Members drawer at 470px over #billing: one add field that offers people and live
agents together, role chips (Creator, Host, Member) that are a menu where you may change them, inline
Leave and Remove with a confirm that names what stays and offers "Also remove Billing page, her agent",
agent rows with owner · status · what it is on, and a Changes ledger. The stream shows the join line
and a toast with the mark. Light, dark and a mobile sheet with the role menu open.

- **On-brief 8.** The right things are warm: Creator on solid apricot, Host on wash, the just-joined row's
  wash and ripple, the live dots. Chocolate for "Remove Ana" is replaced by danger, correctly. The toast
  "Tax lines joins the circle. Undo" with the mark animating arcs-close, and the join line "Bo adds Tax
  lines, Dee's agent · 09:46" in the stream, are the brief's motion principle landing in the right place.
  The drawer lifts the toast to surface-3 in dark and the agent mention to #3A4458 so navy does not sink
  into navy, the override that the whole set now shares.
- **Craft 5.** The desktop screenshot stacks three states at once (picker open, remove-confirm open,
  just-joined toast) and they collide: the picker's floating results cover the People rows entirely, so
  the role chips, Leave and the role menu, the drawer's main content, are not visible on desktop at all,
  and the remove-confirm is sliced through the middle ("Remove Ana from #billing? …" shows only its lower
  half under the picker). The notes admit the picker hides the first rows; that is a layout fault, not a
  note. The mobile shot is the only one where the role chips can be judged, and there they are good (the
  menu's three options each with a one-line rule, Creator disabled with "Dee hands it on, not you"). The
  two rule sentences under each section and the ledger's mark-and-minus-ring are tidy.
- **Truth 9.** "not live · can't join" for an ended session, the lock "Cy or Dee" where you may not remove
  an agent, "its owner is told when it joins", "Hears only what mentions it", the ledger that is "Kept in
  the group log, attributed and replayable. Never sent to the agents." Host is a new role the app lacks,
  flagged honestly; the tokens figure on the agent result row (9.8k) is the kind of fact that makes
  adding an agent a choice about a working thing.
- **Distinct 8.** Slack's member panel is a list; Linear has none; claude.ai has no members. Agents with
  owner, state and spend as pickable members, and a membership ledger, are not borrowed.
- **The fix that matters.** Make the picker's results inline (they push the list down while the field is
  focused) instead of floating, and take one screenshot per state (picker, confirm, just-joined), so the
  role chips and the full confirm are visible on desktop. Then decide the "also remove her agent" default
  the notes leave open and draw the checkbox in that state.

---

## Carry forward

1. **The people | agents stack.** Round initials for people, the agent squircle with a corner status dot,
   a hairline seam between the kinds; used in the topbar, in list rows, in the sheet footer and the preview.
   Give agent tiles a 2px seam of canvas so the dot never sits on a neighbour.
2. **The agent reply shape.** Plain prose behind a 2px navy→chocolate rule, the 26px agent avatar with a
   live dot, serif name, owner in faint sans, dot-separated meta ("replied · in reply to Ana · turn 12"),
   mono turn, an outlined "Open session" chip; a question back to the people in italic serif; a plan chip
   that links to the session's plan card. The chat never shows tool steps.
3. **Three mention marks.** A person on apricot-soft with chocolate text (7px radius); you on solid apricot;
   an agent on navy (#2A3244 light, #3A4458 dark) in Instrument Serif with the agent's corner (8/8/8/2).
   In the session, the steer wears a 22px apricot-soft origin tag (`# billing · steered from the group`)
   and a mono scope line ending "answers in #billing".
4. **The @ completion.** Header "People and agents in #billing" with the typed query echoed in mono,
   matched letters in chocolate, person rows with role, agent rows "Ana's agent · Billing page · running",
   the owner listed under the agent as "not a match, listed for the owner", the selected row on apricot-soft
   with ↵, and the footer "Mentioning an agent steers its session; its next words come back here."
5. **The agent pick row.** Squircle avatar, serif title, owner in italic chocolate, status dot and word
   (running, at the release gate, blocked, paused), tokens in mono; an ended session greyed as "not live ·
   can't join"; a warn-soft note that says what a non-running pick means.
6. **Joining is drawn with the mark.** The join line in the stream and the toast ("Tax lines joins the
   circle. Undo") animate arcs-close; a just-joined row is apricot-washed and its avatar ripples; the
   Changes ledger uses the mark for joins and a minus ring for leaves, "Never sent to the agents."
7. **Unread, mention, new.** A chocolate count for unread, an apricot `@n` when your name was said, the
   bell-off glyph for a quiet group; read rows lose their card and emblem colour; "New since you looked
   away · n" is an apricot-deep rule with a chocolate pill, the only warm rule in a stream; read markers
   are tiny stacks under the last message each person read, never ticks on every bubble.
8. **Rules in one sentence, facts in the voice.** Scope as radio cards each carrying its rule; a lead
   sentence in place of a count ("Cy's agent answered in #billing, and Ana said your name in
   #invoice-rollout"); three facts under a preview (who can find it, what @ does, where it is kept).
9. **Human messages stay left.** "you" is a word in the meta, never a side; the only sign a message is
   yours is a slightly warmer wash. Groups have no Team | Agent toggle; that segment belongs to the
   session composer alone.
10. **Promote the shared dark overrides into tokens.css.** `--ok #8FC487`, `--warn #E2B06A`,
    `--danger #E2847A` with their soft variants, and `--mention-agent` (#2A3244 / #3A4458), which four
    of five pages now paste in by hand.
