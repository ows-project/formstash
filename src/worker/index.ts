import { Hono } from "hono";
import { createSession, endSession, hashPassword, requireUser, verifyPassword, type Env, type User, type Variables } from "./auth";
import { normalizeOrigin, normalizeSourceUrl, parseSubmission, slugify, SubmissionError } from "./submissions";
import type { SubmissionPayload, SubmissionStatus } from "../shared/types";

type AppContext = { Bindings: Env; Variables: Variables };

interface FormRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  fields_json: string;
  allowed_origins_json: string;
  success_url: string | null;
  is_active: number;
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
    isActive: Boolean(row.is_active),
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

app.get("/api/auth/me", requireUser, (context) => context.json({ user: context.get("user") }));

app.use("/api/forms", requireUser);
app.use("/api/forms/*", requireUser);

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
    "SELECT id, allowed_origins_json, success_url FROM forms WHERE slug = ? AND is_active = 1",
  ).bind(context.req.param("slug")).first<Pick<FormRow, "id" | "allowed_origins_json" | "success_url">>();
  if (!form) return context.json({ error: "Form not found" }, 404);

  const origin = context.req.header("origin");
  const allowedOrigins = parseStringArray(form.allowed_origins_json);
  if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
    return context.json({ error: "Origin is not allowed" }, 403);
  }
  const headers = corsHeaders(origin, allowedOrigins);

  try {
    const payload = await parseSubmission(context.req.raw);
    const sourceUrl = typeof payload._source === "string" ? normalizeSourceUrl(payload._source) : null;
    const honeypot = payload._gotcha;
    const bodyIdempotencyKey = typeof payload._idempotency_key === "string" ? payload._idempotency_key : null;
    const headerIdempotencyKey = context.req.header("idempotency-key") ?? null;
    const idempotencyKey = (headerIdempotencyKey || bodyIdempotencyKey)?.slice(0, 200) || null;
    delete payload._source;
    delete payload._gotcha;
    delete payload._idempotency_key;

    if (idempotencyKey) {
      const existing = await context.env.DB.prepare(
        "SELECT id, received_at FROM submissions WHERE form_id = ? AND idempotency_key = ?",
      ).bind(form.id, idempotencyKey).first<{ id: string; received_at: string }>();
      if (existing) return context.json({ id: existing.id, receivedAt: existing.received_at, duplicate: true }, 200, headers);
    }

    const id = crypto.randomUUID();
    const receivedAt = new Date().toISOString();
    const status: SubmissionStatus = typeof honeypot === "string" && honeypot ? "spam" : "unread";
    await context.env.DB.prepare(
      `INSERT INTO submissions (id, form_id, payload_json, source_url, status, idempotency_key, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, form.id, JSON.stringify(payload), sourceUrl, status, idempotencyKey, receivedAt).run();

    const contentType = context.req.header("content-type") ?? "";
    if (!contentType.includes("application/json") && form.success_url) {
      return context.redirect(form.success_url, 303);
    }
    return context.json({ id, receivedAt }, 201, headers);
  } catch (error) {
    if (error instanceof SubmissionError) return context.json({ error: error.message }, error.status, headers);
    console.error("Failed to collect submission", error);
    return context.json({ error: "Unable to collect submission" }, 500, headers);
  }
});

app.notFound((context) => context.json({ error: "Not found" }, 404));

export default app;
