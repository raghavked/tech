# Changelog

Henosis is one product with one version number: the web client, the server, the CLI and the
desktop and mobile shells all move together. This file is the source of release notes.

## Convention

- Keep a section `## Unreleased` at the top and write every user-visible change under it as
  it lands, in the voice of the product (calm, specific; "Approvals show who has voted", not
  "refactor approval state").
- Group entries under `### Added`, `### Changed`, `### Fixed` and `### Security`; leave a
  heading out when it has nothing under it. Name the surface in brackets when the change is
  not everywhere: `[desktop]`, `[web]`, `[cli]`, `[slack]`, `[server]`.
- To release, rename `## Unreleased` to `## <version> — <YYYY-MM-DD>`, bump `version` in
  `apps/desktop/src-tauri/tauri.conf.json` and `apps/desktop/src-tauri/Cargo.toml` to the same
  number, and start a fresh `## Unreleased` above it.
- A desktop release is cut by pushing the tag `desktop-v<version>`. The release workflow
  reads this file: the `## <version>` section becomes the GitHub release body, and the build
  refuses to start when the section is missing or the shell's versions disagree with the tag
  (`node scripts/desktop-release-notes.mjs <version> --check` runs the same check locally).
- Pre-releases carry a hyphen (`0.3.0-beta.1`) and are marked as such on GitHub; installed
  shells ignore them until the draft is published.

Versions follow semver: a change to the wire protocol that an older shell cannot fold is at
least a minor bump; a fix is a patch. The pipeline itself is in `docs/16_desktop_release.md`.

## Unreleased

### Added

- Henosis: the product is one team of people and agents; the two-arcs mark; the merge verb
  is "unite" and the driver token is "the baton".
- Token usage counted on every model call and summed per turn, session, project and person;
  a meter in the session top bar with a budget bar; `GET /api/usage`.
- Plan first: a session proposes its plan with token estimates before it may write; the team
  rates it one to five; approvals carry ratings and a release gate waits for the consumers of
  the code to rate a push or a deploy.
- Groups and chats with people and agents as members; @mentioning an agent reaches its
  session and its reply lands back in the group.
- The manager's view: stat tiles, tokens by project, person and agent, tokens over turns, a
  roster of people and agents, crews.
- [web] The vibrant theme with motion (loaders, the arcs closing when something joins, cards
  rising, a granted approval drawing its check) and a team look leads can set.
- [web] Tokens v6 from the design wave: one dark status triplet, a lifted hand in dark,
  selection and status ink tokens, one motion guard.
- [server] Two surfaces outside the window. `henosis digest` sends every lead the team
  sentence with the week's figures, what needs them, the tokens, the plans and the release
  gates, and who joined, as an e-mail (`.eml` files, SMTP, or printed; counted since the
  previous digest). `henosis github` keeps one comment per attached pull request and edits it
  in place as the session moves: the plan with estimate and actual, ratings as rows, the
  gate with every voice, the tokens, the replay hash. Both run offline against fakes in CI.

- [desktop] Auto-update: the shell checks a signed manifest after launch and every six
  hours, downloads a newer build quietly, and shows one "Restart to update" row in the
  sidebar; it never relaunches on its own.
- [desktop] A release workflow that builds, signs and notarizes macOS, Windows and Linux
  bundles on a `desktop-v*` tag and attaches them to a draft GitHub release.
- [desktop] The window and the tray from the design wave: 1280 × 840, the navy rail from the
  very top edge with the traffic lights set into it on macOS and a 36 px titlebar with the
  mark, "Henosis" and the caption buttons on Windows; the session's title row drags the
  window and its buttons do not. The tray lists what awaits you by name (who · verb · what ·
  age, five per section then "and N more… in the queue", Mentions only when there are any),
  Quick open with the last five sessions and rooms, Pause notifications with a moon on the
  icon, Open Henosis from anywhere (⌥⇧H / Ctrl+Shift+H) and Quit; the badge counts approvals
  and handoffs only. Closing hides to the tray, and the composer's hint says so in the
  platform's keys.
- [desktop] The first run's fourth step teaches the tray by showing the menu as it is, with
  the three tray states as tiles and "Already waits for you" naming the first click's target.
