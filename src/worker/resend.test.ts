import { afterEach, describe, expect, it, vi } from "vitest";
import { sendResend, templateVariables } from "./resend";

describe("templateVariables", () => {
  it("maps submission fields to Resend-safe variables and lets owner values win", () => {
    const variables = templateVariables(
      { email: "ada@example.com", "first-name": "Ada", seats: 3, consent: true, note: null, EMAIL: "x", long: "a".repeat(2500) },
      { formName: "Closed testing", submittedAt: "2026-11-05T01:00:00.000Z", sourceUrl: null },
      { link: "https://play.google.com/apps/testing/app", form_name: "Override" },
    );
    expect(variables).toEqual({
      email: "ada@example.com",
      first_name: "Ada",
      seats: 3,
      consent: "true",
      long: "a".repeat(2000),
      form_name: "Override",
      submitted_at: "2026-11-05T01:00:00.000Z",
      link: "https://play.google.com/apps/testing/app",
    });
  });
});

describe("sendResend", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends templates without html and surfaces Resend's error message", async () => {
    const fetch = vi.fn(async () => Response.json({ name: "validation_error", message: "Missing variable link" }, { status: 422 }));
    vi.stubGlobal("fetch", fetch);
    await expect(sendResend("re_test", "Forms <forms@example.com>", {
      to: "ada@example.com", idempotencyKey: "delivery-1", template: { id: "follow-up", variables: { name: "Ada" } },
    })).rejects.toThrow("Resend 422: Missing variable link");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(init.headers).get("idempotency-key")).toBe("delivery-1");
    expect(JSON.parse(init.body as string)).toEqual({
      from: "Forms <forms@example.com>", to: ["ada@example.com"], template: { id: "follow-up", variables: { name: "Ada" } },
    });
  });
});
