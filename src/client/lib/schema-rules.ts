import type { SchemaField, ValidationRule } from "../../shared/types";

export interface RuleOption {
  key: string;
  label: string;
  type: "string" | "number" | "boolean";
  choices?: string[];
}

export interface RuleDefinition {
  check: string;
  label: string;
  valueType?: "string" | "number" | "boolean";
  choices?: string[];
  defaultValue?: string | number | boolean;
  options?: RuleOption[];
}

const stringChecks: RuleDefinition[] = [
  { check: "email", label: "Email address" },
  {
    check: "httpUrl",
    label: "Website URL (HTTP / HTTPS)",
    options: [{ key: "normalize", label: "Normalize URL", type: "boolean" }],
  },
  {
    check: "min",
    label: "Minimum length",
    valueType: "number",
    defaultValue: 1,
  },
  {
    check: "max",
    label: "Maximum length",
    valueType: "number",
    defaultValue: 254,
  },
  {
    check: "length",
    label: "Exact length",
    valueType: "number",
    defaultValue: 10,
  },
  {
    check: "forbiddenCharacters",
    label: "Disallow characters",
    valueType: "string",
    defaultValue: "<>",
  },
  {
    check: "regex",
    label: "Match a pattern (regex)",
    valueType: "string",
    defaultValue: "^[a-zA-Z0-9_]+$",
    options: [{ key: "flags", label: "Regex flags (i, m, s)", type: "string" }],
  },
  { check: "trim", label: "Trim surrounding spaces" },
  { check: "nonempty", label: "Non-empty text" },
  ...Object.entries({
    startsWith: "Starts with",
    endsWith: "Ends with",
    includes: "Contains text",
  }).map(([check, label]) => ({
    check,
    label,
    valueType: "string" as const,
    defaultValue: "",
    ...(check === "includes"
      ? {
          options: [
            {
              key: "position",
              label: "Starting position",
              type: "number" as const,
            },
          ],
        }
      : {}),
  })),
  ...Object.entries({
    lowercase: "Lowercase only",
    uppercase: "Uppercase only",
    toLowerCase: "Convert to lowercase",
    toUpperCase: "Convert to uppercase",
  }).map(([check, label]) => ({ check, label })),
  {
    check: "normalize",
    label: "Normalize Unicode",
    options: [
      {
        key: "form",
        label: "Normalization form",
        type: "string",
        choices: ["NFC", "NFD", "NFKC", "NFKD"],
      },
    ],
  },
  {
    check: "url",
    label: "URL (any protocol)",
    options: [{ key: "normalize", label: "Normalize URL", type: "boolean" }],
  },
  {
    check: "uuid",
    label: "UUID",
    options: [
      {
        key: "version",
        label: "UUID version",
        type: "string",
        choices: ["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8"],
      },
    ],
  },
  ...Object.entries({
    uuidv4: "UUID v4",
    uuidv6: "UUID v6",
    uuidv7: "UUID v7",
    guid: "GUID",
    emoji: "Emoji",
    nanoid: "Nano ID",
    cuid: "CUID",
    cuid2: "CUID2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    ipv4: "IPv4 address",
    ipv6: "IPv6 address",
    cidrv4: "IPv4 network (CIDR)",
    cidrv6: "IPv6 network (CIDR)",
    base64: "Base64",
    base64url: "Base64 URL",
    e164: "International phone (E.164)",
    creditCard: "Credit card number",
    iban: "IBAN",
    hostname: "Hostname",
    hex: "Hexadecimal",
    currencyCode: "Currency code",
    date: "ISO date",
    duration: "ISO duration",
  }).map(([check, label]) => ({ check, label })),
  {
    check: "mac",
    label: "MAC address",
    options: [
      {
        key: "delimiter",
        label: "Delimiter",
        type: "string",
        choices: [":", "-", ""],
      },
    ],
  },
  {
    check: "jwt",
    label: "JWT token",
    options: [{ key: "alg", label: "Algorithm", type: "string" }],
  },
  {
    check: "hash",
    label: "Hash",
    valueType: "string",
    defaultValue: "sha256",
    choices: ["md5", "sha1", "sha256", "sha384", "sha512"],
    options: [
      {
        key: "enc",
        label: "Encoding",
        type: "string",
        choices: ["hex", "base64", "base64url"],
      },
    ],
  },
  {
    check: "datetime",
    label: "ISO date & time",
    options: [
      { key: "offset", label: "Allow timezone offset", type: "boolean" },
      { key: "local", label: "Allow local time", type: "boolean" },
      {
        key: "precision",
        label: "Second precision (-1 = minutes)",
        type: "number",
      },
    ],
  },
  {
    check: "time",
    label: "ISO time",
    options: [
      {
        key: "precision",
        label: "Second precision (-1 = minutes)",
        type: "number",
      },
    ],
  },
];

const numberChecks: RuleDefinition[] = [
  ...Object.entries({
    min: "Minimum (inclusive)",
    max: "Maximum (inclusive)",
    gt: "Greater than",
    gte: "At least",
    lt: "Less than",
    lte: "At most",
    multipleOf: "Multiple of",
    step: "Step size",
  }).map(([check, label]) => ({
    check,
    label,
    valueType: "number" as const,
    defaultValue: ["multipleOf", "step"].includes(check) ? 1 : 0,
  })),
  ...Object.entries({
    int: "Whole number",
    positive: "Positive",
    nonnegative: "Zero or positive",
    negative: "Negative",
    nonpositive: "Zero or negative",
    safe: "Safe integer",
    finite: "Finite number",
    float32: "32-bit float",
    float64: "64-bit float",
    int32: "32-bit integer",
    uint32: "Unsigned 32-bit integer",
  }).map(([check, label]) => ({ check, label })),
];

export function rulesForType(type: SchemaField["type"]): RuleDefinition[] {
  if (type === "string") return stringChecks;
  if (type === "number") return numberChecks;
  if (type === "boolean")
    return [
      {
        check: "equals",
        label: "Must equal",
        valueType: "boolean",
        defaultValue: true,
      },
    ];
  return [];
}

export function newRule(definition: RuleDefinition): ValidationRule {
  return {
    check: definition.check,
    ...(definition.defaultValue !== undefined
      ? { value: definition.defaultValue }
      : {}),
  };
}

export function ruleSummary(
  type: SchemaField["type"],
  rule: ValidationRule,
): string {
  const label =
    rulesForType(type).find((definition) => definition.check === rule.check)
      ?.label ?? rule.check;
  return `${label}${rule.value !== undefined ? `: ${String(rule.value)}` : ""}`;
}
