# Multi-User Refactoring Migration Guide

## Overview

The IMAP MCP Server has been refactored to support multi-user authentication. All users now share a single IMAP server (same host/port/TLS) but authenticate with their own IMAP credentials via API keys.

## Key Changes

### Architecture

**Before**: Single-user, credentials in environment variables
```
.env:
  IMAP_USER=a.daiker@q23.de
  IMAP_PASS=password
```

**After**: Multi-user, credentials in users.json
```
users.json:
  - api_key: imap-ada-a1b2c3d4e5f6
    imap_user: a.daiker@q23.de
    imap_pass: password
```

### Authentication

**Before**: No authentication; server connected as single user

**After**: Bearer token authentication required for all requests
```
Authorization: Bearer imap-ada-a1b2c3d4e5f6
```

### Connection Model

**Before**: Single global IMAP connection

**After**: Per-user connection pool with idle timeout (5 min)
- Efficient connection reuse
- Automatic cleanup of unused connections
- Max 2 concurrent connections per user (extensible)

## Files Changed

### New Files
- `src/auth.ts` — Authentication manager, API key lookup
- `users.json` — User credentials (should not be committed)
- `users.json.example` — Template for users.json
- `scripts/add-user.ts` — CLI helper to add users
- `MIGRATION_GUIDE.md` — This file

### Modified Files

#### `src/index.ts`
- Load users from `users.json` on startup
- Extract Bearer token from `Authorization: Bearer <key>` header
- Validate API key and look up user credentials
- Pass user context to all tool handlers
- Log multi-user mode enabled

#### `src/imap-client.ts`
- Change from single client to per-user connection pool
- Map connections by `imap_user` (email)
- Implement connection reuse with `withConnection()` helper
- Add idle timeout cleanup (5 min)
- All methods now accept `(imapUser, imapPass, ...)` parameters

#### `src/types.ts`
- Make `user` and `pass` optional in `ImapConfig`
- Add `UserContext` interface for authenticated user data

#### Tool Handlers (all in `src/tools/`)
- `list-folders.ts` — Accept `user: UserContext` parameter
- `list-emails.ts` — Accept `user: UserContext` parameter
- `search-emails.ts` — Accept `user: UserContext` parameter
- `read-email.ts` — Accept `user: UserContext` parameter

#### Configuration Files
- `.env.example` — Updated to reflect shared IMAP config
- `docker-compose.yml` — Mount `users.json` as read-only volume
- `Dockerfile` — Add note about users.json volume requirement
- `README.md` — Complete rewrite with multi-user docs

## Migration Steps

### For Operators

1. **Backup current setup** (if applicable)
   ```bash
   cp .env .env.backup
   ```

2. **Create users.json**
   ```bash
   cp users.json.example users.json
   ```

3. **Edit users.json** with your users
   ```json
   {
     "users": [
       {
         "api_key": "imap-ada-a1b2c3d4e5f6",
         "name": "Andrej Daiker",
         "imap_user": "a.daiker@q23.de",
         "imap_pass": "app-password"
       }
     ]
   }
   ```

4. **Update .env** to global config only
   ```env
   IMAP_HOST=imap.gmail.com
   IMAP_PORT=993
   IMAP_TLS=true
   PORT=3000
   LOG_LEVEL=info
   ```

5. **Verify build**
   ```bash
   npm run build
   ```

6. **Test locally** (if applicable)
   ```bash
   npm run dev
   ```

7. **Deploy** (Docker, Dokploy, etc.)

### For Clients (Claude, MCP Consumers)

**Before**: No authentication headers needed
```
GET /call-tool?name=imap_list_folders
```

**After**: All requests require Bearer token
```
GET /call-tool?name=imap_list_folders
Authorization: Bearer imap-ada-a1b2c3d4e5f6
```

## Adding New Users

### Method 1: CLI Helper

```bash
npx ts-node scripts/add-user.ts
```

Interactive prompts for:
- User name
- IMAP email
- IMAP password
- Generates random API key
- Appends to users.json

### Method 2: Manual

Edit `users.json`:
```json
{
  "users": [
    {
      "api_key": "imap-ada-a1b2c3d4e5f6",
      "name": "Andrej Daiker",
      "imap_user": "a.daiker@q23.de",
      "imap_pass": "password"
    },
    {
      "api_key": "imap-aimo-x9y8z7w6",
      "name": "Aimo Hindriks",
      "imap_user": "a.hindriks@q23.de",
      "imap_pass": "password"
    }
  ]
}
```

## Backward Compatibility

⚠️ **Not backward compatible** — this is a breaking change.

Clients must:
1. Update all requests to include `Authorization: Bearer <api_key>` header
2. Use the new user API keys (not old environment variable credentials)

## Testing Checklist

- [ ] Build succeeds: `npm run build`
- [ ] Type checking passes: `npm run type-check`
- [ ] users.json loads on startup
- [ ] Invalid API key returns 401
- [ ] Valid API key connects to IMAP
- [ ] Per-user isolation works (user A cannot see user B's folders)
- [ ] Connection pool cleanup works (idle timeout)
- [ ] Docker build succeeds
- [ ] Docker volume mount works for users.json
- [ ] All tools work with authentication

## Troubleshooting

### Error: "Failed to load users.json"
- Ensure `users.json` exists in working directory
- Use `cp users.json.example users.json` to create it

### Error: "Invalid API key"
- Verify API key in authorization header matches users.json
- Check for leading/trailing whitespace

### Error: "IMAP authentication failed"
- Verify IMAP credentials in users.json are correct
- Ensure app password (not account password) for Gmail
- Check that email account isn't locked

### Connection timeout
- Verify IMAP_HOST and IMAP_PORT are correct
- Check firewall allows outbound to IMAP port
- Ensure TLS is enabled/disabled correctly

## Performance Notes

- **Connection Pooling**: Connections are reused within 5-minute idle window
- **Per-User Isolation**: Each user has separate connection(s)
- **Memory**: One map entry per active user (~1 KB overhead)
- **Cleanup**: Idle connections automatically closed after 5 minutes

## Security Notes

- API keys are transmitted in Authorization header (use HTTPS in production)
- Passwords stored in users.json (should be restricted file permissions: 600)
- No credentials in HTTP logs (Bearer token not echoed)
- No credentials in tool parameters (resolved server-side)
- Consider storing passwords encrypted or using environment injection in prod
