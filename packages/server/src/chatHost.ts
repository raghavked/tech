/**
 * ChatHost: the authoritative actor for one organisation's groups and chats. It owns the chat
 * log, persists it on every event at store/chat/<org>.json, reloads it on start and fans events
 * out to subscribers. Beside the log it keeps the live "answering" board: which agent member
 * was mentioned in which group and has not replied yet, sent with the snapshot and as it
 * changes, never written to disk. The bridge between a mention and an agent's session lives in
 * the server, which owns the project and session hosts.
 */
import {
  type Answering,
  AnsweringBoard,
  Chat,
  type ChatDirectory,
  type ChatEvent,
  type ChatServerMessage,
  type ChatState,
  type SerializedChat,
} from "@henosis/chat";
import { FileStore, type LiveStore, LogWriter } from "./store/index.js";

export interface ChatSubscriber {
  userId: string | null;
  send(msg: ChatServerMessage | { type: "error"; message: string }): void;
}

export interface ChatHostOptions {
  root: string;
  /** Where the chat log is read and flushed; a `FileStore` on `root` when absent. */
  store?: LiveStore | undefined;
  orgId: string;
  directory: ChatDirectory;
  log?: (line: string) => void;
}

export class ChatHost {
  readonly chat: Chat;
  readonly orgId: string;
  private readonly writer: LogWriter;
  private readonly subscribers = new Set<ChatSubscriber>();
  private readonly board = new AnsweringBoard();

  constructor(opts: ChatHostOptions) {
    this.orgId = opts.orgId;
    const store = opts.store ?? new FileStore(opts.root);
    const existing = store.readLog("chat", opts.orgId) as SerializedChat | null;
    this.writer = new LogWriter(store, "chat", opts.orgId, existing);
    this.chat = existing
      ? Chat.fromSerialized(existing, { directory: opts.directory })
      : Chat.create(opts.orgId, { directory: opts.directory });
    this.chat.onEvent((e) => this.onEvent(e));
    this.flush();
  }

  state(): ChatState {
    return this.chat.state();
  }

  subscribe(sub: ChatSubscriber): void {
    this.subscribers.add(sub);
    sub.send({
      type: "chat.snapshot",
      orgId: this.orgId,
      events: this.chat.events(),
      answering: this.board.all(),
    });
  }

  unsubscribe(sub: ChatSubscriber): void {
    this.subscribers.delete(sub);
  }

  /** Mentions still waiting on an agent, in one group or everywhere. */
  answering(groupId?: string): Answering[] {
    return groupId ? this.board.inGroup(groupId) : this.board.all();
  }

  /** A mention reached the agent's session: everyone in the organisation sees it answering. */
  startAnswering(a: Answering): void {
    this.board.start(a);
    this.broadcast({ type: "chat.answering", on: true, answering: a });
  }

  /** The agent could not be reached (or the server gave up on it): the line goes away. */
  stopAnswering(groupId: string, sessionId: string): void {
    const was = this.board.stop(groupId, sessionId);
    if (was) this.broadcast({ type: "chat.answering", on: false, answering: was });
  }

  flush(): void {
    this.writer.flush(this.chat.log.serialize());
  }

  close(): void {
    this.flush();
  }

  private broadcast(msg: ChatServerMessage): void {
    for (const s of this.subscribers) s.send(msg);
  }

  private onEvent(e: ChatEvent): void {
    // Every event lands on disk before anyone else sees it: a crash never loses a message.
    this.flush();
    this.broadcast({ type: "chat.event", event: e });
    // The reply itself ends the "answering" line; clients fold the event the same way.
    const done = this.board.clearedBy(e);
    if (done) this.broadcast({ type: "chat.answering", on: false, answering: done });
  }
}
