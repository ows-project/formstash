import { describe, expect, it } from "vitest";
import type { FormSummary } from "../../shared/types";
import { curlSnippet, endpointUrl, fetchSnippet, htmlSnippet, inputTypeFor, integrationWarnings } from "./snippets";

const form: FormSummary = {
  id: "form-1",
  name: "Waiting list",
  slug: "waiting-list",
  description: "",
  fields: ["email", "name", "message"],
  allowedOrigins: [],
  notificationEmail: null,
  successUrl: "https://example.com/thanks",
  isActive: true,
  strictFields: false,
  schema: [],
  turnstileEnabled: false,
  rateLimitPerMinute: 60,
  totalCount: 0,
  unreadCount: 0,
  spamCount: 0,
};
const endpoint = endpointUrl("https://forms.example", "waiting-list");
const settings = { turnstileSiteKey: "0x4AAA", turnstileSecretConfigured: true, encryptionReady: true };

describe("endpointUrl", () => {
  it("builds the public submission URL from the dashboard origin", () => {
    expect(endpoint).toBe("https://forms.example/f/waiting-list");
  });
});

describe("inputTypeFor", () => {
  it("guesses an input type from the field key", () => {
    expect(inputTypeFor("email")).toBe("email");
    expect(inputTypeFor("work_email")).toBe("email");
    expect(inputTypeFor("phone")).toBe("tel");
    expect(inputTypeFor("website")).toBe("url");
    expect(inputTypeFor("message")).toBe("textarea");
    expect(inputTypeFor("comments")).toBe("textarea");
    expect(inputTypeFor("company")).toBe("text");
  });
});

describe("htmlSnippet", () => {
  const html = htmlSnippet({ endpoint, form });

  it("posts a native form to the endpoint with one control per schema field", () => {
    expect(html).toContain(`<form action="https://forms.example/f/waiting-list" method="POST">`);
    expect(html).toContain(`<input type="email" name="email">`);
    expect(html).toContain(`<input type="text" name="name">`);
    expect(html).toContain(`<textarea name="message"></textarea>`);
  });

  it("includes the honeypot and an unnamed submit button so strict schemas still accept it", () => {
    expect(html).toContain(`name="_gotcha"`);
    expect(html).toMatch(/<button type="submit">[^<]+<\/button>/);
    expect(html).not.toMatch(/<button[^>]*name=/);
  });

  it("adds the Turnstile widget only when the form requires it", () => {
    expect(html).not.toContain("cf-turnstile");
    const protectedHtml = htmlSnippet({ endpoint, form: { ...form, turnstileEnabled: true }, turnstileSiteKey: "0x4AAA" });
    expect(protectedHtml).toContain(`<div class="cf-turnstile" data-sitekey="0x4AAA"></div>`);
    expect(protectedHtml).toContain("https://challenges.cloudflare.com/turnstile/v0/api.js");
  });

  it("escapes field keys before placing them in markup", () => {
    const hostile = htmlSnippet({ endpoint, form: { ...form, fields: [`a"><script>x</script>`] } });
    expect(hostile).not.toContain("<script>x</script>");
    expect(hostile).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("uses the enforced schema instead of display fields, with types and required flags", () => {
    const html = htmlSnippet({ endpoint, form: { ...form, strictFields: true, schema: [
      { name: "age", type: "number", required: true },
      { name: "consent", type: "boolean" },
      { name: "team", type: "enum", values: ["R&D", "Sales"] },
    ] } });
    expect(html).toContain('<input type="number" name="age" required>');
    expect(html).toContain('<input type="checkbox" name="consent">');
    expect(html).toContain('<option value="R&amp;D">R&amp;D</option>');
    expect(html).not.toContain('name="email"');
  });
});

describe("fetchSnippet", () => {
  const code = fetchSnippet({ endpoint, form });

  it("always sends JSON so the endpoint answers 201 instead of redirecting", () => {
    expect(code).toContain(`fetch("https://forms.example/f/waiting-list"`);
    expect(code).toContain(`"Content-Type": "application/json"`);
    expect(code).toContain("JSON.stringify(");
    expect(code).not.toMatch(/body:\s*new FormData/);
  });

  it("sends what the visitor typed from the form's submit handler, not sample data", () => {
    expect(code).toContain(`form.addEventListener("submit"`);
    expect(code).toContain("event.preventDefault()");
    expect(code).toContain("...Object.fromEntries(new FormData(form))");
    expect(code).not.toContain("ada@example.com");
  });

  it("records the page the visitor submitted from", () => {
    expect(code).toContain("_source: location.href");
  });

  it("mentions the Turnstile token only for protected forms", () => {
    expect(code).not.toContain("cf-turnstile-response");
    expect(fetchSnippet({ endpoint, form: { ...form, turnstileEnabled: true } })).toContain("cf-turnstile-response");
  });
});

describe("curlSnippet", () => {
  it("posts sample JSON for the schema fields", () => {
    const command = curlSnippet({ endpoint, form });
    expect(command).toContain("curl -X POST https://forms.example/f/waiting-list");
    expect(command).toContain(`-H "Content-Type: application/json"`);
    expect(command).toContain(`"email":"ada@example.com"`);
  });

  it("keeps the shell quoting intact when a field key contains a single quote", () => {
    const command = curlSnippet({ endpoint, form: { ...form, fields: ["o'clock"] } });
    expect(command).toContain(`o'\\''clock`);
  });
});

describe("integrationWarnings", () => {
  const ids = (input: Parameters<typeof integrationWarnings>[0], settingsInput: Parameters<typeof integrationWarnings>[1] = settings) =>
    integrationWarnings(input, settingsInput).map((warning) => warning.id);

  it("has nothing to say about a live form with a redirect", () => {
    expect(ids(form)).toEqual([]);
  });

  it("warns when the form is paused", () => {
    expect(ids({ ...form, isActive: false })).toContain("paused");
  });

  it("explains that native posts show JSON without a success URL", () => {
    expect(ids({ ...form, successUrl: null })).toContain("no-success-url");
  });

  it("lists the allowed origins", () => {
    const warnings = integrationWarnings({ ...form, allowedOrigins: ["https://example.com"] }, settings);
    expect(warnings.find((warning) => warning.id === "origins")?.body).toContain("https://example.com");
  });

  it("flags Turnstile protection that cannot verify tokens", () => {
    const protectedForm = { ...form, turnstileEnabled: true };
    expect(ids(protectedForm)).not.toContain("turnstile-setup");
    expect(ids(protectedForm, { ...settings, turnstileSiteKey: "" })).toContain("turnstile-setup");
    expect(ids(protectedForm, { ...settings, turnstileSecretConfigured: false })).toContain("turnstile-setup");
    expect(ids(protectedForm, { ...settings, encryptionReady: false })).toContain("turnstile-setup");
    expect(ids(protectedForm, null)).not.toContain("turnstile-setup");
  });

  it("names the accepted fields when the schema is strict", () => {
    expect(ids({ ...form, strictFields: true })).toContain("strict");
  });
});
