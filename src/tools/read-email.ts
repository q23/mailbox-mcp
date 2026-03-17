import { ImapClient } from "@/imap-client";
import { ReadEmailSchema } from "@/schemas";
import type { UserContext } from "@/types";
import type { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export async function handleReadEmail(
  imapClient: ImapClient,
  user: UserContext,
  input: z.infer<typeof ReadEmailSchema>
): Promise<{
  content: TextContent[];
}> {
  try {
    const email = await imapClient.readEmail(
      user.imapUser,
      user.imapPass,
      input.folder,
      input.uid
    );

    const attachmentList =
      email.attachments.length > 0
        ? `\n### Attachments\n\n${email.attachments.map((a) => `- **${a.name}** (${(a.size / 1024).toFixed(2)} KB, ${a.type})`).join("\n")}`
        : "";

    const markdown = `# Email Details

**From**: ${email.from}
**To**: ${email.to}
${email.cc ? `**CC**: ${email.cc}\n` : ""}
${email.bcc ? `**BCC**: ${email.bcc}\n` : ""}
**Subject**: ${email.subject}
**Date**: ${email.date}
**Status**: ${email.read ? "Read" : "Unread"} ${email.flagged ? "| Flagged" : ""}
**Message ID**: ${input.uid}

---

## Body

${email.textBody || "(empty)"}

${email.htmlBody ? `\n### HTML Version\n\n${email.htmlBody}` : ""}

${attachmentList}
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
          text: `Error reading email: ${errorMessage}`,
        } as TextContent,
      ],
    };
  }
}
