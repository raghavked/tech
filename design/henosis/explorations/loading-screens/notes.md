# loading-screens · Loading and connecting

## The idea
Every wait in Henosis is a picture of something becoming one, so each of the four waits gets exactly one loader and one sentence: the app launch shows the mark closing its two arcs on a navy canvas ("Opening the circle."), a session joining shows three dots in the three colours converging at the centre of an otherwise live shell ("Joining Bo, Cy and Dee in Billing page · Checkout." with the folded-event count beneath), a project opening runs the weave strand under the title while the direction is already readable and the fleet rows ride in ("Opening Payments. 3 of 5 sessions in"), and a long operation keeps its finished steps checked, times the running one, and shimmers only the lines where the release-gate summary will land ("Bo's agent is uniting pdf-layout into main. About a minute."). The board shows the four desktop screens, the four loaders as a spec (where, loop, still frame, sizes), the copy table with the 8-second second line and the failure state, and the same four waits on the phone.

## Keep
- One loader per screen, each tied to a meaning: mark = the app joins you, orbit = you join people, weave = rows arrive, shimmer = words arrive. No generic spinner anywhere.
- Show what is already in: the rail is live while a session joins, the direction card is readable while rows load, finished steps stay checked while one runs. Loading is never a blank page.
- Copy names who and what; the only second line is a count ("1,204 of 2,310 events folded") or, after 8 s, a cause; after 30 s one chocolate action ("Try again", "Watch tests").
- Counts instead of percentage bars for things that are not divisible.
- The mark's arcs are fixed to Chocolate and Apricot on the navy disc in both themes (`--accent` turns apricot in dark and would make both arcs the same colour).
- The orbit loader's third dot uses `--ink` rather than `--rail` so it stays visible on the dark canvas; the chocolate dot is a fixed `#56352D`.
- The composer stays visible but muted while joining ("You can type once the history is in."); the thumb has somewhere to go on the phone too.
- Calm mode and reduced motion freeze each loader at its finished frame (closed ring, stacked dots, plain strand, flat lines); the same markup, no script.

## Open questions
- The computed brief lists a "bead-join" loader; the design brief forbids the older ring-and-bead, so this page uses arcs-close (the mark) for the launch. Confirm that is the intended substitution.
- `tokens.css` `--canvas-wash` is a `radial-gradient`, which Chromium dithers; a full-page 1440-wide PNG of any page with it weighs 600–900 KB. This exploration draws the same wash as a blurred disc instead (flat pixels, 175 KB per shot at 64 colours). Worth deciding for the app as well, since the dithered gradient also costs paint on every scroll.
- Even so the folder is ~430 KB with two full-page desktop shots and the mobile shot; the 300 KB budget does not fit two 1440 × 3200 PNGs. Either the budget should exclude screenshots or boards should be shot at 50 %.
- `tokens.css` `.rail .section` collides with any page-level `.section` class; this page renamed its own to `.bsec`. Consider namespacing the rail's to `.rail-section`.
- Should reconnecting reuse the orbit loader (as here) or only the mark's halo, so the orbit is reserved for first joins? The product's `ReconnectLine` today is a text line only.
- The join count ("1,204 of 2,310 events folded") assumes the server sends the total up front; if it streams without a total, the second line falls back to "events folded so far".
- The launch screen names the signed-in person and team bottom-left; on a shared or kiosk machine that may be more than a splash should say.
