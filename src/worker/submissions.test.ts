import { describe, expect, it } from "vitest";
import { isHoneypotTripped, normalizeOrigin, normalizeSourceUrl, parseSubmission, slugify, SubmissionError } from "./submissions";

describe("parseSubmission", () => {
  it("keeps scalar JSON fields without inventing request metadata", async () => {
    const request = new Request("https://forms.example/f/waiting-list", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "private browser" },
      body: JSON.stringify({ email: "ada@example.com", subscribed: true, seats: 3 }),
    });

    await expect(parseSubmission(request)).resolves.toEqual({
      email: "ada@example.com",
      subscribed: true,
      seats: 3,
    });
  });

  it("rejects nested values that cannot be displayed as form fields", async () => {
    const request = new Request("https://forms.example/f/waiting-list", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: { name: "Ada" } }),
    });

    await expect(parseSubmission(request)).rejects.toEqual(
      expect.objectContaining<Partial<SubmissionError>>({ status: 422 }),
    );
  });

  it("accepts native URL-encoded forms", async () => {
    const request = new Request("https://forms.example/f/waiting-list", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "email=ada%40example.com&name=Ada+Lovelace",
    });

    await expect(parseSubmission(request)).resolves.toEqual({ email: "ada@example.com", name: "Ada Lovelace" });
  });
});

describe("form address helpers", () => {
  it("creates stable, URL-safe slugs", () => {
    expect(slugify("  Bé ta Waiting List! ")).toBe("be-ta-waiting-list");
  });

  it("reduces allowed origins to their origin", () => {
    expect(normalizeOrigin("https://example.com/waitlist?from=home")).toBe("https://example.com");
    expect(normalizeOrigin("javascript:alert(1)")).toBeNull();
  });

  it("keeps safe source paths and rejects executable URLs", () => {
    expect(normalizeSourceUrl("https://example.com/waitlist?from=home")).toBe("https://example.com/waitlist?from=home");
    expect(normalizeSourceUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("isHoneypotTripped", () => {
  it("treats any filled honeypot value as a bot, including JSON booleans and numbers", () => {
    expect(isHoneypotTripped("x")).toBe(true);
    expect(isHoneypotTripped(true)).toBe(true);
    expect(isHoneypotTripped(1)).toBe(true);
    expect(isHoneypotTripped(0)).toBe(true);
  });

  it("ignores an absent or empty honeypot", () => {
    expect(isHoneypotTripped("")).toBe(false);
    expect(isHoneypotTripped(false)).toBe(false);
    expect(isHoneypotTripped(null)).toBe(false);
    expect(isHoneypotTripped(undefined)).toBe(false);
  });
});
