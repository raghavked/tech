import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { hoistCallback, loadAuthInfo, watchExpiry } from "./auth.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { onIdentityChange } from "./identity.js";
import { connectLinks } from "./links.js";
import { connectShell } from "./shell.js";
import { supabaseClient } from "./supabase.js";

// PWA shell: the service worker caches the shell and passes /ws and /api through. Its URL
// and scope follow the app's base (`/` here, `/app/` on the hosted deployment).
try {
  if ("serviceWorker" in navigator) {
    addEventListener("load", () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
    });
  }
} catch {
  // ignore
}

// Identity (auth.ts): the provider's ?code=&state= on this page becomes #/auth/callback, and
// an ID token is refreshed, or the person signed out, shortly before it expires.
hoistCallback();
watchExpiry(onIdentityChange);
// Supabase Auth (supabase.ts): restore the session supabase-js kept, or read the one a magic
// link brought back in the URL, as soon as the server says that is how people sign in.
loadAuthInfo().then((info) => {
  if (info.mode === "supabase") supabaseClient(info).catch(() => undefined);
});
// Deep links: ?link=henosis://… on load, then "henosis:link" DOM events (the desktop shell dispatches them).
connectLinks();
// Desktop shell (Tauri): learn where the server is, then tray clicks and henosis:// deep links
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
