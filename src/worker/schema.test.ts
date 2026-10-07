import { describe, expect, it } from "vitest";
import { parseFormSchema, validateFormPayload } from "./schema";
import { SubmissionError } from "./submissions";
import type { SchemaField, SubmissionPayload, ValidationRule } from "../shared/types";

function field(type: SchemaField["type"], rules: ValidationRule[] = []): SchemaField[] {
  return parseFormSchema([{ name: "value", type, rules }]);
}

describe("schema enforcement", () => {
  it("strips unknown fields and preserves falsy values without mutating the input", () => {
    const schema = parseFormSchema([
      { name: "seats", type: "number", required: true },
      { name: "subscribed", type: "boolean", required: true },
      { name: "notes", type: "string" },
    ]);
    const payload = { seats: 0, subscribed: false, unknown: "private" };
    expect(validateFormPayload(payload, schema)).toEqual({ seats: 0, subscribed: false });
    expect(payload.unknown).toBe("private");
  });

  it.each<SubmissionPayload>([{}, { value: "" }, { value: " \t\n" }, { value: null }])("rejects missing/blank required fields: %j", (payload) => {
    expect(() => validateFormPayload(payload, [{ name: "value", type: "string", required: true }]))
      .toThrow(expect.objectContaining({ status: 422, errors: { value: ["This field is required"] } }));
  });

  it("returns errors for every failing field and rejects the whole submission", () => {
    const schema = parseFormSchema([
      { name: "email", type: "string", rules: [{ check: "email", message: "Use a real email" }] },
      { name: "age", type: "number", rules: [{ check: "min", value: 18 }] },
    ]);
    expect(() => validateFormPayload({ email: "bad", age: 17 }, schema)).toThrow(expect.objectContaining({
      status: 422, errors: { email: ["Use a real email"], age: [expect.any(String)] },
    }));
  });

  it("allows absent optional fields but checks present values, including empty strings", () => {
    const schema = field("string", [{ check: "email" }]);
    expect(validateFormPayload({ foreign: "drop" }, schema)).toEqual({});
    expect(() => validateFormPayload({ value: "" }, schema)).toThrow(SubmissionError);
    expect(() => validateFormPayload({ value: null }, schema)).toThrow(SubmissionError);
    expect(validateFormPayload({ value: null }, [{ name: "value", type: "string", nullable: true }])).toEqual({ value: null });
  });

  it.each(["42", "-2.5", "1e2", " 0 "])("converts numeric HTML strings: %s", (value) => {
    expect(validateFormPayload({ value }, field("number"))).toEqual({ value: Number(value) });
  });

  it.each(["", " ", "0x10", "42cats", true, null])("does not coerce nonnumeric values into numbers: %j", (value) => {
    expect(() => validateFormPayload({ value }, field("number"))).toThrow(SubmissionError);
  });

  it("converts only explicit HTML boolean values, and distinguishes required from consent", () => {
    const schema = [{ name: "value", type: "boolean", required: true }] satisfies SchemaField[];
    expect(validateFormPayload({ value: "on" }, schema)).toEqual({ value: true });
    expect(validateFormPayload({ value: "false" }, schema)).toEqual({ value: false });
    expect(() => validateFormPayload({ value: "yes" }, schema)).toThrow(SubmissionError);
    expect(() => validateFormPayload({ value: false }, field("boolean", [{ check: "equals", value: true }]))).toThrow(SubmissionError);
  });

  it("validates enum choices and preserves legacy scalar schemas", () => {
    const schema = parseFormSchema([{ name: "team", type: "enum", values: ["Sales", "Support"] }, { name: "value", type: "scalar" }]);
    expect(validateFormPayload({ team: "Support", value: null, extra: 1 }, schema)).toEqual({ team: "Support", value: null });
    expect(() => validateFormPayload({ team: "support" }, schema)).toThrow(SubmissionError);
  });
});

