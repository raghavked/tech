/**
 * Two branches side by side in the column: the files that differ as rows with +/- counts,
 * each side's last three turns, and "Fold into <here>", which sends the existing merge
 * message. Conflicts the fold leaves (state.openConflicts) are rows whose "Open file" shows
 * the conflict-marked content read-only. Data comes from the server's branch routes
 * (packages/server/src/branchApi.ts); the merge itself rides the session websocket.
 */
import {
  type BranchCompare as Compare,
  rankOf,
  type SessionState,
  type TurnGlimpse,
} from "@fold/kernel";
import { type Actor, ROLE_RANK } from "@fold/protocol";
import { useEffect, useState } from "react";
import { getJson, useFetch } from "../api.js";
import type { FoldClient } from "../client.js";
import { ErrorLine, ICONS, Icon, Mark } from "../ui.js";

interface SessionFile {
  branch: string;
  path: string;
  hash: string;
  content: string;
  conflict: boolean;
}

const enc = encodeURIComponent;
const branchApi = {
  compare: (projectId: string, sessionId: string, a: string, b: string) =>
    getJson<Compare>(
      `/api/projects/${enc(projectId)}/sessions/${enc(sessionId)}/compare?a=${enc(a)}&b=${enc(b)}`,
    ),
  file: (projectId: string, sessionId: string, branch: string, path: string) =>
    getJson<SessionFile>(
      `/api/projects/${enc(projectId)}/sessions/${enc(sessionId)}/file?branch=${enc(branch)}&path=${enc(path)}`,
    ),
};

