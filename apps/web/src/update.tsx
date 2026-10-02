import { useEffect, useState } from "react";
import { restartToUpdate, subscribeUpdate, type UpdateReady } from "./shell.js";

/**
 * One quiet row above the account button in the desktop shell once a newer build has been
 * downloaded: "Restart to update · 0.2.0". Renders nothing in a browser or while current.
 */
export function UpdateRow() {
  const [update, setUpdate] = useState<UpdateReady | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => subscribeUpdate(setUpdate), []);
  if (!update) return null;
  return (
    <button
      type="button"
      className="item update"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        restartToUpdate().finally(() => setBusy(false));
      }}
    >
      {busy ? "Updating" : "Restart to update"}
      <span className="faint">{update.version}</span>
    </button>
  );
}
