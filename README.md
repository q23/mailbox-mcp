# imap-mcp-server

![MIT License](https://img.shields.io/badge/license-MIT-green.svg)
![Bun >=1.0](https://img.shields.io/badge/bun-%3E%3D1.0-black.svg)
![Node >=20](https://img.shields.io/badge/node-%3E%3D20-339933.svg)

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server for IMAP mailboxes. It exposes mailbox browsing and message reading tools over Streamable HTTP, while keeping user credentials out of server-side storage.

## Highlights

- Streamable HTTP transport for hosted MCP deployments
- Per-request AES-256-GCM credential encryption
- Optional header-based defaults via `x-imap-user` and `x-imap-pass`
- Shared IMAP connection pool keyed by mailbox user
- Bun-first developer workflow with Node.js 20+ compatibility

## Tools

| Tool | Description |
| --- | --- |
| `imap_encrypt_credentials` | Encrypt IMAP credentials into a reusable token |
| `imap_list_folders` | List mailbox folders with message and unread counts |
| `imap_list_emails` | List recent emails in a folder with pagination |
| `imap_search_emails` | Search emails by text, sender, recipient, subject, or date filters |
| `imap_read_email` | Read a single email by UID |

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

## Quick Start

### 1. Install dependencies

```bash
bun install
```

### 2. Generate an encryption key

```bash
openssl rand -hex 32
```

### 3. Configure the environment

```bash
cp .env.example .env
```

Set at least:

```env
IMAP_HOST=imap.yourserver.com
IMAP_PORT=993
IMAP_TLS=true
ENCRYPTION_KEY=your-64-character-hex-key
PORT=3000
LOG_LEVEL=info
```

### 4. Start the server

```bash
bun run dev
```

The MCP endpoint is available at `http://localhost:3000/mcp` and the health endpoint at `http://localhost:3000/health`.

### 5. Optional Docker run

```bash
docker compose up --build
```

## MCP Client Configuration

The server supports two credential flows:

1. Configure `x-imap-user` and `x-imap-pass` headers in the MCP client. The server encrypts them per request and uses them as defaults.
2. Call `imap_encrypt_credentials` once and pass the returned token as the `credentials` argument to the IMAP tools.

### Claude Desktop

```json
{
  "mcpServers": {
    "imap": {
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

```json
{
  "mcpServers": {
    "imap": {
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

## Security Model

- `IMAP_HOST` and transport settings are shared server configuration.
- `ENCRYPTION_KEY` is required and must be a 64-character hex value.
- IMAP credentials are never written to disk by the server.
- Header-based defaults are converted into the same encrypted token format used by `imap_encrypt_credentials`.
- All IMAP operations resolve credentials just in time for the current request.

For reporting vulnerabilities, see [SECURITY.md](./SECURITY.md).

## Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `IMAP_HOST` | Yes | None | Shared IMAP server hostname |
| `IMAP_PORT` | No | `993` | IMAP server port |
| `IMAP_TLS` | No | `true` | Whether TLS is enabled |
| `ENCRYPTION_KEY` | Yes | None | 64-character hex AES-256-GCM key |
| `PORT` | No | `3000` | HTTP listen port |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, or `error` |

## Development

```bash
bun run type-check
bun run build
bun test
```

`bun test` is wired in the project, but the repository currently does not ship any test files.

## Project Structure

```text
imap-mcp-server/
├── docs/
├── scripts/
│   └── encrypt-credentials.ts
├── src/
│   ├── crypto.ts
│   ├── imap-client.ts
│   ├── index.ts
│   ├── schemas/
│   └── tools/
├── CHANGELOG.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── SECURITY.md
├── Dockerfile
└── docker-compose.yml
```

## License

MIT. See [LICENSE](./LICENSE).
