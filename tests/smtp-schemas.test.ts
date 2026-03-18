import { describe, expect, it } from "bun:test";
import { ReplyEmailSchema, SendEmailSchema } from "../src/schemas";

describe("SMTP schemas", () => {
  it("accepts valid send email payloads", () => {
    expect(
      SendEmailSchema.parse({
        credentials: "token",
        to: ["person@example.com"],
        subject: "Hi",
        text: "Hello",
      })
    ).toMatchObject({
      to: ["person@example.com"],
      subject: "Hi",
      text: "Hello",
    });
  });

  it("rejects empty recipient lists", () => {
    expect(() =>
      SendEmailSchema.parse({
        credentials: "token",
        to: [],
        subject: "Hi",
        text: "Hello",
      })
    ).toThrow();
  });

  it("defaults reply_all to false", () => {
    expect(
      ReplyEmailSchema.parse({
        credentials: "token",
        uid: 10,
        text: "Hello",
      }).reply_all
    ).toBe(false);
  });
});
