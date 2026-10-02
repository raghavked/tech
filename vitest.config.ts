import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(`./packages/${p}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@quorum/protocol": src("protocol"),
      "@quorum/kernel": src("kernel"),
      "@quorum/runner": src("runner"),
      "@quorum/server": src("server"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
