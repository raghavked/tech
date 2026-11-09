import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * An effect's arrow body must not hand its expression back to React: a DOM call such as
 * `scrollIntoView` returns a Promise in newer Chrome builds, and React calls whatever an effect
 * returns as its cleanup ("d is not a function" on the CI runner, taking the view down through the
 * route error boundary). Wrap the call in braces instead.
 */
const SUSPECT =
  /use(?:Layout)?Effect\(\(\) =>\s*[^{\s][^\n]*\.(scrollIntoView|animate|requestFullscreen|play|showModal)\(/;

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.tsx?$/.test(name) && !name.endsWith(".test.ts")) out.push(p);
  }
  return out;
}

describe("effects", () => {
  it("never return a DOM call's result as the cleanup", () => {
    const offenders = files(join(__dirname)).filter((f) => SUSPECT.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
