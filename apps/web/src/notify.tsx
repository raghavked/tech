/**
 * The second and third distances of a notification: the typed toast in the corner of the
 * window (`<TypedToasts />`, fed by the inbox poll through toast.ts), and the browser or
 * desktop banner while the window is hidden (`notifyIfHidden`, every call guarded:
 * unsupported browsers and denied permission are no-ops). In the desktop shell banners are
 * native: webviews have no Notification API, so the shell shows them (apps/desktop) and
 * the OS holds the permission.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import { DEFAULT_RATING } from "./approvalsQueue.js";
import { copy } from "./copy.js";
import { useIdentity } from "./identity.js";
import { acceptFromInbox, markRead, voteFromInbox } from "./inbox.js";
import { type NotifyKind, wantsNotify } from "./prefs.js";
import { navigate, paths } from "./router.js";
import { desktop } from "./shell.js";
import { isTyping, type TargetLike } from "./shortcuts.js";
import {
  decisionNotice,
  dismissNotice,
  getNotices,
  isPaused,
  type Notice,
  pauseNotice,
  resumeNotice,
  setNoticeOutcome,
  shownNotices,
  subscribeNotices,
} from "./toast.js";
import { Avatar, ICONS, Icon, Loader, Mark } from "./ui.js";

export type NotifyPermission = NotificationPermission | "unsupported";

export function notifyPermission(): NotifyPermission {
  try {
    if (desktop()) return "granted";
    return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  } catch {
    return "unsupported";
  }
}

export async function requestNotifications(): Promise<NotifyPermission> {
  try {
    if (desktop()) return "granted";
    if (typeof Notification === "undefined") return "unsupported";
    return await Notification.requestPermission();
  } catch {
    return "unsupported";
  }
}

/**
 * Show a notification only when the tab is hidden and permission was granted. A `kind` lets
 * the person turn that kind off on the Settings page (settings-page). In the desktop shell:
 * only when the window is not focused, as a native notification. The shell's own inbox poll
 * covers approvals and handoffs in every other session, so nothing is missed or shown twice.
 * The `tag` is the notification's: a repeat with the same tag replaces the banner.
 */
export function notifyIfHidden(title: string, body: string, tag?: string, kind?: NotifyKind): void {
  try {
    if (kind && !wantsNotify(kind)) return;
    const d = desktop();
    if (d) {
      if (typeof document !== "undefined" && document.hasFocus()) return;
      d.notify({ title, body, ...(tag ? { tag } : {}) }).catch(() => undefined);
      return;
    }
    if (typeof document === "undefined" || !document.hidden) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const n = new Notification(title, { body, icon: "/favicon.svg", ...(tag ? { tag } : {}) });
    n.onclick = () => {
      try {
        window.focus();
        n.close();
      } catch {
        // ignore
      }
    };
  } catch {
    // Notification constructors throw on some mobile browsers; nothing to do.
  }
}

// ---- the typed toasts -------------------------------------------------------------------------

type Identity = NonNullable<ReturnType<typeof useIdentity>>;

/** What pressing the toast does; the outcome word comes back onto the card. */
function act(n: Notice, run: () => Promise<string>): void {
  setNoticeOutcome(n.id, { busy: true });
  run()
    .then((word) => {
      setNoticeOutcome(n.id, { word });
      markRead([n.id]);
      dispatchEvent(new Event("henosis:inbox"));
      dispatchEvent(new Event("henosis:fleet"));
      setTimeout(() => dismissNotice(n.id), 2400);
    })
    .catch((e: unknown) =>
      setNoticeOutcome(n.id, { error: e instanceof Error ? e.message : String(e) }),
    );
}

function open(n: Notice): void {
  markRead([n.id]);
  dismissNotice(n.id);
  navigate(n.route);
}

