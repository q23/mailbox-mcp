import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, TextContent, Tool } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { ImapClient } from "./imap-client";
import { authManager } from "./auth";
import type { UserContext } from "./types";
import {
  ListFoldersSchema,
  ListEmailsSchema,
  SearchEmailsSchema,
  ReadEmailSchema,
} from "./schemas/index";
import { handleListFolders } from "./tools/list-folders";
import { handleListEmails } from "./tools/list-emails";
import { handleSearchEmails } from "./tools/search-emails";
import { handleReadEmail } from "./tools/read-email";

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
  host: process.env.IMAP_HOST || "imap.gmail.com",
  port: parseInt(process.env.IMAP_PORT || "993"),
  tls: (process.env.IMAP_TLS || "true").toLowerCase() === "true",
};

// Load users from users.json
try {
  authManager.loadUsers();
  const users = authManager.getAllUsers();
  logger.info(`Loaded ${users.length} users from users.json`);
  users.forEach((u) => {
    logger.debug(`  - ${u.name} (${u.imap_user})`);
  });
} catch (error) {
  logger.error(
    "Failed to load users.json. Make sure it exists in the working directory."
  );
  process.exit(1);
}

// Global IMAP client for connection pool
const imapClient = new ImapClient({
  host: imapConfig.host,
  port: imapConfig.port,
  tls: imapConfig.tls,
  user: "", // Will be set per-request
  pass: "", // Will be set per-request
});

// Define tools
const tools: Tool[] = [
  {
    name: "imap_list_folders",
    description:
      "List all mailbox folders (INBOX, Sent, Drafts, etc.) with message and unread counts",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "imap_list_emails",
    description:
      "List recent emails from a specific folder with pagination support",
    inputSchema: {
      type: "object",
      properties: {
        folder: {
          type: "string",
          description: "Folder name (default: INBOX)",
        },
        limit: {
          type: "number",
          description: "Maximum number of emails to return (default: 20, max: 100)",
        },
        offset: {
          type: "number",
          description: "Number of emails to skip for pagination (default: 0)",
        },
      },
      required: [],
    },
  },
  {
    name: "imap_search_emails",
    description:
      "Search emails by various criteria (query, from, to, subject, date range)",
    inputSchema: {
      type: "object",
      properties: {
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
      required: ["query"],
    },
  },
  {
    name: "imap_read_email",
    description: "Read the full content of a single email by message ID",
    inputSchema: {
      type: "object",
      properties: {
        uid: {
          type: "number",
          description: "Message UID (unique identifier in folder)",
        },
        folder: {
          type: "string",
          description: "Folder name (default: INBOX)",
        },
      },
      required: ["uid"],
    },
  },
];

async function main(): Promise<void> {
  logger.info("Starting IMAP MCP Server");
  logger.info(`IMAP Host: ${imapConfig.host}:${imapConfig.port}`);
  logger.info("Multi-user mode enabled - using users.json for authentication");

  // Create MCP server
  const server = new Server({
    name: "imap-mcp-server",
    version: "1.0.0",
  });

  /**
   * Helper function to extract API key from Bearer token
   * Authorization: Bearer <api_key>
   */
  function extractApiKey(
    request: CallToolRequest & { meta?: { headers?: Record<string, string> } }
  ): string | null {
    // Try to get from meta.headers (standard MCP format)
    const headers = (request.meta?.headers as Record<string, string>) || {};
    const authHeader = headers.authorization || headers.Authorization;

    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      return parts[1];
    }

    return null;
  }

  // Register tool request handler
  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    logger.debug(`Tool request: ${request.params.name}`, request.params.arguments);

    // Extract and validate API key
    const apiKey = extractApiKey(request);
    if (!apiKey) {
      logger.warn("Tool request without Authorization header");
      return {
        content: [
          {
            type: "text" as const,
            text: "Missing or invalid Authorization header. Use: Authorization: Bearer <api_key>",
          } as TextContent,
        ],
        isError: true,
      };
    }

    const userConfig = authManager.getUserByApiKey(apiKey);
    if (!userConfig) {
      logger.warn(`Invalid API key: ${apiKey}`);
      return {
        content: [
          {
            type: "text" as const,
            text: "Invalid API key",
          } as TextContent,
        ],
        isError: true,
      };
    }

    const user: UserContext = {
      apiKey,
      name: userConfig.name,
      imapUser: userConfig.imap_user,
      imapPass: userConfig.imap_pass,
    };

    logger.info(`Tool request from user: ${user.name}`);

    try {
      switch (request.params.name) {
        case "imap_list_folders": {
          const validated = ListFoldersSchema.parse(request.params.arguments || {});
          return await handleListFolders(imapClient, user, validated);
        }

        case "imap_list_emails": {
          const validated = ListEmailsSchema.parse(request.params.arguments || {});
          return await handleListEmails(imapClient, user, validated);
        }

        case "imap_search_emails": {
          const validated = SearchEmailsSchema.parse(request.params.arguments || {});
          return await handleSearchEmails(imapClient, user, validated);
        }

        case "imap_read_email": {
          const validated = ReadEmailSchema.parse(request.params.arguments || {});
          return await handleReadEmail(imapClient, user, validated);
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
      logger.error(`Tool error for user ${user.name}: ${request.params.name}`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
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
  });

  // Set tools list
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.setRequestHandler(
    {
      method: "tools/list",
    } as any,
    async () => {
      return { tools };
    }
  );

  // Connect transport
  const transport = new StdioServerTransport();

  logger.info("Connecting transport...");
  await server.connect(transport);
  logger.info("IMAP MCP Server running (stdio mode)");

  // Cleanup on exit
  const cleanup = async (): Promise<void> => {
    logger.info("Shutting down...");
    await imapClient.disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    cleanup().catch((err) => {
      logger.error("Error during cleanup:", err);
      process.exit(1);
    });
  });

  process.on("SIGINT", () => {
    cleanup().catch((err) => {
      logger.error("Error during cleanup:", err);
      process.exit(1);
    });
  });
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
