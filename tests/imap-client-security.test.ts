import { afterEach, describe, expect, it } from "bun:test";
import type { ImapFlow } from "imapflow";
import { ImapClient } from "../src/imap-client";

class FakeImapConnection {
  usable = true;
  connectCalls = 0;
  logoutCalls = 0;
  listCalls = 0;

  async connect(): Promise<void> {
    this.connectCalls += 1;
  }

  async logout(): Promise<void> {
    this.logoutCalls += 1;
    this.usable = false;
  }

  async list(): Promise<never[]> {
    this.listCalls += 1;
    return [];
  }

  async mailboxOpen(): Promise<Record<string, never>> {
    return {};
  }

  async search(): Promise<never[]> {
    return [];
  }

  async fetchOne(): Promise<null> {
    return null;
  }
}

const clients: ImapClient[] = [];

afterEach(async () => {
  while (clients.length > 0) {
    await clients.pop()!.disconnect();
  }
});

describe("imap-client security hardening", () => {
  it("reuses a pooled connection only when the credential fingerprint matches", async () => {
    const connections: FakeImapConnection[] = [];
    const client = new ImapClient(
      { host: "imap.example.com", port: 993, tls: true },
      {
        connectionFactory: () => {
          const connection = new FakeImapConnection();
          connections.push(connection);
          return connection as unknown as ImapFlow;
        },
      }
    );
    clients.push(client);

    await client.listFolders("mailbox@example.com", "correct-password");
    await client.listFolders("mailbox@example.com", "correct-password");

    expect(connections).toHaveLength(1);
    expect(connections[0].connectCalls).toBe(1);
    expect(connections[0].listCalls).toBe(2);
  });

  it("does not reuse a pooled connection when the password changes for the same user", async () => {
    const connections: FakeImapConnection[] = [];
    const client = new ImapClient(
      { host: "imap.example.com", port: 993, tls: true },
      {
        connectionFactory: () => {
          const connection = new FakeImapConnection();
          connections.push(connection);
          return connection as unknown as ImapFlow;
        },
      }
    );
    clients.push(client);

    await client.listFolders("mailbox@example.com", "correct-password");
    await client.listFolders("mailbox@example.com", "wrong-password");

    expect(connections).toHaveLength(2);
    expect(connections[0].listCalls).toBe(1);
    expect(connections[1].listCalls).toBe(1);
  });
});
