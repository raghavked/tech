# Settings · notes

## The idea
Settings is a desk with two columns: on the left what is yours (profile, the notifications you want, the keys you press), on the right what is the team's (the policy every new session in Billing page is born with, where sessions also live, the look), so a lead like Ana sees her own things and the Payments team's manners at one glance instead of scrolling one long column. Team policy reads as a sentence first ("Every new session in Billing page starts with a plan. The plan goes ahead when two contributors rate it 3 or more. Nothing irreversible happens until two contributors rate it 4 or more.") and as controls second: plan first, the plan-approval rule as a count plus a star average, the soft token budget with its amber/red ticks drawn under it, the turn budget, one rule chip per risk class, and the contention policy. A changed row is washed apricot and labelled, and the sticky save bar says what changed and that it binds new sessions only, so Bo's running plan for invoice PDF keeps the rule it was born with.

## What to keep
- The two-column desk at 1440: yours left, the team's right; the policy card is the hero and lands in the first screen. Mobile goes to one column in the order Profile, Team policy, Notifications, Integrations, Appearance, Keyboard.
- The policy sentence in Instrument Serif with the mark in front of it, the project and the counts in italic chocolate; it is generated from the same rule the kernel's `describeRule` prints, so the words and the controls can never disagree.
- The plan-approval control as stepper + five stars + "3+ avg" in mono: the same vocabulary as the plan card and the rating control, not a form field.
- The token budget row draws the meter it talks about (0, 80% amber, 100% red) under the hint "nothing is cut off"; the input is `400 k` in mono.
- Risk classes in mono, `irreversible` in the danger colour, each rule a select chip: "No approval", "One contributor", "One driver", "2 contributors · 4+ avg".
- Changed state: `--changed` wash on the row, a small CHANGED tag after the title, and a sticky save bar whose sentence names the change (1 → 2), says "new sessions only", and names the session that keeps the old rule; Save is the only chocolate button on the page.
- Notifications are the seven kinds the app really has, in the app's own words, plus a "Send a test" row that uses a real line ("Dee's agent is waiting on proration").
- Keyboard is the real map (composer, session, anywhere) with glyph key caps and the ⌘/Ctrl segment in the heading.
- Integrations say what the connection means in one line each (a thread per session, a PR is a session) and name the live things (#billing-page, PR #412 invoice PDF, #418 tax lines and proration).
- Dark: fields on `#1E2534`, key caps and switches with their own dark values, empty stars at 22% cream so the average still reads, the changed wash drops to 12%.

## Open questions
- Today `TeamPolicy` is read-only from the project. Should an owner of the project edit it here, or on the project page, and is the save a `PUT /api/projects/:id/policy` for new sessions only (as the bar promises)?
- Is the policy per project (as the picker says) or per team, and does Checkout inherit Billing page's rule or carry its own? The picker assumes per project.
- Appearance holds Theme and Motion; the Team look editor is a row with a swatch preview and Edit. Should the editor open inline (as the app does now) or as its own page under Settings?
- "Mention a person or an agent" (@) is composer behaviour, not a registered shortcut; keep it in the keyboard list as the one typed symbol worth teaching?
- VS Code/Zed and the harness SDK are phase 1 surfaces; show them as "Not connected" now, or hide them until they exist?
- Should the "Send a test" notification also tell you when the browser blocked it, in the row's hint, instead of a toast?
