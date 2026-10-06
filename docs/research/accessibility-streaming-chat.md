# Accessibility for streaming AI chat: live regions, focus, tool steps, motion, warm-palette contrast

Research memo for Henosis. Date: 2026-10-02. Several primary sources are blocked by the egress proxy; those are marked UNVERIFIED and summarised from search snippets.

## Why it matters for Henosis

Henosis's conversation column is not a transcript somebody reads once. It is a shared surface that stays open for hours while an agent emits text, tool steps, approval requests, contentions and handoffs, and while several humans steer at once. Every one of those is a dynamic DOM change, and dynamic change is exactly where assistive technology breaks: WCAG 2.2 has no success criterion for streaming text, and the ARIA live-region model was designed for occasional status strings, not a 500-word response arriving in 5–20 DOM updates per second.

Three things make the stakes higher than a consumer chat app. First, approvals are consequential: a screen-reader user who never hears "the agent wants to delete the branch; needs two approvals" is excluded from a decision the kernel is waiting on. Second, the product is multiplayer, so the column changes because of *other people* (a driver handoff, a lead directive, a contention) while the user is typing in the composer; those interruptions must be announced without stealing focus. Third, the brand palette is warm and low-contrast by design (Apricot Illusion carries most of the "a human's attention is here" meaning), and the measured ratios below show that several roles currently depend on colour alone.

The current web client (`apps/web/src/views/SessionView.tsx`) already has good bones: landmarks and `aria-label`s on the sidebar, composer and conversation, `aria-expanded` on tool-step buttons, an `sr-only` class, a `:focus-visible` ring and a global `prefers-reduced-motion` rule in `design/tokens.css`. What is missing is any live region at all: `grep aria-live` returns nothing, so today a screen-reader user hears nothing when the agent speaks, finishes, asks for approval or is handed off.

## Prior art

1. **W3C, Understanding SC 4.1.3 Status Messages (WCAG 2.2).** https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html — accessed 2026-10-02 (fetch blocked; UNVERIFIED, content known from the standard). Status messages must be programmatically determinable (`role=status`, `role=alert`, `role=log`, `aria-live`) *without receiving focus*. Progress and "done" states are status messages; the live container must exist before the text is injected.
2. **Sara Soueidan, "Accessible notifications with ARIA Live Regions", parts 1–2.** https://www.sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-1/ and https://sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-2 — accessed 2026-10-02 (fetch blocked; UNVERIFIED from snippets). Polite vs assertive; `status` and `alert` are the only widely reliable roles; render the region on page load and change its text, never mount a new region with text already in it.
3. **tianpan.co, "When Streaming Tokens Meet the Screen Reader" (2026-06-29) and "The Accessibility Gap in AI Interfaces" (2026-04-17).** https://tianpan.co/blog/2026-06-29-streaming-tokens-meet-the-screen-reader , https://tianpan.co/blog/2026-04-17-ai-accessibility-streaming-screen-readers — accessed 2026-10-02 (blocked; UNVERIFIED). Names the three failure modes: re-announcement storm (`aria-atomic=true` on the streaming body), silent drops (`aria-atomic=false` under load; NVDA, JAWS and VoiceOver each drop differently), and thinking-state blindness. Recommends `aria-busy=true` on the body while streaming, a separate polite region for "Generating" / "Response complete", and debounced batches every 2–3 s only for very long outputs.
4. **azukiazusa, "Accessible streaming chat UI".** https://azukiazusa.dev/en/blog/accessible-streaming-chat-ui — accessed 2026-10-02 (blocked; UNVERIFIED). Same conclusion from a practitioner's build: never make the streaming body a live region; announce start and finish from a separate element.
5. **GitHub Primer, "Accessible notifications and messages".** https://primer.style/accessibility/toasts/ — accessed 2026-10-02 (blocked; UNVERIFIED). Toasts must be announced non-disruptively; actionable messages do not belong in auto-dismissing toasts; interactive content must be reachable by keyboard.
6. **Adrian Roselli, "Defining 'Toast' Messages" (2020).** https://adrianroselli.com/2020/01/defining-toast-messages.html — accessed 2026-10-02 (not fetched; UNVERIFIED). A toast is a status message, not a dialog; if it needs a decision, it is not a toast.
7. **Claude A11y browser extension.** https://chromewebstore.google.com/detail/nkjicpmlajaekkchnlmfiodcpifmdjok — accessed 2026-10-02 (snippet only). A third party wraps every response on claude.ai, ChatGPT, Gemini and Copilot in a labelled region and announces "Generating response…" / "Response complete". The existence of this extension, plus the AppleVis thread on ChatGPT regressions with VoiceOver and NVDA (https://mail.applevis.com/comment/211605, blocked), is the clearest evidence that the incumbents have not solved this.

