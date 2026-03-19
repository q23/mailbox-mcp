# IMAP Tool Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 6 issues found in first real-world usage: missing UIDs in output, inverted read flag, mandatory query param breaking combined search, missing date filters in list_emails, no sort_order in search, and raw Base64/QP bodies.

**Architecture:** Changes touch `src/schemas/index.ts` (schema additions), `src/imap-client.ts` (backend logic), and `src/tools/` (markdown rendering). mailparser replaces the naive hand-rolled MIME parser in `readEmail()`. All new schema fields are optional with defaults — no breaking changes.

**Tech Stack:** TypeScript, imapflow, zod, mailparser (new), bun test

---

## Setup

Create branch first:
```bash
git checkout -b fix/imap-tool-improvements
```

---

### Task 1: Add UIDs to `imap_list_emails` output

**Files:**
- Modify: `src/tools/list-emails.ts:34`

The data is already there — `EmailListItem` has `uid`. Just add a column to the markdown table.

**Step 1: Edit the table in list-emails.ts**

In `src/tools/list-emails.ts`, replace the table lines:

```typescript
// Old (line ~32-34):
`| From | Subject | Date | Status |
|------|---------|------|--------|
${emails.map((e) => `| ${e.from} | ${e.subject} | ${e.date} | ${e.read ? "Read" : "Unread"} |`).join("\n")}`

// New:
`| UID | From | Subject | Date | Status |
|-----|------|---------|------|--------|
${emails.map((e) => `| ${e.uid} | ${e.from} | ${e.subject} | ${e.date} | ${e.read ? "Read" : "Unread"} |`).join("\n")}`
```

**Step 2: Commit**

```bash
git add src/tools/list-emails.ts
git commit -m "fix: add UID column to list_emails output"
```

---

### Task 2: Add UIDs to `imap_search_emails` output

**Files:**
- Modify: `src/tools/search-emails.ts:48`

**Step 1: Edit the table in search-emails.ts**

In `src/tools/search-emails.ts`, replace the table lines:

```typescript
// Old (line ~46-48):
`| From | Subject | Date | Status |
|------|---------|------|--------|
${emails.map((e) => `| ${e.from} | ${e.subject} | ${e.date} | ${e.read ? "Read" : "Unread"} |`).join("\n")}`

// New:
`| UID | From | Subject | Date | Status |
|-----|------|---------|------|--------|
${emails.map((e) => `| ${e.uid} | ${e.from} | ${e.subject} | ${e.date} | ${e.read ? "Read" : "Unread"} |`).join("\n")}`
```

**Step 2: Commit**

```bash
git add src/tools/search-emails.ts
git commit -m "fix: add UID column to search_emails output"
```

---

### Task 3: Fix inverted `read` flag

**Files:**
- Modify: `src/imap-client.ts` (lines ~225 and ~305)

The `read` field is set as `!flags.has("\\Seen")` which means `read=true` when NOT seen. Should be the opposite.

**Step 1: Fix both occurrences in imap-client.ts**

There are two identical lines — one in `listEmails()` and one in `searchEmails()`. Change both:

```typescript
// Old (appears twice):
read: !flags.has("\\Seen"),

// New (both occurrences):
read: flags.has("\\Seen"),
```

Use search/replace to catch both. Verify with grep after:
```bash
grep -n 'flags.has' src/imap-client.ts
```

**Step 2: Commit**

```bash
git add src/imap-client.ts
git commit -m "fix: correct inverted read flag (Seen flag was negated)"
```

---

### Task 4: Make `query` optional in search schema + backend

**Files:**
- Modify: `src/schemas/index.ts:26`
- Modify: `src/imap-client.ts` (searchEmails method, ~line 258)
- Modify: `src/tools/search-emails.ts` (update function signature call)

Currently `query: z.string().min(1)` forces a text query even when the user only wants `from + since`. This causes IMAP `AND(text, from, since)` which fails on many servers.

