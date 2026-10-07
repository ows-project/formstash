import type { Submission } from "../../shared/types";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function formatTime(value: string, now = Date.now()): string {
  const date = new Date(value);
  const seconds = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function present(value: unknown): string | null {
  const text = displayValue(value);
  return text === "—" ? null : text;
}

export function submissionTitle(submission: Submission): string {
  return present(submission.payload.name) ?? present(submission.payload.email) ?? "Submission";
}

export function initials(submission: Submission): string {
  const name = present(submission.payload.name);
  if (name) return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const email = present(submission.payload.email);
  return email ? email.slice(0, 2).toUpperCase() : "?";
}

export function sourceLabel(submission: Submission): string {
  if (!submission.sourceUrl) return "Direct";
  try {
    return new URL(submission.sourceUrl).pathname || "/";
  } catch {
    return submission.sourceUrl;
  }
}

// Only plain addresses become links, so a submitter can't add ?bcc= or &body= to the owner's reply.
const PLAIN_EMAIL = /^[^\s@?&#/:%]+@[^\s@?&#/:%]+\.[^\s@?&#/:%]+$/;

export function mailtoHref(value: unknown): string | null {
  return typeof value === "string" && PLAIN_EMAIL.test(value) ? `mailto:${value}` : null;
}

export function humanizeField(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
