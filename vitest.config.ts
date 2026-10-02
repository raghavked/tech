import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(`./packages/${p}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@fold/protocol": src("protocol"),
      "@fold/kernel": src("kernel"),
      "@fold/runner": src("runner"),
      "@fold/fleet": src("fleet"),
      "@fold/memory": src("memory"),
      "@fold/slack": src("slack"),
      "@fold/server": src("server"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/web/test/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
