import { z } from "zod";

// Shared credentials field for all tools — optional when x-imap-user/x-imap-pass headers are set
const credentialsField = z.string().optional().describe(
  "Base64-encoded encrypted IMAP credentials (use imap_encrypt_credentials tool to generate). " +
  "Optional if x-imap-user and x-imap-pass headers are configured in the MCP connector settings."
);

export const ListFoldersSchema = z.object({
  credentials: credentialsField,
});

export const ListEmailsSchema = z.object({
  credentials: credentialsField,
  folder: z.string().optional().default("INBOX"),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

export const SearchEmailsSchema = z.object({
  credentials: credentialsField,
  query: z.string().min(1),
  folder: z.string().optional().default("INBOX"),
  from: z.string().optional(),
  to: z.string().optional(),
  since: z.string().optional(),
  before: z.string().optional(),
  subject: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export const ReadEmailSchema = z.object({
  credentials: credentialsField,
  uid: z.number().int().positive(),
  folder: z.string().optional().default("INBOX"),
});

export type ListFoldersInput = z.infer<typeof ListFoldersSchema>;
export type ListEmailsInput = z.infer<typeof ListEmailsSchema>;
export type SearchEmailsInput = z.infer<typeof SearchEmailsSchema>;
export type ReadEmailInput = z.infer<typeof ReadEmailSchema>;
