# Documentation Index

This directory contains the public project documentation for `imap-mcp-server`.

## Core Guides

- [Setup](./setup.md): local development, environment variables, and deployment basics
- [Architecture](./architecture.md): request flow, credential handling, and connection pooling
- [Project Summary](./project-summary.md): release snapshot and high-level capabilities
- [Roadmap](./roadmap.md): planned features and priorities
- [SMTP Integration Plan](./smtp-integration-plan.md): implementation plan for outbound mail support
- [Delivery Checklist](./delivery-checklist.md): release hygiene and publication checklist

## Repository Files

- [README](../README.md): project overview and quick start
- [CHANGELOG](../CHANGELOG.md): released changes
- [CONTRIBUTING](../CONTRIBUTING.md): contributor workflow
- [CODE_OF_CONDUCT](../CODE_OF_CONDUCT.md): community rules
- [SECURITY](../SECURITY.md): vulnerability reporting

## Source Overview

- `src/index.ts`: HTTP server, MCP transport, and tool registration
- `src/imap-client.ts`: IMAP connection lifecycle and mailbox operations
- `src/crypto.ts`: AES-256-GCM encryption helpers
- `src/schemas/index.ts`: Zod schemas for tool input validation
- `src/tools/`: one handler per public MCP tool

## Runtime Notes

- Transport: Streamable HTTP on `/mcp`
- Health check: `/health`
- Credentials: encrypted token per request, with optional header-based defaults
- Shared configuration: `IMAP_HOST`, `IMAP_PORT`, `IMAP_TLS`, `ENCRYPTION_KEY`
