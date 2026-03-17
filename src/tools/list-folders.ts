import { ImapClient } from "@/imap-client";
import { ListFoldersSchema } from "@/schemas";
import type { UserContext } from "@/types";
import type { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export async function handleListFolders(
  imapClient: ImapClient,
  user: UserContext,
  _input: z.infer<typeof ListFoldersSchema>
): Promise<{
  content: TextContent[];
}> {
  try {
    const folders = await imapClient.listFolders(user.imapUser, user.imapPass);

    const markdown = `# IMAP Mailbox Folders

| Folder | Path | Messages | Unread |
|--------|------|----------|--------|
${folders.map((f) => `| ${f.name} | ${f.path} | ${f.messageCount} | ${f.unreadCount} |`).join("\n")}

**Total Folders**: ${folders.length}
`;

    return {
      content: [
        {
          type: "text",
          text: markdown,
        } as TextContent,
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error listing folders: ${errorMessage}`,
        } as TextContent,
      ],
    };
  }
}