**Step 1: Update schema**

In `src/schemas/index.ts`, in `SearchEmailsSchema`:

```typescript
// Old:
query: z.string().min(1),

// New:
query: z.string().optional(),
```

**Step 2: Update imap-client.ts — only set text if query provided**

In `src/imap-client.ts`, in `searchEmails()`, change the query handling:

```typescript
// Old:
if (query) {
  searchCriteria.text = query;
}

// New (same logic, but query is now string | undefined):
if (query) {
  searchCriteria.text = query;
}
// (no change needed here — the existing `if (query)` already handles undefined correctly)
```

Also update the method signature — `query` parameter type changes from `string` to `string | undefined`:

```typescript
// Old:
async searchEmails(
  imapUser: string,
  imapPass: string,
  folder: string,
  query: string,
  searchQuery: SearchQuery,
  limit: number
): Promise<EmailListItem[]>

// New:
async searchEmails(
  imapUser: string,
  imapPass: string,
  folder: string,
  query: string | undefined,
  searchQuery: SearchQuery,
  limit: number
): Promise<EmailListItem[]>
```

**Step 3: Update search-emails.ts — update display when no query**

In `src/tools/search-emails.ts`, update the header line that shows the query:

```typescript
// Old:
**Query**: ${input.query}

// New:
${input.query ? `**Query**: ${input.query}` : ""}
```

**Step 4: Type-check**

```bash
bun run type-check
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/schemas/index.ts src/imap-client.ts src/tools/search-emails.ts
git commit -m "fix: make search query optional to allow from/since-only searches"
```

---

### Task 5: Add `since`/`before` to `imap_list_emails`

**Files:**
- Modify: `src/schemas/index.ts` (ListEmailsSchema)
- Modify: `src/imap-client.ts` (listEmails signature + implementation)
- Modify: `src/tools/list-emails.ts` (pass params through)

**Step 1: Update ListEmailsSchema**

In `src/schemas/index.ts`, add to `ListEmailsSchema`:

```typescript
export const ListEmailsSchema = z.object({
  credentials: credentialsField,
  folder: z.string().optional().default("INBOX"),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
  since: z.string().optional().describe("Filter emails since this date (ISO 8601 or YYYY-MM-DD)"),
  before: z.string().optional().describe("Filter emails before this date (ISO 8601 or YYYY-MM-DD)"),
});
```

**Step 2: Update ImapClient.listEmails() signature**

In `src/imap-client.ts`, update `listEmails()`:

```typescript
async listEmails(
  imapUser: string,
  imapPass: string,
  folder: string,
  limit: number,
  offset: number,
  filter?: { since?: string; before?: string }
): Promise<EmailListItem[]>
```

**Step 3: Update listEmails() body — use date filter in search**

Replace the `client.search({ all: true })` call:

```typescript
// Old:
const uids = await client.search({ all: true });

// New:
const searchFilter: Record<string, unknown> = {};
if (filter?.since) {
  searchFilter.since = new Date(filter.since);
} else if (filter?.before) {
  searchFilter.before = new Date(filter.before);
}

const uids = await client.search(
  Object.keys(searchFilter).length > 0 ? searchFilter : { all: true }
);
```

Note: imapflow search does not support `since AND before` natively in a single object — if both are provided, use `since` only. To support both, wrap in an array: `[{ since: ... }, { before: ... }]` — but test with your IMAP server first as behavior varies. Safe default: support one at a time.

**Step 4: Update list-emails.ts — pass through + update markdown header**

```typescript
// In handleListEmails(), update the call:
const emails = await imapClient.listEmails(
  creds.user,
  creds.pass,
  input.folder,
  input.limit,
  input.offset,
  { since: input.since, before: input.before }
);

// Update markdown header to show filters if set:
${input.since ? `**Since**: ${input.since}\n` : ""}${input.before ? `**Before**: ${input.before}\n` : ""}
```

