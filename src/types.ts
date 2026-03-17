export interface ImapConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  tls: boolean;
}

export interface UserContext {
  apiKey: string;
  name: string;
  imapUser: string;
  imapPass: string;
}

export interface MailboxInfo {
  name: string;
  path: string;
  messageCount: number;
  unreadCount: number;
  flags?: string[];
}

export interface EmailListItem {
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: string;
  read: boolean;
  flagged: boolean;
  messageId?: string;
}

export interface EmailContent {
  uid: number;
  subject: string;
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  date: string;
  textBody: string;
  htmlBody?: string;
  read: boolean;
  flagged: boolean;
  attachments: AttachmentInfo[];
}

export interface AttachmentInfo {
  name: string;
  size: number;
  type: string;
}

export interface SearchQuery {
  from?: string;
  to?: string;
  since?: string;
  before?: string;
  subject?: string;
  text?: string;
}
