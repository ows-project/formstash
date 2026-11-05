import type { SubmissionPayload, TemplateVariable } from "../shared/types";
import type { EmailContent } from "./smtp-message";

export interface ResendTemplate {
  id: string;
  variables: Record<string, string | number>;
}

export type ResendMessage = { to: string; idempotencyKey: string } & (
  | { content: EmailContent }
  | { template: ResendTemplate }
);

// Resend reserves these exact keys for its own contact data; lowercase `email` stays available.
const RESERVED = new Set(["FIRST_NAME", "LAST_NAME", "EMAIL", "UNSUBSCRIBE_URL", "contact", "this"]);

export function isVariableKey(key: string): boolean {
  return /^[A-Za-z0-9_]{1,50}$/.test(key) && !RESERVED.has(key);
}

function toValue(value: unknown): string | number | null {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "number" && Number.isSafeInteger(value) ? value : String(value).slice(0, 2000);
}

// Every submission field (keys reduced to Resend's character set) plus form_name,
// submitted_at, and source_url, then the template's own variables on top. Field variables
// copy a submission field; manual ones use the send-time override or their saved default.
// Empty values are left out so the template's fallback applies.
export function resolveVariables(
  payload: SubmissionPayload,
  meta: { formName: string | null; submittedAt: string | null; sourceUrl: string | null },
  definitions: TemplateVariable[] = [],
  overrides: Record<string, string> = {},
): Record<string, string | number> {
  const variables: Record<string, string | number> = {};
  const builtins: [string, unknown][] = [
    ...Object.entries(payload),
    ["form_name", meta.formName],
    ["submitted_at", meta.submittedAt],
    ["source_url", meta.sourceUrl],
  ];
  for (const [rawKey, raw] of builtins) {
    const key = rawKey.replace(/[^A-Za-z0-9_]/g, "_");
    const value = toValue(raw);
    if (value !== null && isVariableKey(key)) variables[key] = value;
  }
  for (const definition of definitions) {
    const value = toValue(definition.source === "field" ? payload[definition.value] : overrides[definition.key] ?? definition.value);
    if (value === null) delete variables[definition.key];
    else variables[definition.key] = value;
  }
  return variables;
}

export async function sendResend(apiKey: string, from: string, message: ResendMessage): Promise<void> {
  const body = "template" in message
    ? { from, to: [message.to], template: message.template }
    : { from, to: [message.to], subject: message.content.subject, html: message.content.html, text: message.content.text };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Queue retries reuse the delivery id, so Resend sends each email once.
      "Idempotency-Key": message.idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json<{ message?: string; name?: string }>().catch(() => null);
    throw new Error(`Resend ${response.status}: ${error?.message ?? error?.name ?? response.statusText}`.slice(0, 500));
  }
}