/** Approve from a toast: under a ratings rule it opens the notice, never approves blind. */
function approve(n: Notice, identity: Identity): void {
  if (n.ratings || n.kind === "plan") {
    open(n);
    return;
  }
  act(n, () => voteFromInbox(identity, { link: linkFor(n), ref: n.ref }, "approve", null));
}

function deny(n: Notice, identity: Identity): void {
  act(n, () => voteFromInbox(identity, { link: linkFor(n), ref: n.ref }, "deny"));
}

function accept(n: Notice, identity: Identity): void {
  act(n, () => acceptFromInbox(identity, { link: linkFor(n), ref: n.ref }));
}

function linkFor(n: Notice): string {
  return n.projectId && n.sessionId ? `henosis://p/${n.projectId}/s/${n.sessionId}` : "";
}

/**
 * The stack above the composer: three show, newest nearest the corner, the rest fold into a
 * navy tail. `y` / `n` answer the newest decision, `esc` dismisses the newest toast (before
 * the palette sees it), `g` then `i` opens the inbox.
 */
export function TypedToasts() {
  const all = useSyncExternalStore(subscribeNotices, getNotices, getNotices);
  const identity = useIdentity();
  const { shown, tail } = shownNotices(all);
  const latest = useRef({ all, shown, identity });
  latest.current = { all, shown, identity };
  const chord = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { all, shown, identity } = latest.current;
      if (shown.length === 0) return;
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target as TargetLike | null)) return;
      if (e.key === "Escape") {
        // A modal sheet closes first; then the newest toast, then the palette, then the composer.
        if (document.querySelector(".sheet-wrap")) return;
        const newest = shown[shown.length - 1];
        if (!newest) return;
        dismissNotice(newest.id);
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (e.key === "g") {
        if (chord.current) clearTimeout(chord.current);
        chord.current = setTimeout(() => {
          chord.current = null;
        }, 800);
        return;
      }
      if (e.key === "i" && chord.current) {
        clearTimeout(chord.current);
        chord.current = null;
        navigate(paths.inbox());
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (e.key !== "y" && e.key !== "n") return;
      const d = decisionNotice(all);
      if (!d || !identity) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (d.kind === "handoff") {
        if (e.key === "y") accept(d, identity);
        else open(d);
      } else if (d.kind === "approval" || d.kind === "gate" || d.kind === "plan") {
        if (e.key === "y") approve(d, identity);
        else deny(d, identity);
      } else open(d);
    };
    addEventListener("keydown", onKey, true);
    return () => removeEventListener("keydown", onKey, true);
  }, []);
  if (shown.length === 0) return null;
  return (
    <div className="ntoasts" role="status" aria-live="polite">
      {tail > 0 && (
        <button type="button" className="ntail" onClick={() => navigate(paths.inbox())}>
          <b>{copy.toast.tail(tail)}</b>
          <span className="go">
            {copy.toast.openInbox} <kbd>g</kbd>
            <kbd>i</kbd>
          </span>
        </button>
      )}
      {shown.map((n) => (
        <ToastCard key={n.id} n={n} identity={identity} />
      ))}
    </div>
  );
}

