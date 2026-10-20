/**
 * Print and export (print-export, export-evidence · L4). One sheet with three doors: the session
 * as a document, the audit trail as a ledger, markdown for people. `ExportSheet` is the drawer
 * (the door as a radio with the row count beside it, the include list whose off rows carry their
 * reason, the hint that the export is itself recorded, one primary). `PaperView` is the column
 * beside it: the chosen sheet as the paper it becomes, and what `print.css` prints.
 *
 * Paper is its own theme (`--paper-*`, `color-scheme: light`); the mark on it is the cream
 * variant (`ground="paper"`), coloured only through custom properties, never a navy coin on white.
 */
import type { SessionState } from "@henosis/kernel";
import type { Actor, SessionEvent } from "@henosis/protocol";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, useFetch } from "../api.js";
import type { HenosisClient } from "../client.js";
import { copy } from "../copy.js";
import {
  DEFAULT_INCLUDES,
  type Door,
  type Evidence,
  type Includes,
  type LedgerRow,
  type PaperModel,
  type PaperRow,
  paperModel,
  rowCount,
  shortHash,
} from "../print.js";
import { ICONS, Icon, Mark } from "../ui.js";

const DOORS: Door[] = ["session", "audit", "markdown"];

/** What `window.print` is called through, so a flow can stand in for the dialog. */
export function printPage(): void {
  window.print();
}

