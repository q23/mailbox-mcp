# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev          # Development server with hot reload (bun --watch)
bun run build        # Compile TypeScript to dist/
bun run start        # Run compiled output (node dist/index.js)
bun run type-check   # Type check without emitting
bun test             # Run tests
bun run lint         # ESLint on src/

# Generate encryption key
bun run scripts/encrypt-credentials.ts --generate-key

# Encrypt credentials for a user
bun run scripts/encrypt-credentials.ts --user user@domain.com --pass PASSWORD --key HEX_KEY
```

## Architecture

**Transport**: stdio (not HTTP) — the server communicates over stdin/stdout using the MCP protocol. It is not an HTTP server despite `PORT` being an env var.

**Request flow**:
1. MCP client calls a tool with `credentials` (a base64-encoded AES-256-GCM blob)
2. `src/index.ts` validates input via Zod schemas, then dispatches to a tool handler in `src/tools/`
3. Tool handler calls `resolveCredentials()` from `src/crypto.ts` to decrypt `{user, pass}`
4. Tool handler calls methods on the shared `ImapClient` singleton, which manages a per-user connection pool
5. Results are returned as markdown-formatted text

**Key design decision — credentials-per-request**: No credentials are stored on the server. Each tool call includes encrypted credentials. The server holds only the `ENCRYPTION_KEY`. This means the connection pool is keyed by IMAP username (derived from decrypted credentials), and connections are reused across calls within the 2-minute idle timeout.

**Encryption format** (`src/crypto.ts`): `base64(12-byte IV || 16-byte authTag || ciphertext)` — AES-256-GCM. The `encrypt-credentials.ts` tool (MCP tool, not script) performs encryption server-side using the same key.

**Connection pool** (`src/imap-client.ts`): One `ImapFlow` connection per user username, 2-minute idle timeout, cleaned up by a `setInterval` every 60s. The `withConnection()` pattern handles acquire/release.

**Adding a new tool**:
1. Add Zod schema to `src/schemas/index.ts`
2. Create handler in `src/tools/your-tool.ts` (receives `ImapClient`, `encryptionKey`, validated args)
3. Register tool definition in the `tools[]` array in `src/index.ts`
4. Add `case` to the switch in the `CallToolRequestSchema` handler

## Environment Variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `ENCRYPTION_KEY` | **yes** | — | 64-char hex string (256-bit AES key). Server exits if missing/invalid. |
| `IMAP_HOST` | no | `imap.gmail.com` | Shared across all users |
| `IMAP_PORT` | no | `993` | |
| `IMAP_TLS` | no | `true` | |
| `LOG_LEVEL` | no | `info` | `debug\|info\|warn\|error` |
| `PORT` | no | `3000` | Not used for stdio transport |

## TypeScript Config

Strict mode is enabled. `@/` path alias maps to `src/` (configured in `tsconfig.json`). No `any` types allowed in production code.
