/**
 * The inbox (#/inbox): a list of sentences ordered by consequence. Needs you first (something
 * stops until you act), then Mentions, then Done folded quiet. One row shape: a stripe by kind,
 * the serif sentence, the rule or the quote, the meta line, and at the right exactly what you
 * can press now; pressing it is the whole act (Joining… → the outcome word → read).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Shell, type ShellContext } from "../App.js";
import type { Me, Notification } from "../api.js";
import { DEFAULT_RATING, moveCursor } from "../approvalsQueue.js";
import { copy } from "../copy.js";
import { EmptyState } from "../empty.js";
import type { Identity } from "../identity.js";
import {
  acceptFromInbox,
  ageOf,
  bodyOf,
  declineFromInbox,
  filterCounts,
  groupOf,
  INBOX_FILTERS,
  type InboxFilter,
  type InboxGroup,
  isDecision,
  kindOf,
  ledeOf,
  linkOf,
  markRead,
  matchesFilter,
  sentenceOf,
  standOf,
  useInbox,
  voteFromInbox,
} from "../inbox.js";
import { Sentence } from "../notify.js";
import { navigate, paths } from "../router.js";
import { isTyping, type TargetLike } from "../shortcuts.js";
import { Avatar, ICONS, Icon, Loader, Stars } from "../ui.js";

interface Outcome {
  busy: boolean;
  word: string | null;
  error: string | null;
}

const GROUPS: { id: InboxGroup; title: string; why: string }[] = [
  { id: "needs-you", title: copy.inbox.needsYou, why: copy.inbox.needsYouWhy },
  { id: "mentions", title: copy.inbox.mentions, why: "" },
  { id: "done", title: copy.inbox.done, why: copy.inbox.doneWhy },
];

export function Inbox({
  identity,
  me,
  ctx,
}: {
  identity: Identity;
  me: Me | null;
  ctx: ShellContext;
}) {
  const inbox = useInbox(identity.userId);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [filter, setFilter] = useState<InboxFilter | null>(null);
  const [scope, setScope] = useState<"unread" | "all">("unread");
  const [cursorId, setCursorId] = useState<string | null>(null);
  const acted = useCallback((n: Notification) => Boolean(outcomes[n.id]?.word), [outcomes]);
  const items = inbox.items;
  const visible = useMemo(
    () => (scope === "all" ? items : items.filter((n) => !n.read || outcomes[n.id])),
    [items, scope, outcomes],
  );
  const counts = useMemo(() => filterCounts(items, acted), [items, acted]);
  const groups = useMemo<{ id: string; title: string; why: string; rows: Notification[] }[]>(
    () =>
      filter
        ? [
            {
              id: filter,
              title: copy.inbox.filters[filter] ?? filter,
              why: "",
              rows: visible.filter((n) => matchesFilter(n, filter, acted(n))),
            },
          ]
        : GROUPS.map((g) => ({
            ...g,
            rows: visible.filter((n) => groupOf(n, acted(n)) === g.id),
          })).filter((g) => g.rows.length > 0),
    [visible, filter, acted],
  );
  const keys = groups.flatMap((g) => g.rows.map((n) => n.id));
  const cursor = cursorId && keys.includes(cursorId) ? cursorId : (keys[0] ?? null);
  const nameOf = (projectId: string) =>
    me?.projects.find((p) => p.projectId === projectId)?.name ?? projectId;

  const act = (n: Notification, run: () => Promise<string>) => {
    setOutcomes((o) => ({ ...o, [n.id]: { busy: true, word: null, error: null } }));
    run()
      .then((word) => {
        setOutcomes((o) => ({ ...o, [n.id]: { busy: false, word, error: null } }));
        markRead([n.id]);
        dispatchEvent(new Event("henosis:inbox"));
        dispatchEvent(new Event("henosis:fleet"));
      })
      .catch((e: unknown) =>
        setOutcomes((o) => ({
          ...o,
          [n.id]: { busy: false, word: null, error: e instanceof Error ? e.message : String(e) },
        })),
      );
  };
  const approve = (n: Notification, rating: number | null) =>
    act(n, () =>
      voteFromInbox(identity, n, "approve", n.ratings ? (rating ?? DEFAULT_RATING) : null),
    );
  const deny = (n: Notification) => act(n, () => voteFromInbox(identity, n, "deny"));
  const accept = (n: Notification) => act(n, () => acceptFromInbox(identity, n));
  const decline = (n: Notification) => act(n, () => declineFromInbox(identity, n));
  const open = (n: Notification) => {
    markRead([n.id]);
    const href = n.route ?? linkOf(n.link).href;
    if (href) navigate(href);
  };

  // j/k move, a/d decide, e marks read, Enter or o opens. Never while typing somewhere.
  const latest = useRef({ keys, cursor, visible, outcomes, approve, deny, accept, decline, open });
  latest.current = { keys, cursor, visible, outcomes, approve, deny, accept, decline, open };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target as TargetLike | null)) return;
      const { keys, cursor, visible, outcomes, approve, deny, accept, decline, open } =
        latest.current;
      const row = visible.find((n) => n.id === cursor) ?? null;
      const live = row && !row.read && !outcomes[row.id] && row.ref;
      switch (e.key) {
        case "j":
        case "ArrowDown":
          setCursorId(moveCursor(keys, cursor, 1));
          break;
        case "k":
        case "ArrowUp":
          setCursorId(moveCursor(keys, cursor, -1));
          break;
        case "a":
          if (!row || !live) return;
          if (row.kind === "approval") approve(row, null);
          else if (row.kind === "handoff") accept(row);
          else return;
          break;
        case "d":
          if (!row || !live) return;
          if (row.kind === "approval") deny(row);
          else if (row.kind === "handoff") decline(row);
          else return;
          break;
        case "e":
          if (row) markRead([row.id]);
          break;
        case "Enter":
        case "o":
          if (row) open(row);
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

  const lede = ledeOf(items);
  const stand = standOf(items, acted);
  const busy = Object.values(outcomes).some((o) => o.busy);
  return (
    <Shell
      ctx={ctx}
      title={
        <>
          {copy.inbox.title}
          {inbox.unread > 0 && <span className="count">{inbox.unread}</span>}
        </>
      }
      busy={busy ? copy.wait.sendingVote : false}
      right={
        <>
          <span className="keyhints">
            <kbd>j</kbd>
            <kbd>k</kbd> move <kbd>a</kbd> approve <kbd>e</kbd> done
          </span>
          {inbox.unreadAll > 0 && (
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => markRead(items.map((n) => n.id))}
            >
              {copy.inbox.markAllRead}
            </button>
          )}
          <button type="button" className="btn sm" onClick={() => navigate(paths.search())}>
            <Icon d={ICONS.search} size={14} />
            <span className="lbl">{copy.search.title}</span>
          </button>
        </>
      }
    >
      <div className="column page wide inboxpage">
        <div className="lead">
          <h1>{copy.inbox.title}</h1>
          <p className="muted">
            {!inbox.loaded && !inbox.error ? (
              copy.loading
            ) : (
              <>
                {lede.lead} {lede.emphasis && <i className="serif">{lede.emphasis}</i>}
                {lede.rest}
              </>
            )}
          </p>
          {inbox.error && <p className="small danger">{inbox.error}</p>}
        </div>
        <div className="filters" role="tablist" aria-label="Filter">
          {INBOX_FILTERS.map((f) => (
            <button
              type="button"
              key={f}
              role="tab"
              aria-selected={filter === f}
              className={`chip k-${f}${filter === f ? " on" : ""}`}
              onClick={() => setFilter(filter === f ? null : f)}
            >
              <i />
              {copy.inbox.filters[f]}
              <span className="n mono">{counts[f]}</span>
            </button>
          ))}
          <span className="seg right">
            <button
              type="button"
              className={scope === "unread" ? "on" : ""}
              aria-pressed={scope === "unread"}
              onClick={() => setScope("unread")}
            >
              {copy.inbox.unread}
            </button>
            <button
              type="button"
              className={scope === "all" ? "on" : ""}
              aria-pressed={scope === "all"}
              onClick={() => setScope("all")}
            >
              {copy.inbox.all}
            </button>
          </span>
        </div>
        <div className="groups">
          {!inbox.loaded && !inbox.error && (
            <Loader kind="shimmer" label={copy.wait.inbox} rows={3} title />
          )}
          {inbox.loaded && items.length === 0 && (
            <EmptyState
              spot="inbox"
              title={copy.inboxPage.emptyTitle}
              text={copy.inboxPage.emptyLine}
            />
          )}
          {inbox.loaded && groups.length === 0 && items.length > 0 && (
            <p className="muted quietline">{copy.inbox.nothingNew}</p>
          )}
          {groups.map((g) => (
            <section className={`group ${g.id}`} key={g.id}>
              <header>
                <h2>{g.title}</h2>
                <span className="n mono">{g.rows.length}</span>
                {g.why && <span className="why">{g.why}</span>}
                {g.id === "needs-you" && (
                  <a className="right" href={paths.approvals()}>
                    {copy.inbox.approvalsQueue}
                  </a>
                )}
              </header>
              <div className="list">
                {g.rows.map((n) => (
                  <InboxRow
                    key={n.id}
                    n={n}
                    where={rowWhere(n, nameOf)}
                    outcome={outcomes[n.id]}
                    cursor={n.id === cursor}
                    done={g.id === "done"}
                    onFocus={() => setCursorId(n.id)}
                    onOpen={() => open(n)}
                    onApprove={(r) => approve(n, r)}
                    onDeny={() => deny(n)}
                    onAccept={() => accept(n)}
                    onDecline={() => decline(n)}
                    onRead={() => markRead([n.id])}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
        <aside className="aside">
          <div className="card">
            <h3>{copy.inbox.whereThingsStand}</h3>
            <div className="stand">
              <StandRow
                tone="warn"
                title={copy.inbox.waitingOnYou}
                sub={copy.inbox.waitingOnYouSub}
                n={stand.onYou}
              />
              <StandRow
                tone="pulse"
                title={copy.inbox.waitingOnOthers}
                sub={copy.inbox.waitingOnOthersSub}
                n={stand.onOthers}
              />
              <StandRow
                tone="idle"
                title={copy.inbox.moving}
                sub={copy.inbox.movingSub}
                n={stand.moving}
              />
            </div>
          </div>
          <div className="card">
            <h3>{copy.inbox.keys}</h3>
            <div className="keys">
              <span>
                <kbd>j</kbd>
                <kbd>k</kbd>
              </span>
              <span>{copy.inbox.keyMove}</span>
              <span>
                <kbd>a</kbd>
                <kbd>d</kbd>
              </span>
              <span>{copy.inbox.keyApprove}</span>
              <span>
                <kbd>e</kbd>
              </span>
              <span>{copy.inbox.keyDone}</span>
              <span>
                <kbd>o</kbd>
              </span>
              <span>{copy.inbox.keyOpen}</span>
            </div>
          </div>
        </aside>
      </div>
    </Shell>
  );
}

function StandRow({
  tone,
  title,
  sub,
  n,
}: {
  tone: "warn" | "pulse" | "idle";
  title: string;
  sub: string;
  n: number;
}) {
  return (
    <div className="r">
      <i className={tone} />
      <span>
        {title}
        <span className="s">{sub}</span>
      </span>
      <span className="mono">{n}</span>
    </div>
  );
}

/** The meta line's first word: the project, the session or the group the item is about. */
function rowWhere(n: Notification, nameOf: (projectId: string) => string): string {
  const { where } = bodyOf(n);
  if (n.kind === "mention" || n.kind === "search") return sentenceOf(n).what;
  if (where) return where;
  const { projectId } = linkOf(n.link);
  return projectId ? nameOf(projectId) : "";
}

