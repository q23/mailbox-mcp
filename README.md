# IMAP MCP Server

A Model Context Protocol (MCP) server for reading emails via IMAP, built with Bun and TypeScript. Uses encrypted credentials passed per-request with no server-side credential storage.

## Features

- **Zero Credential Storage** — Credentials encrypted client-side; server only holds encryption key
- **Per-Request Auth** — Each MCP tool call includes encrypted IMAP credentials
- **Per-User Connection Pool** — Efficient connection reuse with idle timeout (2 min)
- **List Mailbox Folders** — Get all folders with message/unread counts
- **List Emails** — Retrieve recent emails from any folder with pagination
- **Search Emails** — Advanced search by sender, recipient, subject, date range
- **Read Email** — Fetch full email content with attachments list
- **Production-Ready** — TypeScript strict mode, Zod validation, AES-256-GCM encryption, Docker support

## Architecture

### Authentication Model (Credentials-Per-Request)

- **Global Config** (`.env`): `IMAP_HOST`, `IMAP_PORT`, `IMAP_TLS` — shared across all users
- **Encryption Key** (`ENCRYPTION_KEY` env): 256-bit AES key, shared with MCP client
- **Per-Request Credentials**: Each tool call includes `encrypted_credentials` parameter
- **No Persistent Storage**: Credentials never stored on server; decrypted on-demand
- **Connection Pool**: Keyed by username, 2-minute idle timeout, max 3 connections per user

### Encryption Scheme

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Format**: `base64(iv:authTag:ciphertext)` combined into single base64 string
- **Payload**: JSON: `{ user: "email@domain.com", pass: "password" }`
- **Key**: 256-bit hex string from `ENCRYPTION_KEY` environment variable

## Quick Start

### Local Development

