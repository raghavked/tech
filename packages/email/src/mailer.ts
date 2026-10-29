/**
 * The slice of e-mail the digest needs, behind an interface so everything renders and sends
 * offline. `FakeMailer` keeps what was sent for tests; `FileMailer` writes each message as an
 * `.eml` file (the offline product: open it in any mail client); `SmtpMailer` (smtp.ts) talks
 * to a server over a socket and is the only one that touches the network.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface Email {
  from: string;
  to: string[];
  subject: string;
  /** The plain-text part: the whole message, readable on its own. */
  text: string;
  /** The HTML part, or none for a text-only message. */
  html?: string;
  /** Extra headers (`List-Unsubscribe`, `X-Henosis-Digest`), verbatim. */
  headers?: Record<string, string>;
}

export interface Sent {
  /** The Message-ID the message went out with. */
  id: string;
}

export interface Mailer {
  send(email: Email): Promise<Sent>;
}

/** In-memory mail for tests and the offline demo: nothing leaves the process. */
export class FakeMailer implements Mailer {
  readonly sent: (Email & Sent)[] = [];
  private counter = 0;

  async send(email: Email): Promise<Sent> {
    this.counter += 1;
    const id = `<fake-${this.counter}@henosis.local>`;
    this.sent.push({ ...email, id });
    return { id };
  }

  get last(): (Email & Sent) | undefined {
    return this.sent[this.sent.length - 1];
  }

  /** Every message sent to this address. */
  to(address: string): (Email & Sent)[] {
    return this.sent.filter((e) => e.to.includes(address));
  }
}

/** Writes each message as `<dir>/<n>-<slug>.eml`; the file is the delivery. */
export class FileMailer implements Mailer {
  readonly written: string[] = [];
  private counter = 0;

  constructor(
    private readonly dir: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async send(email: Email): Promise<Sent> {
    mkdirSync(this.dir, { recursive: true });
    this.counter += 1;
    const id = messageId(this.now());
    const slug = email.subject
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    const path = join(this.dir, `${String(this.counter).padStart(3, "0")}-${slug || "mail"}.eml`);
    writeFileSync(path, toEml(email, { id, date: this.now() }));
    this.written.push(path);
    return { id };
  }
}

/** `<1700000000000.a1b2c3@henosis>`: unique enough per process. */
export function messageId(now: Date, domain = "henosis"): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `<${now.getTime()}.${rand}@${domain}>`;
}

/** The address part of "Ana Moreau <ana@example.com>", or the string itself. */
export function addressOf(mailbox: string): string {
  const m = mailbox.match(/<([^>]+)>\s*$/);
  return (m?.[1] ?? mailbox).trim();
}

/** RFC 2047 for a header that is not plain ASCII; plain ones pass through. */
export function encodeHeader(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** Base64 in 76-column lines, the transfer encoding every client reads. */
export function base64Lines(s: string): string {
  const b = Buffer.from(s, "utf8").toString("base64");
  return b.replace(/(.{76})/g, "$1\r\n").replace(/\r\n$/, "");
}

/**
 * The message as RFC 5322 text: headers, then the text part, then the HTML part as a
 * `multipart/alternative` so a client picks the richer one and a reader of the file sees
 * the plain text first.
 */
export function toEml(email: Email, opts: { id: string; date: Date }): string {
  const headers: [string, string][] = [
    ["From", email.from],
    ["To", email.to.join(", ")],
    ["Subject", encodeHeader(email.subject)],
    ["Date", opts.date.toUTCString()],
    ["Message-ID", opts.id],
    ["MIME-Version", "1.0"],
    ...Object.entries(email.headers ?? {}),
  ];
  const text = `Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64Lines(email.text)}`;
  if (!email.html) return `${headers.map(([k, v]) => `${k}: ${v}`).join("\r\n")}\r\n${text}\r\n`;
  const boundary = `=_henosis_${opts.id.replace(/[^a-z0-9]/gi, "").slice(0, 24)}`;
  headers.push(["Content-Type", `multipart/alternative; boundary="${boundary}"`]);
  const html = `Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64Lines(email.html)}`;
  return [
    headers.map(([k, v]) => `${k}: ${v}`).join("\r\n"),
    "",
    `--${boundary}`,
    text,
    `--${boundary}`,
    html,
    `--${boundary}--`,
    "",
  ].join("\r\n");
}
