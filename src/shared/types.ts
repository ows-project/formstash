export type SubmissionStatus = "unread" | "read" | "spam";
export type PayloadValue = string | number | boolean | null;
export type SubmissionPayload = Record<string, PayloadValue>;

export interface FormSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  fields: string[];
  allowedOrigins: string[];
  isActive: boolean;
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
