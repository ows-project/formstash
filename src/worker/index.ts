import { Hono, type Context } from "hono";
import { createSession, endSession, hashOpaqueToken, hashPassword, randomToken, requireUser, verifyPassword, type Env, type User, type Variables } from "./auth";
import { isHoneypotTripped, normalizeOrigin, normalizeSourceUrl, parseSubmission, slugify, SubmissionError } from "./submissions";
import type { SubmissionPayload, SubmissionStatus } from "../shared/types";
import { cleanupExpiredData, consumeEmailBatch, loadSettings, queuePasswordResetEmail, queueSubmissionEmail, queueTestEmail, type EmailJob } from "./delivery";
import { decryptSecret, encryptSecret } from "./secrets";
import { parseFormSchema, validateFormPayload } from "./schema";

type AppContext = { Bindings: Env; Variables: Variables };

interface FormRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  fields_json: string;
  schema_json: string;
  allowed_origins_json: string;
  notification_email: string | null;
  success_url: string | null;
  is_active: number;
  strict_fields: number;
  turnstile_enabled: number;
  rate_limit_per_minute: number;
  total_count: number;
  unread_count: number;
  spam_count: number;
}

interface SubmissionRow {
  id: string;
  form_id: string;
  payload_json: string;
  source_url: string | null;
  status: SubmissionStatus;
  received_at: string;
}

function parseStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string") ? parsed : [];
  } catch {
    return [];
  }
}

function mapForm(row: FormRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    fields: parseStringArray(row.fields_json),
    allowedOrigins: parseStringArray(row.allowed_origins_json),
    notificationEmail: row.notification_email,
    successUrl: row.success_url,
    isActive: Boolean(row.is_active),
    strictFields: Boolean(row.strict_fields),
    schema: JSON.parse(row.schema_json),
    turnstileEnabled: Boolean(row.turnstile_enabled),
    rateLimitPerMinute: row.rate_limit_per_minute,
    totalCount: row.total_count,
    unreadCount: row.unread_count,
    spamCount: row.spam_count,
  };
}

function mapSubmission(row: SubmissionRow) {
  return {
    id: row.id,
    formId: row.form_id,
    payload: JSON.parse(row.payload_json) as SubmissionPayload,
    sourceUrl: row.source_url,
    status: row.status,
    receivedAt: row.received_at,
  };
}

function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length >= 1 && cleaned.length <= 80 ? cleaned : null;
}

function jsonBody(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function corsHeaders(origin: string | undefined, allowedOrigins: string[]): Record<string, string> {
  if (!origin || (allowedOrigins.length > 0 && !allowedOrigins.includes(origin))) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function cleanHttpUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" ? normalizeSourceUrl(value) : null;
}

function parseOrigins(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) return null;
  const origins = value.map((entry) => normalizeOrigin(entry)).filter((entry): entry is string => Boolean(entry));
  return origins.length === value.length ? [...new Set(origins)] : null;
}

async function digest(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function enforceRateLimit(context: Context<AppContext>, form: Pick<FormRow, "id" | "rate_limit_per_minute">): Promise<boolean> {
  if (form.rate_limit_per_minute <= 0) return true;
  const address = context.req.header("cf-connecting-ip") ?? "unknown";
  const bucketKey = await digest(`${context.env.APP_SECRET ?? "formstash-rate-limit"}:${form.id}:${address}`);
  const windowStart = new Date().toISOString().slice(0, 16);
  const row = await context.env.DB.prepare(
    `INSERT INTO rate_limits (form_id, bucket_key, window_start, count) VALUES (?, ?, ?, 1)
     ON CONFLICT (form_id, bucket_key, window_start) DO UPDATE SET count = count + 1
     RETURNING count`,
  ).bind(form.id, bucketKey, windowStart).first<{ count: number }>();
  return (row?.count ?? 1) <= form.rate_limit_per_minute;
}

async function verifyTurnstile(env: Env, token: string): Promise<boolean> {
  const settings = await loadSettings(env.DB);
  if (!env.APP_SECRET || !settings?.turnstile_secret_encrypted) return false;
  const secret = await decryptSecret(settings.turnstile_secret_encrypted, env.APP_SECRET);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token }),
  });
  const result = await response.json<{ success?: boolean }>();
  return Boolean(result.success);
}