**Step 5: Type-check**

```bash
bun run type-check
```

**Step 6: Commit**

```bash
git add src/schemas/index.ts src/imap-client.ts src/tools/list-emails.ts
git commit -m "feat: add since/before date filters to list_emails"
```

---

### Task 6: Add `sort_order` to `imap_search_emails`

**Files:**
- Modify: `src/schemas/index.ts` (SearchEmailsSchema)
- Modify: `src/imap-client.ts` (searchEmails signature + logic)
- Modify: `src/tools/search-emails.ts` (pass through)

**Step 1: Update SearchEmailsSchema**

```typescript
export const SearchEmailsSchema = z.object({
  credentials: credentialsField,
  query: z.string().optional(),
  folder: z.string().optional().default("INBOX"),
  from: z.string().optional(),
  to: z.string().optional(),
  since: z.string().optional(),
  before: z.string().optional(),
  subject: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  sort_order: z.enum(["asc", "desc"]).optional().default("desc"),
});
```

**Step 2: Update searchEmails() signature**

```typescript
async searchEmails(
  imapUser: string,
  imapPass: string,
  folder: string,
  query: string | undefined,
  searchQuery: SearchQuery,
  limit: number,
  sortOrder: "asc" | "desc" = "desc"
): Promise<EmailListItem[]>
```

**Step 3: Update sorting logic in searchEmails()**

```typescript
// Old:
const selectedUids = reversedUids.slice(-limit).reverse();

// New:
const limitedUids = reversedUids.slice(-limit);
const selectedUids = sortOrder === "desc" ? limitedUids.reverse() : limitedUids;
```

**Step 4: Update search-emails.ts**

```typescript
// Pass sort_order:
const emails = await imapClient.searchEmails(
  creds.user,
  creds.pass,
  input.folder,
  input.query,
  { from: input.from, to: input.to, since: input.since, before: input.before, subject: input.subject },
  input.limit,
  input.sort_order
);
```

**Step 5: Type-check**

```bash
bun run type-check
```

**Step 6: Commit**

```bash
git add src/schemas/index.ts src/imap-client.ts src/tools/search-emails.ts
git commit -m "feat: add sort_order parameter to search_emails"
```

---

### Task 7: Add mailparser for proper MIME decoding in `imap_read_email`

**Files:**
- `package.json` (add dependency)
- Modify: `src/imap-client.ts` (replace extractTextFromSource with mailparser)

**Step 1: Install mailparser**

```bash
bun add mailparser
bun add -d @types/mailparser
```

Verify it appears in package.json dependencies.

**Step 2: Import simpleParser in imap-client.ts**

At the top of `src/imap-client.ts`, add:

```typescript
import { simpleParser } from "mailparser";
```

**Step 3: Replace readEmail() body parsing**

In `readEmail()`, replace the source extraction block:

```typescript
// Old:
let textBody = "";
const sourceText = this.normalizeSource(message.source);
if (sourceText) {
  textBody = this.extractTextFromSource(sourceText);
}

return {
  uid: message.uid,
  subject: envelope?.subject || "(no subject)",
  from: envelope?.from?.[0]?.address || "unknown",
  to: envelope?.to?.[0]?.address || "unknown",
  cc: envelope?.cc?.[0]?.address,
  bcc: envelope?.bcc?.[0]?.address,
  date: envelope?.date ? new Date(envelope.date).toISOString() : "",
  textBody,
  htmlBody: undefined,
  ...
};

// New:
const rawSource = message.source;
const parsed = rawSource
  ? await simpleParser(rawSource as Buffer)
  : null;

const textBody = parsed?.text?.substring(0, 5000) || "";
const htmlBody = parsed?.html ? parsed.html.substring(0, 10000) : undefined;

return {
  uid: message.uid,
  subject: envelope?.subject || parsed?.subject || "(no subject)",
  from: envelope?.from?.[0]?.address || parsed?.from?.value?.[0]?.address || "unknown",
  to: envelope?.to?.[0]?.address || parsed?.to?.value?.[0]?.address || "unknown",
  cc: envelope?.cc?.[0]?.address,
  bcc: envelope?.bcc?.[0]?.address,
  date: envelope?.date ? new Date(envelope.date).toISOString() : "",
  textBody,
  htmlBody,
  ...
};
```

