/** @slack/bolt in socket mode. Loaded lazily so tests and the offline demo never import it. */
import type {
  ActionEvent,
  Block,
  MessageEvent,
  Posted,
  PostInput,
  SlackClient,
  SlashEvent,
} from "./client.js";

export interface BoltConfig {
  botToken: string;
  appToken: string;
  signingSecret?: string;
}

export class BoltSlackClient implements SlackClient {
  // biome-ignore lint/suspicious/noExplicitAny: bolt's App type is loaded dynamically
  private app: any = null;
  private actionHandlers: ((e: ActionEvent) => Promise<void>)[] = [];
  private messageHandlers: ((e: MessageEvent) => Promise<void>)[] = [];
  private slashHandlers = new Map<string, (e: SlashEvent) => Promise<void>>();

  constructor(private readonly cfg: BoltConfig) {}

  private async ensure() {
    if (this.app) return this.app;
    const bolt = await import("@slack/bolt");
    const App =
      (bolt as { App: new (o: Record<string, unknown>) => unknown; default?: { App?: unknown } })
        .App ??
      (bolt as { default: { App: new (o: Record<string, unknown>) => unknown } }).default.App;
    // biome-ignore lint/suspicious/noExplicitAny: bolt's App type is loaded dynamically
    const app: any = new App({
      token: this.cfg.botToken,
      appToken: this.cfg.appToken,
      socketMode: true,
      signingSecret: this.cfg.signingSecret ?? "unused-in-socket-mode",
    });
    app.action(
      /.*/,
      async ({
        ack,
        action,
        body,
      }: {
        ack: () => Promise<void>;
        action: Record<string, unknown>;
        body: Record<string, unknown>;
      }) => {
        await ack();
        const container = (body.container as Record<string, unknown> | undefined) ?? {};
        const e: ActionEvent = {
          actionId: String(action.action_id ?? ""),
          value: String(action.value ?? ""),
          userId: String((body.user as Record<string, unknown> | undefined)?.id ?? ""),
          channel: String(container.channel_id ?? ""),
          messageTs: String(container.message_ts ?? ""),
        };
        for (const h of this.actionHandlers) await h(e);
      },
    );
    app.message(async ({ message }: { message: Record<string, unknown> }) => {
      if (message.subtype || message.bot_id) return;
      const e: MessageEvent = {
        channel: String(message.channel ?? ""),
        threadTs: message.thread_ts ? String(message.thread_ts) : null,
        ts: String(message.ts ?? ""),
        userId: String(message.user ?? ""),
        text: String(message.text ?? ""),
      };
      for (const h of this.messageHandlers) await h(e);
    });
    for (const [command, handler] of this.slashHandlers) {
      app.command(
        command,
        async ({
          ack,
          command: c,
          respond,
        }: {
          ack: () => Promise<void>;
          command: Record<string, unknown>;
          respond: (t: string) => Promise<void>;
        }) => {
          await ack();
          await handler({
            command,
            text: String(c.text ?? ""),
            userId: String(c.user_id ?? ""),
            channel: String(c.channel_id ?? ""),
            respond: async (t) => void (await respond(t)),
          });
        },
      );
    }
    this.app = app;
    return app;
  }

  async post(input: PostInput): Promise<Posted> {
    const app = await this.ensure();
    const r = await app.client.chat.postMessage({
      channel: input.channel,
      text: input.text,
      blocks: input.blocks,
      thread_ts: input.threadTs,
      reply_broadcast: input.broadcast,
    });
    return { channel: String(r.channel), ts: String(r.ts) };
  }
  async update(channel: string, ts: string, text: string, blocks?: Block[]): Promise<void> {
    const app = await this.ensure();
    await app.client.chat.update({ channel, ts, text, blocks });
  }
  onAction(handler: (e: ActionEvent) => Promise<void>): void {
    this.actionHandlers.push(handler);
  }
  onMessage(handler: (e: MessageEvent) => Promise<void>): void {
    this.messageHandlers.push(handler);
  }
  onSlash(command: string, handler: (e: SlashEvent) => Promise<void>): void {
    this.slashHandlers.set(command, handler);
  }
  async start(): Promise<void> {
    await (await this.ensure()).start();
  }
  async stop(): Promise<void> {
    await this.app?.stop();
  }
}
