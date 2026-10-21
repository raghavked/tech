/**
 * The glance (widgets, 7.5 revise): the macOS menu-bar panel, and the one surface the
 * widgets are drawn from. Three questions a glance settles without opening the app, in the
 * manager's order: what waits for me (Needs you), who is running (Agents), what today has
 * cost (Tokens today); then the tray's menu made rich: Inbox, Approvals, Pause notifications,
 * Open Henosis.
 *
 * One `GET /api/glance` feeds it on a timeline (every few seconds here; WidgetKit's own on a
 * phone), brisker for a while after a vote so the next gate arrives. Approve on a row is the
 * same vote as in the session (`POST /api/glance/vote`: a plain approve under a release gate
 * sends the default 4); the row then says what the ballot did and stays a minute. The head is
 * the disc mark under 24 px with an uppercase label and the count in an apricot pill, grey at
 * zero, the moon while paused. Every figure is mono. Stale means "As of 9:26 · reconnecting"
 * with hollow dots, never a guess. Bare: no rail, no top row (#/glance).
 */
import { DEFAULT_RATING, type GlanceReport, type GlanceVoteResult } from "@henosis/protocol";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { api, type GlanceGate } from "../api.js";
import { copy } from "../copy.js";
import {
  approveLabel,
  asOfText,
  gateLine,
  OUTCOME_STAYS_MS,
  outcomeText,
  PAUSE_SPANS,
  pauseText,
  segmentsOf,
  tokensLine,
  usedToday,
  widgetState,
} from "../glance.js";
import type { Identity } from "../identity.js";
import { pauseNotifications, resumeNotifications, useNotifyPause } from "../prefs.js";
import { paths } from "../router.js";
import { useTheme } from "../theme.js";
import { ICONS, Icon, Mark } from "../ui.js";

/** The panel's own timeline, and the brisker one for a while after a vote. */
const POLL_MS = 8_000;
const POLL_AFTER_VOTE_MS = 2_000;
const BRISK_FOR_MS = 30_000;

interface GlanceFeed {
  report: GlanceReport | null;
  /** When the last good answer arrived, for "As of 9:26". */
  asOf: number | null;
  error: string | null;
  /** Take a fresh report from a vote's answer. */
  apply: (r: GlanceReport) => void;
  /** Poll briskly for a while: a decision just moved the session on. */
  brisk: () => void;
}

function useGlance(userId: string): GlanceFeed {
  const [report, setReport] = useState<GlanceReport | null>(null);
  const [asOf, setAsOf] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const briskUntil = useRef(0);
  const brisk = useCallback(() => {
    briskUntil.current = Date.now() + BRISK_FOR_MS;
    setTick((t) => t + 1);
  }, []);
  const apply = useCallback((r: GlanceReport) => {
    setReport(r);
    setAsOf(Date.now());
    setError(null);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `tick` restarts the timeline on purpose (after a vote)
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = async () => {
      try {
        const r = await api.glance(userId);
        if (!alive) return;
        apply(r);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive)
          timer = setTimeout(load, Date.now() < briskUntil.current ? POLL_AFTER_VOTE_MS : POLL_MS);
      }
    };
    void load();
    // Back in view: ask now rather than wait out the timeline.
    const onShow = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      timer = null;
      void load();
    };
    document.addEventListener("visibilitychange", onShow);
    addEventListener("focus", onShow);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onShow);
      removeEventListener("focus", onShow);
    };
  }, [userId, tick, apply]);
  return { report, asOf, error, apply, brisk };
}

/** What a ballot from the row did, shown in the row's place for a minute. */
interface Acted extends Pick<GlanceVoteResult, "outcome" | "rating" | "votes" | "needed"> {
  approvalId: string;
  gate: GlanceGate;
  at: number;
}

