import type { AppSettings, FormSummary } from "../../shared/types";
import { humanizeField } from "./format";

type SnippetForm = Pick<FormSummary, "fields" | "turnstileEnabled">;

export interface SnippetInput {
  endpoint: string;
  form: SnippetForm;
  turnstileSiteKey?: string;
}

export type IntegrationSettings = Pick<AppSettings, "turnstileSiteKey" | "turnstileSecretConfigured" | "encryptionReady">;

export interface IntegrationWarning {
  id: "paused" | "no-success-url" | "origins" | "turnstile-setup" | "strict";
  tone: "warning" | "info";
  title: string;
  body: string;
}

type InputType = "email" | "tel" | "url" | "textarea" | "text";

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js";

export function endpointUrl(origin: string, slug: string): string {
  return `${origin}/f/${slug}`;
}

export function inputTypeFor(field: string): InputType {
  const key = field.toLowerCase();
  if (key.includes("email")) return "email";
  if (/phone|tel|mobile/.test(key)) return "tel";
  if (/url|website|site|link/.test(key)) return "url";
  if (/message|comment|note|details|feedback|body/.test(key)) return "textarea";
  return "text";
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function fieldsOf(form: SnippetForm): string[] {
  return form.fields.length ? form.fields : ["email"];
}

function sampleValue(field: string): string {
  const key = field.toLowerCase();
  const type = inputTypeFor(field);
  if (type === "email") return "ada@example.com";
  if (type === "tel") return "+1 555 0100";
  if (type === "url") return "https://example.com";
  if (type === "textarea") return "Hello from the docs!";
  if (key.includes("name")) return "Ada Lovelace";
  if (key.includes("company")) return "Analytical Engines";
  return "Example";
}

function samplePayload(form: SnippetForm): Record<string, string> {
  return Object.fromEntries(fieldsOf(form).map((field) => [field, sampleValue(field)]));
}

export function htmlSnippet({ endpoint, form, turnstileSiteKey }: SnippetInput): string {
  const controls = fieldsOf(form).map((field) => {
    const name = escapeHtml(field);
    const type = inputTypeFor(field);
    const control = type === "textarea"
      ? `<textarea name="${name}"></textarea>`
      : `<input type="${type}" name="${name}"${type === "email" ? " required" : ""}>`;
    return `  <label>\n    ${escapeHtml(humanizeField(field))}\n    ${control}\n  </label>`;
  });

  const lines = [
    `<form action="${escapeHtml(endpoint)}" method="POST">`,
    ...controls,
    `  <!-- Spam trap: people never see this field, bots fill it in. -->`,
    `  <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-10000px">`,
  ];
  if (form.turnstileEnabled) {
    lines.push(`  <div class="cf-turnstile" data-sitekey="${escapeHtml(turnstileSiteKey || "YOUR_SITE_KEY")}"></div>`);
  }
  lines.push(`  <button type="submit">Send</button>`, `</form>`);
  if (form.turnstileEnabled) lines.push(`<script src="${TURNSTILE_SCRIPT}" async defer></script>`);
  return lines.join("\n");
}

export function fetchSnippet({ endpoint, form }: SnippetInput): string {
  return [
    `const form = document.querySelector("form");`,
    ``,
    `form.addEventListener("submit", async (event) => {`,
    `  event.preventDefault();`,
    `  const response = await fetch(${JSON.stringify(endpoint)}, {`,
    `    method: "POST",`,
    `    headers: { "Content-Type": "application/json" },`,
    `    body: JSON.stringify({`,
    ...(form.turnstileEnabled ? [`      // The Turnstile widget adds cf-turnstile-response to the form for you.`] : []),
    `      ...Object.fromEntries(new FormData(form)),`,
    `      _source: location.href,`,
    `    }),`,
    `  });`,
    ``,
    `  if (!response.ok) {`,
    `    const { error } = await response.json();`,
    `    throw new Error(error);`,
    `  }`,
    `  form.reset();`,
    `});`,
  ].join("\n");
}

export function curlSnippet({ endpoint, form }: SnippetInput): string {
  const payload = JSON.stringify(samplePayload(form)).replaceAll("'", `'\\''`);
  return [
    `curl -X POST ${endpoint} \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "Idempotency-Key: $(uuidgen)" \\`,
    `  -d '${payload}'`,
  ].join("\n");
}

export function integrationWarnings(
  form: Pick<FormSummary, "isActive" | "successUrl" | "allowedOrigins" | "turnstileEnabled" | "strictFields" | "fields">,
  settings: IntegrationSettings | null,
): IntegrationWarning[] {
  const warnings: IntegrationWarning[] = [];
  if (!form.isActive) {
    warnings.push({
      id: "paused",
      tone: "warning",
      title: "This form is paused",
      body: "The endpoint answers 404 until you turn the form back on in form settings.",
    });
  }
  if (form.turnstileEnabled && settings && (!settings.turnstileSiteKey || !settings.turnstileSecretConfigured || !settings.encryptionReady)) {
    warnings.push({
      id: "turnstile-setup",
      tone: "warning",
      title: "Turnstile isn't fully set up",
      body: "Every submission will be rejected until the site key, secret key, and APP_SECRET are all configured in Settings.",
    });
  }
  if (!form.successUrl) {
    warnings.push({
      id: "no-success-url",
      tone: "info",
      title: "No thank-you page yet",
      body: "Visitors who submit the HTML form will see a raw JSON response. Add a success redirect URL in form settings.",
    });
  }
  if (form.allowedOrigins.length) {
    warnings.push({
      id: "origins",
      tone: "info",
      title: "Browser submissions are restricted",
      body: `Only pages on ${form.allowedOrigins.join(", ")} can submit from a browser.`,
    });
  }
  if (form.strictFields) {
    warnings.push({
      id: "strict",
      tone: "info",
      title: "Strict fields are on",
      body: `Submissions may only contain: ${form.fields.join(", ")}.`,
    });
  }
  return warnings;
}
