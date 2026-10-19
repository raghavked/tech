/**
 * Identity (auth.ts): the sign-in step of the first run in oidc mode, and the callback view
 * the provider sends the person back to. Home.tsx shows `SsoSignIn` in place of the dev form
 * when GET /api/auth says the server runs single sign-on.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { Shell, type ShellContext } from "../App.js";
import type { Me } from "../api.js";
import {
  type AuthInfo,
  beginSignIn,
  completeSignIn,
  forgetSession,
  getAuthInfo,
  loadAuthInfo,
  onAuthInfo,
  signInEnded,
} from "../auth.js";
import { copy } from "../copy.js";
import { clearIdentity, type Identity } from "../identity.js";
import { navigate } from "../router.js";
import { Loader } from "../ui.js";

/** How the server wants people to sign in; null until it has answered (dev when it cannot). */
export function useAuthInfo(): AuthInfo | null {
  const info = useSyncExternalStore(onAuthInfo, getAuthInfo, () => null);
  useEffect(() => {
    void loadAuthInfo();
  }, []);
  return info;
}

/** While the server has not said how to sign in and nobody is signed in yet: a quiet shimmer, not a form that may be wrong. */
export function SignInPending() {
  return <Loader kind="shimmer" label={copy.loading} rows={2} />;
}

/** The identity step under single sign-on: one button, or the signed-in line with a way out. */
export function SsoSignIn({
  identity,
  me,
  auth,
}: {
  identity: Identity | null;
  me: Me | null;
  auth: AuthInfo;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const provider = auth.provider ?? "your provider";
  if (identity)
    return (
      <p className="row muted">
        <span className="grow">
          {copy.home.signedInAs(identity.name)} <span className="mono">{identity.userId}</span>
          {me && me.projects.length === 0 && copy.home.ssoObserver}
        </span>
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => {
            forgetSession();
            clearIdentity();
          }}
        >
          {copy.home.signOut}
        </button>
      </p>
    );
  const unreachable = auth.error ?? null;
  return (
    <div className="form">
      <p className="small muted">
        {signInEnded() ? copy.home.signedOut : copy.home.ssoLine(provider)}
      </p>
      {unreachable && <p className="small danger">{copy.home.signInFailed(unreachable)}</p>}
      {error && <p className="small danger">{copy.home.signInFailed(error)}</p>}
      <div className="row">
        <button
          type="button"
          className="btn primary"
          disabled={busy || Boolean(unreachable)}
          onClick={() => {
            setBusy(true);
            setError(null);
            beginSignIn(auth).catch((e: unknown) => {
              setBusy(false);
              setError(e instanceof Error ? e.message : String(e));
            });
          }}
        >
          {copy.home.continueWith(provider)}
        </button>
      </div>
    </div>
  );
}

/** `#/auth/callback?code=&state=`: exchange the code, then go back to where the person was. */
export function AuthCallback({ query, ctx }: { query: string; ctx: ShellContext }) {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadAuthInfo()
      .then((auth) => {
        if (auth.mode !== "oidc") throw new Error("the server does not run single sign-on");
        return completeSignIn(auth, query);
      })
      .then((returnTo) => {
        if (alive) navigate(returnTo);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [query]);
  return (
    <Shell ctx={ctx} title={copy.product}>
      <div className="column page">
        {error ? (
          <div className="hero hero-card">
            <p className="danger">{copy.home.signInFailed(error)}</p>
            <a className="btn" href="#/">
              {copy.home.tryAgain}
            </a>
          </div>
        ) : (
          <Loader kind="shimmer" label={copy.home.signingIn} title rows={2} />
        )}
      </div>
    </Shell>
  );
}