const KIND_PILL: Partial<Record<string, string>> = {
  gate: "release gate",
  approval: "approval",
  plan: "plan",
  handoff: "baton",
  contention: "contention",
  blocked: "blocked",
  mention: "mention",
  search: "saved search",
  done: "done",
  joined: "joined",
};

function InboxRow({
  n,
  where,
  outcome,
  cursor,
  done,
  onFocus,
  onOpen,
  onApprove,
  onDeny,
  onAccept,
  onDecline,
  onRead,
}: {
  n: Notification;
  where: string;
  outcome: Outcome | undefined;
  cursor: boolean;
  done: boolean;
  onFocus: () => void;
  onOpen: () => void;
  onApprove: (rating: number | null) => void;
  onDeny: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onRead: () => void;
}) {
  // A release gate: the stars sit beside Approve; the approve carries the pick.
  const [rating, setRating] = useState<number | null>(null);
  const kind = kindOf(n);
  const { who, verb, what } = sentenceOf(n);
  const { forYou } = bodyOf(n);
  const { sessionId } = linkOf(n.link);
  const actionable = Boolean(n.ref && sessionId) && !n.read && !outcome;
  const quote = n.kind === "mention" || n.kind === "search";
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the row only moves the keyboard cursor; its buttons and link are the controls
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handling lives on the window (j/k/a/d/e/o)
    <div
      className={`ibrow k-${kind}${n.read ? " read" : ""}${cursor ? " cursor" : ""}${done ? " folded" : ""}`}
      data-key={n.id}
      aria-current={cursor ? "true" : undefined}
      onClick={onFocus}
    >
      <span className="ico">
        {kind === "mention" || kind === "handoff" || kind === "joined" || kind === "search" ? (
          <Avatar id={who} name={who || "?"} />
        ) : (
          <Icon
            d={
              kind === "blocked"
                ? ICONS.close
                : kind === "contention"
                  ? ICONS.branch
                  : kind === "plan"
                    ? ICONS.file
                    : ICONS.check
            }
            size={16}
          />
        )}
      </span>
      <div className="body">
        <div className="t">
          {!n.read && <span className="new" role="img" aria-label="unread" />}
          <a
            href={n.route ?? linkOf(n.link).href ?? paths.inbox()}
            onClick={(e) => {
              e.preventDefault();
              onOpen();
            }}
          >
            <Sentence who={who} verb={verb} what={what} code={n.code} />
          </a>
        </div>
        {!done && (
          <div className="s">
            {quote ? <q>{n.body}</q> : forYou ? <span>{forYou}</span> : n.body}
          </div>
        )}
        <div className="m">
          {where && <span className="serif">{where}</span>}
          {where && <span className="sep" />}
          <span className={`tag k-${kind}`}>{KIND_PILL[kind] ?? kind}</span>
          <span className="sep" />
          <time className="mono" dateTime={new Date(n.at).toISOString()}>
            {ageOf(n.at)}
          </time>
        </div>
      </div>
      <div className="act">
        {outcome?.busy && (
          <span className="outcome">
            <Loader kind="orbit" label={copy.inbox.joining} />
            {copy.inbox.joining}
          </span>
        )}
        {outcome?.word && (
          <span className="outcome ok">
            <Icon d={ICONS.check} size={14} />
            {outcome.word}
          </span>
        )}
        {outcome?.error && (
          <>
            <span className="outcome err">{outcome.error}</span>
            <button type="button" className="btn sm" onClick={onOpen}>
              {copy.inbox.open}
            </button>
          </>
        )}
        {actionable && n.kind === "approval" && (
          <>
            {n.ratings && (
              <Stars
                value={rating}
                onChange={setRating}
                onClear={() => setRating(null)}
                size="sm"
                tick
                word={false}
              />
            )}
            <button type="button" className="btn primary sm" onClick={() => onApprove(rating)}>
              {n.ratings ? copy.queue.approveWith(rating ?? DEFAULT_RATING) : copy.inbox.approve}
            </button>
            <button type="button" className="btn sm danger" onClick={onDeny}>
              {copy.inbox.deny}
            </button>
          </>
        )}
        {actionable && n.kind === "handoff" && (
          <>
            <button type="button" className="btn primary sm" onClick={onAccept}>
              {copy.inbox.accept}
            </button>
            <button type="button" className="btn sm" onClick={onDecline}>
              {copy.inbox.notNow}
            </button>
          </>
        )}
        {!outcome && !n.read && n.kind === "plan" && (
          <button type="button" className="btn primary sm" onClick={onOpen}>
            {copy.inbox.rate}
          </button>
        )}
        {!outcome && !n.read && (n.kind === "mention" || n.kind === "search") && (
          <button type="button" className="btn primary sm" onClick={onOpen}>
            {copy.inbox.openGroup(what)}
          </button>
        )}
        {!outcome &&
          !n.read &&
          (n.kind === "contention" || n.kind === "blocked" || n.kind === "done") && (
            <button type="button" className="btn sm" onClick={onOpen}>
              {copy.inbox.open}
            </button>
          )}
        {!outcome && !n.read && !isDecision(n) && (
          <button
            type="button"
            className="btn ghost sm icon"
            aria-label={copy.inbox.markRead}
            title={copy.inbox.markRead}
            onClick={onRead}
          >
            <Icon d={ICONS.check} size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
