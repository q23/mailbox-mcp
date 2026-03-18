import { describe, expect, it } from "bun:test";
import {
  buildReplyRecipients,
  buildReplyThreadHeaders,
  normalizeReplySubject,
  resolveSenderAddress,
} from "../src/smtp-utils";

describe("smtp-utils", () => {
  it("prefers explicit sender over default and mailbox user", () => {
    expect(
      resolveSenderAddress(
        "custom@example.com",
        "default@example.com",
        "mailbox@example.com"
      )
    ).toBe("custom@example.com");
  });

  it("normalizes reply subjects without duplicating Re", () => {
    expect(normalizeReplySubject("Hello")).toBe("Re: Hello");
    expect(normalizeReplySubject("Re: Hello")).toBe("Re: Hello");
  });

  it("builds deduplicated reply-all recipients and excludes mailbox user", () => {
    const recipients = buildReplyRecipients(
      {
        uid: 1,
        folder: "INBOX",
        subject: "Hello",
        from: ["sender@example.com"],
        replyTo: [],
        to: ["mailbox@example.com", "team@example.com"],
        cc: ["sender@example.com", "TEAM@example.com", "other@example.com"],
        references: [],
        messageId: "<msg1@example.com>",
      },
      "mailbox@example.com",
      true
    );

    expect(recipients.to).toEqual(["sender@example.com"]);
    expect(recipients.cc).toEqual(["team@example.com", "other@example.com"]);
  });

  it("builds thread headers from message ids", () => {
    expect(
      buildReplyThreadHeaders({
        uid: 1,
        folder: "INBOX",
        subject: "Hello",
        from: ["sender@example.com"],
        replyTo: [],
        to: [],
        cc: [],
        references: ["<root@example.com>"],
        messageId: "<msg1@example.com>",
      })
    ).toEqual({
      inReplyTo: "<msg1@example.com>",
      references: "<root@example.com> <msg1@example.com>",
    });
  });
});
