/**
 * Single sign-on in the browser (docs/07_security_and_compliance.md, "Identity"). `GET
 * /api/auth` says which mode the server runs in. In oidc mode the sign-in step runs the
 * authorization code flow with PKCE against the provider: the verifier, state and nonce
 * wait in sessionStorage while the page is at the provider; the provider sends the person
 * back to this page with `?code=&state=`, which main.tsx hoists onto `#/auth/callback`;
 * that route exchanges the code for an ID token (never through the Henosis server), keeps
 * it in memory and sessionStorage through the identity store, and sends it on every socket
 * and fetch. Shortly before the token expires it is refreshed through the provider when a
 * refresh token was issued; otherwise the person signs in again.
 *
 * The pure helpers at the top take their inputs as arguments so they run under vitest with
 * no window; the flow functions below them touch `location` and storage.
 */
import { getJson } from "./api.js";
import { clearIdentity, getIdentity, type Identity, saveIdentity } from "./identity.js";

/** What GET /api/auth answers (packages/server/src/auth.ts, `AuthDescription`). */
export interface AuthInfo {
  mode: "dev" | "oidc";
  tokenRequired?: boolean;
  provider?: string;
  issuer?: string;
  clientId?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  endSessionEndpoint?: string | null;
  scopes?: string[];
  /** oidc: the provider could not be reached for its endpoints; shown in place of the button. */
  error?: string;
}

export const DEV_AUTH: AuthInfo = { mode: "dev" };

// ---- PKCE and URL helpers (pure) -------------------------------------------------------

/** Base64url without padding, as RFC 7636 wants it. */
export function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A random base64url string of `bytes` random bytes: a code verifier, a state, a nonce. */
export function randomString(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64url(buf);
}

