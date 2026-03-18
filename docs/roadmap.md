# Roadmap

This roadmap reflects likely next steps after the initial open-source release. Priorities may change based on user demand and contribution capacity.

## Near Term

- SMTP support for sending, replying to, and forwarding messages
- Additional mailbox actions such as mark-as-read, move, and delete
- Attachment download support for `imap_read_email`

The detailed Phase 1 approach for SMTP send and reply support lives in [SMTP Integration Plan](./smtp-integration-plan.md).

## Medium Term

- OAuth2 and XOAUTH2 authentication support
- Better observability around connection lifecycle and request failures
- Automated test coverage for core tool behavior

## Longer Term

- Broader deployment examples for hosted MCP environments
- Operational rate limits and abuse safeguards for write-capable email actions
- Expanded mailbox metadata and filtering support

## Contribution Notes

If you want to work on roadmap items, open an issue first for anything that changes the public tool surface or credential model. That keeps transport, security, and compatibility decisions aligned before implementation starts.
