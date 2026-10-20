/**
 * The group's composer with the @ completion anchored over it (chat-view, mention-flow):
 * "People and agents in #billing" with the typed query echoed in mono, matched letters in
 * chocolate, person rows with "you", agent rows "Ana's agent · Billing page · running", the
 * owner listed under its agent as "not a match, listed for the owner", the selected row on the
 * selection wash with ↵, and the footer that says what mentioning an agent does.
 */
import { type ChatMember, type Group, memberId, memberKey, memberName } from "@henosis/chat";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChatDirectoryListing } from "../api.js";
import { copy } from "../copy.js";
import { Avatar, ICONS, Icon } from "../ui.js";
import { AgentTile, type Live, Match, nameOfIn, statusWord } from "./shared.js";

interface Option {
  m: ChatMember;
  /** Listed because the typed letters matched its agent, not it. */
  forOwner: boolean;
}

export function Composer({
  group,
  meId,
  read,
  live,
  directory,
  onSay,
  onRead,
}: {
  group: Group;
  meId: string;
  /** Seq of the last event this person has read in the group. */
  read: number;
  live: Live;
  directory: ChatDirectoryListing | null;
  onSay: (text: string) => void;
  onRead: () => void;
}) {
  const [text, setText] = useState("");
  const [sel, setSel] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);
  const nameOf = nameOfIn(group, directory);
  // Mark read while the page is in view: now, when something lands, and when it comes back.
  const unread = group.lastSeq > read;
  const markRead = useCallback(() => {
    try {
      if (!document.hidden) onRead();
    } catch {
      onRead();
    }
  }, [onRead]);
  useEffect(() => {
    if (unread) markRead();
  }, [unread, markRead]);
  useEffect(() => {
    const on = () => {
      if (group.lastSeq > read) markRead();
    };
    addEventListener("focus", on);
    document.addEventListener("visibilitychange", on);
    return () => {
      removeEventListener("focus", on);
      document.removeEventListener("visibilitychange", on);
    };
  }, [group.lastSeq, read, markRead]);

  // The `@word` being typed at the caret, if any, and the members it could mean.
  const query = useMemo(() => {
    const el = ta.current;
    const caret = el ? el.selectionStart : text.length;
    const before = text.slice(0, caret);
    const m = before.match(/(?:^|\s)@([^\s@]*)$/);
    return m
      ? { q: (m[1] ?? "").toLowerCase(), start: before.length - (m[1] ?? "").length - 1 }
      : null;
  }, [text]);
  const options = useMemo<Option[]>(() => {
    if (!query) return [];
    const hit = group.members.filter((m) => {
      const hay = [memberName(m), memberId(m)].map((x) => x.toLowerCase());
      return hay.some((h) => h.startsWith(query.q)) || hay.some((h) => h.includes(query.q));
    });
    const out: Option[] = hit.map((m) => ({ m, forOwner: false }));
    // The owner under its agent, when the letters matched the agent and not the owner.
    for (const m of hit) {
      if (m.kind !== "agent") continue;
      const ownerId = live.get(m.sessionId)?.ownerId;
      const owner = group.members.find((x) => x.kind === "human" && x.userId === ownerId);
      if (owner && !out.some((o) => memberKey(o.m) === memberKey(owner)))
        out.splice(out.findIndex((o) => memberKey(o.m) === memberKey(m)) + 1, 0, {
          m: owner,
          forOwner: true,
        });
    }
    return out.slice(0, 6);
  }, [group.members, query, live]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset the cursor when the list changes
  useEffect(() => setSel(0), [options.length, query?.q]);

  // The caret after a pick lands right after the name, placed as the new text commits (a frame
  // callback would run late on a busy page and jump the caret back under what was typed since).
  const caretAfter = useRef<number | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once the picked text has committed
  useLayoutEffect(() => {
    const at = caretAfter.current;
    if (at === null) return;
    caretAfter.current = null;
    const el = ta.current;
    el?.focus();
    el?.setSelectionRange(at, at);
  }, [text]);
  const pick = (m: ChatMember) => {
    if (!query) return;
    const el = ta.current;
    const caret = el ? el.selectionStart : text.length;
    const next = `${text.slice(0, query.start)}@${memberName(m)} ${text.slice(caret)}`;
    caretAfter.current = query.start + memberName(m).length + 2;
    setText(next);
  };
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSay(t);
    setText("");
    if (ta.current) ta.current.style.height = "auto";
  };
  const grow = () => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };
  const onKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (options.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSel((v) => (v + 1) % options.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSel((v) => (v - 1 + options.length) % options.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const o = options[sel];
        if (o) pick(o.m);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };
  return (
    <div className="composer-wrap groupchat">
      <form
        className="composer to-team"
        aria-label={copy.chat.composer}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={ta}
          rows={1}
          aria-label={copy.chat.label}
          placeholder={copy.chat.placeholder(group.name)}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            grow();
          }}
          onKeyDown={onKey}
        />
        {options.length > 0 && query && (
          <div className="mention-list" role="listbox" aria-label={copy.chat.mentionList}>
            <div className="head">
              {copy.chat.mentionHead(group.name)}
              <span className="q">
                @<b>{query.q}</b>
              </span>
            </div>
            {options.map((o, i) => {
              const m = o.m;
              const row = m.kind === "agent" ? live.get(m.sessionId) : undefined;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={i === sel}
                  className={i === sel ? "on" : ""}
                  key={memberKey(m)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(m)}
                >
                  {m.kind === "human" ? (
                    <Avatar id={m.userId} name={memberName(m)} />
                  ) : (
                    <AgentTile
                      id={m.sessionId}
                      title={memberName(m)}
                      status={row?.live ?? null}
                      size="md"
                    />
                  )}
                  <span className="name">
                    <span className={`n${m.kind === "agent" ? " serif" : ""}`}>
                      <Match text={memberName(m)} q={o.forOwner ? "" : query.q} />
                    </span>
                    <span className="sub">
                      {o.forOwner
                        ? copy.chat.forOwner
                        : m.kind === "human"
                          ? m.userId === meId
                            ? copy.chat.youWord
                            : memberId(m)
                          : [
                              row ? copy.chat.ownersAgent(nameOf(row.ownerId)) : null,
                              row?.projectName ?? m.projectId,
                              statusWord(row?.live).toLowerCase(),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                    </span>
                  </span>
                  <span className="kind">
                    {m.kind === "human" ? copy.chat.person : copy.chat.agent}
                    <kbd>↵</kbd>
                  </span>
                </button>
              );
            })}
            <div className="foot">
              <Icon d={ICONS.handoff} size={13} />
              {copy.chat.mentionFoot}
              <i>{copy.chat.mentionFootSteers}</i>
              {copy.chat.mentionFootRest}
            </div>
          </div>
        )}
        <div className="bar">
          <span className="small faint">{copy.chat.placeholderMention}</span>
          <div className="right">
            <button
              type="submit"
              className="send"
              aria-label={copy.chat.send}
              disabled={!text.trim()}
            >
              <Icon d={ICONS.send} />
            </button>
          </div>
        </div>
      </form>
      <p className="hint small faint keys">
        <kbd>Enter</kbd> {copy.chat.hintEnter} · <kbd>Shift</kbd>+<kbd>Enter</kbd>{" "}
        {copy.chat.hintShift} · <kbd>@</kbd> {copy.chat.hintAt}
      </p>
    </div>
  );
}
