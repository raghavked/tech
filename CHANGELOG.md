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

- [desktop] Auto-update: the shell checks a signed manifest after launch and every six
  hours, downloads a newer build quietly, and shows one "Restart to update" row in the
  sidebar; it never relaunches on its own.
- [desktop] A release workflow that builds, signs and notarizes macOS, Windows and Linux
  bundles on a `desktop-v*` tag and attaches them to a draft GitHub release.

## 0.1.0 — 2026-10-02

### Added

- Session as a hash-chained, branchable log with intent arbitration, approvals with quorum,
  fork and merge, and handoff with a computed brief.
- Fleet: claims on shared ground, lead directives, cross-session contentions, crews, the
  agents rail and team chat.
- Organisation memory with attribution, conflicts and compaction.
- Surfaces: web client, CLI, Slack adapter, desktop shell with a tray, mobile shell with push.