export function GlancePanel({
  identity,
  budget = null,
}: {
  identity: Identity;
  /** The budget the Tokens widget measures today against; null draws no meter (Decision 8). */
  budget?: number | null;
}) {
  const feed = useGlance(identity.userId);
  const pausedUntil = useNotifyPause();
  // Bare surface: no rail applies the remembered light / dark choice, so the panel does.
  useTheme();
  const [acted, setActed] = useState<Acted | null>(null);
  const [busy, setBusy] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const report = feed.report;
  const state = widgetState({
    report,
    stale: feed.error !== null || report === null,
    paused: pausedUntil !== null,
  });

  // The decided row stays a minute, then the widget moves on.
  useEffect(() => {
    if (!acted) return;
    const left = acted.at + OUTCOME_STAYS_MS - Date.now();
    const t = setTimeout(() => setActed(null), Math.max(0, left));
    return () => clearTimeout(t);
  }, [acted]);

  const vote = async (gate: GlanceGate, choice: "approve" | "deny") => {
    setBusy(true);
    setVoteError(null);
    try {
      const r = await api.glanceVote(identity.userId, {
        projectId: gate.projectId,
        sessionId: gate.sessionId,
        approvalId: gate.approvalId,
        vote: choice,
      });
      setActed({
        approvalId: gate.approvalId,
        gate,
        at: Date.now(),
        outcome: r.outcome,
        rating: r.rating,
        votes: r.votes,
        needed: r.needed,
      });
      feed.apply(r.glance);
      feed.brisk();
    } catch (e) {
      setVoteError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const needsYou = report?.needsYou ?? 0;
  const topGate =
    report?.topGate && report.topGate.approvalId !== acted?.approvalId ? report.topGate : null;
  const more = Math.max(0, (report?.approvals ?? 0) - (topGate ? 1 : 0));
  const tokens = tokensLine(report ? usedToday(report) : 0, budget);

  return (
    <main className={`glance is-${state}`} aria-label={copy.glance.title}>
      <section className="gw gw-needs" aria-labelledby="gl-needs">
        <Head id="gl-needs" label={copy.glance.needsYou}>
          {pausedUntil !== null ? (
            <span
              className="gl-pill moon"
              role="img"
              aria-label={copy.glance.paused(pauseText(pausedUntil))}
            >
              <Icon d={ICONS.moon} size={12} />
            </span>
          ) : (
            <span
              className={`gl-pill${needsYou === 0 ? " zero" : ""}`}
              role="img"
              aria-label={copy.glance.count(needsYou)}
            >
              <b>{needsYou}</b>
            </span>
          )}
        </Head>
        {state === "stale" && (
          <p className="gl-asof" role="status">
            {feed.asOf === null ? copy.glance.failed : copy.glance.asOf(asOfText(feed.asOf))}
          </p>
        )}
        {acted && (
          <p
            className={`gl-outcome ${acted.outcome}`}
            role="status"
            data-approval={acted.approvalId}
          >
            <Icon d={acted.outcome === "denied" ? ICONS.close : ICONS.check} size={14} />
            <span>{outcomeText(acted)}</span>
            <i className="serif">
              {gateLine(acted.gate).who} · {acted.gate.title}
            </i>
          </p>
        )}
        {topGate && (
          <GateRow gate={topGate} busy={busy} onVote={(choice) => void vote(topGate, choice)} />
        )}
        {voteError && (
          <p className="gl-error" role="alert">
            {voteError}
          </p>
        )}
        {!acted && !topGate && report && state !== "stale" && (
          <p className="gl-empty">
            <Mark size={16} cut="small" />
            <span>{copy.glance.nothing}</span>
          </p>
        )}
        {report && report.handoffs > 0 && (
          <a className="gl-row" href={paths.inbox()}>
            <Icon d={ICONS.handoff} size={14} />
            <span>{copy.glance.handoffs(report.handoffs)}</span>
          </a>
        )}
        {more > 0 && (
          <a className="gl-row more" href={paths.approvals()}>
            <span>{copy.glance.andMore(more)}</span>
          </a>
        )}
      </section>

      <section className="gw gw-agents" aria-labelledby="gl-agents">
        <Head id="gl-agents" label={copy.glance.agents}>
          <span className="gl-pill quiet">
            <b>{report?.agents.running ?? 0}</b>
          </span>
        </Head>
        {report && report.agents.open === 0 ? (
          <p className="gl-muted">{copy.glance.noAgents}</p>
        ) : (
          <>
            <p className="gl-big serif">{copy.glance.running(report?.agents.running ?? 0)}</p>
            <p className="gl-dots">
              <span>
                <i className="dot run" aria-hidden="true" />
                {copy.glance.running(report?.agents.running ?? 0)}
              </span>
              <span>
                <i className="dot wait" aria-hidden="true" />
                {copy.glance.awaiting(report?.agents.awaitingApproval ?? 0)}
              </span>
              {(report?.agents.blocked ?? 0) > 0 && (
                <span>
                  <i className="dot block" aria-hidden="true" />
                  {copy.glance.blocked(report?.agents.blocked ?? 0)}
                </span>
              )}
              <span className="gl-muted">{copy.glance.open(report?.agents.open ?? 0)}</span>
            </p>
          </>
        )}
      </section>

      <section className={`gw gw-tokens${tokens.over ? " over" : ""}`} aria-labelledby="gl-tokens">
        <Head id="gl-tokens" label={copy.glance.tokens} />
        <p className="gl-figure">{tokens.figure}</p>
        <p className="gl-detail">{tokens.detail}</p>
        {tokens.fraction !== null && (
          <span className="gl-meter" aria-hidden="true">
            <i style={{ width: `${Math.round(tokens.fraction * 100)}%` }} />
          </span>
        )}
        {tokens.foot && <p className="gl-foot">{tokens.foot}</p>}
      </section>

      <nav className="gw-foot" aria-label={copy.glance.title}>
        <a className="gl-nav" href={paths.inbox()}>
          <Icon d={ICONS.inbox} size={14} />
          <span>{copy.glance.inbox}</span>
        </a>
        <a className="gl-nav" href={paths.approvals()}>
          <Icon d={ICONS.gate} size={14} />
          <span>{copy.glance.approvals}</span>
        </a>
        <PauseMenu pausedUntil={pausedUntil} />
        <a className="gl-nav" href={paths.home()}>
          <Icon d={ICONS.session} size={14} />
          <span>{copy.glance.openHenosis}</span>
        </a>
      </nav>
    </main>
  );
}

/** The widget head: the disc mark under 24 px, an uppercase label, the count at the right. */
function Head({ id, label, children }: { id: string; label: string; children?: ReactNode }) {
  return (
    <header className="gw-head">
      <Mark size={18} cut="small" />
      <h2 id={id}>{label}</h2>
      {children}
    </header>
  );
}

/**
 * One Needs-you row in the toast's grammar: who's agent · session in serif, "wants to" and the
 * call in mono, Gate with its quorum segments, "Approve · 4" in chocolate and a quiet round Deny.
 */
function GateRow({
  gate,
  busy,
  onVote,
}: {
  gate: GlanceGate;
  busy: boolean;
  onVote: (choice: "approve" | "deny") => void;
}) {
  const line = gateLine(gate);
  return (
    <article className="gl-gate" aria-label={`${line.who} · ${line.session}`}>
      <a className="gl-who serif" href={paths.session(gate.projectId, gate.sessionId, gate.title)}>
        {line.who} · {line.session}
      </a>
      <p className="gl-ask">
        <span className="gl-muted">{copy.glance.wantsTo}</span> <code>{line.call}</code>
      </p>
      {gate.ratings && (
        <p className="gl-quorum">
          <span className="gl-gatepill">{copy.glance.gate}</span>
          <span className="segs" aria-hidden="true">
            {segmentsOf(gate.votes, gate.needed).map((s, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the segments are identical
              <i key={i} className={s} />
            ))}
          </span>
          <span className="n">{copy.glance.quorum(gate.votes, gate.needed)}</span>
        </p>
      )}
      <div className="gl-acts">
        <button
          type="button"
          className="gl-approve"
          disabled={busy}
          onClick={() => onVote("approve")}
        >
          {approveLabel(gate, DEFAULT_RATING)}
        </button>
        <button
          type="button"
          className="gl-deny"
          aria-label={copy.glance.deny}
          title={copy.glance.deny}
          disabled={busy}
          onClick={() => onVote("deny")}
        >
          <Icon d={ICONS.close} size={14} />
        </button>
      </div>
    </article>
  );
}

/** Pause notifications: an hour, until tomorrow, until you say; the head shows the moon. */
function PauseMenu({ pausedUntil }: { pausedUntil: number | null }) {
  const [open, setOpen] = useState(false);
  if (pausedUntil !== null)
    return (
      <button type="button" className="gl-nav" onClick={() => resumeNotifications()}>
        <Icon d={ICONS.bell} size={14} />
        <span>{copy.glance.resume}</span>
      </button>
    );
  return (
    <div className={`gl-pause${open ? " open" : ""}`}>
      <button
        type="button"
        className="gl-nav"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon d={ICONS.moon} size={14} />
        <span>{copy.glance.pause}</span>
      </button>
      {open && (
        <div className="gl-spans">
          {PAUSE_SPANS.map((s) => (
            <button
              type="button"
              key={s.span}
              onClick={() => {
                pauseNotifications(s.span);
                setOpen(false);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
