# Keyboard-first UX for Fold

Research memo, 2026-10-02. Topic: command palettes, shortcut discoverability, browser-vs-desktop conflicts, and a shortcut map for Fold's five core acts (steer, approve, hand off, fork, switch session).

## Why it matters for Fold

Fold's primary surfaces are desktop (Tauri wrapping the web client) and web; the people in a session are engineers who already live in VS Code, Linear and a terminal. Two things make keyboard design harder here than in Linear:

1. **The composer is almost always focused.** In the claude.ai register the cursor sits in the one rounded composer, so Linear-style single-letter shortcuts (`C`, `A`, `J`/`K`) collide with typing. Every binding needs an explicit *when* context.
2. **Some keys are consequential.** Approving a tool call is bound to the hash of the exact call (`docs/05_kernel_design.md` §3), and irreversible calls need a quorum. A shortcut that approves whatever notice happens to be newest, while someone is mid-sentence, is a correctness bug, not a convenience.

Today the web client has one key handler: Enter sends, Shift+Enter inserts a newline (`apps/web/src/views/SessionView.tsx`, Composer `onKeyDown`, ~line 735). The CLI already has a slash vocabulary (`/constrain`, `/approve <id>`, `/handoff bo`, `/accept <id>`, `/brief`) that the web client does not mirror. There is no palette, no shortcut sheet, no hint on hover, and the desktop shell (`apps/desktop/src-tauri/src/main.rs`) registers no menu accelerators.

## Prior art

