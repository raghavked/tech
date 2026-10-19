/**
 * The slice of Slack the adapter needs, behind an interface so the adapter is testable
 * offline. `BoltSlackClient` wraps @slack/bolt in socket mode; `FakeSlackClient` records
 * posts and lets a test click buttons and reply in threads.
 */
export interface Block {
  type: string;
  [k: string]: unknown;
}

export interface PostInput {
  channel: string;
  text: string;
  blocks?: Block[];
  threadTs?: string;
  /** Also show a thread reply in the channel (Slack's reply_broadcast). */
  broadcast?: boolean;
  /** Post under this name ("Ana's agent"): Slack's `username` override; the APP badge stays. */
  as?: string;
}

export interface Posted {
  channel: string;
  ts: string;
}

export interface ActionEvent {
  actionId: string;
  value: string;
  userId: string;
  channel: string;
  messageTs: string;
}

export interface MessageEvent {
  channel: string;
  threadTs: string | null;
  ts: string;
  userId: string;
  text: string;
}

export interface SlashEvent {
  command: string;
  text: string;
  userId: string;
  channel: string;
  respond(text: string): Promise<void>;
}

export interface SlackClient {
  post(input: PostInput): Promise<Posted>;
  update(channel: string, ts: string, text: string, blocks?: Block[]): Promise<void>;
  onAction(handler: (e: ActionEvent) => Promise<void>): void;
  onMessage(handler: (e: MessageEvent) => Promise<void>): void;
  onSlash(command: string, handler: (e: SlashEvent) => Promise<void>): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/** In-memory Slack for tests and the offline demo. */
export class FakeSlackClient implements SlackClient {
  readonly posts: (PostInput & Posted)[] = [];
  readonly updates: { channel: string; ts: string; text: string; blocks?: Block[] }[] = [];
  private actions: ((e: ActionEvent) => Promise<void>)[] = [];
  private messages: ((e: MessageEvent) => Promise<void>)[] = [];
  private slashes = new Map<string, (e: SlashEvent) => Promise<void>>();
  private counter = 0;

  async post(input: PostInput): Promise<Posted> {
    this.counter += 1;
    const posted = {
      channel: input.channel,
      ts: `${1700000000 + this.counter}.000${this.counter}`,
    };
    this.posts.push({ ...input, ...posted });
    return posted;
  }
  async update(channel: string, ts: string, text: string, blocks?: Block[]): Promise<void> {
    this.updates.push(blocks ? { channel, ts, text, blocks } : { channel, ts, text });
    const p = this.posts.find((x) => x.channel === channel && x.ts === ts);
    if (p) {
      p.text = text;
      if (blocks) p.blocks = blocks;
    }
  }
  onAction(handler: (e: ActionEvent) => Promise<void>): void {
    this.actions.push(handler);
  }
  onMessage(handler: (e: MessageEvent) => Promise<void>): void {
    this.messages.push(handler);
  }
  onSlash(command: string, handler: (e: SlashEvent) => Promise<void>): void {
    this.slashes.set(command, handler);
  }
  async start(): Promise<void> {}
  async stop(): Promise<void> {}

  // ---- test drivers ------------------------------------------------------------------
  /** Press the button with this action_id; the value sent is the button's, as Slack sends it. */
  async click(actionId: string, userId: string, messageTs?: string): Promise<void> {
    const msg = [...this.posts]
      .reverse()
      .find(
        (p) =>
          (messageTs ? p.ts === messageTs : true) &&
          (p.blocks ?? []).some((b) => blockHasAction(b, actionId)),
      );
    if (!msg) throw new Error(`no message with action ${actionId}`);
    const value = findActionValue(msg.blocks ?? [], actionId);
    for (const h of this.actions)
      await h({ actionId, value, userId, channel: msg.channel, messageTs: msg.ts });
  }
  /** Deliver a button press as Slack would from any message, e.g. one posted by an older adapter. */
  async press(actionId: string, value: string, userId: string, channel = ""): Promise<void> {
    for (const h of this.actions) await h({ actionId, value, userId, channel, messageTs: "" });
  }
  /** The buttons of the latest message whose action_ids start with `prefix`. */
  buttonsOf(
    prefix: string,
    messageTs?: string,
  ): { actionId: string; value: string; text: string }[] {
    const msg = [...this.posts]
      .reverse()
      .find(
        (p) =>
          (messageTs ? p.ts === messageTs : true) &&
          (p.blocks ?? []).some((b) =>
            elementsOf(b).some((e) => String(e.action_id ?? "").startsWith(prefix)),
          ),
      );
    if (!msg) return [];
    return (msg.blocks ?? [])
      .flatMap(elementsOf)
      .filter((e) => String(e.action_id ?? "").startsWith(prefix))
      .map((e) => ({
        actionId: String(e.action_id),
        value: String(e.value ?? ""),
        text: String((e.text as { text?: string } | undefined)?.text ?? ""),
      }));
  }
  async reply(channel: string, threadTs: string, userId: string, text: string): Promise<void> {
    this.counter += 1;
    for (const h of this.messages)
      await h({ channel, threadTs, ts: `${1700000000 + this.counter}.1`, userId, text });
  }
  /** A top-level message in a channel (not in a thread), as a person types it. */
  async say(channel: string, userId: string, text: string): Promise<string> {
    this.counter += 1;
    const ts = `${1700000000 + this.counter}.2`;
    for (const h of this.messages) await h({ channel, threadTs: null, ts, userId, text });
    return ts;
  }
  async slash(command: string, text: string, userId: string, channel: string): Promise<string[]> {
    const h = this.slashes.get(command);
    if (!h) throw new Error(`no handler for ${command}`);
    const out: string[] = [];
    await h({ command, text, userId, channel, respond: async (t) => void out.push(t) });
    return out;
  }
  threads(channel: string): string[] {
    return this.posts.filter((p) => p.channel === channel && !p.threadTs).map((p) => p.ts);
  }
}

function elementsOf(b: Block): Block[] {
  return b.type === "actions" ? ((b.elements as Block[] | undefined) ?? []) : [];
}

function blockHasAction(b: Block, actionId: string): boolean {
  return elementsOf(b).some((e) => e.action_id === actionId);
}

function findActionValue(blocks: Block[], actionId: string): string {
  for (const b of blocks)
    for (const e of elementsOf(b)) if (e.action_id === actionId) return String(e.value ?? "");
  return "";
}
