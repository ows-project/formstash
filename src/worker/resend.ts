import type { SubmissionPayload } from "../shared/types";
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

// Submission fields become template variables. Keys are reduced to Resend's
// character set, values to its limits; nulls are left out so fallbacks apply.
export function templateVariables(
  payload: SubmissionPayload,
  meta: { formName: string | null; submittedAt: string | null; sourceUrl: string | null },
  extra: Record<string, string> = {},
): Record<string, string | number> {
  const variables: Record<string, string | number> = {};
  const entries: [string, unknown][] = [
    ...Object.entries(payload),
    ["form_name", meta.formName],
    ["submitted_at", meta.submittedAt],
    ["source_url", meta.sourceUrl],
    ...Object.entries(extra),
  ];
  for (const [rawKey, value] of entries) {
    const key = rawKey.replace(/[^A-Za-z0-9_]/g, "_");
    if (value === null || value === undefined || !isVariableKey(key)) continue;
    variables[key] = typeof value === "number" && Number.isSafeInteger(value) ? value : String(value).slice(0, 2000);
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