describe("Zod checks", () => {
  it.each([
    ["email", "ada@example.com", "not-an-email"],
    ["httpUrl", "https://example.com", "mailto:ada@example.com"],
    ["uuidv4", "550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-11d4-a716-446655440000"],
    ["ipv4", "192.0.2.1", "999.0.2.1"],
    ["ipv6", "2001:db8::1", "999.0.2.1"],
    ["cidrv4", "192.0.2.0/24", "192.0.2.0/99"],
    ["e164", "+628123456789", "08123456789"],
    ["date", "2024-02-29", "2025-02-29"],
    ["datetime", "2026-10-07T12:00:00Z", "yesterday"],
    ["time", "23:59:59", "25:00:00"],
    ["duration", "P3D", "three days"],
    ["base64", "aGVsbG8=", "***"],
    ["hex", "deadbeef", "ghij"],
    ["hostname", "example.com", "bad hostname"],
    ["currencyCode", "USD", "ZZZ"],
    ["iban", "GB82WEST12345698765432", "GB82WEST12345698765433"],
  ])("enforces %s using Zod", (check, valid, invalid) => {
    const schema = field("string", [{ check }]);
    expect(validateFormPayload({ value: valid }, schema)).toEqual({ value: valid });
    expect(() => validateFormPayload({ value: invalid }, schema)).toThrow(SubmissionError);
  });

  it("supports format options, ordered transformations, and custom error messages", () => {
    const schema = field("string", [{ check: "trim" }, { check: "toLowerCase" }, { check: "email" }]);
    expect(validateFormPayload({ value: " ADA@EXAMPLE.COM " }, schema)).toEqual({ value: "ada@example.com" });
    const dates = field("string", [{ check: "datetime", options: { offset: true, precision: 0 } }]);
    expect(validateFormPayload({ value: "2026-10-07T12:00:00+07:00" }, dates).value).toBe("2026-10-07T12:00:00+07:00");
    expect(() => validateFormPayload({ value: "2026-10-07T12:00:00.123+07:00" }, dates)).toThrow(SubmissionError);
  });

  it("checks both sides of string lengths and numeric boundaries", () => {
    const text = field("string", [{ check: "min", value: 3 }, { check: "max", value: 5 }]);
    for (const value of ["abc", "abcde"]) expect(validateFormPayload({ value }, text).value).toBe(value);
    for (const value of ["ab", "abcdef"]) expect(() => validateFormPayload({ value }, text)).toThrow(SubmissionError);
    const numeric = field("number", [{ check: "gt", value: 0 }, { check: "lte", value: 6 }, { check: "multipleOf", value: 2 }]);
    expect(validateFormPayload({ value: 6 }, numeric).value).toBe(6);
    for (const value of [0, 3, 8]) expect(() => validateFormPayload({ value }, numeric)).toThrow(SubmissionError);
    expect(() => validateFormPayload({ value: 2 ** 32 }, field("number", [{ check: "uint32" }]))).toThrow(SubmissionError);
  });

  it("supports regex flags and forbidden characters without regex", () => {
    const regex = field("string", [{ check: "regex", value: "^[a-z_]+$", options: { flags: "i" } }]);
    expect(validateFormPayload({ value: "Ada_Lovelace" }, regex).value).toBe("Ada_Lovelace");
    expect(() => validateFormPayload({ value: "Ada2" }, regex)).toThrow(SubmissionError);
    const characters = field("string", [{ check: "forbiddenCharacters", value: "<>💥" }]);
    expect(validateFormPayload({ value: "A & B" }, characters).value).toBe("A & B");
    expect(() => validateFormPayload({ value: "A💥B" }, characters)).toThrow(SubmissionError);
  });

  it("handles a pathological regex in linear time", () => {
    expect(() => validateFormPayload({ value: "a".repeat(9_999) + "!" }, field("string", [{ check: "regex", value: "^(a+)+$" }]))).toThrow(SubmissionError);
  });
});

describe("schema configuration", () => {
  it.each([
    [{ name: "same", type: "string" }, { name: "same", type: "number" }],
    [{ name: "__proto__", type: "string" }],
    [{ name: "bad field", type: "string" }],
    [{ name: "email", type: "string", rules: [{ check: "emial" }] }],
    [{ name: "email", type: "string", rules: [{ check: "email", options: { ignore: true } }] }],
    [{ name: "age", type: "number", rules: [{ check: "min", value: "18" }] }],
    [{ name: "age", type: "number", rules: [{ check: "multipleOf", value: 0 }] }],
    [{ name: "value", type: "string", rules: [{ check: "regex", value: "[" }] }],
    [{ name: "value", type: "string", rules: [{ check: "regex", value: "(a)\\1" }] }],
    [{ name: "value", type: "string", rules: [{ check: "regex", value: "a", options: { flags: "g" } }] }],
    [{ name: "team", type: "enum", values: [] }],
  ])("rejects invalid configurations before they can be saved: %j", (...schema) => {
    // it.each spreads the field array into arguments.
    expect(() => parseFormSchema(schema)).toThrow(SubmissionError);
  });
});
