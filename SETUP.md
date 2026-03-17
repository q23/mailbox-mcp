# IMAP MCP Server - Setup Guide

## Project Overview

This is a complete, production-ready IMAP MCP Server implementation with the following characteristics:

- **Runtime**: Designed for Bun 1.0+, compatible with Node.js 20+
- **Language**: TypeScript 5.4+ with strict mode enabled
- **Transport**: Model Context Protocol (MCP) via stdio
- **IMAP Client**: Uses `imapflow` (v1.2.15)
- **Deployment**: Docker + Dokploy ready with multi-stage builds

## Project Structure

```
imap-mcp-server/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── imap-client.ts           # IMAP connection management
│   ├── types.ts                 # TypeScript type definitions
│   ├── schemas/
│   │   └── index.ts             # Zod validation schemas
│   └── tools/                   # Tool implementations
│       ├── list-folders.ts      # imap_list_folders handler
│       ├── list-emails.ts       # imap_list_emails handler
│       ├── search-emails.ts     # imap_search_emails handler
│       └── read-email.ts        # imap_read_email handler
├── dist/                        # Compiled JavaScript (generated)
├── Dockerfile                   # Multi-stage Docker build
├── docker-compose.yml           # Docker Compose configuration
├── package.json                 # Dependencies & scripts
├── tsconfig.json                # TypeScript configuration
├── .env.example                 # Environment variables template
├── .eslintrc.json               # ESLint configuration
├── README.md                    # User documentation
└── build.sh                     # Build script for CI/CD
```

## Installation

### 1. Install Dependencies

**Using Bun** (recommended):
```bash
bun install
```

**Using npm**:
```bash
npm install
```

### 2. Build

**Using Bun**:
```bash
bun run build
```

**Using npm**:
```bash
npm run build
```

Or use the provided build script:
```bash
bash build.sh
```

### 3. Environment Configuration

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` with your IMAP credentials:
```env
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your-email@gmail.com
IMAP_PASS=your-app-password
IMAP_TLS=true
PORT=3000
LOG_LEVEL=info
```

## Running Locally

### Development (with auto-reload)

**Using Bun**:
```bash
bun run dev
```

### Production

**Using Node.js**:
```bash
npm start
```

**Using Bun**:
```bash
bun run dist/index.js
```

## Docker Deployment

### Local Testing

Build and run with Docker Compose:
```bash
docker-compose up --build
```

This will:
1. Build the Docker image using multi-stage process
2. Mount `.env` file for environment variables
3. Expose server on port 3000
4. Include health check endpoint

### View Logs
```bash
docker-compose logs -f
```

### Stop Container
```bash
docker-compose down
```

## Dokploy Deployment

### Prerequisites
- Dokploy account and instance
- Connected Git repository
- Environment variables configured

### Deployment Steps

1. **Create Application in Dokploy**
   - Click "Create App" or "Create Service"
   - Select "Docker Compose"
   - Connect your Git repository

2. **Configure Environment Variables**

   Set these in Dokploy dashboard:
   ```
   IMAP_HOST=imap.gmail.com
   IMAP_PORT=993
   IMAP_USER=your-email@gmail.com
   IMAP_PASS=your-app-password
   IMAP_TLS=true
   PORT=3000
   LOG_LEVEL=info
   ```

3. **Deploy**
   - Dokploy automatically detects `docker-compose.yml`
   - Builds using the provided Dockerfile
   - Deploys to your infrastructure
   - Monitors health checks

4. **Access**
   - Your app will be available at your Dokploy domain
   - Health checks run automatically every 30 seconds

## Development Workflow

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

### Building
```bash
npm run build
```

## Testing IMAP Connection

Once running, you can test the server by sending MCP requests through stdio. The server will respond with tool definitions and results.

Example request (via MCP client):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

Expected response includes all 4 tools:
- `imap_list_folders`
- `imap_list_emails`
- `imap_search_emails`
- `imap_read_email`

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `IMAP_HOST` | `imap.gmail.com` | Yes | IMAP server hostname |
| `IMAP_PORT` | `993` | No | IMAP port (usually 993 for TLS) |
| `IMAP_USER` | - | Yes | Email address or username |
| `IMAP_PASS` | - | Yes | IMAP password or app-specific password |
| `IMAP_TLS` | `true` | No | Use TLS encryption (true/false) |
| `PORT` | `3000` | No | HTTP server listen port |
| `LOG_LEVEL` | `info` | No | Logging level (debug/info/warn/error) |

## Troubleshooting

### Build Errors

**"bun not found"**
- The project automatically falls back to npm/Node.js
- Use `npm run build` directly

**TypeScript errors**
```bash
npm run type-check
```

### Runtime Errors

**"Cannot connect to IMAP server"**
- Verify `IMAP_HOST` and `IMAP_PORT`
- Check credentials in `.env`
- Ensure firewall allows outbound IMAP connections
- For Gmail, use App Password instead of account password

**"IMAP_USER and IMAP_PASS required"**
- These environment variables must be set
- Check `.env` file is in project root
- Restart server after changing environment

**"folder not found"**
- Folder names are case-sensitive on many IMAP servers
- Use `INBOX` (all uppercase) for the main inbox
- Call `imap_list_folders` to see exact folder names

## Project Architecture

### IMAP Client (`src/imap-client.ts`)
- Manages ImapFlow connections
- Handles connection lifecycle
- Provides interface for all IMAP operations
- Automatically closes stale connections

### Tools Implementation
Each tool in `src/tools/` is independent:
- Validates input with Zod schemas
- Calls ImapClient methods
- Returns formatted responses (markdown)
- Handles errors gracefully

### Validation (`src/schemas/index.ts`)
- Zod schemas for all tool inputs
- Type-safe parsing before execution
- Clear error messages on invalid input

## Security Notes

- Credentials are passed only via environment variables (not in code)
- No credential logging in verbose modes
- IMAP connections use TLS by default
- Server validates all inputs before processing
- Read-only operations (no email modification)

## Performance Considerations

- IMAP connections are reused when possible
- Message fetching is paginated (limit 100)
- Search results limited to prevent memory issues
- Text extraction capped at 5000 characters
- No attachment binary data is transmitted

## Files and Their Purposes

| File | Purpose |
|------|---------|
| `src/index.ts` | MCP server setup, tool registration, request routing |
| `src/imap-client.ts` | IMAP connection pooling, message operations |
| `src/types.ts` | TypeScript interface definitions |
| `src/schemas/index.ts` | Zod input validation schemas |
| `src/tools/*.ts` | Individual tool implementations |
| `Dockerfile` | Multi-stage Docker build configuration |
| `docker-compose.yml` | Docker Compose with env file support |
| `package.json` | Dependencies, build scripts, metadata |
| `tsconfig.json` | TypeScript strict mode configuration |

## Next Steps

1. Set up `.env` with your IMAP credentials
2. Run `npm run build` to verify compilation
3. Run `npm start` to test locally
4. Deploy to Docker or Dokploy when ready
5. Monitor logs with `LOG_LEVEL=debug` if issues arise

## Support

For issues:
1. Check environment variables are set
2. Verify IMAP server is accessible
3. Check logs with `LOG_LEVEL=debug`
4. Verify TypeScript compilation: `npm run type-check`
