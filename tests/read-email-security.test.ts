import { afterEach, describe, expect, it } from "bun:test";
import type { ImapFlow } from "imapflow";
import { encrypt } from "../src/crypto";
import { ImapClient } from "../src/imap-client";
import type { ImapConfig } from "../src/types";
import { handleReadEmail } from "../src/tools/read-email";

class FakeReadEmailConnection {
  usable = true;

  async connect(): Promise<void> {}

  async logout(): Promise<void> {
    this.usable = false;
  }

  async list(): Promise<never[]> {
    return [];
  }

  async mailboxOpen(): Promise<Record<string, never>> {
    return {};
  }

  async search(): Promise<never[]> {
    return [];
  }

  async fetchOne(): Promise<{
    uid: number;
    envelope: {
      subject: string;
      from: Array<{ address: string }>;
      to: Array<{ address: string }>;
      date: Date;
    };
    flags: Set<string>;
    source: Buffer;
  }> {
    return {
      uid: 7,
      envelope: {
        subject: "Security test",
        from: [{ address: "sender@example.com" }],
        to: [{ address: "mailbox@example.com" }],
        date: new Date("2026-04-02T12:00:00.000Z"),
      },
      flags: new Set<string>(["\\Seen"]),
      source: Buffer.from(
        [
          "From: sender@example.com",
          "To: mailbox@example.com",
          "Subject: Security test",
          "MIME-Version: 1.0",
          'Content-Type: multipart/alternative; boundary="boundary"',
          "",
          "--boundary",
          "Content-Type: text/plain; charset=utf-8",
          "",
          "Plain text body",
          "",
          "--boundary",
          "Content-Type: text/html; charset=utf-8",
          "",
          "<p>Hello <strong>world</strong></p>",
          "--boundary--",
          "",
        ].join("\r\n")
      ),
    };
  }
}

const ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const IMAP_CONFIG: ImapConfig = {
  host: "imap.example.com",
  port: 993,
  tls: true,
};
const clients: ImapClient[] = [];

afterEach(async () => {
  while (clients.length > 0) {
    await clients.pop()!.disconnect();
  }
});

describe("read email security", () => {
  it("tracks whether an HTML alternative exists without returning raw HTML", async () => {
    const client = new ImapClient(IMAP_CONFIG, {
      connectionFactory: () => new FakeReadEmailConnection() as unknown as ImapFlow,
    });
    clients.push(client);

    const email = await client.readEmail("mailbox@example.com", "password", "INBOX", 7);

    expect(email.textBody).toContain("Plain text body");
    expect(email.hasHtmlAlternative).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(email as Record<string, unknown>, "htmlBody")).toBe(false);
  });

  it("renders a safe text response and replaces raw HTML with a notice", async () => {
    const credentials = encrypt(
      JSON.stringify({ user: "mailbox@example.com", pass: "password" }),
      ENCRYPTION_KEY
    );
    const fakeImapClient = {
      readEmail: async () => ({
        uid: 7,
        subject: "Security test",
        from: "sender@example.com",
        to: "mailbox@example.com",
        date: "2026-04-02T12:00:00.000Z",
        textBody: "Plain text body",
        hasHtmlAlternative: true,
        read: true,
        flagged: false,
        attachments: [],
      }),
    } as unknown as ImapClient;

    const result = await handleReadEmail(fakeImapClient, ENCRYPTION_KEY, {
      credentials,
      folder: "INBOX",
      uid: 7,
    });
    const output = result.content[0].text;

    expect(output).toContain("Plain text body");
    expect(output).toContain("HTML Alternative");
    expect(output).not.toContain("<p>");
    expect(output).not.toContain("<strong>");
  });
});