1. **Superhuman, "How to build a remarkable command palette"** and the help article "Shortcuts and Cmd+K" (https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/, https://help.superhuman.com/article/478-superhuman-command; both blocked by egress proxy, UNVERIFIED, from search snippets, accessed 2026-10-02). Cmd+K is the place you "do any action, and also learn the shortcut for next time": the key appears on the right of each row, hovering any icon teaches its key, and after a mouse action a nudge says to press the key next time. The palette accepts natural language ("remind me tomorrow").
2. **Linear, "Navigating Linear"** (https://linear.app/enablement/guides/navigating-linear; blocked, UNVERIFIED, accessed 2026-10-02). Cmd+K finds every action even if you never learn a key; most actions are single letters; hover shows the key; the stated goal is every common action in two keystrokes or fewer. Linear is also the source of Fold's single-accent rule (`docs/12_brand.md`).
3. **VS Code keybindings and when-clause contexts** (https://code.visualstudio.com/api/references/when-clause-contexts; blocked, UNVERIFIED, accessed 2026-10-02; content matches snippets). Bindings are rules `{key, command, when}`; on a keypress rules are evaluated bottom-to-top and the first that matches key *and* `when` wins. Contexts such as `editorTextFocus`, `inputFocus` and `listFocus` are what let `A` mean "approve" in a list and "a" in a text box. Chords (`Ctrl+K Ctrl+S`) extend the namespace without more modifiers.
4. **Raycast manual, Keyboard Shortcuts and Hyper Key** (https://manual.raycast.com/keyboard-shortcuts.md, https://manual.raycast.com/hyper-key; blocked, UNVERIFIED, accessed 2026-10-02). Global hotkeys work with the app unfocused; the Hyper Key (Caps Lock → ⌃⌥⌘⇧) exists precisely because the shared modifier space is exhausted and app-level shortcuts collide with the OS.
5. **GitLab issue 386209, "Handle conflicts with browser shortcuts"** (https://gitlab.com/gitlab-org/gitlab/-/issues/386209; HTTP 429, UNVERIFIED, accessed 2026-10-02) and the W3C webapps thread on reserved shortcuts (https://lists.w3.org/Archives/Public/public-webapps-github/2016Jan/0255.html; blocked, UNVERIFIED). Chrome and Safari on Mac do not dispatch Cmd+N, Cmd+W, Cmd+Q, Cmd+T, Ctrl+Tab and Ctrl+Shift+Tab to pages; Firefox proposed reserving the tab/window set. Rationale: a page that `preventDefault()`s everything traps keyboard-only users.
6. **code-server issue 2586** (https://github.com/coder/code-server/issues/2586; fetched, accessed 2026-10-02). VS Code in a browser "disables keyboard shortcuts which may conflict with browser shortcuts"; the proposed fix is to detect standalone PWA mode and re-enable them there. Same split Fold faces between web and the Tauri shell.
7. **Tauri 2 global-shortcut plugin** (https://v2.tauri.app/plugin/global-shortcut/; snippet, UNVERIFIED, accessed 2026-10-02). Two distinct mechanisms: native menu accelerators (shown in the macOS menu bar, app-focused) and global shortcuts (system-wide, `CommandOrControl+Shift+C` syntax).

## What to borrow

- **One palette that is also the teacher.** Every action in Fold is reachable from Cmd+K; each row shows its key on the right; menu items and buttons show the same key on hover. No separate "learn shortcuts" tour.
- **When-contexts and bottom-up resolution** from VS Code. A dozen context flags (`composerFocus`, `listMode`, `paletteOpen`, `pendingApproval`, `offeredHandoff`, `isDriver`, `isDesktop`) decide what a key does. This is also how observers get a quiet "you are observing" instead of a dead key.
- **Single letters only in list mode.** Escape leaves the composer and enters the stream as a list (Linear/Superhuman `J`/`K`); letters act there. Modifier chords work everywhere.
- **The web/desktop split as a context, not two keymaps.** Like code-server's PWA check: the Tauri shell sets `isDesktop`, which enables the bindings browsers reserve (Cmd+1..9, Cmd+W for "close session tab") and registers the same keys as native menu accelerators so macOS lists them.
- **Natural-language rows.** Fold's directive vocabulary is already text ("constrain: no external dependencies"); the palette can parse `constrain …`, `pause`, `hand off to Bo`, `fork` as commands, mirroring the CLI.

## What is unsolved

- **Approvals under focus.** No prior art covers a key that must bind to a specific hash while another human may be typing. Auto-focusing the newest notice is wrong; a two-step (jump, then confirm) is slower than Linear's ideal. Quorum on irreversible calls adds a third human, outside any one keyboard.
- **Browser reservation is unqueryable.** There is no API to ask which combos a browser will deliver; the set differs by browser and OS (GitLab, Orion thread). Keyboard Lock (`navigator.keyboard.lock()`) is Chromium-only and fullscreen-only, so not an answer.
- **Option/Alt on macOS** inserts dead keys and symbols in text fields, which kills Alt-letter chords in the composer; IME composition (`isComposing`) must suppress Enter-to-send.
- **Layout independence.** Linear-style letters assume US layout; VS Code solves this with layout detection at considerable cost.
- **Shared sessions.** Shortcuts are per role (observer, contributor, driver, owner) and per seat; a key that works for Ana and silently does nothing for Bo needs an explanation Fold has not designed.

## Concrete recommendations for Fold

1. **Add `apps/web/src/keys.ts`: a keymap with when-contexts.** One `document` keydown listener; rules `{key, when, run}` evaluated last-added-first; contexts derived from React state via a small store. Ignore events with `isComposing`. Export `isDesktop()` from `apps/web/src/shell.ts` (Tauri sets `window.__TAURI__`, `withGlobalTauri: true` in `tauri.conf.json`).
2. **Shortcut map (phase 0).** Modifier chords are usable with composer focus; letters only in list mode. "Web risk" marks keys a browser may swallow.

   | Act | Key | When | Web risk |
   |---|---|---|---|
   | Steer | `Enter` send, `Shift+Enter` newline, `Cmd+Enter` send as interrupt | composerFocus | none |
   | Mode/scope | type `/` in an empty composer → menu (`/constrain`, `/pause`, `/resume`, `/cancel`, `/scope tests`) | composerFocus | none |
   | Palette | `Cmd+K` (actions, then sessions, people, branches) | always | Firefox/Chrome Ctrl+K is interceptable; fine |
   | Switch session | `Cmd+O` open-session picker; `Cmd+1..9` nth recent session; list mode `G` `S` | always / isDesktop / listMode | Cmd+1..9 desktop only |
   | List mode | `Esc` from composer; `J`/`K` move; `Enter` expand tool line; `Esc` back | listMode | none |
   | Approve | `Cmd+Shift+A` jump to oldest pending approval; then `Enter` approve, `D` decline; irreversible class: `Shift+Enter` with the call hash shown | pendingApproval | none |
   | Hand off | `Cmd+Shift+H` "Hand off to…" picker; offered handoff: focus notice, `Enter` accept, `D` decline | isDriver / offeredHandoff | Firefox Cmd+Shift+H history, interceptable; verify Safari |
   | Fork | `Cmd+Shift+F` fork at head; `F` on a selected checkpoint in list mode | contributor+ | none known |
   | Fold (merge) | `Cmd+Shift+M` | branch view | none |
   | Brief | `Cmd+Shift+B` | always | Chrome bookmarks bar, interceptable |
   | Panels | `Cmd+\` sidebar, `Cmd+I` details/team | always | none |
   | Help | `Cmd+/` shortcut sheet; `?` in list mode | always | none |

   Never bind `Cmd/Ctrl+W/N/T/Q`, `Ctrl+Tab`, `Cmd+L`, or `Cmd/Ctrl+C/V/X/Z`.
3. **Palette component in `apps/web/src/ui.tsx`.** Rows: label, context line in grey, `<Kbd>` on the right using `--mono` from `design/tokens.css`; add `--kbd-bg`/`--kbd-border` tokens and a `kbd` sample to `design/index.html`. Fuzzy match on label and aliases; recent commands first; parse `constrain …`, `hand off to <name>`, `fork` as free text. Apricot only on the selected row, per the single-accent rule.
4. **Approval safety in `SessionView.tsx` `ApprovalNotice`.** `Cmd+Shift+A` moves focus, never steals it on arrival; the notice shows the short hash; the approve message carries that hash (already required by the kernel). For `irreversible` risk class, require `Shift+Enter` and show "needs N of M" from `s.approvals[id].votes`.
5. **Desktop parity in `apps/desktop/src-tauri/src/main.rs`.** Build a native `Session` menu (New, Open…, Fork, Hand off…, Brief, Approve pending) with the same accelerators, so macOS shows them and `Cmd+1..9` work without the browser. Add `tauri-plugin-global-shortcut` to `Cargo.toml` for one opt-in system-wide hotkey, "jump to pending approval", default unset.
6. **Discoverability, quietly.** Hover tooltips on every button show the key (`title` plus a styled tip); after a mouse action that has a key, show the key once in the status line ("Forked. Next time: ⌘⇧F"), stored in `recents.ts` so it fires once per action. Document the map as an appendix in `docs/03_product_spec.md`. Mobile (`apps/mobile`) hides all of this; the palette becomes the search sheet.

## Sources

- https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/ (UNVERIFIED, blocked; accessed 2026-10-02)
- https://help.superhuman.com/article/478-superhuman-command (UNVERIFIED, blocked; accessed 2026-10-02)
- https://linear.app/enablement/guides/navigating-linear (UNVERIFIED, blocked; accessed 2026-10-02)
- https://code.visualstudio.com/api/references/when-clause-contexts (UNVERIFIED, blocked; accessed 2026-10-02)
- https://manual.raycast.com/keyboard-shortcuts.md and https://manual.raycast.com/hyper-key (UNVERIFIED, blocked; accessed 2026-10-02)
- https://gitlab.com/gitlab-org/gitlab/-/issues/386209 (UNVERIFIED, HTTP 429; accessed 2026-10-02)
- https://lists.w3.org/Archives/Public/public-webapps-github/2016Jan/0255.html (UNVERIFIED, blocked; accessed 2026-10-02)
- https://github.com/coder/code-server/issues/2586 (fetched; accessed 2026-10-02)
- https://v2.tauri.app/plugin/global-shortcut/ (UNVERIFIED, snippet; accessed 2026-10-02)
- Repo: `apps/web/src/views/SessionView.tsx`, `apps/desktop/src-tauri/tauri.conf.json`, `docs/05_kernel_design.md`, `docs/12_brand.md`