function initialsOf(who: string): string {
  return who
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ToastIcon({ n }: { n: Notice }) {
  if (n.kind === "joined")
    return (
      <span className="ico mark-wrap">
        <Mark size={28} settle />
      </span>
    );
  if (n.kind === "mention" || n.kind === "handoff" || n.kind === "search")
    return (
      <span className="ico">
        <Avatar id={n.who} name={n.who || initialsOf(n.who)} />
      </span>
    );
  const d =
    n.kind === "blocked"
      ? ICONS.close
      : n.kind === "contention"
        ? ICONS.branch
        : n.kind === "plan"
          ? ICONS.file
          : n.kind === "done"
            ? ICONS.check
            : ICONS.check;
  return (
    <span className="ico">
      <Icon d={d} size={15} />
    </span>
  );
}

/** The sentence with its mono part set in code. */
export function Sentence({
  who,
  verb,
  what,
  code,
}: {
  who: string;
  verb: string;
  what: string;
  code?: string | undefined;
}) {
  const at = code ? what.indexOf(code) : -1;
  return (
    <>
      {who && <span className="who">{who}</span>}
      {who && " "}
      {verb && `${verb} `}
      {at >= 0 && code ? (
        <>
          {what.slice(0, at)}
          <code>{code}</code>
          {what.slice(at + code.length)}
        </>
      ) : (
        what
      )}
    </>
  );
}

function ToastCard({ n, identity }: { n: Notice; identity: Identity | null }) {
  const decision = n.sticky;
  const o = n.outcome;
  const acts: { label: string; primary?: boolean; onClick: () => void }[] = [];
  if (!o && identity) {
    if (n.kind === "approval" || n.kind === "gate") {
      acts.push({
        label: n.ratings ? copy.toast.rate : copy.toast.approveWith(DEFAULT_RATING),
        primary: true,
        onClick: () =>
          n.ratings
            ? open(n)
            : act(n, () =>
                voteFromInbox(
                  identity,
                  { link: linkFor(n), ref: n.ref },
                  "approve",
                  DEFAULT_RATING,
                ),
              ),
      });
      acts.push({ label: copy.toast.deny, onClick: () => deny(n, identity) });
    } else if (n.kind === "handoff")
      acts.push({ label: copy.toast.accept, primary: true, onClick: () => accept(n, identity) });
    else if (n.kind === "mention")
      acts.push({ label: copy.toast.reply, primary: true, onClick: () => open(n) });
    else if (n.kind === "plan")
      acts.push({ label: copy.toast.rate, primary: true, onClick: () => open(n) });
  }
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hovering only holds the life line; the buttons are the controls
    <div
      className={`ntoast k-${n.kind}${isPaused(n.id) ? " paused" : ""}${decision ? " decision" : ""}`}
      role={decision ? "alert" : undefined}
      onMouseEnter={() => pauseNotice(n.id)}
      onMouseLeave={() => resumeNotice(n.id)}
    >
      <ToastIcon n={n} />
      <div className="body">
        <div className="l1">
          <Sentence who={n.who} verb={n.verb} what={n.what} code={n.code} />
        </div>
        {(n.where || n.forYou) && n.kind !== "mention" && n.kind !== "search" && (
          <div className="l2">
            {n.where && <span>{n.where}</span>}
            {n.where && n.forYou && <span className="sep" />}
            {n.forYou && <span className="you">{n.forYou}</span>}
          </div>
        )}
        {n.quote && <div className="quote">{n.quote}</div>}
        {o?.busy && (
          <div className="outcome">
            <Loader kind="orbit" label={copy.toast.joining} />
            {copy.toast.joining}
          </div>
        )}
        {o?.word && (
          <div className="outcome ok">
            <Icon d={ICONS.check} size={14} />
            {o.word}
          </div>
        )}
        {o?.error && <div className="outcome err">{o.error}</div>}
        {(acts.length > 0 || (!o && n.kind !== "joined")) && (
          <div className="acts">
            {acts.map((a) => (
              <button
                type="button"
                key={a.label}
                className={`btn sm${a.primary ? " primary" : ""}`}
                onClick={a.onClick}
              >
                {a.label}
              </button>
            ))}
            {!o && (
              <button
                type="button"
                className="btn ghost sm icon"
                aria-label={copy.toast.open}
                title={copy.toast.open}
                onClick={() => open(n)}
              >
                <Icon d={ICONS.chevron} size={14} />
              </button>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        className="x"
        aria-label={copy.toast.dismiss}
        onClick={() => dismissNotice(n.id)}
      >
        <Icon d={ICONS.close} size={13} />
      </button>
      {decision && !o && (
        <span className="keys" aria-hidden="true">
          <kbd>y</kbd>
          <kbd>n</kbd>
        </span>
      )}
      {!decision && <i className="life" />}
    </div>
  );
}
