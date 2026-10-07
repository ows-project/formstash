import { z } from "zod";
import { RE2JS } from "re2js";
import type { SchemaField, SubmissionPayload, ValidationRule } from "../shared/types";
import { SubmissionError, MAX_FIELDS } from "./submissions";

const ruleConfig = z.strictObject({
  check: z.string().min(1),
  value: z.union([z.string().max(512), z.number(), z.boolean()]).optional(),
  options: z.record(z.string(), z.union([z.string().max(512), z.number(), z.boolean()])).optional(),
  message: z.string().min(1).max(240).optional(),
});

const fieldConfig = z.strictObject({
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,99}$/)
    .refine((name) => !["__proto__", "constructor", "prototype", "cf-turnstile-response"].includes(name), "Reserved field name"),
  type: z.enum(["string", "number", "boolean", "enum", "scalar"]),
  required: z.boolean().optional(),
  nullable: z.boolean().optional(),
  values: z.array(z.string().max(10_000)).min(1).max(100).optional(),
  rules: z.array(ruleConfig).max(20).optional(),
});

function invalid(message: string): never {
  throw new SubmissionError(`Invalid schema: ${message}`, 422);
}

function numberValue(rule: ValidationRule): number {
  if (typeof rule.value !== "number" || !Number.isFinite(rule.value)) invalid(`${rule.check} needs a numeric value`);
  return rule.value;
}

function stringValue(rule: ValidationRule): string {
  if (typeof rule.value !== "string") invalid(`${rule.check} needs a string value`);
  return rule.value;
}

function pattern(value: string, flags = "") {
  if (!/^[ims]*$/.test(flags) || new Set(flags).size !== flags.length) invalid("Regex flags must be i, m, or s");
  try {
    return RE2JS.compile(value,
      (flags.includes("i") ? RE2JS.CASE_INSENSITIVE : 0) |
      (flags.includes("m") ? RE2JS.MULTILINE : 0) |
      (flags.includes("s") ? RE2JS.DOTALL : 0));
  } catch {
    invalid("Unsupported regex. Use RE2 syntax (no backreferences or lookarounds)");
  }
}

const stringFormats: Record<string, (params: Record<string, unknown>) => z.ZodType<string, string>> = {
  email: z.email, url: z.url, httpUrl: z.httpUrl,
  uuid: z.uuid, uuidv4: z.uuidv4, uuidv6: z.uuidv6, uuidv7: z.uuidv7, guid: z.guid,
  emoji: z.emoji, nanoid: z.nanoid, cuid: z.cuid, cuid2: z.cuid2, ulid: z.ulid,
  xid: z.xid, ksuid: z.ksuid, ipv4: z.ipv4, ipv6: z.ipv6, cidrv4: z.cidrv4, cidrv6: z.cidrv6,
  mac: z.mac, base64: z.base64, base64url: z.base64url, e164: z.e164,
  jwt: z.jwt, creditCard: z.creditCard, iban: z.iban, hostname: z.hostname, hex: z.hex,
  currencyCode: z.currencyCode,
  datetime: z.iso.datetime, date: z.iso.date, time: z.iso.time, duration: z.iso.duration,
};

// Validate options before passing them to Zod; arbitrary keys must never silently
// disable a check. Custom patterns use RE2 below, not the backtracking JS engine.
function formatOptions(rule: ValidationRule): Record<string, string | number | boolean> {
  const config: Record<string, z.ZodType> = {};
  if (rule.check === "uuid") config.version = z.enum(["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8"]);
  if (rule.check === "datetime") {
    config.offset = z.boolean();
    config.local = z.boolean();
  }
  if (["datetime", "time"].includes(rule.check)) config.precision = z.number().int().min(-1).max(10);
  if (rule.check === "jwt") config.alg = z.string().min(1).max(100);
  if (rule.check === "mac") config.delimiter = z.enum([":", "-", ""]);
  if (rule.check === "url" || rule.check === "httpUrl") config.normalize = z.boolean();
  const result = z.strictObject(config).partial().safeParse(rule.options ?? {});
  if (!result.success) invalid(`Invalid options for ${rule.check}: ${result.error.issues.map((issue) => issue.message).join("; ")}`);
  return result.data as Record<string, string | number | boolean>;
}

