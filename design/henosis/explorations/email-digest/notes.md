# Email digest · notes

## The idea
The Monday digest is the manager overview folded into one email, in the order a lead reads it: the app's own sentence first ("4 open sessions across 2 projects … 3 things need you. This week the team spent 212k tokens, rated 7 plans and held 2 release gates"), then the three things that need her as stripe cards with one action each, then tokens as three tiles and two single-hue bar lists with a one-line reading, then plans and release gates as rows with stars, estimate-vs-actual and vote dots. The invite is the join moment on paper: a navy→chocolate hero with the mark, "Cy, *Bo* invites you to the circle", one chocolate button, who is already here (people and agents in the same two boxes), the manners ("same manners, same gate"), and the agent's path in a navy code block so a person and an agent get in the same way. Both sit in a thin mail-client header (sender disc with the mark, from/to, subject with its preheader) so the subject line is designed as part of the email.

## What to keep
- Subject = the sentence's verdict ("Payments this week: 3 things need you") and the preheader = the four counts, so the inbox row already tells the lead whether to open it.
- The serif sentence at 25px with mono numbers and the needs-you clause in chocolate; it is `copy.team.summary` with the week's figures appended.
- Needs-you cards keep the app's three stripes (apricot plan, navy→chocolate gate, red contention), a kind label, a serif line naming the thing in italic, one line of the rule, the vote dots with a dashed empty avatar for the missing voice, and one button.
- Tokens: Spent / Against plans / Budget tiles, bars in one hue with the value at the tip, the dashed budget mark on Checkout's track, and the reading that names the biggest session and the budget percentage in warn amber.
- Plan rows with small stars, mono average, estimate → actual in green "under" or amber "+38%", and a status tag; gate rows with the rule in mono, the votes and how long the gate waited.
- Footer that says why she gets it ("because you lead Payments"), the cadence as a Daily / Weekly / Off segment, and "Open the overview" as the escape to live numbers.
- Invite: the one-use 7-day link beside the button, the People / Agents boxes using the two avatar shapes, the apricot-wash manners card, the `henosis join` block with the key words in apricot, and the plain "nothing happens until you open the link" foot.
- Dark via the tokens only: surfaces step up, the hand turns apricot on the buttons, the code block drops to the darker rail navy, status tags keep their hue.
- Mobile: one column, email at phone width, tiles two-up with Budget full width, bars stacked, average stars hidden in rows, "1 of 2" hidden beside the vote dots.

## Open questions
- The digest is drawn with the tokens' CSS; a real email needs inline styles, table layout and font fallbacks (Georgia for Instrument Serif, system sans, Menlo). Which clients must it be pixel-right in, and do we ship a dark variant or let the client invert?
- The app's summary sentence today has only live counts; the digest appends the week's tokens, plans and gates. Should that extended sentence also become the overview's lede?
- Needs-you buttons deep-link into the app; for someone not signed in they need a magic link. Do we mint one per digest, or land on sign-in and return?
- Daily vs weekly: the daily version would be the sentence and needs-you only. Is a daily email wanted at all, or is that the inbox's job?
- Per-person tokens (Bo 86k, Ana 27k) in a lead's email read as a league table more strongly than on screen. Keep, or show only by project with "By person" behind the Usage link?
- The invite shows who has the baton and three live agents; that is live state at send time and stale by the time Cy opens it. Keep the circle boxes or make them a plain count?
- The agent key in the invite is Cy's to use; should the agent path live in the invite at all, or in a second email after Cy joins (as the app's Share dialog does)?
