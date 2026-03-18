# Delivery Checklist

This checklist is for preparing a public release of `imap-mcp-server`.

## Repository

- [ ] `README.md` matches the current runtime behavior
- [ ] `CHANGELOG.md` contains the release entry
- [ ] `LICENSE` is tracked
- [ ] `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, and `SECURITY.md` exist
- [ ] Public docs live under `docs/`

## Security and Hygiene

- [ ] Git history reviewed for accidental credential exposure
- [ ] No documentation contains real credentials or private filesystem paths
- [ ] `AGENTS.md` and other local-only files are excluded from release commits
- [ ] `.env.example` documents only shared server configuration

## Verification

- [ ] `bun run type-check`
- [ ] `bun run build`
- [ ] `bun test` run and outcome recorded
- [ ] `git diff --check`
- [ ] Search for stale references to removed setup patterns

## Release

- [ ] Intended files staged explicitly
- [ ] Release commit created
- [ ] Annotated Git tag created
- [ ] Final `git status` reviewed