function stringRule(schema: z.ZodType<string, string>, rule: ValidationRule): z.ZodType<string, string> {
  const error = rule.message;
  const base = z.string();
  let next: z.ZodType<string, string>;
  if (Object.hasOwn(stringFormats, rule.check)) {
    if (rule.value !== undefined) invalid(`${rule.check} does not take a value`);
    const factory = stringFormats[rule.check as keyof typeof stringFormats];
    next = factory({ ...formatOptions(rule), ...(error ? { error } : {}) });
  } else {
    if (["nonempty", "lowercase", "uppercase", "trim", "toLowerCase", "toUpperCase", "normalize"].includes(rule.check) && rule.value !== undefined) {
      invalid(`${rule.check} does not take a value`);
    }
    if (rule.options && rule.check !== "regex" && rule.check !== "normalize" && rule.check !== "hash" && rule.check !== "includes") {
      invalid(`${rule.check} does not take options`);
    }
    switch (rule.check) {
      case "min": case "max": case "length": {
        const value = numberValue(rule);
        if (!Number.isInteger(value) || value < 0 || value > 10_000) invalid("String lengths must be integers between 0 and 10000");
        next = base[rule.check](value, error);
        break;
      }
      case "nonempty": next = base.nonempty(error); break;
      case "startsWith": case "endsWith": next = base[rule.check](stringValue(rule), error); break;
      case "includes": {
        const options = z.strictObject({ position: z.number().int().nonnegative().optional() }).parse(rule.options ?? {});
        next = base.includes(stringValue(rule), { ...options, error });
        break;
      }
      case "regex": {
        const options = z.strictObject({ flags: z.string().optional() }).parse(rule.options ?? {});
        const regex = pattern(stringValue(rule), options.flags);
        next = base.refine((value) => regex.matcher(value).find(), error ?? "Does not match the required pattern");
        break;
      }
      case "forbiddenCharacters": {
        const forbidden = [...stringValue(rule)];
        next = base.refine((value) => !forbidden.some((character) => value.includes(character)), error ?? "Contains forbidden characters");
        break;
      }
      case "lowercase": next = base.lowercase(error); break;
      case "uppercase": next = base.uppercase(error); break;
      case "trim": next = base.trim(); break;
      case "toLowerCase": next = base.toLowerCase(); break;
      case "toUpperCase": next = base.toUpperCase(); break;
      case "normalize": {
        const options = z.strictObject({ form: z.enum(["NFC", "NFD", "NFKC", "NFKD"]).optional() }).parse(rule.options ?? {});
        next = base.normalize(options.form);
        break;
      }
      case "hash": {
        const algorithm = z.enum(["md5", "sha1", "sha256", "sha384", "sha512"]).parse(rule.value);
        const options = z.strictObject({ enc: z.enum(["hex", "base64", "base64url"]).optional() }).parse(rule.options ?? {});
        next = z.hash(algorithm, { ...options, error });
        break;
      }
      default: invalid(`Unknown string check: ${rule.check}`);
    }
  }
  return schema.pipe(next);
}

function numberRule(schema: z.ZodNumber, rule: ValidationRule): z.ZodNumber {
  if (rule.options) invalid(`${rule.check} does not take options`);
  switch (rule.check) {
    case "min": case "max": case "gt": case "gte": case "lt": case "lte":
      return schema[rule.check](numberValue(rule), rule.message);
    case "multipleOf": case "step": {
      const value = numberValue(rule);
      if (value === 0) invalid("multipleOf must be nonzero");
      return schema.multipleOf(value, rule.message);
    }
    case "int": case "safe": case "positive": case "nonnegative": case "negative": case "nonpositive": case "finite":
      if (rule.value !== undefined) invalid(`${rule.check} does not take a value`);
      return schema[rule.check](rule.message);
    case "float32": case "float64": case "int32": case "uint32":
      if (rule.value !== undefined) invalid(`${rule.check} does not take a value`);
      return schema.check(z[rule.check](rule.message));
    default: invalid(`Unknown number check: ${rule.check}`);
  }
}

function fieldValidator(field: SchemaField): z.ZodType {
  let schema: z.ZodType;
  switch (field.type) {
    case "string": {
      let text: z.ZodType<string, string> = z.string();
      for (const rule of field.rules ?? []) text = stringRule(text, rule);
      schema = text;
      break;
    }
    case "number": {
      let number = z.number();
      for (const rule of field.rules ?? []) number = numberRule(number, rule);
      schema = z.preprocess((value) => {
        if (typeof value !== "string" || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) return value;
        return Number(value);
      }, number);
      break;
    }
    case "boolean": {
      let boolean: z.ZodType = z.boolean();
      for (const rule of field.rules ?? []) {
        if (rule.check !== "equals" || typeof rule.value !== "boolean" || rule.options) invalid("Boolean rules support equals with a boolean value");
        boolean = boolean.pipe(z.literal(rule.value, rule.message));
      }
      schema = z.preprocess((value) => value === "true" || value === "on" ? true : value === "false" ? false : value, boolean);
      break;
    }
    case "enum":
      if (!field.values?.length) invalid(`${field.name} needs enum values`);
      if (field.rules?.length) invalid("Enum fields use values, not rules");
      schema = z.enum(field.values);
      break;
    case "scalar":
      if (field.rules?.length) invalid("Choose a specific type to add validation rules");
      schema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
      break;
  }
  if (field.type !== "enum" && field.values) invalid("Only enum fields accept values");
  if (field.nullable && !field.required) schema = schema.nullable();
  if (field.required) {
    schema = z.unknown().refine((value) => value !== undefined && value !== null &&
      !(typeof value === "string" && !value.trim()), "This field is required").pipe(schema);
    // A trim or other transformation must not turn a required value into empty text.
    schema = schema.refine((value) => !(typeof value === "string" && !value.trim()), "This field is required");
  } else {
    schema = schema.optional();
  }
  return schema;
}

export function parseFormSchema(input: unknown): SchemaField[] {
  try {
    const fields = z.array(fieldConfig).max(MAX_FIELDS).parse(input);
    if (new Set(fields.map((field) => field.name)).size !== fields.length) invalid("Field names must be unique");
    for (const field of fields) fieldValidator(field);
    return fields;
  } catch (error) {
    if (error instanceof SubmissionError) throw error;
    if (error instanceof z.ZodError) invalid(error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
    throw error;
  }
}

export function validateFormPayload(payload: SubmissionPayload, fields: SchemaField[]): SubmissionPayload {
  // z.object strips unknown fields. Only its parsed output is persisted/delivered.
  const schema = z.object(Object.fromEntries(fields.map((field) => [field.name, fieldValidator(field)])));
  const result = schema.safeParse(payload);
  if (!result.success) {
    const errors: Record<string, string[]> = Object.create(null);
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? "_form");
      (errors[field] ??= []).push(issue.message);
    }
    throw new SubmissionError("Submission failed schema validation", 422, errors);
  }
  return result.data as SubmissionPayload;
}
