/**
 * ChatHost: the authoritative actor for one organisation's groups and chats. It owns the chat
 * log, persists it on every event at store/chat/<org>.json, reloads it on start and fans events
 * out to subscribers. The bridge between a mention and an agent's session lives in the server,
 * which owns the project and session hosts.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  Chat,
  type ChatDirectory,
  type ChatEvent,
  type ChatServerMessage,
  type ChatState,
  type SerializedChat,
} from "@henosis/chat";
import { atomicWrite } from "./storage.js";

export interface ChatSubscriber {
  userId: string | null;
  send(msg: ChatServerMessage | { type: "error"; message: string }): void;
}

export interface ChatHostOptions {
  root: string;
  orgId: string;
  directory: ChatDirectory;
  log?: (line: string) => void;
}

export class ChatHost {
  readonly chat: Chat;
  readonly orgId: string;
  private readonly path: string;
  private readonly subscribers = new Set<ChatSubscriber>();

  constructor(opts: ChatHostOptions) {
    this.orgId = opts.orgId;
    const dir = join(opts.root, "chat");
    mkdirSync(dir, { recursive: true });
    this.path = join(dir, `${opts.orgId}.json`);
    this.chat = existsSync(this.path)
      ? Chat.fromSerialized(JSON.parse(readFileSync(this.path, "utf8")) as SerializedChat, {
          directory: opts.directory,
        })
      : Chat.create(opts.orgId, { directory: opts.directory });
    this.chat.onEvent((e) => this.onEvent(e));
    this.flush();
  }

  state(): ChatState {
    return this.chat.state();
  }

  subscribe(sub: ChatSubscriber): void {
    this.subscribers.add(sub);
    sub.send({ type: "chat.snapshot", orgId: this.orgId, events: this.chat.events() });
  }

  unsubscribe(sub: ChatSubscriber): void {
    this.subscribers.delete(sub);
  }

  flush(): void {
    atomicWrite(this.path, JSON.stringify(this.chat.log.serialize()));
  }

  close(): void {
    this.flush();
  }

  private onEvent(e: ChatEvent): void {
    // Every event lands on disk before anyone else sees it: a crash never loses a message.
    this.flush();
    for (const s of this.subscribers) s.send({ type: "chat.event", event: e });
  }
}
