import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const proxy = { "/ws": { target: process.env.QUORUM_WS ?? "ws://127.0.0.1:7700", ws: true } };

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: {
    port: 4173,
    proxy: { "/ws": { target: process.env.QUORUM_WS ?? "ws://127.0.0.1:7730", ws: true } },
  },
  build: { outDir: "dist" },
});
