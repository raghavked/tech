#!/usr/bin/env node
// Release notes for a desktop tag, from CHANGELOG.md. Used by .github/workflows/desktop-release.yml
// and handy locally:
//
//   node scripts/desktop-release-notes.mjs 0.2.0            # print the 0.2.0 section
//   node scripts/desktop-release-notes.mjs 0.2.0 --check    # also verify the shell's versions match
//
// Exits 1 when the changelog has no section for the version, or, with --check, when
// apps/desktop/src-tauri/tauri.conf.json or Cargo.toml carry a different version. The workflow
// runs the check before any build so a mistyped tag fails in seconds, not after three OS builds.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The body of `## <version>` in the changelog, without the heading, or null when absent. */
export function changelogSection(changelog, version) {
  const lines = changelog.split("\n");
  const heading = new RegExp(`^## \\[?${version.replace(/[.+-]/g, "\\$&")}\\]?(\\s|$)`);
  const start = lines.findIndex((l) => heading.test(l));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines
    .slice(start + 1, end)
    .join("\n")
    .trim();
}

/** The versions the shell declares, so a tag cannot ship a bundle that reports another number. */
export function shellVersions() {
  const conf = JSON.parse(
    readFileSync(join(root, "apps/desktop/src-tauri/tauri.conf.json"), "utf8"),
  );
  const cargo = readFileSync(join(root, "apps/desktop/src-tauri/Cargo.toml"), "utf8");
  const m = cargo.match(/^version\s*=\s*"([^"]+)"/m);
  return { tauri: conf.version, cargo: m ? m[1] : null };
}

function main(argv) {
  const [version, ...flags] = argv;
  if (!version) {
    console.error("usage: desktop-release-notes.mjs <version> [--check]");
    return 2;
  }
  const notes = changelogSection(readFileSync(join(root, "CHANGELOG.md"), "utf8"), version);
  if (notes === null) {
    console.error(`CHANGELOG.md has no "## ${version}" section; add one before tagging.`);
    return 1;
  }
  if (flags.includes("--check")) {
    const v = shellVersions();
    const bad = Object.entries(v).filter(([, x]) => x !== version);
    if (bad.length) {
      for (const [file, x] of bad) console.error(`${file} says ${x}, tag says ${version}`);
      return 1;
    }
  }
  process.stdout.write(`${notes}\n`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
