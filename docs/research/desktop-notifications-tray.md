# Desktop notifications and tray for Henosis

Topic: desktop-notifications-tray · 2026-10-02 · scope: Tauri shell (`apps/desktop`), web client, server inbox

## Why it matters for Henosis

A Henosis session runs for hours or days with many humans attached, and most of them are
somewhere else most of the time. The two moments where the agent is genuinely blocked on a
specific person are an **approval** (quorum for `irreversible`, driver for `external`, one
contributor for `exec`) and a **handoff offer**. Everything else (turn summaries, claims,
contentions the agent routes around) is ambient. If the desktop shell toasts the ambient
stream, people turn Henosis's notifications off at the OS level and the blocking moments die
with them. The shell today has the right skeleton (tray item "Pending approvals · N",
`notifyIfHidden` in the web client, a per-user inbox in `packages/server/src/notify.ts`,
`henosis://` deep links) but no urgency model, no badge, no quiet-hours logic, and a tray item
that counts approvals the viewer may not be eligible to vote on.

## Prior art

1. **Apple UserNotifications interruption levels** (`UNNotificationInterruptionLevel`),
   developer.apple.com, accessed 2026-10-02. Four levels: passive (no alert, no screen
   wake), active (default), timeSensitive ("can break through system controls such as
   Notification Summary and Focus. The user can turn off the ability for time sensitive
   notification interruptions"), critical (bypasses the mute switch, needs an Apple-granted
   entitlement). Available macOS 12+. https://developer.apple.com/documentation/usernotifications/unnotificationinterruptionlevel/timesensitive
2. **WWDC21 session 10091, "Send communication and Time Sensitive notifications"**, accessed
   2026-10-02 via search snippets (video page is JS-only). Focus decides which apps may
   interrupt; only communication and Time Sensitive notifications break through, and the user
   can revoke that per app. https://developer.apple.com/videos/play/wwdc2021/10091
3. **Microsoft toast UX guidance** and **Windows 11 22H2 Do not disturb** (formerly Focus
   assist), learn.microsoft.com, accessed 2026-10-02, UNVERIFIED (egress blocked; from
   snippets). Clicking a toast must open the app "in the notification's context"; a button
   that does background work (quick reply) should not launch the app. Windows 11 has a
   per-app priority list that breaks through DND, and a focus session can hide taskbar badges
   and suppress taskbar flashing. https://learn.microsoft.com/en-us/windows/apps/design/shell/tiles-and-notifications/toast-ux-guidance ·
   https://windowscentral.com/software-apps/windows-11/whats-new-with-notifications-on-windows-11-2022-update
4. **Tauri 2.2 badging and the notification plugins**, accessed 2026-10-02. Tauri 2.2 added
   `Window::set_badge_count` (Linux, macOS, iOS), `set_overlay_icon` (Windows only) and
   `set_badge_label` (macOS only). The official `tauri-plugin-notification` documents
   title/body/sound on all five platforms and actions on mobile; the community fork
   `Choochmeque/tauri-plugin-notifications` adds `onAction()` and says plainly that on
   macOS, Windows and Linux "actions support varies by platform". https://tauri.app/release/tauri/v2.2.0/ ·
   https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/notification ·
   https://github.com/Choochmeque/tauri-plugin-notifications
5. **Slack Do Not Disturb**, slack.com help 214908388, accessed 2026-10-02, UNVERIFIED
   (egress blocked; from snippets). A per-user schedule (every day, weekdays, custom hours),
   ad-hoc snooze, a visible snooze icon on the profile, and a "notify anyway" override that a
   DM sender may use once per day, which Slack warns to use sparingly.
   https://slack.com/help/articles/214908388-Pause-notifications-with-Do-Not-Disturb
6. **GitHub Desktop notifications**, docs.github.com, accessed 2026-10-02, UNVERIFIED
   (egress blocked; from snippets). It notifies only when a teammate approved, commented on,
   or requested changes on *your* pull request; clicking focuses the app on that review.
   https://docs.github.com/en/desktop/working-with-your-remote-repository-on-github-or-github-enterprise/configuring-notifications-in-github-desktop
7. **PagerDuty acknowledge-from-notification** and **NIST Mobile Threat Catalogue AUT-1**,
   accessed 2026-10-02. PagerDuty lets responders Ack by long-pressing the push; a community
   thread reports the iOS Ack button "seems to only snooze", a reminder that a one-tap action
   must be bound to a precise server-side effect. NIST AUT-1: content in notifications can be
   read from a locked device. https://community.pagerduty.com/ask-a-product-question-2/acknowledge-button-on-ios-seems-to-only-snooze-733 ·
   https://pages.nist.gov/mobile-threat-catalogue/authentication-threats/AUT-1.html

## What to borrow

- **Three urgency levels, mapped from the kernel, not from the UI.** Apple's passive/active/
  time-sensitive is exactly the Henosis split: ambient (passive, inbox only), needs-you-soon
  (active), agent-blocked-on-you (time-sensitive). Never critical.
- **GitHub Desktop's scoping rule.** Only notify the person whose action unblocks something:
  the eligible voters for an approval, the named recipient of a handoff, the driver for a
  contention. Observers get the inbox, never a toast.
- **Microsoft's activation rule.** Click opens the exact notice; a background button never
  raises the window. This maps to Henosis's hash-bound approvals: the thing approved is the
  `approvalId`, so a background "Approve" is safe to wire only when the shell holds a live
  session token and the vote event carries that id.
- **Slack's override budget.** A driver may escalate one approval to time-sensitive per
  person per day; the kernel can enforce it because every escalation is an event.
- **Badge = things awaiting you**, not unread count. Windows focus sessions hide badges;
  macOS Focus hides them too, so the badge must never be the only signal.

