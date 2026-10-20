/**
 * The session as a room (session-view): the title row with the status and turn, the Team pill,
 * the token chip and the presence stack; the stream of the three message shapes, the plan, the
 * approvals and the join lines; the composer; and one drawer with two faces, Team | Details.
 * The scrubber under the title row folds the session back to any turn, in the client.
 *
 * The stream's parts live in src/stream: Message (the shapes, steps, the join line, the edge
 * of the past), ApprovalNotice, PlanCard, Composer, Drawer and TokenMeter.
 */
import {
  compactTokens,
  isRatingsRule,
  planWaiting,
  ruleFor,
  type SessionState,
} from "@henosis/kernel";
import { usageTotal } from "@henosis/protocol";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Shell, type ShellContext } from "../App.js";
import { api, type Me, refOf, useFetch } from "../api.js";
import { DEFAULT_RATING } from "../approvalsQueue.js";
import { PHONE_QUERY } from "../breakpoints.js";
import { HenosisClient, wsUrl } from "../client.js";
import { copy } from "../copy.js";
import { OfflineState, useOffline, useOnline } from "../empty.js";
import { actorOf, type Identity } from "../identity.js";
import { notifyIfHidden } from "../notify.js";
import { usePaletteActions } from "../palette.js";
import { isComposing, presenceSummary } from "../presence.js";
import { rememberRecent } from "../recents.js";
import {
  AsOf,
  clockOf,
  hostOf,
  ReconnectLine,
  readLastSeen,
  rememberLastSeen,
  ServerGone,
} from "../reconnect.js";
import { reportPendingApprovals } from "../shell.js";
import type { ShortcutHandlers } from "../shortcuts.js";
import { ArrivalCard, ToldDrawer } from "../stream/Arrival.js";
import { describeCall } from "../stream/blocks.js";
import { Composer } from "../stream/Composer.js";
import { rememberArrival } from "../stream/clock.js";
import { Drawer, type Face } from "../stream/Drawer.js";
import { Stream } from "../stream/Message.js";
import { TokenMeter } from "../stream/TokenMeter.js";
import { finishTour, Tour, tourPending, tourStepsFor } from "../tour.js";
import {
  Avatar,
  ErrorLine,
  ICONS,
  Icon,
  Loader,
  Status,
  statusOf,
  teamOf,
  toast,
  useConnectionToasts,
  useJustJoined,
  useMediaQuery,
} from "../ui.js";
import { focusSoon, useShortcutContextPublisher } from "../useShortcuts.js";
import { isArriving } from "../welcome.js";
import { BranchCompare } from "./BranchCompare.js";
import { ExportSheet, PaperView, useExportState, usePaper } from "./Export.js";
import { ReplayScrubber, useReplay } from "./ReplayScrubber.js";
import { ShareSheet } from "./ShareSheet.js";
import { sessionCommands, shortcutContextOf } from "./sessionCommands.js";

/** Live events after which the project listing (people, status, goal) reads differently. */
const FLEET_KINDS = new Set<string>([
  "participant.joined",
  "participant.left",
  "handoff.accepted",
  "directive.submitted",
  "agent.turn.started",
  "agent.turn.ended",
  "approval.requested",
  "approval.voted",
  "plan.proposed",
  "plan.rated",
  "plan.decided",
  "session.closed",
]);

type Panel = Face | "share" | "told" | "export" | null;

