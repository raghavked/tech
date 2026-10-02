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
  build: { outDir: "dist" },
});
