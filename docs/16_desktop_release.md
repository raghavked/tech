# Desktop release and auto-update

*How a tagged commit becomes signed installers for macOS, Windows and Linux, and how an
installed Henosis shell learns about them. Built 2 October 2026 on the research in
`research/auto-update-release-pipeline.md`.*

## Why this matters more than a thin shell suggests

The desktop shell (`apps/desktop`) is a Tauri v2 window around the web client; the agent,
the log and arbitration live on the server. Three things still make its release path a
first-class concern:

1. **Approvals need every seat current.** An approval is bound to the hash of the exact tool
   call and irreversible calls need a quorum of distinct humans. A stale shell that cannot
   fold a new `packages/protocol` event drops out of the quorum without anyone noticing.
2. **The updater is the most direct attack on approvals.** The one piece of code that can
   replace what renders an approval prompt is an update. The signing key and the endpoint
   carry the same weight in `09_threat_model.md` as the session token.
3. **Sessions run for days.** A relaunch under a driver with an approval open is an incident
   even though server state survives. The shell therefore never restarts on its own.

## The pieces

| Piece | Where | What it does |
|---|---|---|
| Updater plugin | `apps/desktop/src-tauri/Cargo.toml`, `src/main.rs` | `tauri-plugin-updater` checks a signed manifest; `tauri-plugin-process` relaunches |
| Updater config | `apps/desktop/src-tauri/tauri.conf.json` → `plugins.updater` | the minisign **public key** (placeholder until generated), the endpoints, passive install on Windows |
| Bundle config | same file → `bundle` | `createUpdaterArtifacts: true` (a `.sig` beside every bundle), targets `app`, `dmg`, `nsis`, `appimage`, `deb`, hardened runtime on macOS |
| Capabilities | `apps/desktop/src-tauri/capabilities/default.json` | `updater:default`, `process:allow-restart` |
| Windows signing overlay | `apps/desktop/src-tauri/signing/windows.conf.json` | `bundle.windows.signCommand` for Azure Trusted Signing; merged in only by the workflow, so local builds stay unsigned and need no tool |
| Client | `apps/web/src/shell.ts`, `update.tsx` | check, silent download, one "Restart to update" row |
| Workflow | `.github/workflows/desktop-release.yml` | build, sign, notarize, draft release with `latest.json` |
| Notes | `CHANGELOG.md`, `scripts/desktop-release-notes.mjs` | release body; refuses a tag whose versions disagree |

The regular CI (`ci.yml`) does not build the shell: it needs a Rust toolchain, three
operating systems and signing secrets, none of which belong on every push.

## Cutting a release

1. Under `## Unreleased` in `CHANGELOG.md`, make sure every user-visible change is written.
2. Rename that section to `## <version> — <date>`, start a fresh `## Unreleased`, and set the
   same `<version>` in `apps/desktop/src-tauri/tauri.conf.json` and `Cargo.toml`.
3. Check locally: `node scripts/desktop-release-notes.mjs <version> --check` prints the notes
   and exits 0.
4. Commit, then tag and push: `git tag desktop-v<version> && git push origin desktop-v<version>`.
5. The workflow's `notes` job repeats the check and fails in seconds on a mismatch. The
   `build` job runs on the `release` environment, so the required reviewers configured there
   approve before any secret is read.
6. Four builds run in parallel: `macos-14` for `aarch64-apple-darwin` and
   `x86_64-apple-darwin`, `ubuntu-22.04`, `windows-latest`. Each installs the workspace with
   pnpm, the shell's own `@tauri-apps/cli` with npm (the shell is outside the pnpm workspace
   so `pnpm install` never needs Rust), generates the icons from `icons/icon.svg`, and runs
   `tauri build` through `tauri-apps/tauri-action`, which runs the web client's build first
   via `beforeBuildCommand`.
7. `tauri-action` creates one **draft** GitHub release named `Henosis desktop <version>` with
   the changelog section as its body and attaches every bundle, every `.sig`, and
   `latest.json` (NSIS preferred over MSI on Windows). A version with a hyphen is marked as a
   pre-release.
8. **Promote** by publishing the draft on GitHub. Until then
   `releases/latest/download/latest.json` still points at the previous release and no
   installed shell sees anything. Publishing is the one manual step, on purpose: it is the
   moment to install one bundle by hand and open a session.

## What an installed shell does

`apps/web/src/shell.ts` runs only when `window.__TAURI__.updater` exists, so browsers and the
mobile shell never execute it.

- Fifteen seconds after launch and every six hours, `check()` fetches the first endpoint
  that answers. The plugin compares `version` to the running one and verifies the minisign
  signature of the bundle against `plugins.updater.pubkey`; an unsigned or wrongly signed
  payload is refused by the plugin, not by our code.
- A newer build is downloaded in the background. Nothing is installed.
- The sidebar shows one quiet row above the account button: **Restart to update** with the
  version in grey (`UpdateRow` in `apps/web/src/update.tsx`, styled as a sidebar item, no
  accent). Clicking it installs and relaunches. That click is the only path to a relaunch, so
  a driver with an approval open is never interrupted; the "update while driving" policy in
  the research memo (check seat and pending approvals before offering) is the next step.
