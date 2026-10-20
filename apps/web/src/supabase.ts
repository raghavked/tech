/**
 * Sign-in through Supabase Auth (docs/20_hosting.md). `GET /api/auth` says `supabase` and
 * gives the project URL and its public key; the sign-in card (views/SupabaseSignIn.tsx)
 * sends a one-time code to the person's email, they type it in, and the access token the
 * project answers with becomes the identity (provider `supabase`), sent on every socket and
 * fetch as the ID token is in oidc mode. supabase-js keeps the session in localStorage,
 * refreshes the token on its own and tells us through `onAuthStateChange`; Sign out ends it.
 *
 * The library is imported lazily, so the bundle a dev-mode server serves does not carry it.
 * The magic link in the same email works too: it comes back to this page (`/app/`) with the
 * session in the URL fragment, which supabase-js reads before the router sees it.
 *
 * `identityOfSupabaseToken` is pure (vitest covers it); the rest touches the window.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { type AuthInfo, decodeJwt } from "./auth.js";
import { clearIdentity, getIdentity, type Identity, saveIdentity } from "./identity.js";

/**
 * The identity a Supabase access token names: the user id is `sub`, the name comes from
 * `user_metadata.full_name`, then `.name`, then the email; `expiresAt` from `exp`. Null when
 * the token is unreadable or names nobody.
 */
export function identityOfSupabaseToken(token: string): Identity | null {
  const c = decodeJwt(token);
  if (!c) return null;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const userId = str(c.sub);
  if (!userId) return null;
  const meta =
    c.user_metadata && typeof c.user_metadata === "object"
      ? (c.user_metadata as Record<string, unknown>)
      : {};
  const email = str(c.email);
  const name = str(meta.full_name) ?? str(meta.name) ?? str(meta.user_name) ?? email ?? userId;
  const exp = typeof c.exp === "number" ? c.exp * 1000 : undefined;
  return { name, userId, token, provider: "supabase", ...(exp ? { expiresAt: exp } : {}) };
}

/** Where a magic link brings the person back: this app, at its base (`/app/` when hosted). */
export function appUrl(): string {
  return `${location.origin}${import.meta.env.BASE_URL}`;
}

let client: Promise<SupabaseClient> | null = null;
let ready = false;
let readyError: string | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

/** Called once the library has looked for an existing session (or failed to load). */
export function onSupabaseReady(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** True once a restored session, or the lack of one, is known; the card waits for it. */
export function supabaseReady(): boolean {
  return ready;
}

/** Why the library could not start (offline, a blocked CDN); shown on the card. */
export function supabaseError(): string | null {
  return readyError;
}

/**
 * The one client of this page, created on first use from what the server said. Every change
 * of session lands in the identity store: a sign-in or a refreshed token saves the identity,
 * a sign-out clears it.
 */
export function supabaseClient(info: AuthInfo): Promise<SupabaseClient> {
  if (client) return client;
  if (!info.url || !info.anonKey)
    return Promise.reject(new Error("the server did not say which Supabase project to use"));
  const url = info.url;
  const anonKey = info.anonKey;
  client = import("@supabase/supabase-js")
    .then(({ createClient }) => {
      const c = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "implicit",
        },
      });
      c.auth.onAuthStateChange((event, session) => {
        if (session?.access_token) {
          const id = identityOfSupabaseToken(session.access_token);
          if (id && (id.token !== getIdentity()?.token || getIdentity()?.userId !== id.userId))
            saveIdentity(id);
        } else if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
          if (getIdentity()?.provider === "supabase") clearIdentity();
        }
        if (event === "INITIAL_SESSION" && !ready) {
          ready = true;
          notify();
        }
      });
      return c;
    })
    .catch((err: unknown) => {
      client = null;
      readyError = err instanceof Error ? err.message : String(err);
      ready = true;
      notify();
      throw err;
    });
  return client;
}

/** Email the person a six-digit code (and a magic link back to this app). */
export async function sendCode(info: AuthInfo, email: string): Promise<void> {
  const c = await supabaseClient(info);
  const { error } = await c.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: appUrl() },
  });
  if (error) throw new Error(error.message);
}

/** Turn the code into a session; the identity is saved through `onAuthStateChange`. */
export async function verifyCode(info: AuthInfo, email: string, code: string): Promise<void> {
  const c = await supabaseClient(info);
  const { data, error } = await c.auth.verifyOtp({ email, token: code.trim(), type: "email" });
  if (error) throw new Error(error.message);
  const token = data.session?.access_token;
  if (!token) throw new Error("the code was accepted but no session came back");
  const id = identityOfSupabaseToken(token);
  if (!id) throw new Error("the token names nobody");
  saveIdentity(id);
}

/** End the session here and forget the identity. */
export async function signOut(info: AuthInfo): Promise<void> {
  try {
    const c = await supabaseClient(info);
    await c.auth.signOut({ scope: "local" });
  } catch {
    // The library could not load or the project refused: the identity goes either way.
  }
  clearIdentity();
}
