import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(`./packages/${p}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@tiller/protocol": src("protocol"),
      "@tiller/kernel": src("kernel"),
      "@tiller/runner": src("runner"),
      "@tiller/fleet": src("fleet"),
      "@tiller/memory": src("memory"),
      "@tiller/slack": src("slack"),
      "@tiller/server": src("server"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
