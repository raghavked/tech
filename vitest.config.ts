import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(`./packages/${p}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@henosis/protocol": src("protocol"),
      "@henosis/kernel": src("kernel"),
      "@henosis/runner": src("runner"),
      "@henosis/fleet": src("fleet"),
      "@henosis/memory": src("memory"),
      "@henosis/chat": src("chat"),
      "@henosis/slack": src("slack"),
      "@henosis/server": src("server"),
    },
  },
  test: {
    include: [
      "packages/*/test/**/*.test.ts",
      "apps/web/test/**/*.test.ts",
      "apps/web/src/**/*.test.ts",
    ],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
