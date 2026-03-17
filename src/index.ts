import { createServer } from "http";
import type { IncomingMessage, ServerResponse } from "http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema, TextContent, Tool } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { ImapClient } from "./imap-client";
import {
  ListFoldersSchema,
  ListEmailsSchema,
  SearchEmailsSchema,
  ReadEmailSchema,
} from "./schemas/index";
import { EncryptCredentialsSchema } from "./tools/encrypt-credentials";
import { handleListFolders } from "./tools/list-folders";
import { handleListEmails } from "./tools/list-emails";
import { handleSearchEmails } from "./tools/search-emails";
import { handleReadEmail } from "./tools/read-email";
import { handleEncryptCredentials } from "./tools/encrypt-credentials";

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
const imapConfig = {
  host: process.env.IMAP_HOST || "srv8.q23.net",
  port: parseInt(process.env.IMAP_PORT || "993"),
  tls: (process.env.IMAP_TLS || "true").toLowerCase() === "true",
};

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

// Tool definitions
const tools: Tool[] = [
  {
    name: "imap_encrypt_credentials",
    description:
      "Encrypt IMAP credentials for use with other tools. Call this once to get an encrypted token, then use the token for all subsequent IMAP operations.",
    inputSchema: {
      type: "object",
      properties: {
        imap_user: {
          type: "string",
          description: "IMAP email address",
        },
        imap_pass: {
          type: "string",
          description: "IMAP password or app-specific password",
        },
      },
      required: ["imap_user", "imap_pass"],
    },
  },
  {
    name: "imap_list_folders",
    description:
      "List all mailbox folders (INBOX, Sent, Drafts, etc.) with message and unread counts",
    inputSchema: {
      type: "object",
      properties: {
        credentials: {
          type: "string",
          description:
            "Base64-encoded encrypted IMAP credentials (use imap_encrypt_credentials tool to generate)",
        },
      },
      required: ["credentials"],
    },
  },
  {
    name: "imap_list_emails",
    description:
      "List recent emails from a specific folder with pagination support",
    inputSchema: {
      type: "object",
      properties: {
        credentials: {
          type: "string",
          description:
            "Base64-encoded encrypted IMAP credentials (use imap_encrypt_credentials tool to generate)",
        },
        folder: {
          type: "string",
          description: "Folder name (default: INBOX)",
        },
        limit: {
          type: "number",
          description:
            "Maximum number of emails to return (default: 20, max: 100)",
        },
        offset: {
          type: "number",
          description: "Number of emails to skip for pagination (default: 0)",
        },
      },
      required: ["credentials"],
    },
  },
  {
    name: "imap_search_emails",
    description:
      "Search emails by various criteria (query, from, to, subject, date range)",
    inputSchema: {
      type: "object",
      properties: {
        credentials: {
          type: "string",
          description:
            "Base64-encoded encrypted IMAP credentials (use imap_encrypt_credentials tool to generate)",
        },
        query: {
          type: "string",
          description: "Search query text",
        },
        folder: {
          type: "string",
          description: "Folder to search in (default: INBOX)",
        },
        from: {
          type: "string",
          description: "Filter by sender email",
        },
        to: {
          type: "string",
          description: "Filter by recipient email",
        },
        since: {
          type: "string",
          description: "Filter emails since date (ISO 8601 format)",
        },
        before: {
          type: "string",
          description: "Filter emails before date (ISO 8601 format)",
        },
        subject: {
          type: "string",
          description: "Filter by subject line",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 20, max: 100)",
        },
      },
      required: ["credentials", "query"],
    },
  },
  {
    name: "imap_read_email",
    description: "Read the full content of a single email by message ID",
    inputSchema: {
      type: "object",
      properties: {
        credentials: {
          type: "string",
          description:
            "Base64-encoded encrypted IMAP credentials (use imap_encrypt_credentials tool to generate)",
        },
        uid: {
          type: "number",
          description: "Message UID (unique identifier in folder)",
        },
        folder: {
          type: "string",
          description: "Folder name (default: INBOX)",
        },
      },
      required: ["credentials", "uid"],
    },
  },
];

// CORS headers for Claude Desktop / Cowork access
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, mcp-session-id",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

function createMcpServer(): Server {
  const server = new Server(
    { name: "imap-mcp-server", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

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
            return await handleListFolders(imapClient, encryptionKey, validated);
          }
          case "imap_list_emails": {
            const validated = ListEmailsSchema.parse(
              request.params.arguments || {}
            );
            return await handleListEmails(imapClient, encryptionKey, validated);
          }
          case "imap_search_emails": {
            const validated = SearchEmailsSchema.parse(
              request.params.arguments || {}
            );
            return await handleSearchEmails(
              imapClient,
              encryptionKey,
              validated
            );
          }
          case "imap_read_email": {
            const validated = ReadEmailSchema.parse(
              request.params.arguments || {}
            );
            return await handleReadEmail(imapClient, encryptionKey, validated);
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
      const server = createMcpServer();
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