- [web] Breakpoints written once (1180 the rail folds, 960 the topbar drops words not facts,
  720 the drawer overlays behind a scrim, 480 the phone) with 40 px of hysteresis at the
  moving edges, so a resize never flaps the rail; `[` and `]` pin the choice. The collapsed
  rail's hover card never covers the live message.
- [server] Every notification carries the one grammar (`who`, `verb`, `what`), a `tag` that
  replaces an earlier notice, the client's `route` and its `age` in seconds; mentions ride in
  the same inbox for the tray and never badge.
- [server] Workspaces. With `HENOSIS_TENANCY=workspaces` (the default for the hosted function
  under Supabase sign-in) a signed-in person makes a workspace for their company, with a
  first team, General, and a first project, Main, and is its admin. Admins invite people by
  link (14 days, optionally for one email address and one use, withdrawable), change roles,
  remove people, and add teams and projects. `henosis serve` stays `shared`, the one-company
  server.
- [server] Bring your own key. An admin connects the workspace's Anthropic API key; it is
  checked with Anthropic without spending a token, sealed, and from the next turn the
  workspace's session agents and its council's member models run on it. The admin picks the
  default model from what the key can use. A workspace without a key runs the scripted demo
  model; disconnecting the key returns it there. Usage is billed by Anthropic to the key's
  owner. On `henosis serve` the org admin in `users.json` connects a key the same way.
- [server] `HENOSIS_KEYS_SECRET` seals the keys. Unset with a folder store, `henosis serve`
  keeps a random secret beside the store in `keys.secret`.
- [server] `GET /api/health` reports `tenancy` and `keys` (whether workspaces can connect a
  key here).
- [web] The first run asks a person who is in no workspace to make one. Settings, Workspace
  holds the model key (connect, check, replace, disconnect, the default model), the people
  and their roles, the invitations and the projects. An invitation link opens "Join Acme?"
  at `#/join/<token>` and joins on one press.
- [web] A workspace on the demo model says so in one line under the top row, with "Connect
  your key" for an admin. A key Anthropic refused reads "Refused by Anthropic" in Settings,
  and the turn it stopped ends with a sentence saying an admin can replace it.

### Changed

- [server] The hosted function has no provider key of its own and no longer reads
  `ANTHROPIC_API_KEY`. A workspace's work runs on the key that workspace connected.
  `henosis serve --model claude` with the operator's own key works as before.
- [server] `HENOSIS_OFFLINE=1` blocks every provider call, workspace keys included; `0`,
  `false` and `no` mean off.
- [server] `HENOSIS_AUTO_JOIN` applies only to a `shared` server. On a server of workspaces a
  new sign-up is placed nowhere and makes or joins a workspace.
- [server] On a server of workspaces `GET /api/health` lists no sessions and no projects, and
  every route but `/api/auth` and health needs a signed-in person.
- [server] Several instances over one database read the documents (orgs, users, agents,
  invitations, keys) again before a write and on the reads a person makes right after making
  or joining a workspace, so they see each other's workspaces, members and keys without a
  restart. A session log is still owned by the instance that folds it.

### Security

- [server] A workspace is invisible from outside. Every HTTP route and every websocket join
  and subscription checks membership; anyone outside is answered 404, as if the workspace did
  not exist; a session id that lives in another project is refused.
- [server] A model key is sealed with AES-256-GCM under a key derived with HKDF-SHA256 from
  `HENOSIS_KEYS_SECRET` and the workspace id, with the workspace id and provider bound in as
  associated data. No route answers the key again: the API shows its last four characters,
  who connected it and when. The server logs who connected or disconnected a key, never the
  key. Rotating the secret means every workspace connects its key again.
- [server] An invitation token is shown once and stored as a hash. Only an admin connects,
  replaces or disconnects the key, invites, changes roles or removes people; a workspace
  keeps at least one admin.

## 0.1.0 — 2026-10-02

### Added

- Session as a hash-chained, branchable log with intent arbitration, approvals with quorum,
  fork and merge, and handoff with a computed brief.
- Fleet: claims on shared ground, lead directives, cross-session contentions, crews, the
  agents rail and team chat.
- Organisation memory with attribution, conflicts and compaction.
- Surfaces: web client, CLI, Slack adapter, desktop shell with a tray, mobile shell with push.
