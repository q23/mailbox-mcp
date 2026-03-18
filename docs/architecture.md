# Architecture

## Overview

`mailbox-mcp` is an HTTP-based MCP server built around a shared IMAP configuration and per-request mailbox credentials.

Core properties:

- Streamable HTTP transport on `/mcp`
- Stateless request handling
- AES-256-GCM encrypted credential tokens
- Optional header-based default credentials
- Per-user IMAP connection reuse with idle cleanup
- Optional SMTP delivery using the same mailbox credentials

## Request Flow

1. An MCP client sends a request to `/mcp`.
2. The server checks for `x-imap-user` and `x-imap-pass` headers.
3. If both headers are present, the server converts them into the same encrypted token format used by `imap_encrypt_credentials`.
4. The MCP server validates tool input with Zod.
5. Each IMAP or SMTP tool resolves an encrypted credential string into `{ user, pass }`.
6. IMAP tools use the shared `ImapClient` to acquire or create a pooled connection for that mailbox user.
7. SMTP tools create a Nodemailer transport on demand with the same mailbox credentials.
8. The tool executes the operation and returns markdown-formatted text.

## Transport

- Runtime server: Node HTTP server
- MCP transport: `StreamableHTTPServerTransport`
- Health endpoint: `/health`
- CORS headers allow `mcp-session-id`, `x-imap-user`, and `x-imap-pass`

The shipped runtime uses only HTTP-based transport.

## Credentials

### Server Configuration

- `IMAP_HOST`, `IMAP_PORT`, and `IMAP_TLS` describe the shared IMAP server.
- `SMTP_HOST`, `SMTP_PORT`, and `SMTP_TLS` control optional outbound mail support.
- `ENCRYPTION_KEY` is required and must be a 64-character hex string.

### Token Format

The encrypted credential format is:

```text
base64(iv + authTag + ciphertext)
```

- `iv`: 12 random bytes
- `authTag`: 16 bytes
- `ciphertext`: encrypted JSON payload

Payload shape:

```json
{
  "user": "mailbox@example.com",
  "pass": "imap-password"
}
```

### Credential Sources

There are two supported sources:

1. `credentials` argument passed directly to a tool
2. Request headers `x-imap-user` and `x-imap-pass`

Tool handlers prefer the explicit `credentials` argument and otherwise fall back to header-derived defaults for the current request.

## Connection Pool

The shared `ImapClient` keeps one pool per mailbox user.

- Pool key: IMAP username
- Idle timeout: 2 minutes
- Cleanup interval: 60 seconds
- Goal: reduce reconnect overhead without persisting credentials

SMTP transport instances are not pooled. Each SMTP request creates a transport with the resolved mailbox credentials and shared SMTP server config.

## Public Tools

- `imap_encrypt_credentials`
- `imap_list_folders`
- `imap_list_emails`
- `imap_search_emails`
- `imap_read_email`
- `smtp_send_email`
- `smtp_reply_email`

All tools are registered in `src/index.ts`, with input validation in `src/schemas/index.ts` and implementation handlers in `src/tools/`.

## Operational Notes

- The server exits early if `IMAP_HOST` or `ENCRYPTION_KEY` is missing.
- SMTP tools are registered only when `SMTP_HOST` is configured.
- The server does not persist mailbox users, passwords, or encrypted tokens.
- Security boundaries depend on HTTPS, safe environment variable handling, and correct connector configuration in deployment.
