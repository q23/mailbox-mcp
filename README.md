# IMAP MCP Server

A Model Context Protocol (MCP) server for reading emails via IMAP, built with Bun and TypeScript. Supports multi-user authentication with per-user IMAP credentials.

## Features

- **Multi-User Support** — Multiple users share the same IMAP server; each user authenticates with an API key
- **Per-User Connection Pool** — Efficient connection reuse with idle timeout (5 min)
- **List Mailbox Folders** — Get all folders with message/unread counts
- **List Emails** — Retrieve recent emails from any folder with pagination
- **Search Emails** — Advanced search by sender, recipient, subject, date range
- **Read Email** — Fetch full email content with attachments list
- **Production-Ready** — TypeScript strict mode, Zod validation, Docker support

## Architecture

### Authentication Model

- **Global Config** (`.env`): `IMAP_HOST`, `IMAP_PORT`, `IMAP_TLS` — shared across all users
- **User Config** (`users.json`): Maps API keys to per-user IMAP credentials
- **HTTP Auth**: `Authorization: Bearer <api_key>` header identifies the user
- **No credentials in tool parameters** — all user data is resolved server-side

### users.json Format

```json
{
  "users": [
    {
      "api_key": "imap-ada-a1b2c3d4e5f6",
      "name": "Andrej Daiker",
      "imap_user": "a.daiker@q23.de",
      "imap_pass": "app-password-here"
    },
    {
      "api_key": "imap-aimo-x9y8z7w6",
      "name": "Aimo Hindriks",
      "imap_user": "a.hindriks@q23.de",
      "imap_pass": "their-app-password"
    }
  ]
}
```

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

2. Create `users.json` from template:
```bash
cp users.json.example users.json
```

3. Edit `users.json` with your users and credentials:
```json
{
  "users": [
    {
      "api_key": "imap-ada-a1b2c3d4e5f6",
      "name": "Andrej Daiker",
      "imap_user": "a.daiker@q23.de",
      "imap_pass": "your-app-password"
    }
  ]
}
```

4. Create `.env` file:
```bash
cp .env.example .env
```

5. Update `.env` with global IMAP config:
```env
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_TLS=true
PORT=3000
LOG_LEVEL=info
```

6. Development server:
```bash
npm run dev
```

7. Build for production:
```bash
npm run build
```

8. Type checking:
```bash
npm run type-check
```

### Adding Users via CLI

Use the `add-user` script to interactively add new users:

```bash
npx ts-node scripts/add-user.ts
```

This will:
- Prompt for user name and IMAP email
- Prompt for IMAP password
- Generate a random API key
- Append to `users.json`
- Display the API key for use in requests

### Docker Deployment

#### Local Docker Build

```bash
docker-compose build
docker-compose up
```

This automatically:
- Builds with multi-stage Dockerfile
- Mounts `users.json` as a read-only volume
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

4. Upload or create `users.json` in your repository
5. Dokploy will automatically:
   - Detect `docker-compose.yml`
   - Build and run the container
   - Mount `users.json`
   - Monitor health check
   - Handle logs and restarts

## Authentication

All tool calls require the `Authorization` header with a Bearer token:

```
Authorization: Bearer imap-ada-a1b2c3d4e5f6
```

Example with curl:
```bash
curl -H "Authorization: Bearer imap-ada-a1b2c3d4e5f6" \
  http://localhost:3000/call-tool
```

If the API key is invalid or missing, the server returns a 401 error.

## API Tools

### `imap_list_folders`
List all mailbox folders with counts.

**Auth**: Required (Bearer token)

**Input**: None

**Output**: Markdown table with folders, paths, message counts, unread counts

### `imap_list_emails`
List recent emails from a folder.

**Auth**: Required (Bearer token)

**Input**:
- `folder` (string, optional) — Mailbox name, default: `INBOX`
- `limit` (number, optional) — Max results, default: 20, max: 100
- `offset` (number, optional) — Skip N messages, default: 0

**Output**: Markdown table with sender, subject, date, read status

### `imap_search_emails`
Search emails by criteria.

**Auth**: Required (Bearer token)

**Input**:
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
query="invoice", from="accounting@company.com"
query="support", since="2026-01-01T00:00:00Z", before="2026-03-17T23:59:59Z"
query="contract", subject="agreement"
```

### `imap_read_email`
Get full email content.

**Auth**: Required (Bearer token)

**Input**:
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
│   ├── index.ts           # MCP server setup, tool handlers, auth extraction
│   ├── auth.ts            # User authentication and API key lookup
│   ├── imap-client.ts     # IMAP connection pool & message logic
│   ├── types.ts           # TypeScript interfaces
│   ├── schemas/
│   │   └── index.ts       # Zod input validation schemas
│   └── tools/
│       ├── list-folders.ts
│       ├── list-emails.ts
│       ├── search-emails.ts
│       └── read-email.ts
├── scripts/
│   └── add-user.ts        # CLI helper to add users to users.json
├── Dockerfile             # Multi-stage build
├── docker-compose.yml     # Docker Compose with users.json mount
├── package.json           # Dependencies & scripts
├── tsconfig.json          # TypeScript strict mode
├── .env.example           # Environment template
├── users.json             # User credentials (do not commit)
├── users.json.example     # User template
└── README.md              # This file
```

## Development Guidelines

- **TypeScript Strict Mode**: All `any` types are disallowed
- **Zod Validation**: All tool inputs are validated before processing
- **Error Handling**: Actionable error messages in all responses
- **Read-Only**: No email modification, deletion, or sending
- **Connection Pooling**: Per-user IMAP connections with 5-minute idle timeout
- **Multi-User**: Each request is authenticated and isolated to the user's IMAP account

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `IMAP_HOST` | `imap.gmail.com` | IMAP server hostname (shared across all users) |
| `IMAP_PORT` | `993` | IMAP port (usually 993 for TLS, shared across all users) |
| `IMAP_TLS` | `true` | Use TLS encryption (true/false, shared across all users) |
| `PORT` | `3000` | HTTP server listen port |
| `LOG_LEVEL` | `info` | Logging level (debug/info/warn/error) |

**Note**: User credentials (`imap_user`, `imap_pass`) are configured in `users.json`, NOT environment variables.

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
