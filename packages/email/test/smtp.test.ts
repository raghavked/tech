import { createServer, type Server, type Socket } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { base64Lines, encodeHeader, toEml } from "../src/mailer.js";
import { dotStuff, parseSmtpUrl, SmtpMailer } from "../src/smtp.js";

/** A loopback SMTP server that records one conversation; no TLS, AUTH PLAIN offered. */
interface Recorded {
  commands: string[];
  from: string | null;
  to: string[];
  data: string | null;
  auth: string | null;
}

function fakeSmtp(): Promise<{ server: Server; port: number; sessions: Recorded[] }> {
  const sessions: Recorded[] = [];
  const server = createServer((socket: Socket) => {
    const rec: Recorded = { commands: [], from: null, to: [], data: null, auth: null };
    sessions.push(rec);
    let buffer = "";
    let inData = false;
    socket.write("220 fake.local ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      for (;;) {
        if (inData) {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end < 0) return;
          rec.data = buffer.slice(0, end + 2);
          buffer = buffer.slice(end + 5);
          inData = false;
          socket.write("250 queued\r\n");
          continue;
        }
        const nl = buffer.indexOf("\r\n");
        if (nl < 0) return;
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 2);
        rec.commands.push(line);
        const verb = line.split(/[ :]/)[0]?.toUpperCase();
        if (verb === "EHLO")
          socket.write("250-fake.local\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n");
        else if (verb === "AUTH") {
          rec.auth = line.split(" ")[2] ?? null;
          socket.write("235 ok\r\n");
        } else if (verb === "MAIL") {
          rec.from = line.slice(line.indexOf("<") + 1, line.indexOf(">"));
          socket.write("250 ok\r\n");
        } else if (verb === "RCPT") {
          rec.to.push(line.slice(line.indexOf("<") + 1, line.indexOf(">")));
          socket.write("250 ok\r\n");
        } else if (verb === "DATA") {
          inData = true;
          socket.write("354 go\r\n");
        } else if (verb === "QUIT") {
          socket.write("221 bye\r\n");
          socket.end();
        } else socket.write("500 what\r\n");
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, port, sessions });
    });
  });
}

describe("the smtp mailer", () => {
  let fake: Awaited<ReturnType<typeof fakeSmtp>>;
  beforeAll(async () => {
    fake = await fakeSmtp();
  });
  afterAll(() => {
    fake.server.close();
  });

  it("delivers a digest over a loopback socket with AUTH PLAIN, the text and the html parts", async () => {
    const mailer = new SmtpMailer({
      host: "127.0.0.1",
      port: fake.port,
      user: "henosis",
      pass: "s3cret",
      now: () => new Date("2026-10-06T08:00:00Z"),
    });
    const sent = await mailer.send({
      from: "Henosis <digest@henosis.app>",
      to: ["Ana Moreau <ana@payments.example>", "dee@payments.example"],
      subject: "Payments this week: 3 things need you",
      text: "4 open sessions.\n.a line that starts with a dot\n",
      html: "<p>4 open sessions.</p>",
      headers: { "X-Henosis-Digest": "payments; weekly" },
    });
    expect(sent.id).toMatch(/^<\d+\.[a-z0-9]+@127\.0\.0\.1>$/);
    const s = fake.sessions[0];
    expect(s?.commands[0]).toBe("EHLO henosis");
    expect(s?.auth).toBe(Buffer.from("\0henosis\0s3cret").toString("base64"));
    expect(s?.from).toBe("digest@henosis.app");
    expect(s?.to).toEqual(["ana@payments.example", "dee@payments.example"]);
    expect(s?.commands.at(-1)).toBe("QUIT");
    expect(s?.data).toContain("Subject: Payments this week: 3 things need you\r\n");
    expect(s?.data).toContain("X-Henosis-Digest: payments; weekly\r\n");
    expect(s?.data).toContain("Content-Type: multipart/alternative; boundary=");
    expect(s?.data).toContain("Content-Type: text/plain; charset=UTF-8");
    expect(s?.data).toContain("Content-Type: text/html; charset=UTF-8");
    // The body is base64, so the dot line never reaches the wire as a line; the message ends once.
    expect(s?.data).toContain(base64Lines("4 open sessions.\n.a line that starts with a dot\n"));
  });

  it("stuffs a leading dot, encodes a non-ascii subject and parses smtp urls", () => {
    expect(dotStuff("a\r\n.b\r\n..c\r\n")).toBe("a\r\n..b\r\n...c\r\n");
    expect(dotStuff(".first")).toBe("..first\r\n");
    expect(encodeHeader("Payments this week")).toBe("Payments this week");
    expect(encodeHeader("Zahlungen · diese Woche")).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
    expect(parseSmtpUrl("smtp://ana%40x:p%40ss@mail.example:2525?starttls=0")).toEqual({
      host: "mail.example",
      port: 2525,
      tls: false,
      user: "ana@x",
      pass: "p@ss",
      starttls: false,
    });
    expect(parseSmtpUrl("smtps://mail.example")).toEqual({
      host: "mail.example",
      port: 465,
      tls: true,
    });
    expect(() => parseSmtpUrl("http://x")).toThrow(/not an smtp url/);
  });

  it("writes a text-only message without a multipart wrapper", () => {
    const eml = toEml(
      { from: "a@x", to: ["b@y"], subject: "Hi", text: "hello\n" },
      { id: "<1@x>", date: new Date("2026-10-06T08:00:00Z") },
    );
    expect(eml).toContain("Date: Tue, 06 Oct 2026 08:00:00 GMT\r\n");
    expect(eml).not.toContain("multipart");
    expect(eml).toContain(`\r\n\r\n${base64Lines("hello\n")}\r\n`);
  });
});