/** The hour and date the head carries: "7 Oct 2026, 14:32" in the viewer's locale. */
export function whenText(at: number): string {
  return new Date(at).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function useExportState() {
  const [door, setDoor] = useState<Door>("session");
  const [include, setInclude] = useState<Includes>(DEFAULT_INCLUDES);
  return { door, setDoor, include, setInclude };
}

/**
 * Both documents from the session the client holds, rebuilt when the log grows or the choice
 * changes; null while the panel is closed, so a long log is not refolded on every live event.
 */
export function usePaper(
  active: boolean,
  s: SessionState | null,
  events: SessionEvent[],
  door: Door,
  include: Includes,
  me: Actor,
  agentName: string,
): PaperModel | null {
  // The export time is the moment the panel opened, so the preview and the print agree.
  const [exportedAt, setExportedAt] = useState(() => Date.now());
  useEffect(() => {
    if (active) setExportedAt(Date.now());
  }, [active]);
  return useMemo(
    () =>
      active && s
        ? paperModel(s, events, {
            door: door === "audit" ? "audit" : "session",
            exportedBy: me.name,
            exportedById: me.id,
            exportedAt,
            agentName,
            include,
          })
        : null,
    [active, s, events, door, include, me.name, me.id, exportedAt, agentName],
  );
}

export function ExportSheet({
  s,
  me,
  client,
  connected,
  model,
  door,
  onDoor,
  include,
  onInclude,
  onClose,
}: {
  s: SessionState;
  me: Actor;
  client: HenosisClient;
  connected: boolean;
  model: PaperModel;
  door: Door;
  onDoor: (d: Door) => void;
  include: Includes;
  onInclude: (i: Includes) => void;
  onClose: () => void;
}) {
  const w = copy.export;
  const stepCount = model.rows.reduce((n, r) => (r.kind === "agent" ? n + r.steps.length : n), 0);
  const gateCount = model.rows.filter((r) => r.kind === "gate").length + s.merges.length;
  const msgCount = model.rows.filter((r) => r.kind === "human" || r.kind === "plan").length;
  const others = ["main", ...Object.keys(s.branches)].filter((b) => b !== s.branch).length;
  const inSession = Boolean(s.participants[me.id]);
  const canRecord = connected && inSession;
  // The export is itself a row in the ledger ("Bo exported the audit view."): a note, kept in
  // the session log and never sent to the agent, then the browser's print dialog.
  const print = () => {
    if (canRecord) client.send({ type: "note", text: `${me.name} exported ${w.docWord[door]}.` });
    printPage();
  };
  // ⌘P / Ctrl+P while the sheet is open prints the chosen sheet, recorded the same way.
  useEffect(() => {
    if (door === "markdown") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        print();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });
  return (
    <>
      <button type="button" className="scrim sheet-scrim" aria-label={w.close} onClick={onClose} />
      <aside className="drawer export" aria-label={w.title}>
        <div className="drawer-head">
          <span>{w.title}</span>
          <button
            type="button"
            className="btn ghost icon sm"
            aria-label={w.close}
            onClick={onClose}
          >
            <Icon d={ICONS.close} size={14} />
          </button>
        </div>
        <section className="group">
          <h3>{w.document}</h3>
          <div className="doors" role="radiogroup" aria-label={w.document}>
            {DOORS.map((d) => (
              <label key={d} className={`opt${door === d ? " on" : ""}`}>
                <input
                  type="radio"
                  name="export-door"
                  value={d}
                  checked={door === d}
                  onChange={() => onDoor(d)}
                />
                <span className="rb" aria-hidden="true">
                  {door === d && <Icon d={ICONS.check} size={11} />}
                </span>
                <span className="txt">
                  <span className="t">{w.doors[d].t}</span>
                  <span className="s">{w.doors[d].s}</span>
                </span>
                <span className="mono meta">
                  {d === "markdown" ? w.markdownFile : w.rows(rowCount(model, d))}
                </span>
              </label>
            ))}
          </div>
        </section>
        <section className="group">
          <h3>{w.include}</h3>
          <div className="inc">
            <IncludeRow on fixed label={w.inc.messages} n={msgCount} />
            <IncludeRow
              on
              fixed
              label={w.inc.steps}
              why={model.masked ? w.inc.masked(model.masked) : null}
              amber
              n={stepCount}
            />
            <IncludeRow on fixed label={w.inc.gates} n={gateCount} />
            <IncludeRow
              on={include.chat}
              label={w.inc.chat}
              why={include.chat ? null : w.inc.chatWhy}
              n={s.notes.length}
              onChange={(v) => onInclude({ ...include, chat: v })}
            />
            <IncludeRow
              on={false}
              fixed
              label={w.inc.branches}
              why={w.inc.branchesWhy}
              n={others}
            />
          </div>
        </section>
        <section className="group foot">
          <p className="small faint hint">
            {canRecord ? w.recorded(me.name, w.docWord[door]) : w.notRecorded}
          </p>
          {door === "markdown" ? (
            <div className="row">
              <a
                className="btn sm"
                href={api.exportUrl(s.sessionId)}
                target="_blank"
                rel="noopener"
              >
                <Icon d={ICONS.file} size={14} />
                {w.openMarkdown}
              </a>
              <a className="btn sm primary" href={api.exportUrl(s.sessionId, true)}>
                <Icon d={ICONS.export} size={14} />
                {w.download}
              </a>
            </div>
          ) : (
            <button type="button" className="btn primary" onClick={print}>
              <Icon d={ICONS.export} size={14} />
              {w.print}
            </button>
          )}
        </section>
      </aside>
    </>
  );
}

function IncludeRow({
  on,
  fixed = false,
  label,
  why = null,
  amber = false,
  n,
  onChange,
}: {
  on: boolean;
  /** Always in (or always out): the box is drawn, not offered. */
  fixed?: boolean;
  label: string;
  /** The reason beside an off row, in italic serif; or the amber masked count beside the steps. */
  why?: string | null;
  amber?: boolean;
  n: number;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label className={`l${on ? " on" : ""}${fixed ? " fixed" : ""}`}>
      <input
        type="checkbox"
        checked={on}
        disabled={fixed}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className={`cb${on ? " on" : ""}`} aria-hidden="true">
        {on && <Icon d={ICONS.check} size={10} />}
      </span>
      <span>
        {label}
        {why && <span className={amber ? " why amber" : " why"}> {why}</span>}
      </span>
      <span className="n mono">{n}</span>
    </label>
  );
}

// ---- the paper --------------------------------------------------------------------------

export function PaperView({ model, door, s }: { model: PaperModel; door: Door; s: SessionState }) {
  const w = copy.export;
  const ref = useRef<HTMLDivElement>(null);
  // The stream leaves the column scrolled to its latest moment; a sheet starts at its head.
  // biome-ignore lint/correctness/useExhaustiveDependencies: each door starts at its head
  useEffect(() => {
    const scroller = ref.current?.closest(".scroll");
    if (scroller) scroller.scrollTop = 0;
  }, [door]);
  return (
    <div className="paper-view" ref={ref}>
      <div className="sheet-cap">
        <Icon d={ICONS.file} size={14} />
        {w.preview[door]}
        <span className="file">
          {door === "markdown"
            ? w.markdownFile
            : `${door === "audit" ? "audit" : "session"}_${model.sessionId}.pdf`}
        </span>
        <span className="sz">
          {door === "markdown" ? model.sessionId : w.rows(rowCount(model, door))}
        </span>
      </div>
      {door === "session" ? (
        <SessionSheet model={model} />
      ) : door === "audit" ? (
        <AuditSheet model={model} />
      ) : (
        <MarkdownSheet model={model} sessionId={s.sessionId} />
      )}
    </div>
  );
}

function RunHead({ model, kind }: { model: PaperModel; kind: Door }) {
  const w = copy.export;
  return (
    <div className="run-head">
      <Mark size={30} ground="paper" title={w.wordmark} />
      <div className="wm">
        {w.wordmark}
        <small>
          {model.projectId} · {model.title} · {w.kind[kind]}
        </small>
      </div>
      <div className="right">
        {w.exportedBy(whenText(model.exportedAt), model.exportedBy)}
        <br />
        {model.sessionId} · {model.branch}
      </div>
    </div>
  );
}

/** The verify line and the signature row: identical on both documents. */
function Seal({ model }: { model: PaperModel }) {
  const w = copy.export;
  return (
    <>
      <div className="verify">
        <Icon d={ICONS.check} size={12} />
        {w.verify}
        <span className="mono">{model.verifyCommand}</span>
      </div>
      <div className="sig">
        <Mark size={24} ground="paper" />
        <span>
          {w.sealed(model.events, model.masked)} · {w.head}{" "}
          <span className="mono">{shortHash(model.head)}</span>
        </span>
        <span className="mono">{model.branch}</span>
      </div>
    </>
  );
}

function RunFoot({ model, kind }: { model: PaperModel; kind: Door }) {
  const w = copy.export;
  return (
    <div className="run-foot">
      <span>
        {w.sha} {shortHash(model.hash)}
        {model.masked ? ` · ${w.masked(model.masked)}` : ""}
      </span>
      <span className="c">
        {w.wordmark} · {model.projectId} · {model.title}
      </span>
      <span className="r">{w.kind[kind]}</span>
    </div>
  );
}

function StarsText({ rating }: { rating: number }) {
  return (
    <span className="p-stars" role="img" aria-label={copy.rating.name(rating)}>
      {"★".repeat(rating)}
      <span className="off">{"★".repeat(5 - rating)}</span> {rating}
    </span>
  );
}

function Cast({ model }: { model: PaperModel }) {
  return (
    <div className="sub">
      {model.cast.map((p) => (
        <span key={`${p.who}:${p.role}`}>
          <b>{p.who}</b> <span className="muted">{p.role}</span>
        </span>
      ))}
    </div>
  );
}

export function SessionSheet({ model }: { model: PaperModel }) {
  const w = copy.export;
  return (
    <article className="paper" aria-label={w.preview.session}>
      <RunHead model={model} kind="session" />
      <h1>{model.title}</h1>
      <Cast model={model} />
      <div className="facts">
        {model.facts.map((f) => (
          <div key={f.k}>
            <div className="k">{f.k}</div>
            <div className="v">
              {f.v} <small>{f.small}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="p-stream">
        {model.rows.map((r) => (
          <Row key={r.id} r={r} />
        ))}
        {model.omissions.map((o) => (
          <div className="p-omit" key={o}>
            {o}
          </div>
        ))}
      </div>
      <div className="p-seal">
        <Seal model={model} />
      </div>
      <RunFoot model={model} kind="session" />
    </article>
  );
}

function Row({ r }: { r: PaperRow }) {
  const w = copy.export;
  switch (r.kind) {
    case "human":
      return (
        <div className="p-msg human">
          <div className="t">{r.goal ? copy.stream.goal : r.scope}</div>
          <div>
            <div className="who">
              {r.who}
              <span className="role">{r.role}</span>
              {r.sub && <span className="role">· {r.sub}</span>}
            </div>
            <div className="p-body">{r.text}</div>
          </div>
        </div>
      );
    case "agent":
      return (
        <div className="p-msg ai">
          <div className="t">{w.turnMeta(r.turn, r.step)}</div>
          <div>
            <div className="who">
              {r.who}
              <span className="role">{w.roles.agent}</span>
            </div>
            {r.text && <div className="p-body">{r.text}</div>}
            {r.steps.length > 0 && (
              <div className="p-steps">
                {r.steps.map((st) => (
                  <div className="p-step" key={st.id}>
                    <span>{st.text}</span>
                    <span className={`r${st.masked ? " amber" : ""}`}>
                      {st.masked ? w.masked(st.masked) : st.result}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    case "plan":
      return (
        <div className="p-msg ai">
          <div className="t">{copy.plan.proposedOn(r.plan.turn)}</div>
          <div className="p-plan">
            <div className="ph">
              {copy.plan.heading(r.plan.steps.length)}
              <span className="st">{r.status}</span>
            </div>
            {r.plan.steps.map((st, i) => (
              <div className="p-row" key={st.id}>
                <span className="n">{i + 1}</span>
                <span>{st.title}</span>
                <span className="est">
                  {st.actualTokens ? (
                    <>
                      <span className="act">{st.actualTokens.toLocaleString("en-US")}</span> / ~
                      {st.estTokens.toLocaleString("en-US")}
                    </>
                  ) : (
                    `~${st.estTokens.toLocaleString("en-US")}`
                  )}
                </span>
              </div>
            ))}
            {r.ratings.length > 0 && (
              <div className="rate">
                {r.ratings.map((x) => (
                  <span key={x.who}>
                    <span className="who">{x.who}</span> <StarsText rating={x.rating} />
                    {x.note && <q> {x.note}</q>}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    case "gate":
      return (
        <div className="p-msg ai">
          <div className="t">{r.gate ? copy.approval.releaseGate : copy.approval.label}</div>
          <div className={`p-gate${r.gate ? "" : " plain"}`}>
            <div className="p-gh">
              {copy.approval.wantsTo}
              {r.ask} · {r.approval.call.risk}
              <span className="rl">{r.rule}</span>
            </div>
            {r.votes.length > 0 && (
              <div className="p-votes">
                {r.votes.map((v) => (
                  <span key={v.who}>
                    <span className="who">{v.who}</span> <span className="muted">{v.role}</span>{" "}
                    {v.rating ? (
                      <StarsText rating={v.rating} />
                    ) : (
                      <span className="muted">
                        {v.approve ? w.approved : w.denied}
                        {v.voice ? ` · ${copy.approval.voice}` : ""}
                      </span>
                    )}
                    {v.note && <q> {v.note}</q>}
                  </span>
                ))}
              </div>
            )}
            <div className={`granted${r.approval.status === "pending" ? " waiting" : ""}`}>
              {r.outcome}
            </div>
          </div>
        </div>
      );
    case "line":
      return <div className="p-line">{r.text}</div>;
    case "omit":
      return <div className="p-omit">{r.text}</div>;
    default:
      return null;
  }
}

function EvidenceCell({ e }: { e: Evidence }) {
  switch (e.kind) {
    case "stars":
      return <StarsText rating={e.rating} />;
    case "ok":
      return <span className="ok">{e.text}</span>;
    default:
      return <>{e.text}</>;
  }
}

function LedgerLine({ r }: { r: LedgerRow }) {
  const w = copy.export;
  const cls = [r.kernel ? "kernel" : null, r.gate ? "gate" : null, r.exported ? "exp" : null]
    .filter(Boolean)
    .join(" ");
  return (
    <tr className={cls || undefined}>
      <td className="t">#{r.seq}</td>
      <td className="w">
        {r.who}
        {r.role && r.role !== r.who && <small>{r.role}</small>}
      </td>
      <td className="a">
        {r.did}
        {r.rule && <span className="rl"> {r.rule}</span>}
        {r.quote && <q> {r.quote}</q>}
        {r.masked > 0 && <span className="amber mono"> · {w.masked(r.masked)}</span>}
      </td>
      <td className="e">
        <EvidenceCell e={r.evidence} />
      </td>
    </tr>
  );
}

export function AuditSheet({ model }: { model: PaperModel }) {
  const w = copy.export;
  return (
    <article className="paper" aria-label={w.preview.audit}>
      <RunHead model={model} kind="audit" />
      <h1>{w.auditTitle}</h1>
      <div className="sub">
        <span>{model.title}</span>
        <span className="muted">{model.branch}</span>
        {model.policy && <span className="muted">{model.policy}</span>}
      </div>
      <div className="counts">
        {model.counts.map((c) => (
          <div key={c.k}>
            <div className="k">{c.k}</div>
            <div className="v">{c.v}</div>
          </div>
        ))}
      </div>
      <table className="p-ledger">
        <thead>
          <tr>
            <th>{w.columns.seq}</th>
            <th>{w.columns.who}</th>
            <th>{w.columns.did}</th>
            <th className="e">{w.columns.evidence}</th>
          </tr>
        </thead>
        <tbody>
          {model.ledger.map((r) => (
            <LedgerLine key={r.id} r={r} />
          ))}
        </tbody>
      </table>
      {model.omissions.map((o) => (
        <div className="p-omit" key={o}>
          {o}
        </div>
      ))}
      <div className="p-seal">
        <Seal model={model} />
      </div>
      <RunFoot model={model} kind="audit" />
    </article>
  );
}

/** The markdown the server renders (export-session), shown on paper as the file it will be. */
function MarkdownSheet({ model, sessionId }: { model: PaperModel; sessionId: string }) {
  const w = copy.export;
  const url = api.exportUrl(sessionId);
  const md = useFetch(
    () =>
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.text();
      }),
    url,
  );
  return (
    <article className="paper" aria-label={w.preview.markdown}>
      <RunHead model={model} kind="markdown" />
      <pre className="md">{md.data ?? (md.error ? md.error : copy.wait.rows)}</pre>
      <div className="p-seal">
        <Seal model={model} />
      </div>
      <RunFoot model={model} kind="markdown" />
    </article>
  );
}
