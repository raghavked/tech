# Accessibility audit

## The idea
An audit board that reads the four key screens (session view, approvals queue, rail, plan card) through four lenses, contrast, focus order, screen reader names and reduced motion, with the Payments team's real work in every example: Bo's agent on the invoice PDF for Checkout, Ana rating the proration plan, Dee holding the release gate. Every finding carries its measurement (ratios computed from the hex values in tokens.css, light and dark) and the fix we propose, so the fixes land as token and markup changes rather than a redesign. The focus-order section draws the proposed tab order straight onto the session screen, and the motion section shows each animation's rest state beside the moving one, which is where the one real bug lives (the granted check never draws under reduced motion).

## What to keep
- The before/after plan card: three token changes (ink-3, warn, star fill plus outlined empty stars) and a chocolate focus ring with the apricot halo outside it. Proposed values: ink-3 #6A7183 / #9CA3B2, warn #946021 / #D8A05A, dark ok #7DB577, dark danger #D77A6D, star fill #B4865C.
- Stars as one radiogroup with roving tabindex: one tab stop instead of five, arrows to choose.
- "State in words next to every colour": hidden text in the status dot, a sentence on the Team pill, role="meter" on the budget bar, one composed label per rail card, a sentence on the presence stack, the send button named after the Agent/Team toggle.
- Approvals and gates announce once through the existing polite toasts region, in the product voice.
- The reduce rule and calm mode stay one switch; add `.draw { stroke-dashoffset: 0 }` under both.
- The fix list ordered P0 (tokens, Stars, Status/TeamPill/TokenMeter, live region, check) then P1 (skip link, drawer focus, composer key, names, loaders, toasts).

## Open questions
- The app's tokens.css already has --focus-ring / --focus-halo while design/henosis/tokens.css still ships the apricot glow. Which file is the source of truth for the design wave, and should the design tokens adopt the app's ring now?
- Dark mode --accent is apricot, so a chocolate ring is not available there; the proposal uses var(--accent) (apricot on navy, 9.6:1). Is a brand-constant chocolate ring in dark mode wanted instead, with its own 3:1 check against --rail?
- Outlined empty stars change the look of the rating control in every screen; the rating-control exploration should confirm the outline weight (1.5px) at 16px and 22px.
- Reordering the DOM (main before rail) changes the reading order for every view; is that acceptable for the mobile rail, where the rail is a sheet?
- The live region text for release gates names the command ("stripe prorations --apply"); should screen readers get the agent's one-line reason instead when the command is long?
- Screenshots: the full board is 1440 x 5541 and does not fit the 300 KB cap at any honest fidelity, so shot-light.png and shot-dark.png are the top 1440 x 900 of the board; every section was checked at full resolution in both themes during the build.
