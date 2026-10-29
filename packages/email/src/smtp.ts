/**
 * A small SMTP client on node's sockets: EHLO, STARTTLS when the server offers it, AUTH
 * PLAIN when credentials are given, MAIL FROM, RCPT TO, DATA, QUIT. Nothing else of the
 * protocol is needed to deliver a digest, and no dependency is worth the one file. Tests run
 * it against a loopback server in the test file; CI never reaches the network.
 */
import { createConnection, type Socket } from "node:net";
import { type TLSSocket, connect as tlsConnect } from "node:tls";
import { addressOf, type Email, type Mailer, messageId, type Sent, toEml } from "./mailer.js";

export interface SmtpOptions {
  host: string;
  port?: number;
  /** Start with TLS (port 465 style). Default: plain, then STARTTLS when offered. */
  tls?: boolean;
  /** Upgrade with STARTTLS when the server offers it (default true). */
  starttls?: boolean;
  user?: string;
  pass?: string;
  /** The EHLO name; defaults to "henosis". */
  name?: string;
  /** Per-command timeout, ms (default 10 s). */
  timeoutMs?: number;
  now?: () => Date;
}

/** `smtp://user:pass@host:587` or `smtps://host:465` → options. */
export function parseSmtpUrl(url: string): SmtpOptions {
  const u = new URL(url);
  if (u.protocol !== "smtp:" && u.protocol !== "smtps:") throw new Error(`not an smtp url: ${url}`);
  const tls = u.protocol === "smtps:";
  const out: SmtpOptions = { host: u.hostname, port: Number(u.port || (tls ? 465 : 587)), tls };
  if (u.username) out.user = decodeURIComponent(u.username);
  if (u.password) out.pass = decodeURIComponent(u.password);
  if (u.searchParams.get("starttls") === "0") out.starttls = false;
  return out;
}

class SmtpError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(`smtp ${code}: ${message}`);
  }
}

/** One connection per message: open, deliver, quit. Simple and enough for a weekly digest. */
export class SmtpMailer implements Mailer {
  constructor(private readonly opts: SmtpOptions) {}

  async send(email: Email): Promise<Sent> {
    const now = (this.opts.now ?? (() => new Date()))();
    const id = messageId(now, this.opts.host);
    const conn = await Conversation.open(this.opts);
    try {
      await conn.expect(220);
      let ehlo = await conn.command(`EHLO ${this.opts.name ?? "henosis"}`, 250);
      if (!this.opts.tls && this.opts.starttls !== false && /STARTTLS/i.test(ehlo)) {
        await conn.command("STARTTLS", 220);
        await conn.upgrade(this.opts.host);
        ehlo = await conn.command(`EHLO ${this.opts.name ?? "henosis"}`, 250);
      }
      if (this.opts.user !== undefined) {
        if (!/AUTH[ =].*PLAIN/i.test(ehlo))
          throw new Error("smtp: the server offers no AUTH PLAIN");
        const token = Buffer.from(`\0${this.opts.user}\0${this.opts.pass ?? ""}`).toString(
          "base64",
        );
        await conn.command(`AUTH PLAIN ${token}`, 235);
      }
      await conn.command(`MAIL FROM:<${addressOf(email.from)}>`, 250);
      for (const to of email.to) await conn.command(`RCPT TO:<${addressOf(to)}>`, [250, 251]);
      await conn.command("DATA", 354);
      await conn.command(`${dotStuff(toEml(email, { id, date: now }))}.`, 250);
      await conn.command("QUIT", 221).catch(() => undefined);
      return { id };
    } finally {
      conn.close();
    }
  }
}

/** A line that starts with "." is doubled in DATA so the body cannot end the message early. */
export function dotStuff(eml: string): string {
  const body = eml.endsWith("\r\n") ? eml : `${eml}\r\n`;
  return body.replace(/(^|\r\n)\./g, "$1..");
}

/** Reads SMTP replies line by line and matches the code of the last line of a reply. */
class Conversation {
  private buffer = "";
  private waiters: { resolve: (reply: string) => void; reject: (e: Error) => void }[] = [];
  private socket: Socket | TLSSocket;

  private constructor(
    socket: Socket | TLSSocket,
    private readonly timeoutMs: number,
  ) {
    this.socket = socket;
    this.listen(socket);
  }

  static open(opts: SmtpOptions): Promise<Conversation> {
    const port = opts.port ?? (opts.tls ? 465 : 587);
    const timeoutMs = opts.timeoutMs ?? 10_000;
    return new Promise((resolve, reject) => {
      const socket = opts.tls
        ? tlsConnect({ host: opts.host, port, servername: opts.host }, () =>
            resolve(new Conversation(socket, timeoutMs)),
          )
        : createConnection({ host: opts.host, port }, () =>
            resolve(new Conversation(socket, timeoutMs)),
          );
      socket.once("error", reject);
      socket.setTimeout(timeoutMs, () => {
        socket.destroy(new Error("smtp: connection timed out"));
      });
    });
  }

  private listen(socket: Socket | TLSSocket): void {
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      this.buffer += chunk;
      this.drain();
    });
    socket.on("error", (err) => this.fail(err instanceof Error ? err : new Error(String(err))));
    socket.on("close", () => this.fail(new Error("smtp: connection closed")));
  }

  /** A reply is complete when a line reads `NNN ` (space) rather than `NNN-`. */
  private drain(): void {
    for (;;) {
      const m = this.buffer.match(/^(?:\d{3}-[^\r\n]*\r?\n)*\d{3}(?: [^\r\n]*)?\r?\n/);
      if (!m) return;
      this.buffer = this.buffer.slice(m[0].length);
      const waiter = this.waiters.shift();
      waiter?.resolve(m[0].replace(/\r?\n$/, ""));
    }
  }

  private fail(err: Error): void {
    const ws = this.waiters;
    this.waiters = [];
    for (const w of ws) w.reject(err);
  }

  /** Wait for the next reply and check its code. */
  expect(codes: number | number[]): Promise<string> {
    const wanted = Array.isArray(codes) ? codes : [codes];
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("smtp: no reply in time")),
        this.timeoutMs,
      ).unref();
      this.waiters.push({
        resolve: (reply) => {
          clearTimeout(timer);
          const code = Number(reply.match(/(\d{3})[ -]?[^\n]*$/)?.[1] ?? reply.slice(0, 3));
          if (wanted.includes(code)) resolve(reply);
          else reject(new SmtpError(code, reply.replace(/^\d{3}[ -]/gm, "")));
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.drain();
    });
  }

  command(line: string, codes: number | number[]): Promise<string> {
    const reply = this.expect(codes);
    this.socket.write(`${line}\r\n`);
    return reply;
  }

  /** STARTTLS: wrap the live socket; the old listeners stay on the plain socket, so re-listen. */
  upgrade(host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const plain = this.socket;
      plain.removeAllListeners("data");
      plain.removeAllListeners("close");
      const tls = tlsConnect({ socket: plain, servername: host }, () => {
        this.socket = tls;
        this.buffer = "";
        this.listen(tls);
        resolve();
      });
      tls.once("error", reject);
    });
  }

  close(): void {
    this.socket.end();
    this.socket.destroy();
  }
}
