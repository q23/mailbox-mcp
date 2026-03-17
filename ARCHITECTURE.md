# IMAP MCP Server - Architecture

## Credentials-Per-Request Model with Encryption

This server uses a zero-storage, encrypted-credentials-per-request architecture for secure multi-user email access.

### Overview

- **No server-side credential storage** — credentials are never persisted
- **Encryption client-side** — IMAP credentials encrypted before transmission
- **Per-request authentication** — each tool call includes encrypted credentials
- **Shared secret key** — server and client share an AES-256 encryption key
- **Connection pooling** — IMAP connections pooled by username with 2-minute idle timeout

### Encryption Scheme

**Algorithm**: AES-256-GCM (authenticated encryption with Galois/Counter Mode)

**Format**:
```
base64(iv + authTag + ciphertext)
```

Where:
- `iv` — 12-byte (96-bit) initialization vector
- `authTag` — 16-byte (128-bit) authentication tag
- `ciphertext` — encrypted payload

**Payload Structure**:
```json
{
  "user": "email@domain.com",
  "pass": "imap-password"
}
```

**Key**:
- 256-bit (32-byte) AES key
- Stored as 64-character hexadecimal string in `ENCRYPTION_KEY` environment variable
- Generated with: `openssl rand -hex 32`

### Request Flow

1. **Setup (Admin)**:
   ```bash
   # Generate encryption key (once)
   bun run scripts/encrypt-credentials.ts --generate-key
   # → Output: a1b2c3d4e5f6...

   # Set on server as ENCRYPTION_KEY environment variable
   ```

2. **User Setup (Per User)**:
   ```bash
   # Encrypt user's credentials
   bun run scripts/encrypt-credentials.ts \
     --user user@domain.com \
     --pass password \
     --key a1b2c3d4e5f6...
   # → Output: xYz123...encrypted_token...
   ```

3. **First Tool Call**:
   ```json
   {
     "tool": "imap_encrypt_credentials",
     "params": {
       "imap_user": "user@domain.com",
       "imap_pass": "password"
     }
   }
   ```
   Returns encrypted token.

4. **Subsequent Tool Calls**:
   ```json
   {
     "tool": "imap_list_emails",
     "params": {
       "credentials": "xYz123...encrypted_token...",
       "folder": "INBOX",
       "limit": 20
     }
   }
   ```

### Server-Side Processing

1. Extract `credentials` parameter from tool call
2. Decrypt using `ENCRYPTION_KEY`:
   - Extract IV (first 12 bytes)
   - Extract authTag (next 16 bytes)
   - Extract ciphertext (remaining bytes)
   - Decrypt and verify authentication
3. Parse JSON to get `{ user, pass }`
4. Get or create IMAP connection keyed by `user`
5. Execute IMAP operation
6. Return result
7. Release connection back to pool

### Connection Pool

- **Key**: IMAP username
- **Max per user**: 3 concurrent connections
- **Idle timeout**: 2 minutes
- **Cleanup**: Periodic cleanup of idle connections every minute

### Security Guarantees

1. **Confidentiality**: AES-256 encryption
2. **Integrity**: GCM authentication tag ensures data hasn't been tampered with
3. **No plaintext storage**: Credentials never stored on disk
4. **Per-request isolation**: Each request independently decrypts credentials
5. **Credential rotation**: No "remember-me" sessions; every operation is independent

### Environment Setup

```bash
# .env file
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_TLS=true
PORT=3000
LOG_LEVEL=info
ENCRYPTION_KEY=<256-bit-hex-key>  # From step 1 above
```

### Files Changed

- **Deleted**: `src/auth.ts`, `users.json`, `users.json.example`, `scripts/add-user.ts`, `MIGRATION_GUIDE.md`, `REFACTORING_SUMMARY.md`
- **Created**: `scripts/encrypt-credentials.ts`
- **Modified**:
  - `src/index.ts` — encryption key loading, per-request credential handling
  - `src/imap-client.ts` — 2-minute idle timeout
  - `src/crypto.ts` — AES-256-GCM encryption (using Node.js crypto module)
  - `src/schemas/index.ts` — shared `credentials` field for all tools
  - `src/tools/*.ts` — all tools now use `resolveCredentials()` from `src/crypto.ts`
  - `Dockerfile` — removed users.json references
  - `docker-compose.yml` — added ENCRYPTION_KEY environment variable
  - `README.md` — updated setup, deployment, and API documentation

### Type Safety

- TypeScript strict mode enabled
- Zod schema validation for all inputs
- No `any` types
- Explicit error handling
