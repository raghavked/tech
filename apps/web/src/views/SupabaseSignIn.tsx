/**
 * The identity step when the server signs people in through Supabase Auth (supabase.ts):
 * an email, then the six-digit code the email carries. Home.tsx shows it in place of the dev
 * form when GET /api/auth says `supabase`; the dev form and the OIDC button are untouched.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Me } from "../api.js";
import type { AuthInfo } from "../auth.js";
import { copy } from "../copy.js";
import type { Identity } from "../identity.js";
import {
  onSupabaseReady,
  sendCode,
  signOut,
  supabaseClient,
  supabaseError,
  supabaseReady,
  verifyCode,
} from "../supabase.js";
import { Loader } from "../ui.js";

/** Whether the library has looked for a session it kept from last time. */
function useSupabaseReady(info: AuthInfo): boolean {
  const ready = useSyncExternalStore(onSupabaseReady, supabaseReady, () => false);
  useEffect(() => {
    supabaseClient(info).catch(() => undefined);
  }, [info]);
  return ready;
}

export function SupabaseSignIn({
  identity,
  me,
  auth,
}: {
  identity: Identity | null;
  me: Me | null;
  auth: AuthInfo;
}) {
  const ready = useSupabaseReady(auth);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
            void signOut(auth);
          }}
        >
          {copy.home.signOut}
        </button>
      </p>
    );
  if (!ready) return <Loader kind="shimmer" label={copy.loading} rows={2} />;
  const unreachable = supabaseError();
  const run = (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    work()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const address = email.trim();
        if (!address) return;
        if (!sent) run(() => sendCode(auth, address).then(() => setSent(true)));
        else if (code.trim()) run(() => verifyCode(auth, address, code));
      }}
    >
      <p className="small muted">{sent ? copy.home.codeSent(email.trim()) : copy.home.emailLine}</p>
      {unreachable && <p className="small danger">{copy.home.signInFailed(unreachable)}</p>}
      {error && <p className="small danger">{copy.home.signInFailed(error)}</p>}
      <label className="field">
        <span>{copy.home.email}</span>
        <input
          className="input"
          type="email"
          value={email}
          autoComplete="email"
          disabled={sent}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {sent && (
        <label className="field">
          <span>{copy.home.code}</span>
          <input
            className="input mono"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={copy.home.codeHint}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\s+/g, ""))}
          />
        </label>
      )}
      <div className="row">
        <button
          type="submit"
          className="btn primary"
          disabled={busy || Boolean(unreachable) || !email.trim() || (sent && !code.trim())}
        >
          {sent ? copy.home.signIn : copy.home.sendCode}
        </button>
        {sent && (
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={() => {
              setSent(false);
              setCode("");
              setError(null);
            }}
          >
            {copy.home.otherEmail}
          </button>
        )}
      </div>
    </form>
  );
}
