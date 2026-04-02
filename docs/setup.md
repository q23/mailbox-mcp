# Setup Guide

## Requirements

- Bun 1.0 or newer
- Node.js 20 or newer
- A reachable IMAP server
- A 64-character hex `ENCRYPTION_KEY`

## Local Development

### Install

```bash
bun install
```

### Configure

```bash
cp .env.example .env
```

Example configuration:

```env
IMAP_HOST=imap.yourserver.com
IMAP_PORT=993
IMAP_TLS=true
SMTP_HOST=smtp.yourserver.com
SMTP_PORT=587
SMTP_TLS=true
PORT=3000
LOG_LEVEL=info
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

`IMAP_HOST` and `ENCRYPTION_KEY` are required. User mailbox credentials are not stored in `.env`.
`SMTP_HOST` is optional. When set, the server also registers `smtp_send_email` and `smtp_reply_email`.

### Run

```bash
bun run dev
```

Useful checks:

```bash
bun run type-check
bun run build
bun run lint
```

## Production Run

```bash
bun run build
bun run start
```

The server listens on `0.0.0.0:${PORT}` and exposes:

- `GET /health`
- `POST /mcp`

## Docker

Build and run with Docker Compose:

```bash
docker compose up --build
```

Stop the stack:

```bash
docker compose down
```

The compose setup reads values from `.env` and forwards the required runtime variables into the container.

## MCP Connector Setup

There are two supported ways to provide mailbox credentials.

### Option 1: Header-based defaults

Configure `x-imap-user` and `x-imap-pass` in the MCP client. The server will encrypt them internally and use them as default credentials for the request.

Use this option only for trusted local setups or tightly controlled internal environments, because the client configuration may store mailbox credentials locally.

### Option 2: Encrypted token parameter

Generate a reusable token:

```bash
bun run scripts/encrypt-credentials.ts --generate-key
bun run scripts/encrypt-credentials.ts \
  --user you@example.com \
  --pass your-imap-password \
  --key your-64-character-hex-key
```

Then pass the returned token as the `credentials` argument to the IMAP tools.
The same token is also valid for SMTP tools when SMTP is enabled.
For SMTP, `from` must come from the tool input if you want to override the authenticated mailbox user.

Security recommendations:

- Prefer app passwords over primary mailbox passwords.
- Treat MCP client config files and encrypted tokens as secrets.
- Use HTTPS or an equivalent TLS-terminating reverse proxy for every non-local deployment.

## Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `IMAP_HOST` | Yes | None | Shared IMAP server hostname |
| `IMAP_PORT` | No | `993` | Shared IMAP server port |
| `IMAP_TLS` | No | `true` | Shared TLS toggle |
| `SMTP_HOST` | No | None | Enables SMTP tools when configured |
| `SMTP_PORT` | No | `587` | SMTP submission port |
| `SMTP_TLS` | No | `true` | Require TLS for SMTP when not using port `465` |
| `ENCRYPTION_KEY` | Yes | None | 64-character hex AES-256-GCM key |
| `PORT` | No | `3000` | HTTP listen port |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, or `error` |

## Troubleshooting

### Server exits at startup

- Verify `IMAP_HOST` is set.
- Verify `ENCRYPTION_KEY` is present and exactly 64 hex characters.

### IMAP authentication fails

- Re-check the mailbox user and password provided by header or encrypted token.
- For Gmail or similar providers, use an app password if required.
- If the credentials are stored in a local MCP config file, verify the file was updated and not overridden by another profile or project-level setting.

### SMTP tools are missing

- Verify `SMTP_HOST` is set.
- Restart the server after changing SMTP environment variables.
- Confirm the connector uses mailbox credentials that are valid for SMTP submission.

### MCP tools say no credentials were provided

- Confirm the connector sends `x-imap-user` and `x-imap-pass`, or
- Pass a `credentials` token produced by `imap_encrypt_credentials`

### Folder lookup fails

- Folder names can be server-specific and case-sensitive.
- Use `imap_list_folders` to inspect the exact available mailbox names.
