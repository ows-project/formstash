import type { SubmissionPayload } from "../shared/types";
import type { Env } from "./auth";
import { decryptSecret } from "./secrets";
import { sendResend, templateVariables, type ResendTemplate } from "./resend";
import { sendSmtp, type EmailContent, type SmtpConfig } from "./smtp";

export interface EmailJob {
  deliveryId: string;
  resetUrl?: string;
}

export interface SettingsRow {
  smtp_enabled: number;
  email_provider: "smtp" | "resend";
  smtp_host: string;
  smtp_port: number;
  smtp_security: "tls" | "starttls";
  smtp_username: string;
  smtp_password_encrypted: string | null;
  smtp_from_name: string;
  smtp_from_email: string;
  retention_days: number;
  turnstile_site_key: string;
  turnstile_secret_encrypted: string | null;
}

export type DeliveryKind = "submission" | "password_reset" | "test" | "confirmation" | "follow_up";

interface DeliveryRow {
  id: string;
  recipient: string;
  kind: DeliveryKind;
  variables_json: string | null;
  form_name: string | null;
  confirmation_template: string | null;
  follow_up_template: string | null;
  payload_json: string | null;
  source_url: string | null;
  received_at: string | null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]!);
}

export async function loadSettings(database: D1Database): Promise<SettingsRow | null> {
  return database.prepare("SELECT * FROM instance_settings WHERE id = 1").first<SettingsRow>();
}

// Email is ready when it is turned on and the chosen provider has its credential.
export function emailReady(settings: SettingsRow | null, env: Env): settings is SettingsRow {
  if (!settings?.smtp_enabled) return false;
  return settings.email_provider === "resend"
    ? Boolean(env.RESEND_API_KEY)
    : Boolean(settings.smtp_password_encrypted && env.APP_SECRET);
}

async function smtpConfig(env: Env, settings: SettingsRow): Promise<SmtpConfig> {
  if (!env.APP_SECRET || !settings.smtp_password_encrypted) throw new Error("SMTP credentials are not configured");
  return {
    host: settings.smtp_host,
    port: settings.smtp_port,
    security: settings.smtp_security,
    username: settings.smtp_username,
    password: await decryptSecret(settings.smtp_password_encrypted, env.APP_SECRET),
    fromName: settings.smtp_from_name,
    fromEmail: settings.smtp_from_email,
  };
}