/** The S256 code challenge of a verifier: base64url(sha256(verifier)). */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** The provider's authorization URL for one sign-in attempt. */
export function authorizeUrl(
  info: AuthInfo,
  p: { redirectUri: string; state: string; challenge: string; nonce: string },
): string {
  if (!info.authorizationEndpoint || !info.clientId)
    throw new Error("the server did not say how to sign in");
  const url = new URL(info.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", info.clientId);
  url.searchParams.set("redirect_uri", p.redirectUri);
  url.searchParams.set("scope", (info.scopes ?? ["openid", "profile", "email"]).join(" "));
  url.searchParams.set("state", p.state);
  url.searchParams.set("nonce", p.nonce);
  url.searchParams.set("code_challenge", p.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

/** The `?code=&state=` (or `?error=`) the provider sent back, or null when the query is something else. */
export function callbackParams(query: string): {
  code: string | null;
  state: string | null;
  error: string | null;
  description: string | null;
} | null {
  const q = new URLSearchParams(query.replace(/^\?/, ""));
  const code = q.get("code");
  const error = q.get("error");
  if (!code && !error) return null;
  return { code, state: q.get("state"), error, description: q.get("error_description") };
}

/** The claims of a JWT, read without verification (the server verifies; this is for display and expiry). */
export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const claims: unknown = JSON.parse(json);
    return claims && typeof claims === "object" ? (claims as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The identity an ID token names, as the identity store holds it; null when the token is unreadable. */
export function identityOfToken(
  token: string,
  userIdClaim: "sub" | "email" = "sub",
): Identity | null {
  const c = decodeJwt(token);
  if (!c) return null;
  const str = (k: string) =>
    typeof c[k] === "string" && (c[k] as string).trim() ? (c[k] as string) : null;
  const userId = str(userIdClaim) ?? str("sub");
  if (!userId) return null;
  const name = str("name") ?? str("preferred_username") ?? str("email") ?? userId;
  const exp = typeof c.exp === "number" ? c.exp * 1000 : undefined;
  return { name, userId, token, provider: "oidc", ...(exp ? { expiresAt: exp } : {}) };
}

// ---- Mode discovery ----------------------------------------------------------------------

let info: AuthInfo | null = null;
let loading: Promise<AuthInfo> | null = null;
const listeners = new Set<() => void>();

/** How the server wants people to sign in; dev when it cannot be asked (an older server, or offline). */
export function loadAuthInfo(): Promise<AuthInfo> {
  if (info) return Promise.resolve(info);
  if (!loading) {
    loading = getJson<AuthInfo>("/api/auth")
      .then((d) => (d && (d.mode === "oidc" || d.mode === "dev") ? d : DEV_AUTH))
      .catch(() => DEV_AUTH)
      .then((d) => {
        info = d;
        for (const fn of listeners) fn();
        return d;
      });
  }
  return loading;
}

/** The cached answer, or null until `loadAuthInfo` has resolved (components subscribe through `useAuthInfo`). */
export function getAuthInfo(): AuthInfo | null {
  return info;
}

export function onAuthInfo(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---- The flow ------------------------------------------------------------------------------

const PENDING_KEY = "henosis.oidc.pending";
const REFRESH_KEY = "henosis.oidc.refresh";
const RETURN_KEY = "henosis.oidc.return";
/** How long before expiry a refresh is tried, or the person is signed out. */
const REFRESH_LEAD_MS = 60_000;

interface Pending {
  verifier: string;
  state: string;
  nonce: string;
  redirectUri: string;
}

function session(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

/** Where the provider sends the person back: this page, without hash or query (RFC 6749 forbids a fragment). */
export function redirectUri(): string {
  return `${location.origin}${location.pathname}`;
}

/** Send the person to the provider; the page leaves. `returnTo` is the hash route to come back to. */
export async function beginSignIn(auth: AuthInfo, returnTo?: string): Promise<void> {
  const pending: Pending = {
    verifier: randomString(32),
    state: randomString(16),
    nonce: randomString(16),
    redirectUri: redirectUri(),
  };
  const s = session();
  s?.setItem(PENDING_KEY, JSON.stringify(pending));
  s?.setItem(RETURN_KEY, returnTo ?? location.hash ?? "#/");
  const url = authorizeUrl(auth, {
    redirectUri: pending.redirectUri,
    state: pending.state,
    challenge: await pkceChallenge(pending.verifier),
    nonce: pending.nonce,
  });
  location.assign(url);
}

/**
 * Called from main.tsx before anything renders: the provider's `?code=&state=` on this page
 * becomes `#/auth/callback?code=&state=`, so the router shows the callback view and a reload
 * of the page never replays the code. Returns true when it did so.
 */
export function hoistCallback(): boolean {
  try {
    const p = callbackParams(location.search);
    if (!p?.state) return false;
    history.replaceState(
      history.state,
      "",
      `${location.pathname}#/auth/callback${location.search}`,
    );
    return true;
  } catch {
    return false;
  }
}

interface TokenResponse {
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function tokenRequest(auth: AuthInfo, body: Record<string, string>): Promise<TokenResponse> {
  if (!auth.tokenEndpoint || !auth.clientId)
    throw new Error("the server did not say how to sign in");
  const res = await fetch(auth.tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ client_id: auth.clientId, ...body }).toString(),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.id_token)
    throw new Error(data.error_description ?? data.error ?? `${res.status} from the provider`);
  return data;
}

/**
 * Finish a sign-in from the callback route's query: check the state, exchange the code with
 * the verifier, keep the ID token (and a refresh token, when the provider gave one). Resolves
 * to the hash route to go on to.
 */
export async function completeSignIn(auth: AuthInfo, query: string): Promise<string> {
  const p = callbackParams(query);
  if (!p) throw new Error("the provider sent nothing back");
  if (p.error) throw new Error(p.description ?? p.error);
  const s = session();
  const raw = s?.getItem(PENDING_KEY);
  s?.removeItem(PENDING_KEY);
  const pending = raw ? (JSON.parse(raw) as Pending) : null;
  if (!pending || !p.code || p.state !== pending.state)
    throw new Error("this sign-in did not start here; try again");
  const data = await tokenRequest(auth, {
    grant_type: "authorization_code",
    code: p.code,
    redirect_uri: pending.redirectUri,
    code_verifier: pending.verifier,
  });
  const token = data.id_token as string;
  const claims = decodeJwt(token);
  if (claims?.nonce !== pending.nonce) throw new Error("the token is not the one asked for");
  const id = identityOfToken(token);
  if (!id) throw new Error("the token names nobody");
  if (data.refresh_token) s?.setItem(REFRESH_KEY, data.refresh_token);
  else s?.removeItem(REFRESH_KEY);
  saveIdentity(id);
  const returnTo = s?.getItem(RETURN_KEY) || "#/";
  s?.removeItem(RETURN_KEY);
  return returnTo.startsWith("#/auth") ? "#/" : returnTo;
}

/** Ask the provider for a fresh ID token with the refresh token; false when there is none or it refuses. */
export async function refreshToken(auth: AuthInfo): Promise<boolean> {
  const s = session();
  const refresh = s?.getItem(REFRESH_KEY);
  if (!refresh) return false;
  try {
    const data = await tokenRequest(auth, { grant_type: "refresh_token", refresh_token: refresh });
    const id = identityOfToken(data.id_token as string);
    if (!id) return false;
    if (data.refresh_token) s?.setItem(REFRESH_KEY, data.refresh_token);
    saveIdentity(id);
    return true;
  } catch {
    return false;
  }
}

/** Forget the provider's session on this page; the identity store is cleared by the caller. */
export function forgetSession(): void {
  const s = session();
  s?.removeItem(REFRESH_KEY);
  s?.removeItem(PENDING_KEY);
}

/** True when a sign-in ended on its own (the token expired) and a route waits to be resumed. */
export function signInEnded(): boolean {
  return Boolean(session()?.getItem(RETURN_KEY));
}

let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Keep the token fresh: whenever the identity changes, arm a timer for a minute before it
 * expires; then refresh through the provider, or sign the person out (Home shows the
 * sign-in again, and goes back to where they were). Call once at startup.
 */
export function watchExpiry(onChange: (fn: () => void) => () => void): void {
  const arm = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const id = getIdentity();
    if (id?.provider !== "oidc" || !id.expiresAt) return;
    const wait = Math.max(0, id.expiresAt - REFRESH_LEAD_MS - Date.now());
    timer = setTimeout(async () => {
      timer = null;
      const auth = await loadAuthInfo();
      if (auth.mode === "oidc" && (await refreshToken(auth))) return;
      const s = session();
      s?.setItem(RETURN_KEY, location.hash || "#/");
      forgetSession();
      clearIdentity();
    }, wait);
  };
  onChange(arm);
  arm();
}
