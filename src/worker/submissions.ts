import type { PayloadValue, SubmissionPayload } from "../shared/types";

export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_FIELDS = 50;

export class SubmissionError extends Error {
  constructor(message: string, readonly status: 400 | 413 | 415 | 422 = 400, readonly errors?: Record<string, string[]>) {
    super(message);
  }
}

function isValue(value: unknown): value is string | number | boolean | null {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function validatePayload(value: unknown): SubmissionPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SubmissionError("The submission must be an object", 422);
  }

  const entries = Object.entries(value);
  if (entries.length > MAX_FIELDS) throw new SubmissionError(`A submission can contain at most ${MAX_FIELDS} fields`, 422);

  const payload: SubmissionPayload = Object.create(null);
  for (const [key, entry] of entries) {
    if (!key.trim() || key.length > 100) throw new SubmissionError("Field names must be between 1 and 100 characters", 422);
    if (!isValue(entry)) throw new SubmissionError(`Field "${key}" must contain a scalar value`, 422);
    if (typeof entry === "string" && entry.length > 10_000) {
      throw new SubmissionError(`Field "${key}" exceeds 10,000 characters`, 422);
    }
    payload[key] = entry;
  }
  return payload;
}

// A filled honeypot marks a bot. JSON bodies can send non-string values, so any
// value other than an empty string, false, null, or absence counts as filled.
export function isHoneypotTripped(value: PayloadValue | undefined): boolean {
  if (typeof value === "string") return value !== "";
  return value !== undefined && value !== null && value !== false;
}

export async function parseSubmission(request: Request): Promise<SubmissionPayload> {
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_BODY_BYTES) throw new SubmissionError("Submission exceeds 64 KiB", 413);

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_BYTES) throw new SubmissionError("Submission exceeds 64 KiB", 413);

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const body = new TextDecoder().decode(bytes);

  if (contentType.includes("application/json")) {
    try {
      return validatePayload(JSON.parse(body));
    } catch (error) {
      if (error instanceof SubmissionError) throw error;
      throw new SubmissionError("Invalid JSON body");
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return validatePayload(Object.fromEntries(new URLSearchParams(body)));
  }

  if (contentType.includes("multipart/form-data")) {
    const clone = new Request(request.url, { method: "POST", headers: request.headers, body: bytes });
    const data = await clone.formData();
    const payload: Record<string, string> = Object.create(null);
    for (const [key, value] of data.entries()) {
      if (typeof value !== "string") throw new SubmissionError("File uploads are not supported", 422);
      payload[key] = value;
    }
    return validatePayload(payload);
  }

  throw new SubmissionError("Use JSON, URL-encoded, or multipart form data", 415);
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "form";
}

export function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function normalizeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.href.slice(0, 2_000);
  } catch {
    return null;
  }
}
