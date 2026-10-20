/**
 * The approvals queue (#/approvals): every pending approval across the team's projects as one
 * flat list of sentences, oldest first. Sessions with something waiting are found through
 * /api/projects/:id/sessions and joined over the websocket, so a vote here is the same vote as
 * in the session, and a decision anywhere folds the row. The keyboard cursor, the filters, the
 * quorum meter and the owner override (Decision 3) are computed in approvalsQueue.ts.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Shell, type ShellContext } from "../App.js";
import { api, type Me, type ProjectRef, type SessionRow } from "../api.js";
import {
  askParts,
  countsOf,
  DEFAULT_RATING,
  filterRows,
  glanceOf,
  isTyping,
  ledeOf,
  moveCursor,
  pendingOf,
  type QueueFilter,
  type QueueRow,
  ratingWord,
  rowState,
  rowsOf,
  sortRows,
} from "../approvalsQueue.js";
import { HenosisClient, wsUrl } from "../client.js";
import { copy } from "../copy.js";
import { EmptyState } from "../empty.js";
import { approvalsSubtitle, refreshGlance } from "../glance.js";
import { actorOf, type Identity, initials } from "../identity.js";
import { markRead, useInbox } from "../inbox.js";
import { navigate, paths } from "../router.js";
import { pressTwoStep, type TargetLike } from "../shortcuts.js";
import { ErrorLine, ICONS, Icon, PHONE_QUERY, Stars, useMediaQuery } from "../ui.js";
import { useShortcutContextPublisher } from "../useShortcuts.js";
import { GateSheet, Meter, QueueCard, ThumbFilters } from "./ApprovalsPhone.js";

interface Target {
  ref: ProjectRef;
  row: SessionRow;
}

/** One websocket per session with something to approve; every change bumps one version. */
class Hub {
  readonly joined = new Map<string, { client: HenosisClient; ref: ProjectRef; row: SessionRow }>();
  private listeners = new Set<() => void>();
  private version = 0;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  read = () => this.version;
  private bump() {
    this.version += 1;
    for (const fn of this.listeners) fn();
  }
  join(t: Target, identity: Identity): void {
    const key = `${t.ref.projectId}/${t.row.sessionId}`;
    const have = this.joined.get(key);
    if (have) {
      have.row = t.row;
      return;
    }
    const client = new HenosisClient();
    client.subscribe(() => this.bump());
    client.connect(wsUrl(), {
      sessionId: t.row.sessionId,
      actor: actorOf(identity),
      userId: identity.userId,
      projectId: t.ref.projectId,
      title: t.row.title || t.row.sessionId,
      ...(identity.token ? { token: identity.token } : {}),
    });
    this.joined.set(key, { client, ref: t.ref, row: t.row });
    this.bump();
  }
  close(): void {
    for (const j of this.joined.values()) j.client.disconnect();
    this.joined.clear();
  }
}