async function uniqueSlug(database: D1Database, name: string): Promise<string> {
  const base = slugify(name);
  const existing = await database.prepare("SELECT 1 FROM forms WHERE slug = ?").bind(base).first();
  if (!existing) return base;
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

const app = new Hono<AppContext>();

app.get("/api/setup/status", async (context) => {
  const instance = await context.env.DB.prepare("SELECT 1 FROM instance WHERE id = 1").first();
  return context.json({ initialized: Boolean(instance) });
});

app.post("/api/setup", async (context) => {
  const body = jsonBody(await context.req.json().catch(() => null));
  const email = body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = body && typeof body.password === "string" ? body.password : "";
  const formName = cleanName(body?.formName);
  const description = typeof body?.description === "string" ? body.description.trim().slice(0, 240) : "";
  const originInput = typeof body?.allowedOrigin === "string" ? body.allowedOrigin.trim() : "";
  const allowedOrigin = originInput ? normalizeOrigin(originInput) : null;

  if (!isEmail(email)) return context.json({ error: "Enter a valid owner email" }, 422);
  if (password.length < 12) return context.json({ error: "Password must contain at least 12 characters" }, 422);
  if (!formName) return context.json({ error: "Form name is required" }, 422);
  if (originInput && !allowedOrigin) return context.json({ error: "Allowed origin must be an HTTP or HTTPS URL" }, 422);

  const alreadyInitialized = await context.env.DB.prepare("SELECT 1 FROM instance WHERE id = 1").first();
  if (alreadyInitialized) return context.json({ error: "This instance is already initialized" }, 409);

  const now = new Date().toISOString();
  const userId = crypto.randomUUID();
  const formId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const slug = await uniqueSlug(context.env.DB, formName);

  try {
    await context.env.DB.batch([
      context.env.DB.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
        .bind(userId, email, passwordHash, now),
      context.env.DB.prepare("INSERT INTO instance (id, owner_id, created_at) VALUES (1, ?, ?)").bind(userId, now),
      context.env.DB.prepare("INSERT INTO instance_settings (id, smtp_from_email, updated_at) VALUES (1, ?, ?)")
        .bind(email, now),
      context.env.DB.prepare(
        `INSERT INTO forms
         (id, name, slug, description, fields_json, allowed_origins_json, notification_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        formId,
        formName,
        slug,
        description,
        JSON.stringify(["email", "name", "company"]),
        JSON.stringify(allowedOrigin ? [allowedOrigin] : []),
        email,
        now,
        now,
      ),
    ]);
  } catch {
    return context.json({ error: "This instance was initialized by another request" }, 409);
  }

  await createSession(context, userId);
  return context.json({ user: { id: userId, email }, formId }, 201);
});

app.post("/api/auth/login", async (context) => {
  const body = jsonBody(await context.req.json().catch(() => null));
  const email = body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = body && typeof body.password === "string" ? body.password : "";
  const user = await context.env.DB.prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
    .bind(email).first<User & { password_hash: string }>();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return context.json({ error: "Email or password is incorrect" }, 401);
  }

  await createSession(context, user.id);
  return context.json({ user: { id: user.id, email: user.email } });
});

app.post("/api/auth/logout", async (context) => {
  await endSession(context);
  return context.body(null, 204);
});

app.post("/api/auth/password/request", async (context) => {
  const body = jsonBody(await context.req.json().catch(() => null));
  const email = body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const user = isEmail(email)
    ? await context.env.DB.prepare("SELECT id, email FROM users WHERE email = ?").bind(email).first<User>()
    : null;
  const settings = await loadSettings(context.env.DB);
  if (user && settings?.smtp_enabled && settings.smtp_password_encrypted && context.env.APP_SECRET) {
    const token = randomToken();
    const now = new Date();
    await context.env.DB.prepare(
      "INSERT INTO password_resets (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    ).bind(
      await hashOpaqueToken(token),
      user.id,
      new Date(now.getTime() + 3_600_000).toISOString(),
      now.toISOString(),
    ).run();
    const resetUrl = `${new URL(context.req.url).origin}/?reset=${encodeURIComponent(token)}`;
    context.executionCtx.waitUntil(queuePasswordResetEmail(context.env, user.email, resetUrl).catch((error) => {
      console.error("Failed to queue password reset", error);
    }));
  }
  return context.body(null, 204);
});

app.post("/api/auth/password/reset", async (context) => {
  const body = jsonBody(await context.req.json().catch(() => null));
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!token || password.length < 12) return context.json({ error: "Invalid token or password" }, 422);

  const tokenHash = await hashOpaqueToken(token);
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const results = await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE users SET password_hash = ? WHERE id = (
         SELECT user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
       )`,
    ).bind(passwordHash, tokenHash, now),
    context.env.DB.prepare(
      "UPDATE password_resets SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?",
    ).bind(now, tokenHash, now),
  ]);
  if (!results[0].meta.changes) return context.json({ error: "Reset link is invalid or expired" }, 422);
  const reset = await context.env.DB.prepare("SELECT user_id FROM password_resets WHERE token_hash = ?")
    .bind(tokenHash).first<{ user_id: string }>();
  if (reset) await context.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(reset.user_id).run();
  return context.body(null, 204);
});

app.get("/api/auth/me", requireUser, (context) => context.json({ user: context.get("user") }));

app.use("/api/forms", requireUser);
app.use("/api/forms/*", requireUser);
app.use("/api/settings", requireUser);
app.use("/api/settings/*", requireUser);
app.use("/api/activity", requireUser);

app.get("/api/settings", async (context) => {
  const settings = await loadSettings(context.env.DB);
  return context.json({
    settings: {
      smtpEnabled: Boolean(settings?.smtp_enabled),
      smtpHost: settings?.smtp_host ?? "",
      smtpPort: settings?.smtp_port ?? 465,
      smtpSecurity: settings?.smtp_security ?? "tls",
      smtpUsername: settings?.smtp_username ?? "",
      smtpPasswordConfigured: Boolean(settings?.smtp_password_encrypted),
      smtpFromName: settings?.smtp_from_name ?? "Formstash",
      smtpFromEmail: settings?.smtp_from_email ?? "",
      retentionDays: settings?.retention_days ?? 0,
      turnstileSiteKey: settings?.turnstile_site_key ?? "",
      turnstileSecretConfigured: Boolean(settings?.turnstile_secret_encrypted),
      encryptionReady: Boolean(context.env.APP_SECRET),
    },
  });
});

app.patch("/api/settings", async (context) => {
  const body = jsonBody(await context.req.json().catch(() => null));
  if (!body) return context.json({ error: "Invalid settings" }, 422);
  const current = await loadSettings(context.env.DB);
  const smtpEnabled = Boolean(body.smtpEnabled);
  const smtpHost = typeof body.smtpHost === "string" ? body.smtpHost.trim().slice(0, 253) : "";
  const smtpPort = Number(body.smtpPort);
  const smtpSecurity = body.smtpSecurity === "starttls" ? "starttls" : "tls";
  const smtpUsername = typeof body.smtpUsername === "string" ? body.smtpUsername.trim().slice(0, 254) : "";
  const smtpPassword = typeof body.smtpPassword === "string" ? body.smtpPassword : "";
  const smtpFromName = cleanName(body.smtpFromName) ?? "Formstash";
  const smtpFromEmail = typeof body.smtpFromEmail === "string" ? body.smtpFromEmail.trim().toLowerCase() : "";
  const retentionDays = Number(body.retentionDays);
  const turnstileSiteKey = typeof body.turnstileSiteKey === "string" ? body.turnstileSiteKey.trim().slice(0, 200) : "";
  const turnstileSecret = typeof body.turnstileSecret === "string" ? body.turnstileSecret.trim() : "";

  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65_535) return context.json({ error: "Invalid SMTP port" }, 422);
  if (!Number.isInteger(retentionDays) || retentionDays < 0 || retentionDays > 3_650) return context.json({ error: "Retention must be between 0 and 3650 days" }, 422);
  if (smtpEnabled && (!smtpHost || !isEmail(smtpFromEmail))) return context.json({ error: "SMTP host and sender email are required" }, 422);
  if ((smtpPassword || turnstileSecret) && !context.env.APP_SECRET) {
    return context.json({ error: "Set the APP_SECRET Worker secret before saving credentials" }, 422);
  }

  const encryptedSmtpPassword = smtpPassword
    ? await encryptSecret(smtpPassword, context.env.APP_SECRET!)
    : current?.smtp_password_encrypted ?? null;
  const encryptedTurnstileSecret = turnstileSecret
    ? await encryptSecret(turnstileSecret, context.env.APP_SECRET!)
    : current?.turnstile_secret_encrypted ?? null;
  if (smtpEnabled && !encryptedSmtpPassword) return context.json({ error: "SMTP password is required" }, 422);

  await context.env.DB.prepare(
    `INSERT INTO instance_settings
      (id, smtp_enabled, smtp_host, smtp_port, smtp_security, smtp_username, smtp_password_encrypted,
       smtp_from_name, smtp_from_email, retention_days, turnstile_site_key, turnstile_secret_encrypted, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       smtp_enabled = excluded.smtp_enabled, smtp_host = excluded.smtp_host, smtp_port = excluded.smtp_port,
       smtp_security = excluded.smtp_security, smtp_username = excluded.smtp_username,
       smtp_password_encrypted = excluded.smtp_password_encrypted, smtp_from_name = excluded.smtp_from_name,
       smtp_from_email = excluded.smtp_from_email, retention_days = excluded.retention_days,
       turnstile_site_key = excluded.turnstile_site_key, turnstile_secret_encrypted = excluded.turnstile_secret_encrypted,
       updated_at = excluded.updated_at`,
  ).bind(
    smtpEnabled ? 1 : 0, smtpHost, smtpPort, smtpSecurity, smtpUsername, encryptedSmtpPassword,
    smtpFromName, smtpFromEmail, retentionDays, turnstileSiteKey, encryptedTurnstileSecret, new Date().toISOString(),
  ).run();
  return context.json({ saved: true });
});

app.post("/api/settings/test-email", async (context) => {
  const settings = await loadSettings(context.env.DB);
  if (!settings?.smtp_enabled || !settings.smtp_password_encrypted || !context.env.APP_SECRET) {
    return context.json({ error: "Save and enable SMTP first" }, 422);
  }
  const id = await queueTestEmail(context.env, context.get("user").email);
  return context.json({ id }, 202);
});

app.get("/api/activity", async (context) => {
  const rows = await context.env.DB.prepare(
    `SELECT email_deliveries.id, forms.name AS form_name, email_deliveries.recipient,
            email_deliveries.kind, email_deliveries.status, email_deliveries.attempts,
            email_deliveries.last_error, email_deliveries.created_at, email_deliveries.delivered_at
     FROM email_deliveries LEFT JOIN forms ON forms.id = email_deliveries.form_id
     ORDER BY email_deliveries.created_at DESC LIMIT 100`,
  ).all<{
    id: string; form_name: string | null; recipient: string; kind: "submission" | "password_reset" | "test";
    status: "queued" | "retrying" | "delivered" | "failed"; attempts: number; last_error: string | null;
    created_at: string; delivered_at: string | null;
  }>();
  return context.json({ deliveries: rows.results.map((row) => ({
    id: row.id, formName: row.form_name, recipient: row.recipient, kind: row.kind, status: row.status,
    attempts: row.attempts, lastError: row.last_error, createdAt: row.created_at, deliveredAt: row.delivered_at,
  })) });
});

app.get("/api/forms", async (context) => {
  const rows = await context.env.DB.prepare(
    `SELECT forms.*,
       (SELECT COUNT(*) FROM submissions WHERE form_id = forms.id) AS total_count,
       (SELECT COUNT(*) FROM submissions WHERE form_id = forms.id AND status = 'unread') AS unread_count,
       (SELECT COUNT(*) FROM submissions WHERE form_id = forms.id AND status = 'spam') AS spam_count
     FROM forms ORDER BY created_at ASC`,
  ).all<FormRow>();
  return context.json({ forms: rows.results.map(mapForm) });
});

app.post("/api/forms", async (context) => {
  const body = jsonBody(await context.req.json().catch(() => null));
  const name = cleanName(body?.name);
  if (!name) return context.json({ error: "Form name is required" }, 422);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const slug = await uniqueSlug(context.env.DB, name);
  await context.env.DB.prepare(
    `INSERT INTO forms (id, name, slug, fields_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(id, name, slug, JSON.stringify(["email", "name"]), now, now).run();
  return context.json({ id, slug }, 201);
});

app.patch("/api/forms/:formId", async (context) => {
  const body = jsonBody(await context.req.json().catch(() => null));
  if (!body) return context.json({ error: "Invalid form settings" }, 422);
  const name = cleanName(body?.name);
  const description = typeof body?.description === "string" ? body.description.trim().slice(0, 240) : "";
  const fields = Array.isArray(body?.fields) && body.fields.every((field) => typeof field === "string")
    ? [...new Set(body.fields.map((field) => field.trim()).filter((field) => /^[a-zA-Z][a-zA-Z0-9_-]{0,99}$/.test(field)))]
    : null;
  const allowedOrigins = parseOrigins(body?.allowedOrigins);
  const notificationEmail = body?.notificationEmail === "" || body?.notificationEmail === null
    ? null
    : typeof body?.notificationEmail === "string" ? body.notificationEmail.trim().toLowerCase() : null;
  const successUrl = cleanHttpUrl(body?.successUrl);
  const rateLimit = Number(body?.rateLimitPerMinute);
  if (!name || !fields || !allowedOrigins) return context.json({ error: "Invalid form settings" }, 422);
  if (notificationEmail && !isEmail(notificationEmail)) return context.json({ error: "Invalid notification email" }, 422);
  if (body?.successUrl && !successUrl) return context.json({ error: "Success URL must use HTTP or HTTPS" }, 422);
  if (!Number.isInteger(rateLimit) || rateLimit < 0 || rateLimit > 10_000) return context.json({ error: "Rate limit must be between 0 and 10000" }, 422);

  let schema;
  try {
    schema = parseFormSchema(body.schema ?? []);
    if (body.strictFields && !schema.length) return context.json({ error: "Add at least one schema field before enabling enforcement" }, 422);
  } catch (error) {
    if (error instanceof SubmissionError) return context.json({ error: error.message }, error.status);
    throw error;
  }

  const result = await context.env.DB.prepare(
    `UPDATE forms SET name = ?, description = ?, fields_json = ?, allowed_origins_json = ?, notification_email = ?,
       success_url = ?, is_active = ?, strict_fields = ?, turnstile_enabled = ?, rate_limit_per_minute = ?, schema_json = ?, updated_at = ?
     WHERE id = ?`,
  ).bind(
    name, description, JSON.stringify(fields), JSON.stringify(allowedOrigins), notificationEmail, successUrl,
    body.isActive === false ? 0 : 1, body.strictFields ? 1 : 0, body.turnstileEnabled ? 1 : 0,
    rateLimit, JSON.stringify(schema), new Date().toISOString(), context.req.param("formId"),
  ).run();
  if (!result.meta.changes) return context.json({ error: "Form not found" }, 404);
  return context.json({ saved: true });
});

app.delete("/api/forms/:formId", async (context) => {
  const result = await context.env.DB.prepare("DELETE FROM forms WHERE id = ?")
    .bind(context.req.param("formId")).run();
  if (!result.meta.changes) return context.json({ error: "Form not found" }, 404);
  return context.body(null, 204);
});

app.get("/api/forms/:formId/export.csv", async (context) => {
  const form = await context.env.DB.prepare("SELECT name, fields_json FROM forms WHERE id = ?")
    .bind(context.req.param("formId")).first<{ name: string; fields_json: string }>();
  if (!form) return context.json({ error: "Form not found" }, 404);
  const rows = await context.env.DB.prepare(
    "SELECT id, payload_json, source_url, status, received_at FROM submissions WHERE form_id = ? ORDER BY received_at DESC",
  ).bind(context.req.param("formId")).all<Pick<SubmissionRow, "id" | "payload_json" | "source_url" | "status" | "received_at">>();
  const configuredFields = parseStringArray(form.fields_json);
  const payloads = rows.results.map((row) => JSON.parse(row.payload_json) as SubmissionPayload);
  const fields = [...new Set([...configuredFields, ...payloads.flatMap((payload) => Object.keys(payload))])];
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = [
    ["id", ...fields, "source", "status", "received_at"].map(escape).join(","),
    ...rows.results.map((row, index) => [
      row.id, ...fields.map((field) => payloads[index][field]), row.source_url, row.status, row.received_at,
    ].map(escape).join(",")),
  ];
  const filename = `${slugify(form.name)}-submissions.csv`;
  return context.body(`\uFEFF${lines.join("\r\n")}`, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
});

app.get("/api/forms/:formId/submissions", async (context) => {
  const formId = context.req.param("formId");
  const status = context.req.query("status");
  const search = context.req.query("q")?.trim();
  if (status && !["unread", "read", "spam"].includes(status)) {
    return context.json({ error: "Invalid submission status" }, 422);
  }

  const conditions = ["form_id = ?"];
  const bindings: unknown[] = [formId];
  if (status) {
    conditions.push("status = ?");
    bindings.push(status);
  }
  if (search) {
    conditions.push("payload_json LIKE ?");
    bindings.push(`%${search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
  }

  const rows = await context.env.DB.prepare(
    `SELECT id, form_id, payload_json, source_url, status, received_at
     FROM submissions WHERE ${conditions.join(" AND ")}
     ORDER BY received_at DESC LIMIT 100`,
  ).bind(...bindings).all<SubmissionRow>();
  return context.json({ submissions: rows.results.map(mapSubmission) });
});

app.get("/api/forms/:formId/submissions/:submissionId", async (context) => {
  const row = await context.env.DB.prepare(
    "SELECT id, form_id, payload_json, source_url, status, received_at FROM submissions WHERE id = ? AND form_id = ?",
  ).bind(context.req.param("submissionId"), context.req.param("formId")).first<SubmissionRow>();
  if (!row) return context.json({ error: "Submission not found" }, 404);
  return context.json({ submission: mapSubmission(row) });
});

app.patch("/api/forms/:formId/submissions/:submissionId", async (context) => {
  const body = jsonBody(await context.req.json().catch(() => null));
  const status = body?.status;
  if (!["unread", "read", "spam"].includes(String(status))) {
    return context.json({ error: "Invalid submission status" }, 422);
  }
  const result = await context.env.DB.prepare(
    "UPDATE submissions SET status = ? WHERE id = ? AND form_id = ?",
  ).bind(status, context.req.param("submissionId"), context.req.param("formId")).run();
  if (!result.meta.changes) return context.json({ error: "Submission not found" }, 404);
  return context.json({ status });
});

app.delete("/api/forms/:formId/submissions/:submissionId", async (context) => {
  const result = await context.env.DB.prepare("DELETE FROM submissions WHERE id = ? AND form_id = ?")
    .bind(context.req.param("submissionId"), context.req.param("formId")).run();
  if (!result.meta.changes) return context.json({ error: "Submission not found" }, 404);
  return context.body(null, 204);
});

app.options("/f/:slug", async (context) => {
  const form = await context.env.DB.prepare("SELECT allowed_origins_json FROM forms WHERE slug = ? AND is_active = 1")
    .bind(context.req.param("slug")).first<{ allowed_origins_json: string }>();
  if (!form) return context.body(null, 404);

  const origin = context.req.header("origin");
  const allowedOrigins = parseStringArray(form.allowed_origins_json);
  if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
    return context.json({ error: "Origin is not allowed" }, 403);
  }
  return context.body(null, 204, corsHeaders(origin, allowedOrigins));
});

app.post("/f/:slug", async (context) => {
  const form = await context.env.DB.prepare(
    `SELECT id, fields_json, schema_json, allowed_origins_json, notification_email, success_url, strict_fields,
            turnstile_enabled, rate_limit_per_minute
     FROM forms WHERE slug = ? AND is_active = 1`,
  ).bind(context.req.param("slug")).first<Pick<FormRow,
    "id" | "fields_json" | "schema_json" | "allowed_origins_json" | "notification_email" | "success_url" |
    "strict_fields" | "turnstile_enabled" | "rate_limit_per_minute"
  >>();
  if (!form) return context.json({ error: "Form not found" }, 404);

  const origin = context.req.header("origin");
  const allowedOrigins = parseStringArray(form.allowed_origins_json);
  if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
    return context.json({ error: "Origin is not allowed" }, 403);
  }
  const headers = corsHeaders(origin, allowedOrigins);
  if (!(await enforceRateLimit(context, form))) {
    return context.json({ error: "Too many submissions. Try again in a minute." }, 429, { ...headers, "Retry-After": "60" });
  }

  try {
    let payload = await parseSubmission(context.req.raw);
    const sourceUrl = typeof payload._source === "string" ? normalizeSourceUrl(payload._source) : null;
    const honeypot = isHoneypotTripped(payload._gotcha);
    const turnstileToken = typeof payload._turnstile === "string"
      ? payload._turnstile
      : typeof payload["cf-turnstile-response"] === "string" ? payload["cf-turnstile-response"] : "";
    const bodyIdempotencyKey = typeof payload._idempotency_key === "string" ? payload._idempotency_key : null;
    const headerIdempotencyKey = context.req.header("idempotency-key") ?? null;
    const idempotencyKey = (headerIdempotencyKey || bodyIdempotencyKey)?.slice(0, 200) || null;
    delete payload._source;
    delete payload._gotcha;
    delete payload._idempotency_key;
    delete payload._turnstile;
    delete payload["cf-turnstile-response"];

    if (form.turnstile_enabled && !honeypot && (!turnstileToken || !(await verifyTurnstile(context.env, turnstileToken)))) {
      return context.json({ error: "Turnstile verification failed" }, 422, headers);
    }
    if (form.strict_fields) {
      payload = validateFormPayload(payload, parseFormSchema(JSON.parse(form.schema_json)));
    }
    if (!form.strict_fields && Object.keys(payload).length === 0) return context.json({ error: "At least one field is required" }, 422, headers);

    if (idempotencyKey) {
      const existing = await context.env.DB.prepare(
        "SELECT id, received_at FROM submissions WHERE form_id = ? AND idempotency_key = ?",
      ).bind(form.id, idempotencyKey).first<{ id: string; received_at: string }>();
      if (existing) return context.json({ id: existing.id, receivedAt: existing.received_at, duplicate: true }, 200, headers);
    }

    const id = crypto.randomUUID();
    const receivedAt = new Date().toISOString();
    const status: SubmissionStatus = honeypot ? "spam" : "unread";
    await context.env.DB.prepare(
      `INSERT INTO submissions (id, form_id, payload_json, source_url, status, idempotency_key, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, form.id, JSON.stringify(payload), sourceUrl, status, idempotencyKey, receivedAt).run();

    if (status !== "spam" && form.notification_email) {
      const settings = await loadSettings(context.env.DB);
      if (settings?.smtp_enabled) {
        context.executionCtx.waitUntil(queueSubmissionEmail(context.env, form.id, id, form.notification_email).catch((error) => {
          console.error("Failed to queue submission email", error);
        }));
      }
    }

    const contentType = context.req.header("content-type") ?? "";
    if (!contentType.includes("application/json") && form.success_url) {
      return context.redirect(form.success_url, 303);
    }
    return context.json({ id, receivedAt }, 201, headers);
  } catch (error) {
    if (error instanceof SubmissionError) return context.json({ error: error.message, ...(error.errors ? { errors: error.errors } : {}) }, error.status, headers);
    console.error("Failed to collect submission", error);
    return context.json({ error: "Unable to collect submission" }, 500, headers);
  }
});

app.notFound((context) => context.json({ error: "Not found" }, 404));

export default {
  fetch: app.fetch,
  queue: (batch: MessageBatch<EmailJob>, env: Env) => consumeEmailBatch(batch, env),
  scheduled: (_controller: ScheduledController, env: Env, context: ExecutionContext) => {
    context.waitUntil(cleanupExpiredData(env));
  },
} satisfies ExportedHandler<Env, EmailJob>;
