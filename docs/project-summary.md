# Project Summary

## Release Snapshot

`imap-mcp-server` is a Bun-first MCP server for read-oriented IMAP access over Streamable HTTP.

Current release highlights:

- Encrypted per-request credentials using AES-256-GCM
- Optional default mailbox credentials from `x-imap-user` and `x-imap-pass`
- Shared IMAP connection pooling by user
- IMAP tools for folder listing, message listing, search, and full message retrieval
- Optional SMTP tools for sending new email and replying to mailbox messages
- Docker-ready deployment and Node.js 20+ compatibility

## Intended Use

This project is aimed at hosted MCP deployments where a single service connects to one IMAP backend and different users supply their own mailbox credentials at request time.

The server does not store user credentials. Instead, it expects one of these flows:

- an encrypted `credentials` token passed to the tool call
- header-based defaults configured in the MCP connector

## Shipped Tooling

- `imap_encrypt_credentials`
- `imap_list_folders`
- `imap_list_emails`
- `imap_search_emails`
- `imap_read_email`
- `smtp_send_email`
- `smtp_reply_email`

## Runtime Requirements

- Bun 1.0+
- Node.js 20+
- Shared IMAP server configuration
- `ENCRYPTION_KEY` as a 64-character hex string

## Repository Health

- TypeScript strict mode is enabled
- Zod validation protects public tool inputs
- `bun run type-check`, `bun run build`, and `bun test` pass on the current baseline
