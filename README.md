# mailbox-mcp

![MIT License](https://img.shields.io/badge/license-MIT-green.svg)
![Bun >=1.0](https://img.shields.io/badge/bun-%3E%3D1.0-black.svg)
![Node >=20](https://img.shields.io/badge/node-%3E%3D20-339933.svg)

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server for mailboxes. It exposes IMAP mailbox browsing plus SMTP send/reply tools over Streamable HTTP, while keeping user credentials out of server-side storage.

## Highlights

- Streamable HTTP transport for hosted MCP deployments
- Per-request AES-256-GCM credential encryption
- Optional header-based defaults via `x-imap-user` and `x-imap-pass`
- Shared IMAP connection pool keyed by mailbox user
- Optional SMTP send and reply tools using the same mailbox credentials
- Bun-first developer workflow with Node.js 20+ compatibility

## Tools

| Tool | Description |
| --- | --- |
| `imap_encrypt_credentials` | Encrypt IMAP credentials into a reusable token |
| `imap_list_folders` | List mailbox folders with message and unread counts |
| `imap_list_emails` | List recent emails in a folder with pagination |
| `imap_search_emails` | Search emails by text, sender, recipient, subject, or date filters |
| `imap_read_email` | Read a single email by UID |
| `smtp_send_email` | Send a new email when SMTP is configured |
| `smtp_reply_email` | Reply to an existing mailbox message when SMTP is configured |

## Documentation

- [Setup guide](./docs/setup.md)
- [Architecture](./docs/architecture.md)
- [Project summary](./docs/project-summary.md)
- [Roadmap](./docs/roadmap.md)
- [Release checklist](./docs/delivery-checklist.md)
- [Contributing](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security policy](./SECURITY.md)
- [Changelog](./CHANGELOG.md)

## Setup Tutorial

This is the shortest reliable path from zero to a working MCP mail server.

### What gets configured where

There are two separate configuration layers:

1. **Server environment**
   This is where you set the shared IMAP/SMTP host settings and the server encryption key.

2. **MCP client configuration**
   This is where each user provides their own mailbox credentials.

Important:

- SMTP is enabled **only** on the server via `SMTP_HOST`, `SMTP_PORT`, and `SMTP_TLS`.
- You do **not** need separate SMTP headers in the MCP client.
- The existing mailbox credentials (`x-imap-user` / `x-imap-pass`) are reused for both IMAP and SMTP.

### 1. Install dependencies

```bash
bun install
```

### 2. Generate an encryption key

The server requires one 64-character hex key:

```bash
openssl rand -hex 32
```

Example output:

```text
0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

### 3. Create `.env`

```bash
cp .env.example .env
```

### 4. Fill in the server environment

#### IMAP only

```env
IMAP_HOST=imap.yourserver.com
IMAP_PORT=993
IMAP_TLS=true

ENCRYPTION_KEY=your-64-character-hex-key
PORT=3000
LOG_LEVEL=info
```

#### IMAP + SMTP

```env
IMAP_HOST=imap.yourserver.com
IMAP_PORT=993
IMAP_TLS=true

SMTP_HOST=smtp.yourserver.com
SMTP_PORT=587
SMTP_TLS=true

ENCRYPTION_KEY=your-64-character-hex-key
PORT=3000
LOG_LEVEL=info
```

Notes:

- `IMAP_HOST` is required.
- `ENCRYPTION_KEY` is required.
- `SMTP_HOST` is optional. If it is missing, SMTP tools are not registered.
- For most providers, `SMTP_PORT=587` and `SMTP_TLS=true` is correct.
- If your provider requires implicit TLS on port `465`, use `SMTP_PORT=465`.

### 5. Start the server

#### Local development

```bash
bun run dev
```

#### Production build

```bash
bun run build
bun run start
```

#### Docker

```bash
docker compose up --build
```

### 6. Verify the server is running

The server exposes:

- MCP endpoint: `http://localhost:3000/mcp`
- Health endpoint: `http://localhost:3000/health`

Quick health check:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{"status":"ok","service":"mailbox-mcp"}
```

## MCP Client Configuration

The server supports two credential flows:

1. Configure `x-imap-user` and `x-imap-pass` headers in the MCP client.
2. Call `imap_encrypt_credentials` once and pass the returned token as the `credentials` argument to IMAP and SMTP tools.

For most setups, the header-based approach is simpler.

### Important SMTP note

You do **not** need to add SMTP-specific fields to the MCP object.

This is enough:

- `x-imap-user`
- `x-imap-pass`

Those same mailbox credentials are used for:

- `imap_list_folders`
- `imap_list_emails`
- `imap_search_emails`
- `imap_read_email`
- `smtp_send_email`
- `smtp_reply_email`

For SMTP, the sender is resolved per request:

- if the tool call includes `from`, that value is used
- otherwise the authenticated mailbox user is used

### Claude Desktop

Config file paths:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: no official Claude Desktop app path at the moment

If you use Claude Desktop, edit the desktop config file for your platform:

```json
{
  "mcpServers": {
    "mailbox": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-deployed-server.example.com/mcp",
        "--header",
        "x-imap-user:you@yourcompany.com",
        "--header",
        "x-imap-pass:your-imap-password"
      ]
    }
  }
}
```

### Claude Code / Cowork

Config file paths:

- macOS: `~/.claude/settings.json`
- Linux: `~/.claude/settings.json`
- Windows: `%USERPROFILE%\\.claude\\settings.json`

If you use Claude Code or Cowork, edit the user settings file for your platform:

```json
{
  "mcpServers": {
    "mailbox": {
      "type": "http",
      "url": "https://your-deployed-server.example.com/mcp",
      "headers": {
        "x-imap-user": "you@yourcompany.com",
        "x-imap-pass": "your-imap-password"
      }
    }
  }
}
```

### Claude Code / Cowork Project Settings

In addition to the user-level file, Claude Code supports project-scoped settings.

Common locations:

- shared project settings: `.claude/settings.json`
- local project overrides: `.claude/settings.local.json`
- MCP-only project config: `.mcp.json`

Example project-scoped config:

```json
{
  "mcpServers": {
    "mailbox": {
      "type": "http",
      "url": "https://your-deployed-server.example.com/mcp",
      "headers": {
        "x-imap-user": "you@yourcompany.com",
        "x-imap-pass": "your-imap-password"
      }
    }
  }
}
```

### When do I need `imap_encrypt_credentials`?

Use `imap_encrypt_credentials` if:

- you do not want to store mailbox credentials as MCP headers
- you want to pass a reusable encrypted token directly to tool calls

If you already use `x-imap-user` and `x-imap-pass`, you usually do not need it.

## First IMAP Checks

After the MCP client is connected, run these tools in order:

### 1. List folders

```json
{}
```

for `imap_list_folders`

### 2. List emails

```json
{
  "folder": "INBOX",
  "limit": 10
}
```

for `imap_list_emails`

### 3. Read one email

Take a `uid` from the previous result:

```json
{
  "folder": "INBOX",
  "uid": 123
}
```

for `imap_read_email`

## First SMTP Checks

SMTP tools appear only if `SMTP_HOST` is configured on the server.

### 1. Send a new email

```json
{
  "to": ["person@example.com"],
  "subject": "SMTP test",
  "text": "Hello from mailbox-mcp"
}
```

for `smtp_send_email`

Optional sender override:

```json
{
  "to": ["person@example.com"],
  "subject": "SMTP test",
  "text": "Hello from mailbox-mcp",
  "from": "alias@example.com"
}
```

### 2. Reply to an existing email

Use a `uid` from `imap_list_emails` or `imap_search_emails`:

```json
{
  "folder": "INBOX",
  "uid": 123,
  "text": "Thanks, I will get back to you shortly."
}
```

for `smtp_reply_email`

Reply all:

```json
{
  "folder": "INBOX",
  "uid": 123,
  "text": "Thanks, I will get back to you shortly.",
  "reply_all": true
}
```

## Provider Notes

### Typical hosted mail server

```env
IMAP_PORT=993
IMAP_TLS=true
SMTP_PORT=587
SMTP_TLS=true
```

### SMTP on port 465

```env
SMTP_PORT=465
SMTP_TLS=true
```

### Gmail / Google Workspace

- IMAP usually: `imap.gmail.com:993`
- SMTP usually: `smtp.gmail.com:587`
- you typically need an app password

### Microsoft 365 / Outlook

- IMAP usually: `outlook.office365.com:993`
- SMTP usually: `smtp.office365.com:587`

## Troubleshooting

### SMTP tools are not visible

- Check that `SMTP_HOST` is set on the server
- Restart or redeploy the server
- Verify the server logs do not show SMTP config errors

### IMAP works, SMTP fails

- Confirm the mailbox credentials are also valid for SMTP submission
- Re-check `SMTP_HOST`, `SMTP_PORT`, and `SMTP_TLS`
- Try `587` first unless your provider explicitly requires `465`

### No credentials provided

- Check your MCP object for `x-imap-user` and `x-imap-pass`
- Or use `imap_encrypt_credentials` and pass `credentials` explicitly

### Sender address is wrong

- If you pass `from`, that value is used
- If you omit `from`, the authenticated mailbox user is used
- There is no server-side default sender override

## Security Model

- `IMAP_HOST` and transport settings are shared server configuration.
- `ENCRYPTION_KEY` is required and must be a 64-character hex value.
- IMAP credentials are never written to disk by the server.
- Header-based defaults are converted into the same encrypted token format used by `imap_encrypt_credentials`.
- IMAP and SMTP operations resolve credentials just in time for the current request.

For reporting vulnerabilities, see [SECURITY.md](./SECURITY.md).

## Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `IMAP_HOST` | Yes | None | Shared IMAP server hostname |
| `IMAP_PORT` | No | `993` | IMAP server port |
| `IMAP_TLS` | No | `true` | Whether TLS is enabled |
| `SMTP_HOST` | No | None | Enables SMTP tools when set |
| `SMTP_PORT` | No | `587` | SMTP submission port |
| `SMTP_TLS` | No | `true` | Require TLS for SMTP when not using port `465` |
| `ENCRYPTION_KEY` | Yes | None | 64-character hex AES-256-GCM key |
| `PORT` | No | `3000` | HTTP listen port |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, or `error` |

## Development

```bash
bun run type-check
bun run build
bun test
```

The repository includes focused Bun tests for SMTP schema validation, tool registration, and reply helper behavior.

## Project Structure

```text
mailbox-mcp/
├── docs/
├── scripts/
│   └── encrypt-credentials.ts
├── src/
│   ├── crypto.ts
│   ├── imap-client.ts
│   ├── index.ts
│   ├── smtp-client.ts
│   ├── smtp-utils.ts
│   ├── schemas/
│   └── tools/
├── tests/
├── CHANGELOG.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── SECURITY.md
├── Dockerfile
└── docker-compose.yml
```

## Data Protection / DSGVO

`mailbox-mcp` is a self-hosted tool. It does not collect, store, or transmit personal data on its own — all email content is fetched directly from the IMAP server configured by the operator and returned to the requesting MCP client within the same request.

Operators who deploy this software to process mailboxes containing personal data are acting as data controllers or processors under the GDPR / DSGVO and are solely responsible for ensuring their deployment complies with applicable data protection law, including appropriate access controls, logging, and data processing agreements with their users.

## Publisher

`mailbox-mcp` is developed and maintained by **q23 GmbH**.
Contact: [q23.de/media.html#kontakt-3](https://q23.de/media.html#kontakt-3)

## License

MIT. See [LICENSE](./LICENSE).
