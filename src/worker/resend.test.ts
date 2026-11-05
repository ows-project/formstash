import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveVariables, sendResend } from "./resend";

describe("resolveVariables", () => {
  const meta = { formName: "Closed testing", submittedAt: "2026-11-05T01:00:00.000Z", sourceUrl: null };

  it("sends submission fields under Resend-safe names within Resend's limits", () => {
    expect(resolveVariables({ email: "ada@example.com", "first-name": "Ada", seats: 3, consent: true, note: null, EMAIL: "x", long: "a".repeat(2500) }, meta)).toEqual({
      email: "ada@example.com", first_name: "Ada", seats: 3, consent: "true", long: "a".repeat(2000),
      form_name: "Closed testing", submitted_at: "2026-11-05T01:00:00.000Z",
    });
  });

  it("applies field mappings and manual values, with send-time values over saved defaults", () => {
    const variables = resolveVariables(
      { email: "ada@example.com", name: "Ada" },
      meta,
      [
        { key: "NAMA", source: "field", value: "name" },
        { key: "COMPANY", source: "field", value: "company" },
        { key: "LINK", source: "manual", value: "https://default.example" },
        { key: "CODE", source: "manual", value: "SAVED" },
        { key: "form_name", source: "manual", value: "" },
      ],
      { LINK: "https://play.google.com/apps/testing/app" },
    );
    expect(variables).toEqual({
      email: "ada@example.com", name: "Ada", submitted_at: "2026-11-05T01:00:00.000Z",
      NAMA: "Ada", LINK: "https://play.google.com/apps/testing/app", CODE: "SAVED",
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
