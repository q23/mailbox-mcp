# SMTP Integration Plan

## Goal

Add outbound email support to `mailbox-mcp` without changing the existing IMAP behavior or the current encrypted credential model for IMAP access.

## Scope

Phase 1 should implement:

- `smtp_send_email`
- `smtp_reply_email`

Phase 1 does not include:

- separate SMTP credentials per user
- attachment forwarding
- draft support
- rate limiting
- OAuth2 / XOAUTH2

## Key Decisions

### Credential Model

Phase 1 will reuse the existing `credentials` token and header-based defaults.

- `smtp_send_email` and `smtp_reply_email` will use the same mailbox user and password that IMAP tools already resolve.
- No new encrypted token shape is introduced in Phase 1.
- Separate SMTP credentials are deferred to a later iteration if real providers require them.

This keeps `imap_encrypt_credentials` unchanged and avoids breaking existing clients.

### SMTP Server Configuration

Add optional server environment variables:

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `SMTP_HOST` | No | None | If missing, SMTP tools are not registered |
| `SMTP_PORT` | No | `587` | Standard submission port |
| `SMTP_TLS` | No | `true` | Maps to `requireTLS`; `secure` is derived from port `465` |

The server should continue to boot in IMAP-only mode when `SMTP_HOST` is not set.

### Library

Use `nodemailer` with `@types/nodemailer`.

Reasons:

- mature SMTP transport support
- Bun and Node compatibility
- straightforward support for reply headers and multipart bodies

## Public API

### `smtp_send_email`

Send a new email.

Input:

- `credentials?: string`
- `to: string[]`
- `subject: string`
- `text: string`
- `html?: string`
- `cc?: string[]`
- `bcc?: string[]`
- `from?: string`

Behavior:

- requires at least one recipient in `to`
- uses `from` if provided, otherwise the resolved mailbox user
- returns a short delivery summary including envelope sender, recipients, and generated message id when available

### `smtp_reply_email`

Reply to an existing email.

Input:

- `credentials?: string`
- `uid: number`
- `folder?: string` default `INBOX`
- `text: string`
- `html?: string`
- `reply_all?: boolean` default `false`
- `from?: string`

Behavior:

- fetches the original message metadata via IMAP
- sets `inReplyTo` and `references` from the original message headers when available
- replies to the original sender by default
- includes original `to` and `cc` recipients when `reply_all=true`
- prefixes the subject with `Re:` only when it does not already start with `Re:`

## Internal Changes

### New Types

Add SMTP-specific types to `src/types.ts`:

- `SmtpConfig`
- `SendEmailInput`
- `ReplyEmailInput`
- `SentEmailResult`
- `ReplyContext`

### New Schema Definitions

Add Zod schemas in `src/schemas/index.ts`:

- `SendEmailSchema`
- `ReplyEmailSchema`

Use array fields for recipients instead of comma-separated strings to keep validation explicit.

### New Runtime Modules

Add:

- `src/smtp-client.ts`
- `src/tools/send-email.ts`
- `src/tools/reply-email.ts`

Responsibilities:

- `SmtpClient` owns transporter creation and `sendMail` calls
- tool handlers stay responsible for validation, credential resolution, and markdown output

### IMAP Support for Replies

Extend `src/imap-client.ts` with a helper that returns enough metadata for replies:

- original subject
- sender address
- `reply-to` address if present
- message id
- references
- recipients for reply-all

Do not overload `readEmail` with SMTP-specific behavior. Add a dedicated method such as `getReplyContext(...)`.

### Server Registration

Update `src/index.ts` to:

- load optional SMTP env vars
- create an `SmtpClient` only when `SMTP_HOST` is configured
- append SMTP tools to `tools[]` only when SMTP is enabled
- dispatch SMTP tool handlers in the `CallToolRequestSchema` switch

This avoids breaking existing IMAP-only deployments.

## Data Flow

### Send

1. Validate tool input with Zod.
2. Resolve credentials via the existing encrypted-token flow.
3. Build the sender address from `input.from` or mailbox user.
4. Send through `SmtpClient`.
5. Return a markdown summary with recipients and message id.

### Reply

1. Validate tool input with Zod.
2. Resolve credentials via the existing encrypted-token flow.
3. Use `ImapClient.getReplyContext(...)` to load original message metadata.
4. Compute recipients:
   - default: reply-to or sender
   - `reply_all`: include original `to` and `cc`, excluding the current sender mailbox
5. Normalize the subject with a single `Re:` prefix.
6. Send through `SmtpClient` with reply headers.
7. Return a markdown summary of the reply target and message id.

## Edge Cases

- SMTP disabled: tool list should not include SMTP tools.
- Invalid SMTP configuration: fail fast at startup only when `SMTP_HOST` is present but unusable.
- Empty recipient arrays: schema validation error.
- Reply to message without `messageId`: send reply without threading headers but log that the reply was degraded.
- Reply-all duplicates: deduplicate case-insensitively.
- Replying to self: exclude the current mailbox user from generated recipient lists unless explicitly provided through `from`.

## Logging

Do not log message bodies or passwords.

Safe log fields:

- SMTP host
- sender address
- recipient counts
- message id
- reply target uid

## Tests and Verification

Add automated coverage for:

- recipient validation
- sender fallback precedence
- subject normalization for replies
- reply-all deduplication
- SMTP tool registration only when `SMTP_HOST` is set

Implementation verification should include:

- `bun run type-check`
- `bun run build`
- focused unit tests for new schema and helper logic
- one manual end-to-end test against a disposable SMTP/IMAP account

## Rollout

1. Add dependencies and config parsing.
2. Land `SmtpClient` and send-email tool.
3. Land reply-context IMAP helper and reply tool.
4. Add tests.
5. Update `README.md`, `docs/setup.md`, `docs/architecture.md`, `docs/project-summary.md`, and `CHANGELOG.md`.

## Follow-Up

After Phase 1:

- evaluate whether separate SMTP credentials are needed
- add forwarding with explicit attachment behavior
- add delivery throttling and abuse protection
- add OAuth-capable auth flows
