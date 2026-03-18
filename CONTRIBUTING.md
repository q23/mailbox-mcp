# Contributing

Thanks for contributing to `imap-mcp-server`.

## Prerequisites

- Bun 1.0 or newer
- Node.js 20 or newer
- Access to an IMAP server for manual testing

## Development Setup

```bash
git clone https://github.com/q23/imap-mcp-server.git
cd imap-mcp-server
bun install
cp .env.example .env
```

Set `IMAP_HOST` and `ENCRYPTION_KEY` in `.env` before running the server locally.

## Local Workflow

```bash
bun run dev
bun run type-check
bun run build
bun run lint
bun test
```

`bun test` is currently informational because the repository does not yet contain automated test files.

## Branches and Commits

- Use `feature/<name>` for feature work.
- Use `fix/<name>` for bug fixes.
- Prefer [Conventional Commits](https://www.conventionalcommits.org/).
- Keep pull requests focused. Avoid mixing docs-only cleanup with runtime changes unless they are tightly coupled.

## Pull Requests

1. Fork the repository and create a topic branch from `main`.
2. Make your changes and update documentation when behavior changes.
3. Run `bun run type-check`, `bun run build`, and `bun run lint`.
4. Open a pull request against `main` with a clear summary and verification notes.

## Code Standards

- TypeScript is in strict mode.
- Avoid introducing `any` into production code.
- Keep tool input validation in Zod schemas.
- Preserve the existing credential model: no server-side credential persistence.

## Adding or Changing MCP Tools

When adding a new tool:

1. Define or extend the input schema in `src/schemas/index.ts`.
2. Add the handler in `src/tools/`.
3. Register the tool definition in `src/index.ts`.
4. Add the runtime dispatch case in `src/index.ts`.
5. Update `README.md`, `docs/architecture.md`, and `CHANGELOG.md` if the public surface changed.

## Reporting Issues

- Use GitHub Issues for bugs, enhancements, and questions.
- Use the private reporting flow in [SECURITY.md](./SECURITY.md) for vulnerabilities.

## Code of Conduct

This project follows the rules in [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