/** Sessions across the given projects that are waiting on an approval; polled like the rail. */
function useTargets(projects: ProjectRef[]): {
  targets: Target[];
  loaded: boolean;
  error: string | null;
} {
  const [state, setState] = useState<{ targets: Target[]; loaded: boolean; error: string | null }>({
    targets: [],
    loaded: false,
    error: null,
  });
  const key = projects.map((p) => p.projectId).join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` names the projects
  useEffect(() => {
    let alive = true;
    const load = () =>
      Promise.all(
        projects.map((ref) =>
          api
            .sessions(ref.projectId)
            .then((rows) => ({ ref, rows, error: null as string | null }))
            .catch((e: unknown) => ({
              ref,
              rows: [] as SessionRow[],
              error: e instanceof Error ? e.message : String(e),
            })),
        ),
      ).then((pairs) => {
        if (!alive) return;
        const targets = pairs.flatMap(({ ref, rows }) =>
          rows.filter((row) => pendingOf(row) > 0).map((row) => ({ ref, row })),
        );
        setState({ targets, loaded: true, error: pairs.find((p) => p.error)?.error ?? null });
      });
    load();
    const soon = setTimeout(load, 1500);
    const every = setInterval(load, 8_000);
    addEventListener("focus", load);
    addEventListener("henosis:fleet", load);
    return () => {
      alive = false;
      clearTimeout(soon);
      clearInterval(every);
      removeEventListener("focus", load);
      removeEventListener("henosis:fleet", load);
    };
  }, [key]);
  return state;
}

const FILTERS: QueueFilter[] = ["needs-you", "gates", "others", "all"];

export function Approvals({
  identity,
  me,
  ctx,
}: {
  identity: Identity;
  me: Me | null;
  ctx: ShellContext;
}) {
  const projects = me?.projects ?? [];
  const { targets, loaded, error } = useTargets(projects);
  const hub = useMemo(() => new Hub(), []);
  useEffect(() => () => hub.close(), [hub]);
  useSyncExternalStore(hub.subscribe, hub.read);
  useEffect(() => {
    for (const t of targets) hub.join(t, identity);
  }, [hub, targets, identity]);

  // Rows from every joined session. A decided approval is shown, folded, only when it was
  // pending while this page was open; the history of old decisions stays in the session.
  const seenPending = useRef(new Set<string>());
  const all: QueueRow[] = [];
  const errors: string[] = [];
  for (const j of hub.joined.values()) {
    const s = j.client.snapshot.state;
    const last = j.client.snapshot.errors.at(-1);
    if (last) errors.push(`${j.row.title || j.row.sessionId}: ${last}`);
    if (!s) continue;
    all.push(
      ...rowsOf(
        s,
        { projectId: j.ref.projectId, projectName: j.ref.name, fallbackTitle: j.row.title },
        identity.userId,
      ),
    );
  }
  for (const r of all) if (r.status === "pending") seenPending.current.add(r.key);
  const pending = sortRows(all.filter((r) => r.status === "pending"));
  const done = sortRows(
    all.filter((r) => r.status !== "pending" && seenPending.current.has(r.key)),
  );
  const counts = countsOf(pending);
  // A decision folds the row here and settles its inbox item, so the toast and the badge agree.
  const inbox = useInbox(identity.userId);
  const doneIds = done.map((r) => r.approvalId).join(",");
  useEffect(() => {
    const refs = new Set(doneIds.split(",").filter(Boolean));
    const ids = inbox.items
      .filter((n) => n.kind === "approval" && n.ref && refs.has(n.ref) && !n.read)
      .map((n) => n.id);
    if (ids.length) markRead(ids);
  }, [doneIds, inbox.items]);
  const [filter, setFilter] = useState<QueueFilter>("needs-you");
  // "Needs you" is where the page opens; when nothing needs you, the whole list shows.
  const effective: QueueFilter =
    filter === "needs-you" && counts["needs-you"] === 0 ? "all" : filter;
  const shown = filterRows(pending, effective);
  const glance = glanceOf(pending);
  const lede = ledeOf(pending);
  const gates = pending.filter((r) => r.quorum);

  const [cursorKey, setCursorKey] = useState<string | null>(null);
  const keys = shown.map((r) => r.key);
  const cursor = cursorKey && keys.includes(cursorKey) ? cursorKey : (keys[0] ?? null);
  // The stars picked on each row, so `1`–`5` and the button agree.
  const [picks, setPicks] = useState<Record<string, number>>({});
  // The two-step: an irreversible row lit by a first `a`, waiting for the second.
  const [armed, setArmed] = useState<string | null>(null);
  useShortcutContextPublisher({ queue: { count: pending.length } });

  // Under a release gate an approve carries the chosen rating, or the default when none was picked.
  const vote = (
    r: QueueRow,
    v: "approve" | "deny",
    rating: number | null = null,
    override = false,
    note = "",
  ) => {
    hub.joined.get(`${r.projectId}/${r.sessionId}`)?.client.send({
      type: "vote",
      approvalId: r.approvalId,
      vote: v,
      note,
      ...(r.ratings && v === "approve" ? { rating: rating ?? picks[r.key] ?? DEFAULT_RATING } : {}),
      ...(override ? { override: true } : {}),
    });
    // The tab's needs-you count is the glance's: ask for it again once the vote has landed.
    setTimeout(refreshGlance, 400);
  };
  const nudge = (r: QueueRow) => navigate(paths.session(r.projectId, r.sessionId));
  // The phone (ApprovalsPhone.tsx): cards, the filter bar at the thumb, the gate sheet.
  const phone = useMediaQuery(PHONE_QUERY);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openRow = openKey ? (pending.find((r) => r.key === openKey) ?? null) : null;
  useEffect(() => {
    if (openKey && !openRow) setOpenKey(null);
  }, [openKey, openRow]);
  const projectNames = [...new Set(pending.map((r) => r.projectName))];

  // j/k move, a/d decide, 1–5 pick a rating, Enter opens the session. Never while typing.
  const latest = useRef({ keys, cursor, shown, vote, armed });
  latest.current = { keys, cursor, shown, vote, armed };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target as TargetLike | null)) return;
      const { keys, cursor, shown, vote, armed } = latest.current;
      const row = shown.find((r) => r.key === cursor) ?? null;
      const state = row ? rowState(row) : null;
      const mayVote = row && (state === "needs-you" || state === "exec" || state === "low");
      switch (e.key) {
        case "j":
        case "ArrowDown":
          setCursorKey(moveCursor(keys, cursor, 1));
          setArmed(null);
          break;
        case "k":
        case "ArrowUp":
          setCursorKey(moveCursor(keys, cursor, -1));
          setArmed(null);
          break;
        case "a": {
          if (!row || !mayVote) return;
          // An irreversible call from another page takes two presses: the first lights the row.
          const step = pressTwoStep(armed, row.key, row.irreversible);
          setArmed(step.armed);
          if (step.fire) vote(row, "approve");
          break;
        }
        case "d":
          if (!row || (!mayVote && state !== "voted")) return;
          setArmed(null);
          vote(row, "deny");
          break;
        case "Escape":
          if (!armed) return;
          setArmed(null);
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
          if (!row?.ratings || !mayVote) return;
          setPicks((p) => ({ ...p, [row.key]: Number(e.key) }));
          break;
        case "Enter":
        case "o":
          if (row) navigate(paths.session(row.projectId, row.sessionId));
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    // Capture: the page's own j/k win over the shell's next/previous session.
    addEventListener("keydown", onKey, true);
    return () => removeEventListener("keydown", onKey, true);
  }, []);
  useEffect(() => {
    if (!cursor) return;
    document
      .querySelector(`[data-key="${CSS.escape(cursor)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const summary =
    projects.length === 0
      ? me
        ? copy.queue.noProjects
        : copy.loading
      : !loaded
        ? copy.queue.looking
        : pending.length === 0 && targets.length > 0
          ? copy.queue.joining
          : null;
  const oldest = shown[0];
  const firstGate = gates[0]?.quorum ?? null;

  if (phone)
    return (
      <Shell
        ctx={ctx}
        title={copy.queue.title}
        subtitle={
          loaded
            ? approvalsSubtitle(counts["needs-you"], pending.length, projectNames)
            : copy.queue.looking
        }
      >
        <div className="column page queuepage onphone">
          {error && <p className="small danger">{error}</p>}
          <ErrorLine errors={errors} />
          {shown.length > 0 ? (
            <div className="grows">
              {shown.map((r) => (
                <QueueCard
                  key={r.key}
                  r={r}
                  pick={picks[r.key] ?? null}
                  open={openKey === r.key}
                  onOpen={() => setOpenKey(r.key)}
                  onVote={(v, rating, override, note) => vote(r, v, rating, override, note)}
                  onNudge={() => nudge(r)}
                />
              ))}
            </div>
          ) : loaded && pending.length === 0 && targets.length === 0 && projects.length > 0 ? (
            <EmptyState
              spot="gate"
              title={copy.approvalsPage.emptyTitle}
              text={copy.approvalsPage.emptyLine}
              action={{ label: copy.approvalsPage.reviewRules, href: paths.settings() }}
            />
          ) : (
            <p className="muted quietline">{summary ?? copy.queue.nothing}</p>
          )}
          {done.length > 0 && (
            <div className="group">
              <div className="gh">
                <span className="serif">{copy.queue.done}</span>
                <span className="n mono">{done.length}</span>
              </div>
              <div className="qlist quiet">
                {done.map((r) => (
                  <DoneRow key={r.key} r={r} />
                ))}
              </div>
            </div>
          )}
          <ThumbFilters filters={FILTERS} active={effective} counts={counts} onPick={setFilter} />
        </div>
        {openRow && (
          <GateSheet
            r={openRow}
            pick={picks[openRow.key] ?? null}
            onPick={(n) => setPicks((p) => ({ ...p, [openRow.key]: n }))}
            onVote={(v, rating, override, note) => vote(openRow, v, rating, override, note)}
            onClose={() => setOpenKey(null)}
          />
        )}
      </Shell>
    );

  return (
    <Shell
      ctx={ctx}
      title={
        <>
          {copy.queue.title}
          {pending.length > 0 && <span className="count">{pending.length}</span>}
        </>
      }
      right={
        <>
          <span className="keyhints">
            <kbd>j</kbd>
            <kbd>k</kbd> move <kbd>a</kbd> approve <kbd>d</kbd> deny <kbd>↵</kbd> open
          </span>
          <button type="button" className="btn sm" onClick={() => navigate(paths.search())}>
            <Icon d={ICONS.search} size={14} />
            <span className="lbl">{copy.search.title}</span>
          </button>
        </>
      }
    >
      <div className="column page wide queuepage">
        <div className="lead">
          <h1>{copy.queue.title}</h1>
          <p className="muted">
            {summary ?? (
              <>
                {lede.sentence} {lede.emphasis && <i className="serif">{lede.emphasis}</i>}
                {lede.rest && ` ${lede.rest}`}
              </>
            )}
          </p>
          {error && <p className="small danger">{error}</p>}
          <ErrorLine errors={errors} />
        </div>

        <section className="queue">
          <div className="filters" role="tablist" aria-label="Filter">
            {FILTERS.map((f) => (
              <button
                type="button"
                key={f}
                role="tab"
                aria-selected={effective === f}
                className={`chip f-${f}${effective === f ? " on" : ""}`}
                onClick={() => setFilter(f)}
              >
                <i />
                {copy.queue.filters[f]}
                <span className="n mono">{counts[f]}</span>
              </button>
            ))}
            <span className="sort">
              {copy.queue.oldestFirst}
              <Icon d={ICONS.down} size={13} />
            </span>
          </div>

          <div className="group">
            <div className="gh">
              <span className="serif">{copy.queue.waiting}</span>
              <span className="n mono">{shown.length}</span>
              <span className="sub">{copy.queue.foldsHint}</span>
              {oldest && (
                <a className="right" href={paths.session(oldest.projectId, oldest.sessionId)}>
                  {copy.queue.openOldest}
                </a>
              )}
            </div>
            {shown.length > 0 ? (
              <div className="qlist">
                {shown.map((r) => (
                  <QueueRowItem
                    key={r.key}
                    r={r}
                    cursor={r.key === cursor}
                    armed={armed === r.key}
                    pick={picks[r.key] ?? null}
                    onPick={(n) => setPicks((p) => ({ ...p, [r.key]: n }))}
                    onFocus={() => setCursorKey(r.key)}
                    onVote={(v, rating, override) => vote(r, v, rating, override)}
                    onNudge={() => nudge(r)}
                  />
                ))}
              </div>
            ) : loaded && pending.length === 0 && targets.length === 0 && projects.length > 0 ? (
              <EmptyState
                spot="gate"
                title={copy.approvalsPage.emptyTitle}
                text={copy.approvalsPage.emptyLine}
                action={{ label: copy.approvalsPage.reviewRules, href: paths.settings() }}
                ghost={
                  <>
                    <span>
                      <span className="serif">{copy.approvalsPage.ghostTitle}</span>
                      <span className="s">{copy.approvalsPage.ghostLine}</span>
                    </span>
                    <span className="mono">{copy.approvalsPage.ghostRatings}</span>
                  </>
                }
              />
            ) : (
              <p className="muted quietline">{summary ?? copy.queue.nothing}</p>
            )}
            {shown.length > 0 && (
              <p className="foot">
                <kbd>j</kbd>
                <kbd>k</kbd> move · <kbd>a</kbd> approves ({DEFAULT_RATING} of 5 under a release
                gate; {copy.queue.twiceIrreversible}) · <kbd>d</kbd> denies · <kbd>↵</kbd> opens ·{" "}
                {copy.queue.neverWhileTyping}
              </p>
            )}
          </div>

          {done.length > 0 && (
            <div className="group">
              <div className="gh">
                <span className="serif">{copy.queue.done}</span>
                <span className="n mono">{done.length}</span>
              </div>
              <div className="qlist quiet">
                {done.map((r) => (
                  <DoneRow key={r.key} r={r} />
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="aside">
          <div className="card">
            <h3>{copy.queue.atAGlance}</h3>
            <div className="glance">
              <div className="g">
                <i className="warn" />
                <span>
                  {copy.queue.needYou}
                  <span className="sub">{copy.queue.needYouSub}</span>
                </span>
                <span className="n mono">{glance.needYou}</span>
              </div>
              <div className="g">
                <i className="pulse" />
                <span>
                  {copy.queue.voteIn}
                  <span className="sub">{copy.queue.voteInSub}</span>
                </span>
                <span className="n mono">{glance.voteIn}</span>
              </div>
              <div className="g">
                <i className="idle" />
                <span>
                  {copy.queue.theirs}
                  <span className="sub">{copy.queue.theirsSub}</span>
                </span>
                <span className="n mono">{glance.theirs}</span>
              </div>
            </div>
          </div>
          {gates.length > 0 && (
            <div className="card">
              <h3>{copy.queue.gates}</h3>
              <div className="gates">
                {gates.map((r) => (
                  <div className="gate" key={r.key}>
                    <div className="l">
                      <span className="serif">{r.sessionTitle}</span>
                      <span className="muted ellipsis">{r.code ?? r.action}</span>
                      <span className="n mono">
                        {r.quorum?.count} of {r.quorum?.min}
                      </span>
                    </div>
                    <Meter quorum={r.quorum} />
                  </div>
                ))}
                {firstGate && (
                  <p>{copy.queue.gatesRule(firstGate.min, firstGate.bar, DEFAULT_RATING)}</p>
                )}
              </div>
            </div>
          )}
          <div className="card">
            <h3>{copy.queue.keys}</h3>
            <div className="keys">
              <span>
                <kbd>j</kbd>
                <kbd>k</kbd>
              </span>
              <span>{copy.queue.keyMove}</span>
              <span>
                <kbd>a</kbd>
                <kbd>d</kbd>
              </span>
              <span>{copy.queue.keyDecide}</span>
              <span>
                <kbd>1</kbd>–<kbd>5</kbd>
              </span>
              <span>{copy.queue.keyRate}</span>
              <span>
                <kbd>↵</kbd>
              </span>
              <span>{copy.queue.keyOpen}</span>
            </div>
          </div>
        </aside>
      </div>
    </Shell>
  );
}

function QueueRowItem({
  r,
  cursor,
  armed,
  pick,
  onPick,
  onFocus,
  onVote,
  onNudge,
}: {
  r: QueueRow;
  cursor: boolean;
  armed: boolean;
  pick: number | null;
  onPick: (n: number) => void;
  onFocus: () => void;
  onVote: (v: "approve" | "deny", rating: number | null, override?: boolean) => void;
  onNudge: () => void;
}) {
  const state = rowState(r);
  const rating = state === "voted" ? r.myRating : pick;
  const word = ratingWord(rating);
  const voted = r.votes
    .filter((v) => v.vote === "approve")
    .map((v) => (v.rating ? `${v.who} approved with ${v.rating}` : `${v.who} approved`));
  const denied = r.votes.filter((v) => v.vote === "deny").map((v) => `${v.who} denied`);
  const votesLine = [...voted, ...denied];
  const ownerInitials = initials(r.ownerName ?? r.agentName);
  const waits = copy.queue.waitsFor(r.waitsFor.role, r.waitsFor.who);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the row only moves the keyboard cursor; its buttons and link are the controls
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handling lives on the window (j/k/a/d)
    <div
      className={`qrow s-${state}${r.ratings ? " gated" : ""}${cursor ? " cursor" : ""}${armed ? " armed" : ""}`}
      data-key={r.key}
      aria-current={cursor ? "true" : undefined}
      onClick={onFocus}
    >
      <span className="cur" aria-hidden="true">
        <Icon d={ICONS.chevron} size={12} />
      </span>
      <span className={`avatar agent${state === "driver-only" ? " wait" : ""}`} aria-hidden="true">
        {ownerInitials}
      </span>
      <div className="body">
        <div className="t">
          <span className="who">{r.agentName}</span> {copy.queue.in}{" "}
          <a className="sess" href={paths.session(r.projectId, r.sessionId)}>
            {r.sessionTitle}
          </a>{" "}
          {copy.queue.wantsTo}{" "}
          {askParts(r.action).map((p, i) =>
            p.code ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: the parts are positional
              <code key={i}>{p.code}</code>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: the parts are positional
              <span key={i}>{p.text}</span>
            ),
          )}
          .
        </div>
        <div className="s">
          <span className="proj">{r.projectName}</span>
          <span className="sep">·</span>
          {r.ratings && <span className="pill gate sm">{copy.queue.gatePill}</span>}
          <span className={`pill risk ${r.risk} sm`}>{r.risk}</span>
          <span className="sep">·</span>
          {votesLine.length ? (
            votesLine.map((v, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the votes are positional
              <span key={i} className={v.startsWith("you ") ? "you" : ""}>
                {v}
                {i < votesLine.length - 1 && <span className="sep">·</span>}
              </span>
            ))
          ) : (
            <span>{copy.queue.noVotes}</span>
          )}
          <span className="sep">·</span>
          <span className="ago mono">{copy.queue.turn(r.turn)}</span>
        </div>
        {r.quorum && (
          <div className="qm">
            <Meter quorum={r.quorum} />
            <span className="n mono">
              {copy.queue.quorum(r.quorum.count, r.quorum.min, r.quorum.bar, r.quorum.average)}
            </span>
            <span className="note">
              ·{" "}
              {r.quorum.low
                ? copy.queue.voiceNotVote
                : state === "voted"
                  ? copy.queue.waitsOnOthers
                  : copy.queue.waitsOneMore}
            </span>
          </div>
        )}
      </div>
      <div className="ctl">
        <div className="line">
          <span className={`needs${state === "voted" || state === "driver-only" ? " other" : ""}`}>
            {state === "voted"
              ? copy.queue.waitsOnOthers
              : state === "driver-only"
                ? waits
                : r.needs}
          </span>
          {r.ratings && state !== "driver-only" && (
            <span className={`rate${state === "voted" ? " locked" : ""}`}>
              <Stars
                value={rating}
                onChange={onPick}
                onClear={() => onPick(0)}
                size="sm"
                tick
                word={false}
                readonly={state === "voted"}
                label="Your rating"
              />
              <span className={`word ${word.tone}`}>
                {state === "voted" && <Icon d={ICONS.check} size={13} className="tick" />}
                {word.word}
              </span>
            </span>
          )}
        </div>
        <div className="line acts">
          {armed ? (
            <span className="hint live">
              <kbd className="live">a</kbd> {copy.queue.againApproves} · <kbd>esc</kbd>{" "}
              {copy.queue.escLeaves}
            </span>
          ) : state === "voted" ? (
            <span className="hint">{copy.queue.yourVoteIn}</span>
          ) : state === "driver-only" ? (
            r.override && (
              <span className="hint">{copy.queue.overrideHint(r.override.requires)}</span>
            )
          ) : r.ratings ? (
            <span className="hint">
              <kbd className={cursor ? "live" : ""}>a</kbd>{" "}
              {copy.queue.sends(rating ?? DEFAULT_RATING)}
            </span>
          ) : (
            <span className="hint">
              <kbd className={cursor ? "live" : ""}>a</kbd> <kbd>d</kbd>
            </span>
          )}
          {state === "voted" ? (
            <>
              <button type="button" className="btn sm" disabled>
                {r.myVote === "approve" ? copy.queue.approved : copy.queue.denied}
              </button>
              {r.myVote === "approve" && (
                <button
                  type="button"
                  className="btn sm danger"
                  onClick={() => onVote("deny", null)}
                >
                  {copy.queue.changeToDeny}
                </button>
              )}
            </>
          ) : state === "driver-only" ? (
            <>
              {r.override && (
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => onVote("approve", rating, true)}
                >
                  {copy.queue.approveFor(r.waitsFor.who)}
                </button>
              )}
              <button type="button" className="btn sm ghost" onClick={onNudge}>
                {copy.queue.nudge(r.waitsFor.who ?? `the ${r.waitsFor.role}`)}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn primary sm"
                onClick={() => onVote("approve", rating)}
              >
                {r.ratings ? copy.queue.approveWith(rating ?? DEFAULT_RATING) : copy.queue.approve}
              </button>
              <button
                type="button"
                className="btn ghost danger sm"
                onClick={() => onVote("deny", null)}
              >
                {copy.queue.deny}
              </button>
              {r.override && (
                <button
                  type="button"
                  className="btn sm ghost"
                  title={copy.queue.overrideHint(r.override.requires)}
                  onClick={() => onVote("approve", rating, true)}
                >
                  {copy.queue.decideAsOwner}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** A decided row, folded to one quiet line with the result coloured. */
function DoneRow({ r }: { r: QueueRow }) {
  const ok = r.status === "granted";
  const by = r.votes
    .filter((v) => v.vote === (ok ? "approve" : "deny"))
    .map((v) => (v.override ? `${v.who} as owner` : v.rating ? `${v.who} · ${v.rating}` : v.who));
  return (
    <div className="drow folding" data-key={r.key}>
      <span className={`ico ${ok ? "ok" : "no"}`} aria-hidden="true">
        <Icon d={ok ? ICONS.check : ICONS.close} size={12} />
      </span>
      <span className="txt">
        <b>{ok ? copy.queue.approved : copy.queue.denied}</b> {r.action.replace(/`/g, "")} in{" "}
        <a className="sess" href={paths.session(r.projectId, r.sessionId)}>
          {r.sessionTitle}
        </a>
        {by.length > 0 && <span className="by"> · {by.join(", ")}</span>}
      </span>
      <span className="end">
        <span className={`res ${ok ? "ok" : "no"}`}>
          {ok ? copy.queue.approved : copy.queue.denied}
        </span>
        <span className="ago mono">{copy.queue.turn(r.turn)}</span>
      </span>
    </div>
  );
}