export function SessionView({
  projectId,
  sessionId,
  title,
  identity,
  me,
  ctx,
}: {
  projectId: string;
  sessionId: string;
  title: string | null;
  identity: Identity;
  me: Me | null;
  ctx: ShellContext;
}) {
  const client = useMemo(() => new HenosisClient(), []);
  const snap = useSyncExternalStore(
    (fn) => client.subscribe(fn),
    () => client.snapshot,
  );
  const actor = useMemo(() => actorOf(identity), [identity]);
  // onboarding-empty-states: `join` is reused by the offline state's Retry.
  const join = useCallback(
    () =>
      client.connect(wsUrl(), {
        sessionId,
        actor,
        userId: identity.userId,
        projectId,
        title: title ?? sessionId,
        ...(identity.token ? { token: identity.token } : {}),
      }),
    [client, sessionId, projectId, title, actor, identity.userId, identity.token],
  );
  useEffect(() => {
    join();
    return () => client.disconnect();
  }, [client, join]);
  // Hook point (error-boundary-toasts): server errors and a lost socket as quiet toasts.
  useConnectionToasts(snap.connected, snap.errors);
  const offline = useOffline(snap.connected);
  const netOnline = useOnline();

  // The tour (tour.tsx): once, on the first session opened after the first run, or from
  // Settings; never on the demo session. It starts 600 ms after the fold so its targets exist.
  const [touring, setTouring] = useState(false);
  // An approval that arrived during the tour: it ended the tour and wears the halo for a while.
  const [lit, setLit] = useState<string | null>(null);
  const folded = snap.state !== null;
  useEffect(() => {
    if (!folded || sessionId.startsWith("demo-") || !tourPending()) return;
    const t = setTimeout(() => setTouring(true), 600);
    return () => clearTimeout(t);
  }, [folded, sessionId]);
  const endTour = useCallback(
    (how: "closed" | "skipped" | "approval") => {
      setTouring(false);
      finishTour();
      if (how === "closed") toast(copy.tour.inCircle(identity.name));
      else if (how === "approval") toast(copy.tour.endedByApproval);
    },
    [identity.name],
  );
  useEffect(() => {
    if (!lit) return;
    const t = setTimeout(() => setLit(null), 6000);
    return () => clearTimeout(t);
  }, [lit]);

  // The log has no wall clock: remember when each live event reached us (stream/clock.ts).
  useEffect(() => client.onLiveEvent((e) => rememberArrival(e.id)), [client]);

  // Notifications for things that need this person, only while the tab is hidden.
  useEffect(
    () =>
      client.onLiveEvent((e) => {
        const st = client.snapshot.state;
        const who = (id: string) => st?.participants[id]?.actor.name ?? id;
        const where = st?.title || sessionId;
        // An arriving approval ends the tour: the dim lifts and the card takes the halo.
        if (e.kind === "approval.requested" && touring) {
          endTour("approval");
          setLit(e.payload.approvalId);
        }
        if (e.kind === "approval.requested")
          notifyIfHidden(
            copy.notify.approvalTitle,
            copy.notify.approvalBody(e.payload.call.name, e.payload.call.risk, where),
            e.payload.approvalId,
            "approval",
          );
        else if (e.kind === "handoff.requested" && e.payload.to === identity.userId)
          notifyIfHidden(
            copy.notify.handoffTitle,
            copy.notify.handoffBody(who(e.actor), where),
            e.payload.handoffId,
            "handoff",
          );
        else if (e.kind === "note.posted" && e.actor !== identity.userId)
          notifyIfHidden(`${who(e.actor)} ${copy.stream.toTheTeam}`, e.payload.text, e.id, "team");
        else if (e.kind === "plan.proposed")
          notifyIfHidden(
            copy.notify.planTitle,
            copy.notify.planBody(e.payload.steps.length, where),
            e.payload.planId,
            "approval",
          );
        else if (e.kind === "fleet.contention.mirrored" && !e.payload.resolved)
          notifyIfHidden(
            copy.notify.contentionTitle,
            copy.notify.contentionBody(e.payload.kind, e.payload.resource),
            e.payload.contentionId,
            "contention",
          );
      }),
    [client, identity.userId, sessionId, touring, endTour],
  );

  // What this browser last saw of the session (only the time, the status and the turn), for
  // the server-down page's "What it last saw · 14:02".
  const seenStatus = snap.state?.status ?? null;
  const seenTurn = snap.state?.turn ?? 0;
  const seenAt = snap.events.at(-1)?.ts ?? null;
  useEffect(() => {
    if (!seenStatus || !seenAt) return;
    rememberLastSeen(projectId, sessionId, { at: seenAt, status: seenStatus, turn: seenTurn });
  }, [projectId, sessionId, seenStatus, seenTurn, seenAt]);

  // The sidebar's agents rail reads the project listing: tell it when who is here or what the
  // agent is doing changed, instead of leaving it to the next poll.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = client.onLiveEvent((e) => {
      if (!FLEET_KINDS.has(e.kind) || timer) return;
      timer = setTimeout(() => {
        timer = null;
        dispatchEvent(new Event("henosis:fleet"));
      }, 400);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, [client]);

  const ref = refOf(me, projectId);
  const s = snap.state;
  const shownTitle = s?.title || title || sessionId;
  useEffect(() => {
    rememberRecent({ projectId, sessionId, title: shownTitle });
  }, [projectId, sessionId, shownTitle]);
  // One drawer, two faces (team-panel): `panel` is which face is up, the share sheet, or none.
  const [panel, setPanel] = useState<Panel>(null);
  const details = panel === "details";
  const setDetails = useCallback((v: boolean) => setPanel(v ? "details" : null), []);
  const toggle = (face: Panel) => setPanel((v) => (v === face ? null : face));
  // Branch compare (views/BranchCompare.tsx): the other branch shown beside this one, or null.
  const [compare, setCompare] = useState<string | null>(null);
  const phone = useMediaQuery(PHONE_QUERY);
  const rows = useFetch(() => api.sessions(projectId), `${projectId}:${s?.seq ?? -1}`);
  const mine = rows.data?.find((r) => r.sessionId === sessionId) ?? null;
  // hook point (command-palette): this page's actions, refreshed as the session changes
  const openExport = useCallback(() => setPanel("export"), []);
  usePaletteActions(
    "session",
    useMemo(
      () => sessionCommands({ s, me: actor, client, details, setDetails, onExport: openExport }),
      [s, actor, client, details, setDetails, openExport],
    ),
  );
  // print-export: the chosen door and include list, and both documents folded from the log
  // while the panel is open (views/Export.tsx).
  const exp = useExportState();
  const paper = usePaper(
    panel === "export",
    s,
    snap.events,
    exp.door,
    exp.include,
    actor,
    s ? agentNameOf(s, (id) => s.participants[id]?.actor.name ?? id) : "",
  );
  // replay-scrubber: `viewSeq` is the seq being looked at, null for now; a pure client-side fold.
  const [viewSeq, setViewSeq] = useState<number | null>(null);
  const [scrubber, setScrubber] = useState(false);
  const view = useReplay(snap.events, s, viewSeq);
  const past = viewSeq !== null;
  // presence join: whoever just came online wears the ripple for a second.
  const justJoined = useJustJoined(snap.presence.filter((p) => p.online).map((p) => p.actor.id));
  // shortcuts: the "?" sheet says what each key would do right now in this session.
  useShortcutContextPublisher(
    useMemo(
      () => shortcutContextOf(s, actor.id, details, shownTitle),
      [s, actor.id, details, shownTitle],
    ),
  );

  if (!s)
    return (
      <Shell ctx={ctx} title={shownTitle}>
        <div className="column">
          <ErrorLine errors={snap.errors} />
          {offline ? (
            // Server down takes the page: the only state that takes the mark's centre away.
            <ServerGone
              online={netOnline}
              host={hostOf(wsUrl())}
              retry={snap.retry}
              lastSeen={readLastSeen(projectId, sessionId)}
              sessionId={sessionId}
              onRetry={() => {
                if (snap.reconnecting) client.reconnectNow();
                else join();
              }}
            />
          ) : (
            <div className="centre-wait">
              {snap.connected ? (
                <Loader
                  kind="orbit"
                  stack
                  label={copy.wait.joining(
                    (mine?.people ?? [])
                      .filter((p) => p.online && p.id !== identity.userId)
                      .map((p) => p.name),
                    shownTitle,
                  )}
                  count={snap.events.length ? copy.wait.folded(snap.events.length, null) : null}
                  after8s={copy.wait.longSession}
                />
              ) : (
                <Loader
                  kind="join"
                  size={96}
                  stack
                  label={
                    snap.reconnecting
                      ? copy.wait.reconnecting(mine?.people.find((p) => p.driving)?.name ?? null)
                      : copy.wait.connecting(shownTitle)
                  }
                  after8s={copy.wait.serverSlow}
                  after30s={{ label: copy.wait.tryAgain, onClick: join }}
                />
              )}
              <p className="small muted">{copy.wait.composerMuted}</p>
            </div>
          )}
        </div>
      </Shell>
    );

  const pendingApprovals = Object.values(s.approvals).filter((a) => a.status === "pending");
  reportPendingApprovals(pendingApprovals.length);
  const comparing =
    compare && compare !== s.branch && (compare === "main" || compare in s.branches)
      ? compare
      : null;
  const online = snap.presence.filter((p) => p.online);
  const name = (id: string) => s.participants[id]?.actor.name ?? id;
  const agentName = agentNameOf(s, name);
  // Keyboard shortcuts (shortcuts.ts): what each key means on this page.
  const offered = Object.values(s.handoffs).find(
    (h) => h.status === "pending" && h.to === actor.id,
  );
  const waiting = pendingApprovals[0];
  // Under a release gate a plain Approve carries the default rating; the notice offers the stars.
  const waitingRated = waiting
    ? isRatingsRule(ruleFor(s.policy.approvals, waiting.call.risk))
    : false;
  const planWaits = planWaiting(s);
  const running = s.status === "running";
  const shortcuts: ShortcutHandlers = {
    steer: () => focusSoon(".composer textarea"),
    approve: () =>
      waiting &&
      client.send({
        type: "vote",
        approvalId: waiting.id,
        vote: "approve",
        note: "",
        ...(waitingRated ? { rating: DEFAULT_RATING } : {}),
      }),
    deny: () =>
      waiting && client.send({ type: "vote", approvalId: waiting.id, vote: "deny", note: "" }),
    handoff: () => {
      if (offered) client.send({ type: "handoff.accept", handoffId: offered.id });
      else {
        setPanel("team");
        focusSoon('.drawer button[data-shortcut="handoff"]');
      }
    },
    fork: () => {
      setPanel("details");
      focusSoon('.drawer input[aria-label="New branch name"]');
    },
    details: () => toggle("details"),
  };
  const team = mine ? teamOf(mine) : null;
  const withNames = team?.with.map((p) => p.name) ?? [];
  const plan = s.activePlanId ? s.plans[s.activePlanId] : undefined;
  const liveStep = liveStepOf(s);
  const marksAt = view.marks.findIndex((m) => viewSeq !== null && viewSeq <= m.endSeq);
  // The phone's top block (mobile-session): the subtitle's status word, the Team button carrying
  // the "with Bo" pill, and the strip with the tokens, the crew and the gate's survival chip.
  const spent = usageTotal(s.usage);
  const budget = s.policy.tokenBudget;
  const spentPct = budget ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

  return (
    <Shell
      ctx={ctx}
      title={
        <>
          <span className="ellipsis serif">{shownTitle}</span>
          <Status status={s.status}>
            <span className="turn"> · {copy.stream.turn(s.turn)}</span>
          </Status>
          {team && (
            <span className={`pill ${team.team ? "team" : "solo"}`}>
              {team.team ? copy.session.teamWith(withNames) : copy.session.solo}
            </span>
          )}
          <TokenMeter
            usage={s.usage}
            budget={s.policy.tokenBudget}
            live={running}
            session={shownTitle}
            turn={s.turn}
          />
          {planWaits && <span className="pill planning">{copy.plan.planning}</span>}
        </>
      }
      subtitle={
        <>
          <b className={`st-${statusOf(s.status).cls}`}>{statusOf(s.status).label}</b>
          {" · "}
          {copy.stream.turn(s.turn)}
          {" · "}
          {copy.session.drives(s.driver ? name(s.driver) : null)}
        </>
      }
      right={
        <>
          {/* presence dims to 45 % with "as of HH:MM" while the socket is down: we no longer know who is here */}
          {!snap.connected && <AsOf ts={snap.events.at(-1)?.ts} />}
          <fieldset
            className={`stack${snap.connected ? "" : " stale"}`}
            aria-label={copy.session.presentSummary(presenceSummary(snap.presence, s.driver))}
            title={
              presenceSummary(snap.presence, s.driver) +
              (snap.connected ? "" : copy.session.asOf(clockOf(snap.events.at(-1)?.ts)))
            }
          >
            {online.slice(0, 4).map((p) => (
              <Avatar
                key={p.actor.id}
                id={p.actor.id}
                name={p.actor.name}
                driver={s.driver === p.actor.id}
                joined={justJoined.has(p.actor.id)}
                title={
                  copy.session.avatarTitle(p.actor.name, p.role, s.driver === p.actor.id) +
                  (isComposing(p.status) ? copy.session.writing : "")
                }
              />
            ))}
            {online.length > 4 && (
              <span className="avatar" title={presenceSummary(snap.presence, s.driver)}>
                {copy.session.more(online.length - 4)}
              </span>
            )}
          </fieldset>
          <button
            type="button"
            className={`btn ghost sm share${panel === "share" ? " on" : ""}`}
            aria-pressed={panel === "share"}
            onClick={() => toggle("share")}
          >
            <Icon d={ICONS.link} size={14} />
            <span className="lbl">{copy.session.share}</span>
          </button>
          {/* desktop-compact: below 960 the words go and the icons stay (styles.css .lbl) */}
          <button
            type="button"
            className={`btn sm${panel === "team" ? " on" : ""}${team?.team ? " team" : ""}`}
            aria-pressed={panel === "team"}
            aria-label={copy.session.team}
            title={copy.session.teamTitle(online.length)}
            onClick={() => toggle("team")}
          >
            <Icon d={ICONS.group} size={14} />
            {/* the phone folds the title's Team pill into this button: "Team · with Bo" */}
            <span className="lbl">
              {phone && team?.team ? copy.session.teamWith(withNames) : copy.session.team}
            </span>
            <span className="n mono" aria-hidden="true">
              {online.length}
            </span>
          </button>
          <button
            type="button"
            className={`btn sm${details ? " on" : ""}`}
            aria-pressed={details}
            aria-label={copy.session.details}
            title={copy.session.details}
            onClick={() => toggle("details")}
          >
            <Icon d={ICONS.brief} size={14} />
            <span className="lbl">{copy.session.details}</span>
            <span className="kbd key" aria-hidden="true">
              i
            </span>
          </button>
        </>
      }
      below={
        <>
          <div className="strip">
            {phone && (
              <>
                <span
                  className={`tok${spentPct >= 100 ? " over" : spentPct >= 80 ? " warn" : ""}`}
                  title={copy.session.tokensTitle}
                >
                  <span className="mono">
                    {compactTokens(spent)}
                    {budget ? ` / ${compactTokens(budget)}` : ""}
                  </span>
                  <i className="hair" style={{ "--spent": `${spentPct}%` } as CSSProperties} />
                </span>
                {mine?.crew && <span className="crew serif">{mine.crew}</span>}
              </>
            )}
            <GateChip count={pendingApprovals.length} id={waiting?.id} />
          </div>
          <ReconnectLine
            reconnecting={snap.reconnecting}
            retry={snap.retry}
            asOf={snap.events.at(-1)?.ts}
            onTryNow={() => client.reconnectNow()}
          />
          {!comparing && (
            <ReplayScrubber
              marks={view.marks}
              viewSeq={viewSeq}
              pinned={scrubber}
              steps={plan ? plan.steps.map((st) => st.title) : []}
              onView={setViewSeq}
            />
          )}
        </>
      }
      shortcuts={shortcuts}
      onCloseDrawer={() => setPanel(null)}
      drawer={
        panel === "share" ? (
          <ShareSheet
            s={s}
            me={actor}
            client={client}
            projectId={projectId}
            errors={snap.errors}
            onClose={() => setPanel(null)}
            onExport={openExport}
          />
        ) : panel === "export" && paper ? (
          <ExportSheet
            s={s}
            me={actor}
            client={client}
            connected={snap.connected}
            model={paper}
            door={exp.door}
            onDoor={exp.setDoor}
            include={exp.include}
            onInclude={exp.setInclude}
            onClose={() => setPanel(null)}
          />
        ) : panel === "told" ? (
          <ToldDrawer
            s={s}
            rows={rows.data ?? []}
            mine={mine}
            projectName={ref.name}
            orgId={ref.orgId}
            teamId={ref.teamId}
            projectId={projectId}
            at={snap.events[0]?.ts ?? null}
            me={actor}
            onClose={() => setPanel(null)}
          />
        ) : panel === "team" || panel === "details" ? (
          <Drawer
            face={panel}
            onFace={setPanel}
            onClose={() => setPanel(null)}
            s={s}
            me={actor}
            client={client}
            presence={snap.presence}
            rows={rows.data ?? []}
            reload={rows.reload}
            projectId={projectId}
            orgId={ref.orgId}
            teamId={ref.teamId}
            brief={snap.brief}
            errors={snap.errors}
            onCompare={(b) => {
              setCompare(b);
              if (phone) setPanel(null);
            }}
            onShare={() => setPanel("share")}
            onTold={() => setPanel("told")}
            replay={{
              marks: view.marks,
              viewSeq,
              pinned: scrubber,
              onPin: () => setScrubber((v) => !v),
              onView: setViewSeq,
            }}
          />
        ) : null
      }
    >
      {comparing ? (
        <BranchCompare
          s={s}
          me={actor}
          client={client}
          projectId={projectId}
          other={comparing}
          onOther={setCompare}
          onClose={() => setCompare(null)}
          errors={snap.errors}
        />
      ) : panel === "export" && paper ? (
        <PaperView model={paper} door={exp.door} s={s} />
      ) : (
        <>
          <div className={past ? "past" : undefined}>
            <Stream
              events={view.events}
              s={view.state ?? s}
              me={actor}
              client={client}
              agentName={agentName}
              showHandoff={panel !== "team" && !past}
              past={past ? { marks: view.marks, at: marksAt } : null}
              lit={lit}
              arrival={
                !past && isArriving(s) ? (
                  <ArrivalCard
                    s={s}
                    rows={rows.data ?? []}
                    mine={mine}
                    projectId={projectId}
                    at={snap.events[0]?.ts ?? null}
                    me={actor}
                    onTold={() => setPanel("told")}
                  />
                ) : null
              }
            />
          </div>
          {touring && <Tour steps={tourStepsFor(s)} onEnd={endTour} />}
          <Composer
            s={s}
            me={actor}
            client={client}
            connected={snap.connected}
            queued={snap.queued}
            presence={snap.presence}
            planWaits={planWaits}
            liveStep={running ? liveStep : null}
            readonly={past ? { onReturn: () => setViewSeq(null) } : null}
          />
        </>
      )}
    </Shell>
  );
}

