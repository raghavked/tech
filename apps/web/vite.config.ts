import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** The dev server and the preview server both forward the websocket and the JSON API to the Fold server. */
const proxyFor = (ws: string) => {
  const http = ws.replace(/^ws/, "http");
  return {
    "/ws": { target: ws, ws: true },
    "/api": { target: http, changeOrigin: true },
    "/health": { target: http, changeOrigin: true },
  };
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: proxyFor(process.env.FOLD_WS ?? "ws://127.0.0.1:7700") },
  preview: {
    port: 4173,
    proxy: proxyFor(process.env.FOLD_WS ?? "ws://127.0.0.1:7730"),
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        // Perf: vendor code in chunks of its own, so an app change does not invalidate React or
        // zod in the browser cache, and so the entry carries only what the first paint needs.
        // The views are split by the dynamic imports in src/views/lazy.ts.
        manualChunks: vendorChunk,
      },
    },
  },
});

function vendorChunk(id: string): string | undefined {
  if (!id.includes("/node_modules/")) return undefined;
  if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
  if (id.includes("/node_modules/zod/")) return "zod";
  return "vendor";
}
