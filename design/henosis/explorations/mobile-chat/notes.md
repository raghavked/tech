# Mobile chat · notes

## The idea
On a phone the chats are two screens that share one frame: the groups list under a navy top block (title, the Payments team, a gradient "New group", search) and the group itself (#billing) with a back chevron and a members stack where the Team button would sit on a session. The list leads with what needs you ("Two mentions wait for you in #billing and #invoice-pdf"), then rows that read like a chat app but carry Henosis facts: a serif #name, member count, the last line attributed in serif, a live dot on the emblem when an agent member is running or waiting, apricot counts for unread and a chocolate "@" for a mention, and an "Agents replied" section so an agent's answer is a thing you can open. The chat anchors to the latest moment: Bo's number, Cy's steer with its highlighted @mention, Cy's agent's reply with "in reply to · turn 4", a join line with the mark, and "Ana's agent is working on turn 13"; the composer's @ sheet is open over the keyboard area, offering Bo and Bo's agent with its live status.

## What to keep
- One navy block for status bar + title row; the rail opens from the menu button with the needs-you count in apricot (groups list), and the chat replaces it with a back chevron.
- Row anatomy: 44px emblem with the live dot, serif name + small member count, one-line last message with the author in serif, time on the right (accent when unread), apricot count badge, chocolate "@" badge for a mention.
- The "needs you" strip in apricot wash with the mark, above the All / Unread / Mentions chips with mono counts.
- Agent replies in the stream: agent avatar with the live dot, "replied · in reply to Cy · turn 4", the text indented under the avatar, tool steps as a quiet ledger (+41 −6, 9 pass).
- Mine on the right in a faint accent tint with a square inner corner; mentions as apricot-wash marks in accent.
- The @ sheet as a card above the composer: people first, agents with their status word; the typed "@b" echoed in the header; the selected row in apricot wash.
- Tab bar: Sessions, Chats, Approvals, Me with apricot counts; the only colour in the bar.
- Dark via the tokens only; the mark keeps its arc colours in both themes.

## Open questions
- Should the "Agents replied" section be a filter chip instead of a list section, so the main list stays groups only?
- The members button shows three avatars and "5"; on a 4-member group it would show all. Is the count still useful, or should it read "Members" like the desktop?
- Swipe actions on a row (mute, mark read, leave) are not drawn; which two does the Payments team reach for?
- When the @ sheet is open the stream loses ~130px; should the sheet replace the last message area instead of sitting above the composer, as iOS Messages does?
- Join lines ("Dee joins #billing") are drawn in the stream; the app keeps them only as events. Worth persisting as a visible line?
- Deep link from a mention push: land on the message (scrolled, highlighted) or at the bottom with a "1 mention above" chip?