/** "Ana's agent": the stream's name for the agent (the rail card carries the session title). */
function agentNameOf(s: SessionState, name: (id: string) => string): string {
  if (s.ownerId && s.participants[s.ownerId]) return copy.team.agentOf(name(s.ownerId));
  const agent = Object.values(s.participants).find((p) => p.actor.kind === "agent");
  return agent?.actor.name ?? copy.session.theAgent;
}

/** What the agent is doing right now, for the composer's hint: the step with no result yet. */
function liveStepOf(s: SessionState): string | null {
  const t = s.currentTurn;
  if (!t) return null;
  const done = new Set(t.toolResults.map((r) => r.callId));
  const call = t.toolCalls.find((c) => !done.has(c.id));
  return call ? describeCall(call).doing : null;
}

/**
 * The gate's survival rule: once the pending approval has scrolled out of view (or the windowed
 * stream has unmounted it), a chip in the strip under the top row says how many wait and taps
 * back to it.
 */
function GateChip({ count, id }: { count: number; id: string | undefined }) {
  const [away, setAway] = useState(false);
  useEffect(() => {
    if (!id) return;
    const find = () => document.querySelector<HTMLElement>(`[data-approval="${CSS.escape(id)}"]`);
    let raf = 0;
    const check = () => {
      raf = 0;
      const el = find();
      const scroller = el?.closest(".scroll");
      if (!el || !scroller) {
        setAway(true);
        return;
      }
      const r = el.getBoundingClientRect();
      const v = scroller.getBoundingClientRect();
      setAway(r.bottom < v.top + 8 || r.top > v.bottom - 8);
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    addEventListener("scroll", queue, true);
    addEventListener("resize", queue);
    // rows mount and unmount with the window (VirtualList), so the DOM says when to look again
    const mo = typeof MutationObserver === "undefined" ? null : new MutationObserver(queue);
    const scroller = document.querySelector(".scroll");
    if (mo && scroller) mo.observe(scroller, { childList: true, subtree: true });
    queue();
    return () => {
      removeEventListener("scroll", queue, true);
      removeEventListener("resize", queue);
      mo?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [id]);
  if (!id || count === 0 || !away) return null;
  const back = () => {
    const el = document.querySelector<HTMLElement>(`[data-approval="${CSS.escape(id)}"]`);
    if (el) el.scrollIntoView({ block: "center" });
    else {
      const scroller = document.querySelector(".scroll");
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    }
  };
  return (
    <button type="button" className="chip gatechip" onClick={back}>
      <span className="mono">{count}</span> {copy.approval.waitsForYou(count)}
    </button>
  );
}
