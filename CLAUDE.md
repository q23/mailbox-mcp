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

**Transport**: Streamable HTTP — the server exposes an HTTP MCP endpoint on `/mcp` plus a health endpoint on `/health`.

**Request flow**:
1. MCP client sends an HTTP request to `/mcp` with either `credentials` or `x-imap-user` / `x-imap-pass`
2. `src/index.ts` validates input via Zod schemas, then dispatches to a tool handler in `src/tools/`
3. Tool handler calls `resolveCredentials()` from `src/crypto.ts` to decrypt `{user, pass}`
4. Tool handler calls methods on the shared `ImapClient` singleton, which manages a per-credential connection pool
5. Results are returned as markdown-formatted text, and `imap_read_email` suppresses raw HTML output

**Key design decision — credentials-per-request**: No credentials are stored on the server. Each tool call includes encrypted credentials. The server holds only the `ENCRYPTION_KEY`. The connection pool is keyed by a credential fingerprint derived from `{ user, pass }`, so connections can be reused safely within the 2-minute idle timeout without cross-password reuse.

**Encryption format** (`src/crypto.ts`): `base64(12-byte IV || 16-byte authTag || ciphertext)` — AES-256-GCM. The `encrypt-credentials.ts` tool (MCP tool, not script) performs encryption server-side using the same key.

**Connection pool** (`src/imap-client.ts`): One `ImapFlow` connection per credential fingerprint, 2-minute idle timeout, cleaned up by a `setInterval` every 60s. The `withConnection()` pattern handles acquire/release.

**Adding a new tool**:
1. Add Zod schema to `src/schemas/index.ts`
2. Create handler in `src/tools/your-tool.ts` (receives `ImapClient`, `encryptionKey`, validated args)
3. Register tool definition in `src/tool-definitions.ts`
4. Add `case` to the switch in the `CallToolRequestSchema` handler

## Environment Variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `ENCRYPTION_KEY` | **yes** | — | 64-char hex string (256-bit AES key). Server exits if missing/invalid. |
| `IMAP_HOST` | **yes** | — | Shared across all users |
| `IMAP_PORT` | no | `993` | |
| `IMAP_TLS` | no | `true` | |
| `SMTP_HOST` | no | — | Enables `smtp_send_email` and `smtp_reply_email` when set |
| `SMTP_PORT` | no | `587` | |
| `SMTP_TLS` | no | `true` | |
| `LOG_LEVEL` | no | `info` | `debug\|info\|warn\|error` |
| `PORT` | no | `3000` | HTTP listen port |

## TypeScript Config

Strict mode is enabled. `@/` path alias maps to `src/` (configured in `tsconfig.json`). No `any` types allowed in production code.