Note: `simpleParser` is async — make sure `readEmail()` remains `async` (it already is via `withConnection`). The inner lambda passed to `withConnection` needs to `await` the parser call.

**Step 4: Remove unused private methods**

Remove `extractTextFromSource()` and `normalizeSource()` from the class — they're no longer called by `readEmail()`. Keep `extractHeaders()`, `mapAddresses()`, and `extractEmailAddresses()` — they're still used by `getReplyContext()`.

**Step 5: Update getReplyContext() if needed**

`getReplyContext()` uses `this.normalizeSource()` — since we're removing it, inline the conversion there:

```typescript
// In getReplyContext(), replace:
const sourceText = this.normalizeSource(message.source);

// With:
const src = message.source;
const sourceText = src
  ? Buffer.isBuffer(src)
    ? src.toString("utf8")
    : typeof src === "string"
    ? src
    : Buffer.from((src as Uint8Array).buffer).toString("utf8")
  : "";
```

**Step 6: Type-check**

```bash
bun run type-check
```

Expected: no errors. If mailparser types cause issues, check `@types/mailparser` is installed.

**Step 7: Commit**

```bash
git add package.json bun.lockb src/imap-client.ts
git commit -m "feat: use mailparser for proper MIME/Base64/QP decoding in read_email"
```

---

### Task 8: Update tool-definitions for new parameters

**Files:**
- Modify: `src/tool-definitions.ts`

The MCP tool definitions shown to the client need to reflect the new parameters so Claude knows to use them.

**Step 1: Check current tool-definitions.ts**

```bash
cat src/tool-definitions.ts
```

**Step 2: Add missing parameters**

For `imap_list_emails` input schema, add:
```json
"since": { "type": "string", "description": "Filter emails since this date (ISO 8601, e.g. 2024-01-01)" },
"before": { "type": "string", "description": "Filter emails before this date (ISO 8601)" }
```

For `imap_search_emails` input schema, add:
```json
"sort_order": { "type": "string", "enum": ["asc", "desc"], "description": "Sort order by date, default desc (newest first)" }
```

Also make `query` optional (remove it from `required` array if present).

**Step 3: Type-check + build**

```bash
bun run type-check && bun run build
```

**Step 4: Commit**

```bash
git add src/tool-definitions.ts
git commit -m "docs: update tool definitions with new parameters"
```

---

### Task 9: Final verification

**Step 1: Full type-check**

```bash
bun run type-check
```

Expected: 0 errors.

**Step 2: Build**

```bash
bun run build
```

Expected: compiles to `dist/` without errors.

**Step 3: Run tests if any**

```bash
bun test
```

**Step 4: Create PR**

```bash
git push -u origin fix/imap-tool-improvements
gh pr create --title "fix: imap tool improvements from user feedback" --body "$(cat <<'EOF'
## Summary
- Add UID column to list_emails and search_emails output
- Fix inverted read flag (was showing unread emails as read)
- Make search query optional so from/since-only searches work
- Add since/before date filters to list_emails
- Add sort_order parameter to search_emails
- Use mailparser for proper Base64/QP body decoding in read_email

## Test plan
- [ ] list_emails shows UID column
- [ ] search_emails shows UID column
- [ ] Read email has correct read/unread status
- [ ] search_emails with only `from` param (no query) returns results
- [ ] list_emails with `since` param filters correctly
- [ ] search_emails with `sort_order=asc` returns oldest first
- [ ] read_email body is decoded (not raw Base64)
EOF
)"
```
