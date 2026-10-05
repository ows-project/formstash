import { describe, expect, it } from "vitest";
import { normalizeOrigin, normalizeSourceUrl, parseSubmission, slugify, SubmissionError } from "./submissions";

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
