import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { connectLinks } from "./links.js";
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

// Deep links: ?link=fold://… on load, then "fold:link" DOM events (the desktop shell dispatches them).
connectLinks();
// Desktop shell (Tauri): learn where the server is, then tray clicks and fold:// deep links
// arrive as window events. Resolves at once in a browser.
connectShell().then(() => {
  const el = document.getElementById("root");
  // Last resort: when the shell itself cannot render, a bare recovery row instead of a white page.
  if (el)
    createRoot(el).render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>,
    );
});
