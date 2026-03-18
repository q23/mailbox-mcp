import { createServer } from "http";
import type { IncomingMessage, ServerResponse } from "http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema, TextContent } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { ImapClient } from "./imap-client";
import { encrypt } from "./crypto";
import {
  ListFoldersSchema,
  ListEmailsSchema,
  SearchEmailsSchema,
  ReadEmailSchema,
  SendEmailSchema,
  ReplyEmailSchema,
} from "./schemas/index";
import { SmtpClient } from "./smtp-client";
import { createToolDefinitions } from "./tool-definitions";
import { EncryptCredentialsSchema } from "./tools/encrypt-credentials";
import { handleListFolders } from "./tools/list-folders";
import { handleListEmails } from "./tools/list-emails";
import { handleSearchEmails } from "./tools/search-emails";
import { handleReadEmail } from "./tools/read-email";
import { handleEncryptCredentials } from "./tools/encrypt-credentials";
import { handleSendEmail } from "./tools/send-email";
import { handleReplyEmail } from "./tools/reply-email";

const LOG_LEVEL = (process.env.LOG_LEVEL || "info") as
  | "debug"
  | "info"
  | "warn"
  | "error";

const logger = {
  debug: (msg: string, data?: unknown) => {
    if (LOG_LEVEL === "debug") {
      console.error(`[DEBUG] ${msg}`, data || "");
    }
  },
  info: (msg: string, data?: unknown) => {
    if (["debug", "info"].includes(LOG_LEVEL)) {
      console.error(`[INFO] ${msg}`, data || "");
    }
  },
  warn: (msg: string, data?: unknown) => {
    if (["debug", "info", "warn"].includes(LOG_LEVEL)) {
      console.error(`[WARN] ${msg}`, data || "");
    }
  },
  error: (msg: string, data?: unknown) => {
    console.error(`[ERROR] ${msg}`, data || "");
  },
};

// Global IMAP config (shared across all users)
if (!process.env.IMAP_HOST) {
  logger.error("IMAP_HOST env var is required (e.g. imap.yourserver.com)");
  process.exit(1);
}

const imapConfig = {
  host: process.env.IMAP_HOST,
  port: parseInt(process.env.IMAP_PORT || "993"),
  tls: (process.env.IMAP_TLS || "true").toLowerCase() === "true",
};

const smtpEnabled = Boolean(process.env.SMTP_HOST);
const smtpConfig = smtpEnabled
  ? {
      host: process.env.SMTP_HOST || "",
      port: parseInt(process.env.SMTP_PORT || "587"),
      tls: (process.env.SMTP_TLS || "true").toLowerCase() === "true",
    }
  : undefined;

if (smtpConfig && Number.isNaN(smtpConfig.port)) {
  logger.error("SMTP_PORT must be a valid number when SMTP_HOST is configured");
  process.exit(1);
}

// Load and validate encryption key from env
if (!process.env.ENCRYPTION_KEY) {
  logger.error(
    "ENCRYPTION_KEY env var is required. Generate one with: bun run scripts/encrypt-credentials.ts --generate-key"
  );
  process.exit(1);
}

const encryptionKey = process.env.ENCRYPTION_KEY;

// Validate key format: must be a 64-character hex string (256 bits)
if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
  logger.error(
    "ENCRYPTION_KEY must be a 64-character hex string (256-bit AES key). Generate one with: bun run scripts/encrypt-credentials.ts --generate-key"
  );
  process.exit(1);
}

logger.info("ENCRYPTION_KEY loaded and validated");

// Global IMAP client connection pool (shared across all requests)
const imapClient = new ImapClient({
  host: imapConfig.host,
  port: imapConfig.port,
  tls: imapConfig.tls,
});
const smtpClient = smtpConfig ? new SmtpClient(smtpConfig) : undefined;

// Tool definitions
const tools = createToolDefinitions({ smtpEnabled: Boolean(smtpClient) });

// CORS headers for Claude Desktop / Cowork access
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, mcp-session-id, x-imap-user, x-imap-pass",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

