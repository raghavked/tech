import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(`./packages/${p}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@atelier/protocol": src("protocol"),
      "@atelier/kernel": src("kernel"),
      "@atelier/runner": src("runner"),
      "@atelier/fleet": src("fleet"),
      "@atelier/memory": src("memory"),
      "@atelier/server": src("server"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
