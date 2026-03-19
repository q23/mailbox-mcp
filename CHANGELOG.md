# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-03-19

### Added
- `since` and `before` date filters for `imap_list_emails`
- `sort_order` parameter for `imap_search_emails` (`asc` = oldest first, `desc` = newest first, default)
- `smtp_send_email` and `smtp_reply_email` tools (SMTP enabled via `SMTP_HOST` env var)
- SMTP runtime configuration via `SMTP_HOST`, `SMTP_PORT`, and `SMTP_TLS`
- Reply context extraction from IMAP messages for threaded replies
- Automated tests for SMTP schema validation, reply logic, and tool registration

### Fixed
- `imap_list_emails` and `imap_search_emails` now include the UID column in output — required to use `imap_read_email`
- `read` field was inverted (showed unread emails as read and vice versa)
- `query` in `imap_search_emails` is now optional, enabling `from`- or date-only searches without triggering IMAP AND conflicts
- Combining `since` and `before` in `imap_list_emails` now applies both filters correctly (was `else if`, silently dropped `before`)
- `sort_order: asc` now returns the oldest N emails, not the newest N in reversed display order
- Date strings are now validated before being passed to IMAP (`Invalid Date` no longer reaches the server)

### Changed
- `imap_read_email` now uses `mailparser` for full MIME decoding — Base64 and Quoted-Printable bodies are decoded automatically; HTML body is returned when present

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
