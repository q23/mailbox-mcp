# Design: IMAP Tool Fixes

**Date**: 2026-03-19
**Branch**: fix/imap-tool-improvements

## Motivation

Feedback from first real-world usage identified 6 issues: two critical (no UIDs in output), two important (missing date filters in list, unreliable combined search), one bug (inverted read flag), and two nice-to-haves (sort_order, MIME decoding).

## Changes

### 1. UIDs in list/search output (Critical)
- `src/tools/list-emails.ts`: Add `| UID |` as first column in markdown table
- `src/tools/search-emails.ts`: Add `| UID |` as first column in markdown table
- No backend change needed — `uid` is already in `EmailListItem`

### 2. Fix inverted `read` flag (Bug)
- `src/imap-client.ts` lines ~225 and ~305: `read: !flags.has("\\Seen")` → `read: flags.has("\\Seen")`

### 3. Make `query` optional in search (Important)
- `src/schemas/index.ts`: `query: z.string().min(1)` → `query: z.string().optional()`
- `src/imap-client.ts` `searchEmails()`: only set `searchCriteria.text = query` if query is provided
- Enables `from + since` searches without a text query causing AND conflicts

### 4. Add `since`/`before` to `list_emails` (Important)
- `src/schemas/index.ts`: Add `since: z.string().optional()` and `before: z.string().optional()` to `ListEmailsSchema`
- `src/imap-client.ts` `listEmails()`: Accept optional `filter: { since?, before? }` param; use `client.search({ all: true })` if no filter, or `client.search({ since, before })` otherwise
- `src/tools/list-emails.ts`: Pass `since`/`before` through to `imapClient.listEmails()`

### 5. `sort_order` in search (Nice-to-have)
- `src/schemas/index.ts`: Add `sort_order: z.enum(["asc", "desc"]).optional().default("desc")` to `SearchEmailsSchema`
- `src/imap-client.ts` `searchEmails()`: Accept `sortOrder` param, apply after reversing UIDs
- `src/tools/search-emails.ts`: Pass through

### 6. MIME decoding with `mailparser` (Nice-to-have)
- Add `mailparser` and `@types/mailparser` as dependencies
- `src/imap-client.ts` `readEmail()`: Replace `extractTextFromSource()` call with `simpleParser(source)` from mailparser — gives decoded `text` and `html` automatically (handles Base64, Quoted-Printable)
- Remove private methods `extractTextFromSource()` and `normalizeSource()` (keep `extractHeaders()` and address helpers for `getReplyContext()`)

## No schema-breaking changes
All additions are optional fields with defaults. Existing callers continue to work unchanged.
