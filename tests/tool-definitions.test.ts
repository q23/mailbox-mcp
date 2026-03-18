import { describe, expect, it } from "bun:test";
import { createToolDefinitions } from "../src/tool-definitions";

describe("tool definitions", () => {
  it("hides SMTP tools when SMTP is disabled", () => {
    const names = createToolDefinitions({ smtpEnabled: false }).map(
      (tool) => tool.name
    );

    expect(names).not.toContain("smtp_send_email");
    expect(names).not.toContain("smtp_reply_email");
  });

  it("includes SMTP tools when SMTP is enabled", () => {
    const names = createToolDefinitions({ smtpEnabled: true }).map(
      (tool) => tool.name
    );

    expect(names).toContain("smtp_send_email");
    expect(names).toContain("smtp_reply_email");
  });
});
