import { ImapFlow } from "imapflow";
import type { MessageAddressObject } from "imapflow";
import {
  ImapConfig,
  MailboxInfo,
  EmailListItem,
  EmailContent,
  SearchQuery,
  AttachmentInfo,
  ReplyContext,
} from "./types";

interface ClientPool {
  client: ImapFlow;
  lastActivity: number;
  inUse: boolean;
}

type MessageSource = Buffer | string | Uint8Array | undefined;

export class ImapClient {
  private globalConfig: Omit<ImapConfig, "user" | "pass">;
  private connectionPool: Map<string, ClientPool> = new Map();
  private readonly IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: ImapConfig) {
    this.globalConfig = {
      host: config.host,
      port: config.port,
      tls: config.tls,
    };

    // Start periodic cleanup of idle connections
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, 1 * 60 * 1000); // Check every minute
  }

  /**
   * Get or create a connection for a specific user
   */
  private async getConnection(
    imapUser: string,
    imapPass: string
  ): Promise<ImapFlow> {
    const poolKey = imapUser;
    const pool = this.connectionPool.get(poolKey);

    // If we have a usable connection, reuse it
    if (pool && pool.client.usable && !pool.inUse) {
      pool.lastActivity = Date.now();
      pool.inUse = true;
      return pool.client;
    }

    // Close stale connection if it exists
    if (pool && !pool.client.usable) {
      try {
        await pool.client.logout();
      } catch (error) {
        console.error(`Error closing stale connection for ${imapUser}:`, error);
      }
      this.connectionPool.delete(poolKey);
    }

    // Create new connection
    const client = new ImapFlow({
      host: this.globalConfig.host,
      port: this.globalConfig.port,
      auth: {
        user: imapUser,
        pass: imapPass,
      },
      secure: this.globalConfig.tls,
    });

    try {
      await client.connect();
    } catch (error) {
      throw new Error(
        `Failed to connect to IMAP server for ${imapUser}: ${error}`
      );
    }

    // Store in pool
    this.connectionPool.set(poolKey, {
      client,
      lastActivity: Date.now(),
      inUse: true,
    });

    return client;
  }

  /**
   * Release a connection back to the pool
   */
  private releaseConnection(imapUser: string): void {
    const pool = this.connectionPool.get(imapUser);
    if (pool) {
      pool.inUse = false;
      pool.lastActivity = Date.now();
    }
  }

  /**
   * Clean up idle connections
   */
  private async cleanupIdleConnections(): Promise<void> {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, pool] of this.connectionPool.entries()) {
      if (!pool.inUse && now - pool.lastActivity > this.IDLE_TIMEOUT_MS) {
        try {
          await pool.client.logout();
        } catch (error) {
          console.error(`Error closing idle connection for ${key}:`, error);
        }
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.connectionPool.delete(key));
  }

  /**
   * Execute a function with an IMAP connection, automatically releasing it
   */
  private async withConnection<T>(
    imapUser: string,
    imapPass: string,
    fn: (client: ImapFlow) => Promise<T>
  ): Promise<T> {
    const client = await this.getConnection(imapUser, imapPass);
    try {
      return await fn(client);
    } finally {
      this.releaseConnection(imapUser);
    }
  }

  async disconnect(): Promise<void> {
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all connections
    for (const [key, pool] of this.connectionPool.entries()) {
      try {
        await pool.client.logout();
      } catch (error) {
        console.error(`Error closing connection for ${key}:`, error);
      }
    }
    this.connectionPool.clear();
  }

  async listFolders(imapUser: string, imapPass: string): Promise<MailboxInfo[]> {
    return this.withConnection(imapUser, imapPass, async (client) => {
      const mailboxes = await client.list();
      const folders: MailboxInfo[] = [];

      for (const mailbox of mailboxes) {
        const folder: MailboxInfo = {
          name: mailbox.name || "Unknown",
          path: mailbox.path || "",
          messageCount: mailbox.status?.messages || 0,
          unreadCount: mailbox.status?.unseen || 0,
        };
        folders.push(folder);
      }

      return folders;
    });
  }

  async listEmails(
    imapUser: string,
    imapPass: string,
    folder: string,
    limit: number,
    offset: number,
    filter?: { since?: string; before?: string }
  ): Promise<EmailListItem[]> {
    return this.withConnection(imapUser, imapPass, async (client) => {
      try {
        await client.mailboxOpen(folder);
      } catch (error) {
        throw new Error(`Failed to open folder "${folder}": ${error}`);
      }

      // Get message UIDs in reverse order (newest first)
      const searchFilter: Record<string, unknown> = {};
      if (filter?.since) {
        searchFilter.since = new Date(filter.since);
      } else if (filter?.before) {
        searchFilter.before = new Date(filter.before);
      }

      const uids = await client.search(
        Object.keys(searchFilter).length > 0 ? searchFilter : { all: true }
      );
      const reversedUids = Array.isArray(uids) ? uids : [];
      const selectedUids = reversedUids
        .slice(
          Math.max(0, reversedUids.length - limit - offset),
          reversedUids.length - offset || undefined
        )
        .reverse();

      const emails: EmailListItem[] = [];

      for (const uid of selectedUids) {
        try {
          const message = await client.fetchOne(uid, {
            source: false,
            envelope: true,
            flags: true,
            uid: true,
          });

          if (message && message.envelope) {
            const envelope = message.envelope;
            const flags = message.flags || new Set<string>();
            emails.push({
              uid: message.uid,
              subject: envelope.subject || "(no subject)",
              from: envelope.from?.[0]?.address || "unknown",
              to: envelope.to?.[0]?.address || "unknown",
              date: envelope.date ? new Date(envelope.date).toISOString() : "",
              read: flags.has("\\Seen"),
              flagged: flags.has("\\Flagged"),
              messageId: envelope.messageId || undefined,
            });
          }
        } catch (error) {
          console.error(`Error fetching message ${uid}:`, error);
          continue;
        }
      }

      return emails;
    });
  }

  async searchEmails(
    imapUser: string,
    imapPass: string,
    folder: string,
    query: string | undefined,
    searchQuery: SearchQuery,
    limit: number,
    sortOrder: "asc" | "desc" = "desc"
  ): Promise<EmailListItem[]> {
    return this.withConnection(imapUser, imapPass, async (client) => {
      try {
        await client.mailboxOpen(folder);
      } catch (error) {
        throw new Error(`Failed to open folder "${folder}": ${error}`);
      }

      // Build IMAP search query
      const searchCriteria: Record<string, unknown> = {};

      if (query) {
        searchCriteria.text = query;
      }

      if (searchQuery.from) {
        searchCriteria.from = searchQuery.from;
      }

      if (searchQuery.to) {
        searchCriteria.to = searchQuery.to;
      }

      if (searchQuery.subject) {
        searchCriteria.subject = searchQuery.subject;
      }

      if (searchQuery.since) {
        searchCriteria.since = new Date(searchQuery.since);
      }

      if (searchQuery.before) {
        searchCriteria.before = new Date(searchQuery.before);
      }

      // Perform search
      const uids = await client.search(searchCriteria);
      const reversedUids = Array.isArray(uids) ? uids : [];
      const limitedUids = reversedUids.slice(-limit);
      const selectedUids = sortOrder === "desc" ? limitedUids.reverse() : limitedUids;

      const emails: EmailListItem[] = [];

      for (const uid of selectedUids) {
        try {
          const message = await client.fetchOne(uid, {
            source: false,
            envelope: true,
            flags: true,
            uid: true,
          });

          if (message && message.envelope) {
            const envelope = message.envelope;
            const flags = message.flags || new Set<string>();
            emails.push({
              uid: message.uid,
              subject: envelope.subject || "(no subject)",
              from: envelope.from?.[0]?.address || "unknown",
              to: envelope.to?.[0]?.address || "unknown",
              date: envelope.date ? new Date(envelope.date).toISOString() : "",
              read: flags.has("\\Seen"),
              flagged: flags.has("\\Flagged"),
              messageId: envelope.messageId || undefined,
            });
          }
        } catch (error) {
          console.error(`Error fetching message ${uid}:`, error);
          continue;
        }
      }

      return emails;
    });
  }

  async readEmail(
    imapUser: string,
    imapPass: string,
    folder: string,
    uid: number
  ): Promise<EmailContent> {
    return this.withConnection(imapUser, imapPass, async (client) => {
      try {
        await client.mailboxOpen(folder);
      } catch (error) {
        throw new Error(`Failed to open folder "${folder}": ${error}`);
      }

      let message;
      try {
        message = await client.fetchOne(uid, {
          source: true,
          envelope: true,
          flags: true,
          uid: true,
        });
      } catch (error) {
        throw new Error(`Failed to fetch message ${uid}: ${error}`);
      }

      if (!message) {
        throw new Error(`Message ${uid} not found in folder "${folder}"`);
      }

      const envelope = message.envelope;
      const flags = message.flags || new Set<string>();
      const attachments: AttachmentInfo[] = [];

      // Extract text body from source
      let textBody = "";
      const sourceText = this.normalizeSource(message.source);
      if (sourceText) {
        textBody = this.extractTextFromSource(sourceText);
      }

      return {
        uid: message.uid,
        subject: envelope?.subject || "(no subject)",
        from: envelope?.from?.[0]?.address || "unknown",
        to: envelope?.to?.[0]?.address || "unknown",
        cc: envelope?.cc?.[0]?.address,
        bcc: envelope?.bcc?.[0]?.address,
        date: envelope?.date ? new Date(envelope.date).toISOString() : "",
        textBody,
        htmlBody: undefined,
        read: flags.has("\\Seen"),
        flagged: flags.has("\\Flagged"),
        attachments,
      };
    });
  }

  async getReplyContext(
    imapUser: string,
    imapPass: string,
    folder: string,
    uid: number
  ): Promise<ReplyContext> {
    return this.withConnection(imapUser, imapPass, async (client) => {
      try {
        await client.mailboxOpen(folder);
      } catch (error) {
        throw new Error(`Failed to open folder "${folder}": ${error}`);
      }

      const message = await client.fetchOne(uid, {
        source: true,
        envelope: true,
        uid: true,
      });

      if (!message) {
        throw new Error(`Message ${uid} not found in folder "${folder}"`);
      }

      const sourceText = this.normalizeSource(message.source);
      const headers = this.extractHeaders(sourceText);
      const envelope = message.envelope;

      const replyTo = this.mapAddresses(envelope?.replyTo);
      const fallbackReplyTo =
        replyTo.length > 0
          ? replyTo
          : this.extractEmailAddresses(headers.get("reply-to"));

      const referencesHeader = headers.get("references");
      const references = referencesHeader
        ? referencesHeader.split(/\s+/).filter(Boolean)
        : [];

      return {
        uid: message.uid,
        folder,
        subject: envelope?.subject || "(no subject)",
        from: this.mapAddresses(envelope?.from),
        replyTo: fallbackReplyTo,
        to: this.mapAddresses(envelope?.to),
        cc: this.mapAddresses(envelope?.cc),
        messageId: envelope?.messageId || headers.get("message-id"),
        inReplyTo: envelope?.inReplyTo || headers.get("in-reply-to"),
        references,
      };
    });
  }

  private extractTextFromSource(source: string): string {
    // Simple extraction: look for common body delimiters
    const lines = source.split("\n");
    let bodyStarted = false;
    const bodyLines: string[] = [];

    for (const line of lines) {
      if (line.trim() === "" && !bodyStarted) {
        bodyStarted = true;
        continue;
      }
      if (bodyStarted && !line.startsWith("--")) {
        bodyLines.push(line);
      }
    }

    return bodyLines.join("\n").trim().substring(0, 5000); // Limit to 5000 chars
  }

  private normalizeSource(source: MessageSource): string {
    if (!source) {
      return "";
    }

    if (typeof source === "string") {
      return source;
    }

    if (Buffer.isBuffer(source)) {
      return source.toString("utf8");
    }

    if (ArrayBuffer.isView(source)) {
      return Buffer.from(
        source.buffer,
        source.byteOffset,
        source.byteLength
      ).toString("utf8");
    }

    return "";
  }

  private extractHeaders(source: string): Map<string, string> {
    const headers = new Map<string, string>();
    const lines = source.split(/\r?\n/);
    let currentName: string | null = null;
    let currentValue = "";

    for (const line of lines) {
      if (line.trim() === "") {
        break;
      }

      if (/^\s/.test(line) && currentName) {
        currentValue += ` ${line.trim()}`;
        continue;
      }

      if (currentName) {
        headers.set(currentName, currentValue.trim());
      }

      const separator = line.indexOf(":");
      if (separator === -1) {
        currentName = null;
        currentValue = "";
        continue;
      }

      currentName = line.slice(0, separator).trim().toLowerCase();
      currentValue = line.slice(separator + 1).trim();
    }

    if (currentName) {
      headers.set(currentName, currentValue.trim());
    }

    return headers;
  }

  private mapAddresses(addresses?: MessageAddressObject[]): string[] {
    return (addresses || [])
      .map((address) => address.address)
      .filter((address): address is string => Boolean(address));
  }

  private extractEmailAddresses(headerValue?: string): string[] {
    if (!headerValue) {
      return [];
    }

    return headerValue.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  }
}
