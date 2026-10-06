import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Henosis mobile shell. The native app loads the built web client from ../web/dist; the client
 * talks to the Henosis server over /ws and /api, so set HENOSIS_SERVER (below) or serve the dist
 * from the same origin as the server.
 */
const config: CapacitorConfig = {
  appId: "team.henosis.app",
  appName: "Henosis",
  webDir: "../web/dist",
  // Development: point the shell at the Vite dev server so edits reload on the device.
  // server: { url: "http://192.168.1.10:5173", cleartext: true },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  ios: { contentInset: "automatic" },
  android: { allowMixedContent: false },
};

export default config;