## What to borrow

- **Two channels, never one.** The conversation body is a labelled region (`role=log` or `section aria-label="Conversation"`) that the user reads at their own pace. A single persistent `role=status` element, rendered at mount, carries short sentences: "Ana's agent is working", "Agent finished: 3 steps", "Approval needed", "Bo is now driving". Nothing in the body is `aria-live`.
- **`aria-busy` during generation,** cleared on completion, so AT that honours it holds off until the message settles.
- **Politeness by consequence, not by colour.** `polite` for text and steps; `assertive` (`role=alert`) only for things the kernel is blocked on (approval requested, handoff pending for *me*, contention needing *my* resolution).
- **Actions never live in toasts.** Henosis's approval and contention notices are already inline blocks with two buttons; keep them in the column, announce their arrival through the status channel, and give the user a shortcut to jump to the next one.
- **Reduced motion as a global veto,** which `tokens.css` already does; extend it to scrolling and the running pulse.

## What is unsolved

- No standard exists for streaming text; every screen reader buffers live regions differently and none expose a "stream" primitive. The best known practice is a workaround.
- Multiplayer collision: if two humans steer while a screen-reader user composes, a `polite` queue can hold several sentences that are stale by the time they are read. Nobody has published a policy for coalescing or expiring announcements.
- Attribution in audio: "Bo approved" vs "Bo denied" must reach the ear without the apricot ring or the olive/brick dots; there is no agreed verbal grammar for driver, contention and claim state.
- Henosis's protocol records whole model outputs as events (`grep delta|stream packages/protocol` is empty), which sidesteps token storms today; if the Claude adapter starts streaming deltas, the pattern above must be in place first.

## Concrete recommendations for Henosis