function sender(settings: SettingsRow): string {
  const name = settings.smtp_from_name.replace(/[\r\n<>"]+/g, " ").trim();
  return name ? `${name} <${settings.smtp_from_email}>` : settings.smtp_from_email;
}

function submissionEmail(row: DeliveryRow): EmailContent {
  const payload = JSON.parse(row.payload_json ?? "{}") as SubmissionPayload;
  const lines = Object.entries(payload).map(([key, value]) => `${key}: ${String(value ?? "")}`);
  if (row.source_url) lines.push(`source: ${row.source_url}`);
  const table = Object.entries(payload).map(([key, value]) =>
    `<tr><th style="text-align:left;padding:8px 12px 8px 0;color:#667085;vertical-align:top">${escapeHtml(key)}</th><td style="padding:8px 0;color:#172033">${escapeHtml(value)}</td></tr>`,
  ).join("");
  return {
    to: row.recipient,
    subject: `New ${row.form_name ?? "form"} submission`,
    text: [`New submission for ${row.form_name ?? "your form"}`, "", ...lines].join("\n"),
    html: `<div style="font-family:system-ui,sans-serif;max-width:620px"><h2>New submission for ${escapeHtml(row.form_name ?? "your form")}</h2><table>${table}</table>${row.source_url ? `<p style="color:#667085">Source: ${escapeHtml(row.source_url)}</p>` : ""}</div>`,
  };
}

function resetEmail(row: DeliveryRow, resetUrl: string): EmailContent {
  return {
    to: row.recipient,
    subject: "Reset your Formstash password",
    text: `Use this link to reset your Formstash password. It expires in one hour:\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:620px"><h2>Reset your Formstash password</h2><p>This link expires in one hour.</p><p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:10px 16px;background:#175cd3;color:white;text-decoration:none;border-radius:7px">Reset password</a></p><p style="color:#667085">If you did not request this, ignore this email.</p></div>`,
  };
}

function testEmail(row: DeliveryRow): EmailContent {
  return {
    to: row.recipient,
    subject: "Formstash email test",
    text: "Your Formstash email settings are working.",
    html: "<div style=\"font-family:system-ui,sans-serif\"><h2>Email is working</h2><p>Your Formstash email settings delivered this message successfully.</p></div>",
  };
}

async function createDelivery(env: Env, input: {
  formId?: string;
  submissionId?: string;
  recipient: string;
  kind: DeliveryKind;
  resetUrl?: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO email_deliveries (id, form_id, submission_id, recipient, kind, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(id, input.formId ?? null, input.submissionId ?? null, input.recipient, input.kind, new Date().toISOString()).run();
  try {
    await env.EMAIL_QUEUE.send({ deliveryId: id, resetUrl: input.resetUrl });
  } catch (error) {
    await env.DB.prepare("UPDATE email_deliveries SET status = 'failed', last_error = ? WHERE id = ?")
      .bind(error instanceof Error ? error.message.slice(0, 500) : "Queue unavailable", id).run();
    throw error;
  }
  return id;
}

export async function queueSubmissionEmail(env: Env, formId: string, submissionId: string, recipient: string): Promise<string> {
  return createDelivery(env, { formId, submissionId, recipient, kind: "submission" });
}

export async function queueConfirmationEmail(env: Env, formId: string, submissionId: string, recipient: string): Promise<string> {
  return createDelivery(env, { formId, submissionId, recipient, kind: "confirmation" });
}

// Queues one follow-up per recipient; owner-entered variables are stored with each delivery.
export async function queueFollowUpEmails(
  env: Env,
  formId: string,
  recipients: { submissionId: string; recipient: string }[],
  variables: Record<string, string>,
): Promise<number> {
  const now = new Date().toISOString();
  const variablesJson = JSON.stringify(variables);
  for (let start = 0; start < recipients.length; start += 100) {
    const chunk = recipients.slice(start, start + 100).map((entry) => ({ ...entry, id: crypto.randomUUID() }));
    await env.DB.batch(chunk.map((entry) => env.DB.prepare(
      `INSERT INTO email_deliveries (id, form_id, submission_id, recipient, kind, variables_json, created_at)
       VALUES (?, ?, ?, ?, 'follow_up', ?, ?)`,
    ).bind(entry.id, formId, entry.submissionId, entry.recipient, variablesJson, now)));
    try {
      await env.EMAIL_QUEUE.sendBatch(chunk.map((entry) => ({ body: { deliveryId: entry.id } })));
    } catch (error) {
      await env.DB.batch(chunk.map((entry) => env.DB.prepare(
        "UPDATE email_deliveries SET status = 'failed', last_error = ? WHERE id = ?",
      ).bind(error instanceof Error ? error.message.slice(0, 500) : "Queue unavailable", entry.id)));
      throw error;
    }
  }
  return recipients.length;
}

export async function queuePasswordResetEmail(env: Env, recipient: string, resetUrl: string): Promise<string> {
  return createDelivery(env, { recipient, kind: "password_reset", resetUrl });
}

export async function queueTestEmail(env: Env, recipient: string): Promise<string> {
  return createDelivery(env, { recipient, kind: "test" });
}

async function deliver(env: Env, job: EmailJob): Promise<void> {
  const row = await env.DB.prepare(
    `SELECT email_deliveries.id, email_deliveries.recipient, email_deliveries.kind, email_deliveries.variables_json,
            forms.name AS form_name, forms.confirmation_template, forms.follow_up_template,
            submissions.payload_json, submissions.source_url, submissions.received_at
     FROM email_deliveries
     LEFT JOIN forms ON forms.id = email_deliveries.form_id
     LEFT JOIN submissions ON submissions.id = email_deliveries.submission_id
     WHERE email_deliveries.id = ?`,
  ).bind(job.deliveryId).first<DeliveryRow>();
  if (!row) return;

  const settings = await loadSettings(env.DB);
  if (!emailReady(settings, env)) throw new Error("Email delivery is not enabled or its credentials are missing");
  if (row.kind === "confirmation" || row.kind === "follow_up") {
    if (settings.email_provider !== "resend") throw new Error("Template emails require Resend as the email provider");
    const templateId = row.kind === "confirmation" ? row.confirmation_template : row.follow_up_template;
    if (!templateId) throw new Error("The form has no Resend template for this email");
    if (!row.payload_json) throw new Error("The submission was deleted");
    const template: ResendTemplate = {
      id: templateId,
      variables: templateVariables(
        JSON.parse(row.payload_json) as SubmissionPayload,
        { formName: row.form_name, submittedAt: row.received_at, sourceUrl: row.source_url },
        JSON.parse(row.variables_json ?? "{}") as Record<string, string>,
      ),
    };
    await sendResend(env.RESEND_API_KEY!, sender(settings), { to: row.recipient, idempotencyKey: row.id, template });
  } else {
    const content = row.kind === "submission"
      ? submissionEmail(row)
      : row.kind === "password_reset"
        ? resetEmail(row, job.resetUrl ?? "")
        : testEmail(row);
    if (settings.email_provider === "resend") {
      await sendResend(env.RESEND_API_KEY!, sender(settings), { to: row.recipient, idempotencyKey: row.id, content });
    } else {
      await sendSmtp(await smtpConfig(env, settings), content);
    }
  }
  await env.DB.prepare(
    "UPDATE email_deliveries SET status = 'delivered', attempts = attempts + 1, last_error = NULL, delivered_at = ? WHERE id = ?",
  ).bind(new Date().toISOString(), row.id).run();
}

export async function consumeEmailBatch(batch: MessageBatch<EmailJob>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    try {
      await deliver(env, message.body);
      message.ack();
    } catch (error) {
      const finalAttempt = message.attempts >= 4;
      await env.DB.prepare(
        "UPDATE email_deliveries SET status = ?, attempts = attempts + 1, last_error = ? WHERE id = ?",
      ).bind(
        finalAttempt ? "failed" : "retrying",
        error instanceof Error ? error.message.slice(0, 500) : "Email delivery failed",
        message.body.deliveryId,
      ).run();
      if (finalAttempt) message.ack();
      else message.retry({ delaySeconds: Math.min(3600, 30 * (2 ** Math.max(0, message.attempts - 1))) });
    }
  }
}

export async function cleanupExpiredData(env: Env): Promise<void> {
  const settings = await loadSettings(env.DB);
  const now = new Date();
  const statements = [
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now.toISOString()),
    env.DB.prepare("DELETE FROM password_resets WHERE expires_at <= ? OR used_at IS NOT NULL").bind(now.toISOString()),
    env.DB.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(new Date(now.getTime() - 3_600_000).toISOString().slice(0, 16)),
    env.DB.prepare("DELETE FROM email_deliveries WHERE created_at < ?").bind(new Date(now.getTime() - 90 * 86_400_000).toISOString()),
  ];
  if (settings && settings.retention_days > 0) {
    statements.push(env.DB.prepare("DELETE FROM submissions WHERE received_at < ?")
      .bind(new Date(now.getTime() - settings.retention_days * 86_400_000).toISOString()));
  }
  await env.DB.batch(statements);
}
