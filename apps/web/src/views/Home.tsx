import { useState } from "react";
import { Shell, type ShellContext } from "../App.js";
import type { Me } from "../api.js";
import { copy } from "../copy.js";
import { type Identity, saveIdentity, slugify } from "../identity.js";
import { Mark } from "../ui.js";
import { FirstRun } from "./FirstRun.js";

export function Home({
  me,
  meError,
  identity,
  ctx,
  onRetry,
}: {
  me: Me | null;
  meError: string | null;
  identity: Identity | null;
  ctx: ShellContext;
  /** Reload /api/me; the offline state's one action. */
  onRetry?: () => void;
}) {
  const needsIdentity = ctx.route.name !== "home" && !identity;
  return (
    <Shell ctx={ctx} title={identity ? copy.home.title : copy.product}>
      <div className="column page home">
        {!identity && (
          <div className="hero">
            <Mark size={40} />
            <h1>{copy.home.heroTitle}</h1>
            <p className="muted">{copy.home.heroLine}</p>
            {needsIdentity && <p className="small danger">{copy.home.needsIdentity}</p>}
          </div>
        )}
        {/* onboarding-empty-states: the three-step first run owns the rest of the page. */}
        <FirstRun
          identity={identity}
          me={me}
          meError={meError}
          onRetry={onRetry}
          identityStep={<IdentityForm identity={identity} me={me} />}
        />
      </div>
    </Shell>
  );
}

function IdentityForm({ identity, me }: { identity: Identity | null; me: Me | null }) {
  const [name, setName] = useState(identity?.name ?? "");
  const [userId, setUserId] = useState(identity?.userId ?? "");
  const [userTouched, setUserTouched] = useState(Boolean(identity));
  const [token, setToken] = useState(identity?.token ?? "");
  const [editing, setEditing] = useState(!identity);
  if (identity && !editing)
    return (
      <p className="row muted">
        <span className="grow">
          {copy.home.signedInAs(identity.name)} <span className="mono">{identity.userId}</span>
          {me && !me.user && copy.home.unknownToServer}
        </span>
        <button type="button" className="btn ghost sm" onClick={() => setEditing(true)}>
          {copy.home.change}
        </button>
      </p>
    );
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const id = (userId || slugify(name)).trim();
        if (!name.trim() || !id) return;
        saveIdentity({ name: name.trim(), userId: id, token: token.trim() });
        setEditing(false);
      }}
    >
      <label className="field">
        <span>{copy.home.yourName}</span>
        <input
          className="input"
          value={name}
          autoComplete="name"
          onChange={(e) => {
            setName(e.target.value);
            if (!userTouched) setUserId(slugify(e.target.value));
          }}
        />
      </label>
      <label className="field">
        <span>{copy.home.userId}</span>
        <input
          className="input mono"
          value={userId}
          placeholder={copy.home.userIdHint}
          onChange={(e) => {
            setUserTouched(true);
            setUserId(slugify(e.target.value));
          }}
        />
      </label>
      <label className="field">
        <span>{copy.home.token}</span>
        <input
          className="input"
          type="password"
          value={token}
          autoComplete="off"
          placeholder={copy.home.tokenHint}
          onChange={(e) => setToken(e.target.value)}
        />
      </label>
      <div className="row">
        <button type="submit" className="btn primary">
          {copy.home.continue}
        </button>
        {identity && (
          <button type="button" className="btn ghost" onClick={() => setEditing(false)}>
            {copy.home.cancel}
          </button>
        )}
      </div>
    </form>
  );
}