1. **Add one mounted status region** in `apps/web/src/App.tsx` (or a small `apps/web/src/announce.ts` module exposing `announce(text, {assertive?})`): two `sr-only` elements, `role="status"` and `role="alert"`, present from first paint. Clear and re-set text with a 50 ms gap so identical strings re-announce. Debounce to one message per 1.5 s per channel; drop superseded "working" messages when "finished" arrives.
2. **Wire the event reducer to it** in `SessionView.tsx` where `blocksOf` and the `notifyIfHidden` branch already classify events: `model.output` → polite "Agent: {first sentence}"; `tool.call` → nothing; `tool.result` with `ok=false` → polite "Step failed: {done}"; `approval.requested` → assertive "Approval needed: {d.ask}"; `handoff` to me → assertive; `fleet.contention.mirrored` → polite unless unresolved and I am an owner or lead; `driver` change → polite "{name} is now driving".
3. **Mark generation state** on the agent block: `aria-busy={true}` while the agent's turn has no terminal event, and a visible "working" line that is text, not only the pulsing dot in `.agent .head .dot.running`.
4. **Give tool steps an accessible name that carries result and risk.** In `StepLine`, the button text is `doing`/`done` plus an ellipsis class; add `aria-label={`${text}${suffix}, ${step.ok===false?'failed':'succeeded'}`}` and render `step-out` as `<pre tabIndex={0} aria-label="Output">`, since a 20-line `pre` is otherwise unreachable by keyboard scrolling. Group steps as `<ol aria-label="Steps">`.
5. **Focus management for notices:** never move focus on arrival. Add a key (suggest `g a`) and a sidebar count that jumps focus to the first pending `ApprovalNotice` (`tabIndex={-1}` on the `.notice` div, `focus()` on demand), and announce "No pending approvals" when there are none. On vote, return focus to the composer textarea.
6. **Fix colour-alone meaning:** measured on `#FAF8F4`, Apricot `#E2C4A6` is 1.56:1 (driver ring, contention border, selected item), failing SC 1.4.11's 3:1 for UI components; add a 1 px `--fg-2` inner stroke or a text label ("driving", "contention") beside every apricot cue. `--fg-3 #9A9EA9` is 2.53:1 and is used for 12 px timestamps and dividers; raise it to about `#7C8290` (4.0:1 at 12 px is still under AA, so also move timestamps to 13 px or `--fg-2`). `--warn #B9792E` is 3.39:1 and `--ok #5F7F4B` 4.28:1; these are fine as dots but must not be the only text colour for "awaiting approval" or "running". Dark mode passes everywhere except `--fg-3` (4.03:1). Land in `design/tokens.css` and `apps/web/src/tokens.css`.
7. **Reduced motion beyond CSS:** in `Stream`'s `useEffect`, call `scrollTo({top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'})` and, when the user has scrolled up, do not auto-scroll at all (SC 2.2.2 pause/stop/hide); the `.running` pulse should become a static dot plus the word under reduced motion, which the existing `tokens.css` rule already achieves for the animation.
8. **Desktop shell parity:** `apps/desktop/src-tauri/src/main.rs` updates the tray label "Pending approvals · N"; also post a native notification (Tauri `notification` plugin) for assertive events so desktop users relying on OS-level AT get them even when the window is unfocused.
9. **Audit checklist for Henosis (add to `docs/03_product_spec.md` or a new section in `docs/11_open_questions.md`):** mounted status/alert regions present; no `aria-live` on message bodies; `aria-busy` toggles; every notice reachable by keyboard and announced on arrival; focus never moved by incoming events; tool steps named with result; all apricot cues doubled with text or stroke; text ≥ 4.5:1, UI cues ≥ 3:1 in both themes; reduced-motion disables pulse and smooth scroll; tested with VoiceOver+Safari, NVDA+Firefox, JAWS+Chrome against a scripted session (`pnpm demo`) with a Playwright assertion in `apps/web/test/smoke.spec.ts` that the status region's text changes on `approval.requested`.

## Sources

- https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html (2026-10-02, UNVERIFIED)
- https://www.sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-1/ (2026-10-02, UNVERIFIED)
- https://sarasoueidan.com/blog/accessible-notifications-with-aria-live-regions-part-2 (2026-10-02, UNVERIFIED)
- https://tianpan.co/blog/2026-06-29-streaming-tokens-meet-the-screen-reader (2026-10-02, UNVERIFIED)
- https://tianpan.co/blog/2026-04-17-ai-accessibility-streaming-screen-readers (2026-10-02, UNVERIFIED)
- https://azukiazusa.dev/en/blog/accessible-streaming-chat-ui (2026-10-02, UNVERIFIED)
- https://primer.style/accessibility/toasts/ (2026-10-02, UNVERIFIED)
- https://adrianroselli.com/2020/01/defining-toast-messages.html (2026-10-02, UNVERIFIED)
- https://chromewebstore.google.com/detail/nkjicpmlajaekkchnlmfiodcpifmdjok (2026-10-02, snippet)
- https://mail.applevis.com/comment/211605 (2026-10-02, UNVERIFIED)
- Repo: `apps/web/src/views/SessionView.tsx`, `apps/web/src/App.tsx`, `design/tokens.css`, `apps/desktop/src-tauri/src/main.rs`; contrast ratios computed locally with the WCAG relative-luminance formula.
