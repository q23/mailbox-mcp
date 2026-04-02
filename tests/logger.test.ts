import { describe, expect, it } from "bun:test";
import { summarizeHeaderCredentials, summarizeToolArguments } from "../src/logger";

describe("logger redaction", () => {
  it("does not leak plaintext credentials in tool request summaries", () => {
    const summary = summarizeToolArguments("imap_encrypt_credentials", {
      imap_user: "person@example.com",
      imap_pass: "SuperSecretPassword123!",
    });
    const serialized = JSON.stringify(summary);

    expect(serialized).not.toContain("SuperSecretPassword123!");
    expect(serialized).not.toContain("person@example.com");
    expect(summary).toMatchObject({
      tool: "imap_encrypt_credentials",
      imap_user: "p***n@example.com",
      has_imap_pass: true,
    });
  });

  it("summarizes outbound email inputs without logging recipients or content", () => {
    const summary = summarizeToolArguments("smtp_send_email", {
      credentials: "token",
      to: ["one@example.com", "two@example.com"],
      cc: ["cc@example.com"],
      bcc: ["bcc@example.com"],
      subject: "Quarterly budget",
      text: "super-secret-body",
      html: "<p>super-secret-body</p>",
    });
    const serialized = JSON.stringify(summary);

    expect(serialized).not.toContain("Quarterly budget");
    expect(serialized).not.toContain("super-secret-body");
    expect(serialized).not.toContain("one@example.com");
    expect(summary).toMatchObject({
      tool: "smtp_send_email",
      has_credentials: true,
      to_count: 2,
      cc_count: 1,
      bcc_count: 1,
      has_subject: true,
      has_html: true,
    });
    expect(summary.text_length).toBeGreaterThan(0);
  });

  it("masks header-derived mailbox users in debug summaries", () => {
    const summary = summarizeHeaderCredentials(
      "person@example.com",
      "SuperSecretPassword123!"
    );

    expect(summary).toEqual({
      has_header_credentials: true,
      header_user: "p***n@example.com",
    });
  });
});
