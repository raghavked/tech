# Docs site · home and the Release gates guide · notes

## The idea
The docs home leads with the brief's own sentence as a serif claim ("One team, people and agents. Here is how it works.") beside one navy stage that is not a screenshot but the CLI joining a session, in the product's voice: "Dee joins the circle. Bo has the baton. The plan waits for two ratings." The guide page is a classic three-column register (guides tree, article, "on this page") whose centrepiece is the real release-gate notice from the app, with Ana and Cy rating 4 and 5 on the Billing page and Checkout, Bo's unrated approve marked "a voice, not a vote", and the tally bar reaching the rule before "Granted. United pdf-layout into main." Everything else on the page (policy JSON, risk-class table, who counts) is written so the reader can set the same rule for the Payments team.

## What to keep
- Cream page, one navy element per screen: the install stage on the home, the code block on a guide. The gradient is reserved for the app's primary button; the docs use flat chocolate for "Open Henosis".
- The "Docs" wordmark pill in apricot-soft next to the mark, so the docs feel like a room of the product, not another site.
- Guide cards with serif titles, one apricot tab on the "live" card, read times, and a chocolate arrow; "updated" as a mono tag.
- The embedded notice is the app's own `.notice.gate` with the brand-gradient edge, inside a dashed "live example" frame so it reads as an exhibit, not a control.
- Code blocks sit on the rail navy in both themes with apricot keys and the green of running status for strings; the tabs (henosis.json / CLI / API) sit flush on top.
- Risk classes carry the status dot colours used in the app (write ok, exec and external warn, irreversible danger).
- Dark: the stage and code keep a deeper navy than the canvas, the active sidebar item uses apricot-soft, the callout uses surface-2 so it stays quieter than the example.
- Mobile: the sidebar and the table of contents collapse into the menu button, the vote rows put the note under the name, the tally bar drops to its own line, the pager and the feedback box go full width.

## Open questions
- `docs.henosis.dev` and the npm package name `henosis` are placeholders; is the CLI installed with npm or shipped with the desktop app?
- Should the release-gate example be a live replay (the spec says replays are deterministic) rather than a static exhibit, so the docs can rate it and show the tally move?
- The "Was this page useful?" answer and "Ask in #henosis-docs" assume a public Slack community; the brief does not decide that yet.
- The home's "What's new" needs a version scheme (0.9.x here); should the docs version-switch per release like the app, or stay single-track?
- A mobile table of contents is dropped entirely; a collapsible "On this page" at the top of the article may be worth it on long guides.
