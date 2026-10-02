import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { connectShell } from "./shell.js";

// PWA shell: the service worker caches the shell and passes /ws and /api through.
try {
  if ("serviceWorker" in navigator) {
    addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    });
  }
} catch {
  // ignore
}

// Desktop shell (Tauri): tray clicks and fold:// deep links arrive as window events.
connectShell();

const el = document.getElementById("root");
if (el) createRoot(el).render(<App />);