function createMcpServer(defaultCredentials?: string): Server {
  const server = new Server(
    { name: "imap-mcp-server", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  /** Resolve credentials: prefer explicit param, fall back to header-derived default */
  function resolveCredentials(paramCredentials?: string): string {
    const creds = paramCredentials || defaultCredentials;
    if (!creds) {
      throw new Error(
        "No credentials provided. Either pass the 'credentials' parameter or configure " +
        "'x-imap-user' and 'x-imap-pass' headers in your MCP connector settings."
      );
    }
    return creds;
  }

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // Call tool handler
  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      logger.debug(
        `Tool request: ${request.params.name}`,
        request.params.arguments
      );

      try {
        switch (request.params.name) {
          case "imap_encrypt_credentials": {
            const validated = EncryptCredentialsSchema.parse(
              request.params.arguments || {}
            );
            return await handleEncryptCredentials(encryptionKey, validated);
          }
          case "imap_list_folders": {
            const validated = ListFoldersSchema.parse(
              request.params.arguments || {}
            );
            return await handleListFolders(imapClient, encryptionKey, {
              ...validated,
              credentials: resolveCredentials(validated.credentials),
            });
          }
          case "imap_list_emails": {
            const validated = ListEmailsSchema.parse(
              request.params.arguments || {}
            );
            return await handleListEmails(imapClient, encryptionKey, {
              ...validated,
              credentials: resolveCredentials(validated.credentials),
            });
          }
          case "imap_search_emails": {
            const validated = SearchEmailsSchema.parse(
              request.params.arguments || {}
            );
            return await handleSearchEmails(imapClient, encryptionKey, {
              ...validated,
              credentials: resolveCredentials(validated.credentials),
            });
          }
          case "imap_read_email": {
            const validated = ReadEmailSchema.parse(
              request.params.arguments || {}
            );
            return await handleReadEmail(imapClient, encryptionKey, {
              ...validated,
              credentials: resolveCredentials(validated.credentials),
            });
          }
          case "smtp_send_email": {
            if (!smtpClient || !smtpConfig) {
              throw new Error("SMTP support is not configured on this server");
            }

            const validated = SendEmailSchema.parse(
              request.params.arguments || {}
            );
            return await handleSendEmail(
              smtpClient,
              encryptionKey,
              {
                ...validated,
                credentials: resolveCredentials(validated.credentials),
              }
            );
          }
          case "smtp_reply_email": {
            if (!smtpClient || !smtpConfig) {
              throw new Error("SMTP support is not configured on this server");
            }

            const validated = ReplyEmailSchema.parse(
              request.params.arguments || {}
            );
            return await handleReplyEmail(
              imapClient,
              smtpClient,
              encryptionKey,
              {
                ...validated,
                credentials: resolveCredentials(validated.credentials),
              }
            );
          }
          default:
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Unknown tool: ${request.params.name}`,
                } as TextContent,
              ],
              isError: true,
            };
        }
      } catch (error) {
        logger.error(`Tool error for ${request.params.name}`, error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error executing ${request.params.name}: ${errorMessage}`,
            } as TextContent,
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

const PORT = parseInt(process.env.PORT || "3000");

logger.info("Starting IMAP MCP Server (HTTP mode)");
logger.info(`IMAP Host: ${imapConfig.host}:${imapConfig.port}`);
logger.info("Credential-per-request mode enabled");
if (smtpConfig) {
  logger.info(`SMTP enabled for ${smtpConfig.host}:${smtpConfig.port}`);
}

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // Set CORS headers on all responses
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "imap-mcp-server" }));
    return;
  }

  // MCP endpoint - stateless per-request
  if (url.pathname === "/mcp") {
    try {
      // Build default credentials from headers (x-imap-user / x-imap-pass)
      let defaultCredentials: string | undefined;
      const headerUser = req.headers["x-imap-user"];
      const headerPass = req.headers["x-imap-pass"];
      if (headerUser && headerPass) {
        const credJson = JSON.stringify({
          user: String(headerUser),
          pass: String(headerPass),
        });
        defaultCredentials = encrypt(credJson, encryptionKey);
        logger.debug(`Header credentials resolved for: ${String(headerUser)}`);
      }

      const server = createMcpServer(defaultCredentials);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless mode
      });

      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      logger.error("MCP request error", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

httpServer.listen(PORT, "0.0.0.0", () => {
  logger.info(`IMAP MCP Server listening on http://0.0.0.0:${PORT}/mcp`);
});

// Graceful shutdown
const shutdown = async (): Promise<void> => {
  logger.info("Shutting down...");
  await imapClient.disconnect();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown().catch(() => process.exit(1)));
process.on("SIGINT", () => shutdown().catch(() => process.exit(1)));