#### Prerequisites
- Node.js 20+ or [Bun](https://bun.sh/) 1.0+
- IMAP server (e.g., Gmail, Outlook with q23.de domain)

#### Setup

1. Clone and install:
```bash
cd imap-mcp-server
npm install  # or: bun install
```

2. Generate an encryption key (once):
```bash
bun run scripts/encrypt-credentials.ts --generate-key
# Output: a1b2c3d4e5f6...
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Update `.env` with encryption key and IMAP config:
```env
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_TLS=true
PORT=3000
LOG_LEVEL=info
ENCRYPTION_KEY=a1b2c3d4e5f6...  # From step 2
```

5. Development server:
```bash
npm run dev
```

6. Build for production:
```bash
npm run build
```

7. Type checking:
```bash
npm run type-check
```

### Encrypting Credentials for Users

For each user who needs access, encrypt their IMAP credentials:

```bash
bun run scripts/encrypt-credentials.ts \
  --user a.daiker@q23.de \
  --pass MySecretPassword \
  --key a1b2c3d4e5f6...
```

Output:
```
Encrypted token:
xYz123...full_base64_token...
```

The user then uses this token as the `credentials` parameter in their MCP tool calls.

### Docker Deployment

#### Local Docker Build

```bash
docker-compose build
docker-compose up
```

This automatically:
- Builds with multi-stage Dockerfile
- Loads environment from `.env`
- Exposes server on port 3000
- Includes health check

#### Dokploy Deployment

1. Create a new application in Dokploy
2. Connect your Git repository
3. Set these environment variables in Dokploy:
   - `IMAP_HOST` — IMAP server hostname (default: `imap.gmail.com`)
   - `IMAP_PORT` — IMAP port (default: 993)
   - `IMAP_TLS` — `true` or `false` (default: true)
   - `PORT` — HTTP server port (default: 3000)
   - `LOG_LEVEL` — `debug`, `info`, `warn`, or `error`
   - `ENCRYPTION_KEY` — 256-bit hex AES key (generate with `openssl rand -hex 32`)

4. Dokploy will automatically:
   - Detect `docker-compose.yml`
   - Build and run the container
   - Monitor health check
   - Handle logs and restarts

## Authentication

All IMAP tool calls require encrypted credentials passed as a parameter:

1. **First call**: Use `imap_encrypt_credentials` to encrypt your credentials:
```json
{
  "imap_user": "a.daiker@q23.de",
  "imap_pass": "MyPassword"
}
```

2. **All subsequent calls**: Pass the encrypted token:
```json
{
  "credentials": "xYz123...base64_encrypted_token...",
  "folder": "INBOX",
  "limit": 20
}
```

Or use the `encrypt-credentials.ts` script to pre-generate tokens:
```bash
bun run scripts/encrypt-credentials.ts \
  --user a.daiker@q23.de \
  --pass MyPassword \
  --key a1b2c3d4e5f6...
```

**Security Notes**:
- Credentials are encrypted client-side using AES-256-GCM
- The server never stores credentials; they are decrypted on-demand for each request
- The encryption key (`ENCRYPTION_KEY`) is shared only between the client and server
- Each encrypted token can be safely reused within the same session

## API Tools

### `imap_encrypt_credentials`
Encrypt IMAP credentials for use with other tools. Call this once to get an encrypted token, then use the token for all subsequent IMAP operations.

**Input**:
- `imap_user` (string, required) — IMAP email address
- `imap_pass` (string, required) — IMAP password or app-specific password

**Output**: Encrypted token (base64 string) to use as `credentials` parameter in other tools

**Example**:
```json
{
  "imap_user": "a.daiker@q23.de",
  "imap_pass": "app-password-here"
}
```

### `imap_list_folders`
List all mailbox folders with counts.

**Input**:
- `credentials` (string, required) — Encrypted IMAP credentials from `imap_encrypt_credentials`

**Output**: Markdown table with folders, paths, message counts, unread counts

### `imap_list_emails`
List recent emails from a folder.

**Input**:
- `credentials` (string, required) — Encrypted IMAP credentials
- `folder` (string, optional) — Mailbox name, default: `INBOX`
- `limit` (number, optional) — Max results, default: 20, max: 100
- `offset` (number, optional) — Skip N messages, default: 0

**Output**: Markdown table with sender, subject, date, read status

### `imap_search_emails`
Search emails by criteria.

**Input**:
- `credentials` (string, required) — Encrypted IMAP credentials
- `query` (string, required) — Search text
- `folder` (string, optional) — Mailbox name, default: `INBOX`
- `from` (string, optional) — Sender email filter
- `to` (string, optional) — Recipient email filter
- `since` (string, optional) — ISO 8601 date, inclusive
- `before` (string, optional) — ISO 8601 date, inclusive
- `subject` (string, optional) — Subject line filter
- `limit` (number, optional) — Max results, default: 20, max: 100

**Output**: Markdown table with matching emails

**Examples**:
```
credentials="xYz123...", query="invoice", from="accounting@company.com"
credentials="xYz123...", query="support", since="2026-01-01T00:00:00Z", before="2026-03-17T23:59:59Z"
credentials="xYz123...", query="contract", subject="agreement"
```

### `imap_read_email`
Get full email content.

**Input**:
- `credentials` (string, required) — Encrypted IMAP credentials
- `uid` (number, required) — Message UID from list/search results
- `folder` (string, optional) — Mailbox name, default: `INBOX`

**Output**: Markdown with:
- Headers (from, to, cc, bcc, subject, date)
- Read/flagged status
- Full text body (first 5000 chars)
- HTML body (stripped to text, first 5000 chars)
- Attachment list (name, size, type — **NOT binary data**)

## Project Structure

```
imap-mcp-server/
├── src/
│   ├── index.ts           # MCP server setup, tool handlers, encryption key loading
│   ├── crypto.ts          # AES-256-GCM encryption/decryption functions
│   ├── imap-client.ts     # IMAP connection pool & message logic
│   ├── types.ts           # TypeScript interfaces
│   ├── schemas/
│   │   └── index.ts       # Zod input validation schemas
│   └── tools/
│       ├── encrypt-credentials.ts   # Encryption tool handler
│       ├── list-folders.ts
│       ├── list-emails.ts
│       ├── search-emails.ts
│       └── read-email.ts
├── scripts/
│   └── encrypt-credentials.ts   # CLI to encrypt user credentials
├── dist/                  # Compiled TypeScript output (build artifact)
├── Dockerfile             # Multi-stage build
├── docker-compose.yml     # Docker Compose configuration
├── package.json           # Dependencies & scripts
├── tsconfig.json          # TypeScript strict mode
├── .env.example           # Environment template
└── README.md              # This file
```

## Development Guidelines

- **TypeScript Strict Mode**: All `any` types are disallowed
- **Zod Validation**: All tool inputs are validated before processing
- **Error Handling**: Actionable error messages in all responses
- **Read-Only**: No email modification, deletion, or sending
- **Encryption**: AES-256-GCM encryption with authenticated decryption
- **Connection Pooling**: Per-user IMAP connections with 2-minute idle timeout
- **Stateless Auth**: Credentials per-request; no persistent sessions

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `IMAP_HOST` | `imap.gmail.com` | IMAP server hostname (shared across all users) |
| `IMAP_PORT` | `993` | IMAP port (usually 993 for TLS) |
| `IMAP_TLS` | `true` | Use TLS encryption (true/false) |
| `PORT` | `3000` | HTTP server listen port |
| `LOG_LEVEL` | `info` | Logging level (debug/info/warn/error) |
| `ENCRYPTION_KEY` | (none) | 256-bit AES key (hex string, 64 characters). Generate with `openssl rand -hex 32` |

**Note**: User credentials are never stored on the server. They are encrypted per-request using `ENCRYPTION_KEY`.

## Common IMAP Servers

| Provider | Host | Port | Notes |
|----------|------|------|-------|
| Gmail | `imap.gmail.com` | 993 | Use App Password, enable "Less secure apps" or 2FA + App Password |
| Outlook | `outlook.office365.com` | 993 | Use account password or OAuth |
| Yahoo Mail | `imap.mail.yahoo.com` | 993 | Use App Password |
| ProtonMail | `127.0.0.1` (via Bridge) | 1143 | Requires ProtonMail Bridge |
| Fastmail | `imap.fastmail.com` | 993 | Standard IMAP auth |
| Self-hosted | (your server) | 993/143 | Port depends on your config |

## Troubleshooting

### Connection Refused
- Verify `IMAP_HOST` and `IMAP_PORT` are correct
- Check firewall rules allow outbound connections to IMAP port
- Ensure TLS is enabled if using port 993

### Authentication Failed
- Double-check `IMAP_USER` and `IMAP_PASS`
- For Gmail: use App Password, not account password
- Verify account isn't locked due to failed login attempts

### No Emails Found
- Ensure folder name is correct (case-sensitive on some servers)
- Try `INBOX` (all uppercase)
- Check folder accessibility in your email client

### Timeout Errors
- Increase IMAP server response time
- Check network connectivity
- Verify server isn't rate-limiting

## License

MIT
