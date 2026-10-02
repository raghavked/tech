import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Fold mobile shell. The native app loads the built web client from ../web/dist; the client
 * talks to the Fold server over /ws and /api, so set FOLD_SERVER (below) or serve the dist
 * from the same origin as the server.
 */
const config: CapacitorConfig = {
  appId: "studio.fold.app",
  appName: "Fold",
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
