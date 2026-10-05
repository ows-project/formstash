import { describe, expect, it } from "vitest";
import { buildMessage } from "./smtp-message";

describe("SMTP message construction", () => {
  it("removes header injection and encodes message bodies", () => {
    const message = buildMessage(
      { fromName: "Formstash\r\nBcc: attacker@example.com", fromEmail: "forms@example.com" },
      { to: "owner@example.com", subject: "New submission", text: ".hello", html: "<p>Hello</p>" },
    );
    expect(message).not.toContain("\r\nBcc:");
    expect(message).toContain("Content-Transfer-Encoding: base64");
    expect(message).not.toContain("<p>Hello</p>");
  });
});
