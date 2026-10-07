export type SubmissionStatus = "unread" | "read" | "spam";
export type PayloadValue = string | number | boolean | null;
export type SubmissionPayload = Record<string, PayloadValue>;

export interface ValidationRule {
  check: string;
  value?: string | number | boolean;
  options?: Record<string, string | number | boolean>;
  message?: string;
}

export interface SchemaField {
  name: string;
  type: "string" | "number" | "boolean" | "enum" | "scalar";
  required?: boolean;
  nullable?: boolean;
  values?: string[];
  rules?: ValidationRule[];
}

export interface FormSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  fields: string[];
  allowedOrigins: string[];
  notificationEmail: string | null;
  successUrl: string | null;
  isActive: boolean;
  strictFields: boolean;
  schema: SchemaField[];
  turnstileEnabled: boolean;
  rateLimitPerMinute: number;
  totalCount: number;
  unreadCount: number;
  spamCount: number;
}

export interface Submission {
  id: string;
  formId: string;
  payload: SubmissionPayload;
  sourceUrl: string | null;
  status: SubmissionStatus;
  receivedAt: string;
}

export interface AppSettings {
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: "tls" | "starttls";
  smtpUsername: string;
  smtpPasswordConfigured: boolean;
  smtpFromName: string;
  smtpFromEmail: string;
  retentionDays: number;
  turnstileSiteKey: string;
  turnstileSecretConfigured: boolean;
  encryptionReady: boolean;
}

export interface Delivery {
  id: string;
  formName: string | null;
  recipient: string;
  kind: "submission" | "password_reset" | "test";
  status: "queued" | "retrying" | "delivered" | "failed";
  attempts: number;
  lastError: string | null;
  createdAt: string;
  deliveredAt: string | null;
}