- Windows installs passively (`installMode: "passive"`: a progress bar, no prompts); macOS
  replaces the `.app` bundle; Linux updates AppImage in place and runs the package manager
  for `.deb`.
- If the public key is still the placeholder, `check()` fails and the catch swallows it: the
  shell behaves exactly like a build without an updater.

## Endpoints

`plugins.updater.endpoints` is tried in order:

1. `https://github.com/raghavked/tech/releases/latest/download/latest.json`: the static
   manifest `tauri-action` attaches to the published (non-draft, non-pre-release) release.
   This is what Phase 0 uses.
2. `https://releases.henosis.team/desktop/{{target}}/{{arch}}/{{current_version}}`: reserved
   for the dynamic endpoint in the research memo, which answers 204 below a rollout
   percentage keyed on a per-install id and lets the server say `min_client_version`. It
   does not exist yet; the plugin moves on when a host does not resolve.

Changing the repository's owner or name means changing endpoint 1 and shipping a release
signed by the current key before the old URL stops answering, otherwise installed shells
can never find the new address.

## Keys and secrets

All secrets live on the GitHub **`release` environment** with required reviewers, never as
repository secrets, so a tag push alone cannot read them.

| Secret | Used by | Notes |
|---|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | updater artifacts, every OS | minisign private key, contents of the `.key` file; the build refuses to run without it |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | same | the password given at generation (may be empty) |
| `APPLE_CERTIFICATE` | macOS codesign | Developer ID Application `.p12`, base64 |
| `APPLE_CERTIFICATE_PASSWORD` | macOS codesign | the `.p12` password |
| `APPLE_SIGNING_IDENTITY` | macOS codesign | e.g. `Developer ID Application: Henosis Studio (TEAMID)` |
| `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_CONTENT` | notarytool | App Store Connect API key id, issuer id, and the `.p8` as base64; the workflow writes it to disk and sets `APPLE_API_KEY_PATH` |
| `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET` | Windows Trusted Signing | a service principal with the Code Signing Certificate Profile Signer role |

The Apple and Azure steps are skipped when their secrets are absent, so the pipeline can be
exercised end to end with only the updater key: it then produces unsigned, un-notarized
bundles, which Sequoia will not open without a bypass and SmartScreen will warn about.
Treat those as test artifacts, never publish such a draft.

### Generating the updater key

```bash
cd apps/desktop
npx tauri signer generate -w ~/.tauri/fold-desktop.key     # asks for a password
```

Put the printed public key into `plugins.updater.pubkey` in `tauri.conf.json` (replacing
`REPLACE_WITH_HENOSIS_DESKTOP_MINISIGN_PUBLIC_KEY`), commit it, and put the private key file's
contents and the password into the two `TAURI_SIGNING_*` secrets. Generate the key on a
machine that is not the CI runner and keep an offline copy: Tauri trusts exactly one public
key per build, so a lost private key means every installed shell is stranded on its version
until it is reinstalled by hand.

### Rotation

Ship the new public key in a release signed by the *current* key, wait until the fleet has
updated (the release's download counts are the signal), then retire the old key. Never
rotate the key and the endpoint in the same release.

### Compromise

A leaked `TAURI_SIGNING_PRIVATE_KEY` lets an attacker ship code that every installed shell
accepts. Response: remove the secret from the `release` environment, cut a release from the
offline backup key containing a new public key, publish it, and announce it in the fleet
brief and the management Slack channel so every driver restarts. Threshold or TUF-style
signing does not exist for Tauri; the mitigation is an air-gapped key and a short reviewer
list on the environment.

### Windows signing

`src-tauri/signing/windows.conf.json` names the Trusted Signing endpoint, account and
certificate profile (`fold-desktop`, both placeholders until the Azure resources exist).
The workflow installs `trusted-signing-cli` and passes the file with `--config` only when
`AZURE_CLIENT_ID` is set; a local `npx tauri build` never sees it.

## Changelog convention

`CHANGELOG.md` is the single source of release notes, one version for the whole product.
`## Unreleased` on top, `## <version> — <date>` below, entries under `Added`, `Changed`,
`Fixed`, `Security`, with `[desktop]`, `[web]`, `[cli]`, `[slack]`, `[server]` when a change
is not everywhere. `scripts/desktop-release-notes.mjs <version>` extracts a section;
`--check` also compares the shell's two version fields to it.

## Rollback

The updater only moves forward by semver. To pull a release: unpublish or delete it on GitHub
so `latest.json` points at the previous one again (shells that already updated keep the bad
build), then cut a patch release whose payload is the known-good code. A true downgrade needs
the plugin's `version_comparator`, which is undocumented territory and not wired.

## Not done yet, on purpose

- **Staged rollout and `min_client_version`.** Need the dynamic endpoint (research memo,
  recommendations 3 and 4); the second endpoint entry reserves the address.
- **Offer only when idle.** The row appears whenever a download finished; it should also
  check that the current actor holds no driver seat and has no open approval before
  appearing (recommendation 5). The hook is `UpdateRow`, which already has the only
  relaunch path.
- **Linux `.rpm`, Flatpak, Snap.** Outside the Tauri updater; AppImage and `.deb` only.
- **Mobile.** The Capacitor shell updates through the stores, not this pipeline.
