# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-18

### Added
- Multi-user IMAP access via MCP protocol
- AES-256-GCM credential encryption per request with no server-side credential storage
- Header-based auth via `x-imap-user` and `x-imap-pass`
- Connection pooling with a 2-minute idle timeout keyed by IMAP username
- Streamable HTTP transport for hosted MCP deployments
- Docker support with a non-root runtime image
- MCP tools: `imap_encrypt_credentials`, `imap_list_folders`, `imap_list_emails`, `imap_search_emails`, `imap_read_email`
- Bun-first development workflow with Node.js 20+ compatibility
- Public project files: `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, and `SECURITY.md`
- Public documentation under `docs/`

### Security
- Audited git history for `password`, `ENCRYPTION_KEY`, and `x-imap-pass`; matches were code or documentation references, not committed secrets
