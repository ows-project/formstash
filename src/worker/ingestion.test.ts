import { describe, expect, it, vi } from "vitest";
import type { Env } from "./auth";
import type { SchemaField } from "../shared/types";

vi.mock("./delivery", () => ({
  cleanupExpiredData: vi.fn(), consumeEmailBatch: vi.fn(), loadSettings: vi.fn(),
  queuePasswordResetEmail: vi.fn(), queueSubmissionEmail: vi.fn(), queueTestEmail: vi.fn(),
}));
import worker from "./index";

function database(enforced: boolean, schema: SchemaField[]) {
  const writes: unknown[][] = [];
  const DB = {
    prepare(sql: string) {
      let values: unknown[] = [];
      return {
        bind(...args: unknown[]) { values = args; return this; },
        async first() {
          if (sql.includes("FROM forms")) return {
            id: "contact", fields_json: '["display_only"]', schema_json: JSON.stringify(schema),
            allowed_origins_json: '["https://site.example"]', strict_fields: enforced ? 1 : 0,
            turnstile_enabled: 0, rate_limit_per_minute: 0, notification_email: null, success_url: null,
          };
          if (sql.includes("FROM sessions")) return { id: "owner", email: "owner@example.com" };
          return null;
        },
        async run() { writes.push(values); return { meta: { changes: 1 } }; },
      };
    },
  } as unknown as D1Database;
  return { DB, writes };
}

async function submit(enforced: boolean, schema: SchemaField[], data: Record<string, unknown>, contentType = "application/json") {
  const { DB, writes } = database(enforced, schema);
  const request = new Request("https://forms.example/f/contact", {
    method: "POST", headers: { "content-type": contentType, origin: "https://site.example" },
    body: contentType === "application/json" ? JSON.stringify(data) : new URLSearchParams(data as Record<string, string>),
  });
  const response = await worker.fetch(request, { DB } as Env, {} as ExecutionContext);
  return { response, writes };
}

describe("public ingestion", () => {
  it("ignores a saved schema when enforcement is off", async () => {
    const { response, writes } = await submit(false, [{ name: "email", type: "string", required: true }], { arbitrary: "accepted", count: 0 });
    expect(response.status).toBe(201);
    expect(JSON.parse(writes[0][2] as string)).toEqual({ arbitrary: "accepted", count: 0 });
  });

  it("stores only validated schema output, keeping metadata separate", async () => {
    const { response, writes } = await submit(true, [
      { name: "email", type: "string", required: true, rules: [{ check: "trim" }, { check: "email" }] },
      { name: "seats", type: "number" },
    ], { email: " ada@example.com ", seats: "3", extra: "drop", _source: "https://site.example/contact", _gotcha: "" });
    expect(response.status).toBe(201);
    expect(JSON.parse(writes[0][2] as string)).toEqual({ email: "ada@example.com", seats: 3 });
    expect(writes[0][3]).toBe("https://site.example/contact");
  });

  it("rejects missing required fields before any database write, with CORS and field errors", async () => {
    const { response, writes } = await submit(true, [{ name: "email", type: "string", required: true }], { other: "not email" });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "Submission failed schema validation", errors: { email: ["This field is required"] } });
    expect(response.headers.get("access-control-allow-origin")).toBe("https://site.example");
    expect(writes).toEqual([]);
  });

  it("reports required-field errors even for an empty JSON object", async () => {
    const { response, writes } = await submit(true, [{ name: "email", type: "string", required: true }], {});
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "Submission failed schema validation", errors: { email: ["This field is required"] } });
    expect(writes).toEqual([]);
  });

  it("accepts native HTML number and boolean values and drops unknown fields", async () => {
    const { response, writes } = await submit(true, [
      { name: "age", type: "number", rules: [{ check: "int" }, { check: "min", value: 18 }] },
      { name: "consent", type: "boolean", required: true, rules: [{ check: "equals", value: true }] },
    ], { age: "24", consent: "on", extra: "drop" }, "application/x-www-form-urlencoded");
    expect(response.status).toBe(201);
    expect(JSON.parse(writes[0][2] as string)).toEqual({ age: 24, consent: true });
  });

  it("allows an empty sanitized object when no fields are required", async () => {
    const { response, writes } = await submit(true, [{ name: "note", type: "string" }], { extra: "drop" });
    expect(response.status).toBe(201);
    expect(JSON.parse(writes[0][2] as string)).toEqual({});
  });
});

describe("schema settings", () => {
  it("saves valid schemas independently of display fields", async () => {
    const { DB, writes } = database(false, []);
    const schema = [{ name: "email", type: "string", required: true, rules: [{ check: "email" }] }];
    const response = await worker.fetch(new Request("https://forms.example/api/forms/contact", {
      method: "PATCH", headers: { "content-type": "application/json", cookie: "formstash_session=test" },
      body: JSON.stringify({ name: "Contact", fields: [], allowedOrigins: [], rateLimitPerMinute: 60, strictFields: true, schema }),
    }), { DB } as Env, {} as ExecutionContext);
    expect(response.status).toBe(200);
    expect(writes[0][2]).toBe("[]");
    expect(writes[0][7]).toBe(1);
    expect(JSON.parse(writes[0][10] as string)).toEqual(schema);
  });

  it("does not enable enforcement with an empty schema", async () => {
    const { DB, writes } = database(false, []);
    const response = await worker.fetch(new Request("https://forms.example/api/forms/contact", {
      method: "PATCH", headers: { "content-type": "application/json", cookie: "formstash_session=test" },
      body: JSON.stringify({ name: "Contact", fields: [], allowedOrigins: [], rateLimitPerMinute: 60, strictFields: true, schema: [] }),
    }), { DB } as Env, {} as ExecutionContext);
    expect(response.status).toBe(422);
    expect(writes).toEqual([]);
  });

  it("rejects unknown rules without writing invalid configuration", async () => {
    const { DB, writes } = database(false, []);
    const response = await worker.fetch(new Request("https://forms.example/api/forms/contact", {
      method: "PATCH", headers: { "content-type": "application/json", cookie: "formstash_session=test" },
      body: JSON.stringify({ name: "Contact", fields: [], allowedOrigins: [], rateLimitPerMinute: 60, strictFields: true,
        schema: [{ name: "email", type: "string", rules: [{ check: "emial" }] }] }),
    }), { DB } as Env, {} as ExecutionContext);
    expect(response.status).toBe(422);
    expect((await response.json() as { error: string }).error).toContain("Unknown string check");
    expect(writes).toEqual([]);
  });
});