export function BranchCompare({
  s,
  me,
  client,
  projectId,
  other,
  onOther,
  onClose,
  errors,
}: {
  s: SessionState;
  me: Actor;
  client: FoldClient;
  projectId: string;
  /** The branch shown beside the one this client is on. */
  other: string;
  onOther: (branch: string) => void;
  onClose: () => void;
  errors: string[];
}) {
  const here = s.branch;
  const cmp = useFetch(
    // Counted from the other branch to here, so "+" is what this branch adds.
    () => branchApi.compare(projectId, s.sessionId, other, here),
    `${s.sessionId}/${here}/${other}/${s.seq}`,
  );
  // The other branch's events do not reach this socket: look again now and then.
  useEffect(() => {
    const every = setInterval(cmp.reload, 5_000);
    return () => clearInterval(every);
  }, [cmp.reload]);
  // Only a fold made while this view is open is announced; older conflicts still list below.
  const [openedSeq] = useState(s.seq);
  const folded = [...s.merges].reverse().find((m) => m.source === other && m.seq > openedSeq);
  const canFold = rankOf(s, me.id) >= ROLE_RANK.driver;
  const others = ["main", ...Object.keys(s.branches)].filter((b) => b !== here);
  const files = cmp.data?.files ?? [];
  const note = (f: Compare["files"][number]) =>
    !f.inA ? `only on ${here}` : !f.inB ? `only on ${other}` : "";

  return (
    <section className="column page compare" aria-label={`Compare ${here} with ${other}`}>
      <p className="row">
        <button type="button" className="btn ghost sm" onClick={onClose}>
          <Icon d={ICONS.back} size={14} />
          Conversation
        </button>
      </p>
      <div className="sides">
        <div className="side">
          <span className="serif">
            {here}
            <span className="muted"> · here</span>
          </span>
        </div>
        <div className="side">
          <span className="row">
            <span className="serif ellipsis">{other}</span>
            {others.length > 1 && (
              <select
                className="select sm"
                aria-label="Compare with"
                value={other}
                onChange={(e) => onOther(e.target.value)}
              >
                {others.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            )}
          </span>
        </div>
      </div>
      <ErrorLine errors={errors} />
      {cmp.error && <p className="small danger">{cmp.error}</p>}

      <section className="group">
        <h2>Files that differ</h2>
        {!cmp.data && !cmp.error && <p className="muted">Comparing…</p>}
        {cmp.data && files.length === 0 && <p className="muted">Nothing differs.</p>}
        {files.length > 0 && (
          <div className="list">
            {files.map((f) => (
              <div className="rowitem" key={f.path}>
                <span className="mono ellipsis">{f.path}</span>
                <span className="small faint">{note(f)}</span>
                <Counts plus={f.plus} minus={f.minus} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="group">
        <h2>Last turns</h2>
        <div className="sides">
          <Turns branch={here} turns={cmp.data?.turns.b ?? []} />
          <Turns branch={other} turns={cmp.data?.turns.a ?? []} />
        </div>
      </section>

      <section className="group">
        {folded ? (
          <div className={`divider${folded.conflicts.length ? " danger" : ""}`}>
            Folded {other} into {here}
            {folded.conflicts.length
              ? ` · ${folded.conflicts.length} conflict${folded.conflicts.length === 1 ? "" : "s"}`
              : " · no conflicts"}
          </div>
        ) : (
          <p className="row">
            <button
              type="button"
              className="btn primary sm"
              disabled={!canFold}
              onClick={() => client.send({ type: "merge", source: other })}
            >
              <Mark size={14} />
              Fold {other} into {here}
            </button>
            {!canFold && <span className="small faint">Folding needs the driver or an owner.</span>}
          </p>
        )}
      </section>

      {s.openConflicts.length > 0 && (
        <section className="group">
          <h2>Conflicts</h2>
          <p className="small muted">
            Both sides changed these; the file now carries both versions between markers until the
            agent or a person rewrites it.
          </p>
          <div className="list">
            {s.openConflicts.map((p) => (
              <ConflictRow
                key={p}
                path={p}
                projectId={projectId}
                sessionId={s.sessionId}
                branch={here}
                seq={s.seq}
              />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

function Counts({ plus, minus }: { plus: number; minus: number }) {
  return (
    <span className="mono muted counts">
      {plus > 0 && <span>+{plus}</span>}
      {minus > 0 && <span>−{minus}</span>}
      {plus === 0 && minus === 0 && <span>±0</span>}
    </span>
  );
}

function Turns({ branch, turns }: { branch: string; turns: TurnGlimpse[] }) {
  return (
    <div className="side" data-branch={branch}>
      {turns.length === 0 && <p className="muted small">No turns yet.</p>}
      {turns.map((t) => (
        <p className="turn" key={t.turn}>
          <b>Turn {t.turn}</b> {t.text.replace(/^(DONE|continuing):?\s*/i, "") || "(no summary)"}
          <span className="faint">
            {t.toolCalls ? ` · ${t.toolCalls} tool call${t.toolCalls === 1 ? "" : "s"}` : ""}
            {t.reason && t.reason !== "done" ? ` · ${t.reason}` : ""}
          </span>
        </p>
      ))}
    </div>
  );
}

/** One conflicted path; "Open file" reveals the conflict-marked content, read-only. */
function ConflictRow({
  path,
  projectId,
  sessionId,
  branch,
  seq,
}: {
  path: string;
  projectId: string;
  sessionId: string;
  branch: string;
  seq: number;
}) {
  const [open, setOpen] = useState(false);
  const file = useFetch(
    open ? () => branchApi.file(projectId, sessionId, branch, path) : null,
    `${sessionId}/${branch}/${path}/${seq}`,
  );
  return (
    <>
      <div className="rowitem">
        <span className="mono ellipsis">{path}</span>
        <button
          type="button"
          className="btn ghost sm"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Open file"}
        </button>
      </div>
      {open && (
        <pre className="step-out filebody">
          {file.error ? (
            <span className="danger">{file.error}</span>
          ) : !file.data ? (
            "Loading…"
          ) : (
            file.data.content.split("\n").map((line, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: lines of a read-only file
                key={i}
                className={/^(<{7}|={7}|>{7})/.test(line) ? "mark" : ""}
              >
                {line}
                {"\n"}
              </span>
            ))
          )}
        </pre>
      )}
    </>
  );
}