## What is unsolved

- **Desktop action buttons in Tauri are not reliable.** The official plugin exposes actions
  on mobile only; the community fork works on macOS via UNUserNotificationCenter but is
  unverified on Windows (WinRT toast buttons need an AUMID and COM activation) and Linux.
  Phase 0 should treat the whole toast as one button.
- **Apps cannot read Focus or DND state.** macOS exposes no public query for Focus; Windows
  has `SHQueryUserNotificationState` only for presentation/full-screen cases. The app can
  only declare a level and let the OS decide, so Henosis needs its own quiet hours as well.
- **Withdrawing a toast when the agent routes around.** A denied or expired approval, or a
  handoff that was accepted by someone else, should disappear from Notification Center.
  Removal by identifier exists natively; the plugins' `cancel` on desktop is undocumented.
- **Quorum fan-out.** For 2-of-N `irreversible` calls, notifying all N at time-sensitive is
  noisy; notifying two is fragile. No prior art settles this.
- **Lock-screen leakage.** Tool call arguments (paths, commands, secrets) in a toast body
  are visible on a locked screen (NIST AUT-1). Bodies must be redacted by default.

## Concrete recommendations for Henosis

1. **Add `urgency` and `audience` to the server inbox.** In `packages/server/src/notify.ts`
   give `Notification` a field `urgency: "passive" | "active" | "time-sensitive"` and compute
   it from the event: `approval.requested` where the user is an eligible voter and the call is
   `irreversible` or the session is blocked → time-sensitive; `exec`/`external` approvals and
   `handoff.requested` to the user → active; turn summaries, claims and fleet contention
   notices → passive. Non-eligible participants are not written to the inbox at all.
2. **Replace `set_pending` with `set_attention`.** In `apps/desktop/src-tauri/src/main.rs`
   take `{ approvals, handoffs }` counts of items awaiting *this* user, set the tray text to
   "Awaiting you · N" (status-word register from `docs/12_brand.md`), and call
   `window.set_badge_count(Some(n))` on macOS/Linux and `set_overlay_icon` with a small
   apricot dot on Windows; clear both when `n == 0`. Swap the tray icon to a template image
   with a dot variant when `n > 0`.
3. **Deep-link to the notice, not the session.** Extend the scheme to
   `henosis://p/<project>/s/<session>/a/<approvalId>` and `/h/<handoffId>` in `main.rs` and the
   hash router in `apps/web/src/App.tsx`, so a click scrolls to the quiet notice and focuses
   its first button. Every toast gets `tag`/identifier = the approval or handoff id so
   re-notifications replace rather than stack.
4. **Approve from the notification only for hash-bound, non-quorum classes.** In
   `apps/web/src/notify.ts` add a Tauri branch (`"__TAURI__" in window`) that sends via the
   notification plugin with actions `Review` (foreground) and, for `exec`/`external` only,
   `Approve` (background) that posts `approval.vote` with the `approvalId` from the toast
   payload. `irreversible` approvals and handoff acceptance stay in-app: a quorum vote and an
   authority transfer deserve the brief on screen. Gate the feature behind a capability flag
   per OS until Windows actions are verified.
5. **Quiet hours and escalation budget in the kernel.** Store per-user quiet hours and
   "overrides remaining today" in `packages/server/src/notify.ts`; during quiet hours deliver
   passive and active items to the inbox only, time-sensitive still toasts. A driver escalation
   (`notification.escalated` event) spends one override per recipient per day, mirroring
   Slack's once-a-day rule, and shows in the session as a quiet notice so it is accountable.
6. **Redact bodies and withdraw stale toasts.** Toast body = `"<call.name> [<risk>] in
   <session title>"` (as `SessionView.tsx` does now) plus the requesting human's name; never
   arguments. On `approval.resolved`, `approval.expired` and `handoff.resolved`, call the
   plugin's remove-by-identifier; where unsupported, the inbox marks the item read so the
   badge drops immediately. Coalesce bursts per session to one toast per 30 s, the same way
   `packages/slack` coalesces at 1.5 s.
7. **Tray menu stays three items plus a short list.** Keep Open / Awaiting you / Quit; under
   "Awaiting you" list at most five items as "approve rm -rf · billing-42" / "Ana offers you
   pdf-layout", each a deep link. No status dashboards in the tray.

## Sources

- https://developer.apple.com/documentation/usernotifications/unnotificationinterruptionlevel/timesensitive (accessed 2026-10-02)
- https://developer.apple.com/videos/play/wwdc2021/10091 (accessed 2026-10-02, snippets)
- https://learn.microsoft.com/en-us/windows/apps/design/shell/tiles-and-notifications/toast-ux-guidance (accessed 2026-10-02, UNVERIFIED)
- https://windowscentral.com/software-apps/windows-11/whats-new-with-notifications-on-windows-11-2022-update (accessed 2026-10-02)
- https://tauri.app/release/tauri/v2.2.0/ (accessed 2026-10-02)
- https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/notification (accessed 2026-10-02)
- https://github.com/Choochmeque/tauri-plugin-notifications (accessed 2026-10-02)
- https://slack.com/help/articles/214908388-Pause-notifications-with-Do-Not-Disturb (accessed 2026-10-02, UNVERIFIED)
- https://docs.github.com/en/desktop/working-with-your-remote-repository-on-github-or-github-enterprise/configuring-notifications-in-github-desktop (accessed 2026-10-02, UNVERIFIED)
- https://community.pagerduty.com/ask-a-product-question-2/acknowledge-button-on-ios-seems-to-only-snooze-733 (accessed 2026-10-02)
- https://pages.nist.gov/mobile-threat-catalogue/authentication-threats/AUT-1.html (accessed 2026-10-02)
