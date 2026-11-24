/**
 * #/join/<token>: where an invitation link to a workspace lands. Says where it leads and who
 * sent it, and joins on one press; a link that is used up, expired, withdrawn or wrong says
 * so. A person who is not signed in yet signs in on the home page first and comes back here.
 */
import { useState } from "react";
import { Shell, type ShellContext } from "../App.js";
import { api, useFetch } from "../api.js";
import { copy } from "../copy.js";
import type { Identity } from "../identity.js";
import { navigate, paths } from "../router.js";
import { Loader, Mark } from "../ui.js";
import { reloadMe, reloadWorkspaces } from "../workspaces.js";

const c = copy.workspace;

export function Join({
  token,
  identity,
  ctx,
}: {
  token: string;
  identity: Identity;
  ctx: ShellContext;
}) {
  const found = useFetch(() => api.invite(identity.userId, token), token);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invite = found.data;
  const openWorkspace = (workspace: { teams: { projects: { id: string }[] }[] }) => {
    const first = workspace.teams.flatMap((t) => t.projects)[0];
    navigate(first ? paths.fleet(first.id) : paths.home());
  };
  const join = () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    api
      .acceptInvite(identity.userId, token, identity.name)
      .then((res) => {
        reloadWorkspaces();
        reloadMe();
        openWorkspace(res.workspace);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  };
  return (
    <Shell ctx={ctx} title={c.joinTitle}>
      <div className="column page join">
        <div className="hero hero-card ws-join">
          <Mark size={64} settle />
          {found.loading && !invite && !found.error && <Loader kind="orbit" label={c.joining} />}
          {found.error && !invite && (
            <>
              <h1>{c.joinTitle}</h1>
              <p className="muted" role="alert">
                {c.joinMissing}
              </p>
              <a className="btn" href={paths.home()}>
                {copy.home.title}
              </a>
            </>
          )}
          {invite && (
            <>
              <h1>{c.joinAsk(invite.workspace.name)}</h1>
              {invite.member ? (
                <>
                  <p className="muted">{c.joinMember(invite.workspace.name)}</p>
                  <a className="btn primary" href={paths.home()}>
                    {c.open}
                  </a>
                </>
              ) : invite.state !== "open" ? (
                <p className="muted" role="alert">
                  {c.joinGone(invite.state)}
                </p>
              ) : (
                <>
                  <p className="muted">
                    {c.joinLine(invite.invitedBy, invite.role)}
                    {invite.email ? ` ${c.joinEmail(invite.email)}` : ""}
                  </p>
                  <button type="button" className="btn primary" disabled={busy} onClick={join}>
                    {busy ? c.joining : c.join}
                  </button>
                </>
              )}
              {error && (
                <p className="small danger" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}
