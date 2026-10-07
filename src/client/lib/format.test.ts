import { describe, expect, it } from "vitest";
import type { Submission } from "../../shared/types";
import { avatarGradient } from "./avatar";
import { displayValue, formatTime, humanizeField, initials, mailtoHref, sourceLabel, submissionTitle } from "./format";

function submission(payload: Submission["payload"], sourceUrl: string | null = null): Submission {
  return { id: "s1", formId: "f1", payload, sourceUrl, status: "unread", receivedAt: "2026-01-01T00:00:00.000Z" };
}

describe("formatTime", () => {
  const now = Date.parse("2026-10-07T12:00:00.000Z");

  it("uses short relative times for the last week", () => {
    expect(formatTime("2026-10-07T11:59:30.000Z", now)).toBe("30s ago");
    expect(formatTime("2026-10-07T11:15:00.000Z", now)).toBe("45m ago");
    expect(formatTime("2026-10-07T09:00:00.000Z", now)).toBe("3h ago");
    expect(formatTime("2026-10-05T12:00:00.000Z", now)).toBe("2d ago");
  });

  it("falls back to a date for anything older", () => {
    expect(formatTime("2026-09-01T12:00:00.000Z", now)).toMatch(/2026/);
  });
});

describe("displayValue", () => {
  it("renders empty values as a dash and booleans as words", () => {
    expect(displayValue(undefined)).toBe("—");
    expect(displayValue("")).toBe("—");
    expect(displayValue(true)).toBe("Yes");
    expect(displayValue(3)).toBe("3");
  });
});

describe("submission labels", () => {
  it("prefers the submitter's name for initials and title", () => {
    const entry = submission({ email: "ada@example.com", name: "Ada King Lovelace" });
    expect(initials(entry)).toBe("AK");
    expect(submissionTitle(entry)).toBe("Ada King Lovelace");
  });

  it("falls back to the email, then to a generic label", () => {
    expect(initials(submission({ email: "bob@example.com" }))).toBe("BO");
    expect(submissionTitle(submission({ email: "bob@example.com" }))).toBe("bob@example.com");
    expect(submissionTitle(submission({ company: "Acme" }))).toBe("Submission");
    expect(initials(submission({ company: "Acme" }))).toBe("?");
  });

  it("shows only the path of the page a submission came from", () => {
    expect(sourceLabel(submission({}, "https://example.com/waitlist?ref=x"))).toBe("/waitlist");
    expect(sourceLabel(submission({}))).toBe("Direct");
  });

  it("turns field keys into readable labels", () => {
    expect(humanizeField("first_name")).toBe("First name");
    expect(humanizeField("companyName")).toBe("Company name");
  });
});

describe("avatarGradient", () => {
  it("gives the same submitter the same colors every time", () => {
    expect(avatarGradient("ada@example.com")).toEqual(avatarGradient("ada@example.com"));
    expect(avatarGradient("ada@example.com")).toMatch(/^linear-gradient\(/);
  });

  it("spreads different submitters across the palette", () => {
    const gradients = new Set(["a@x.io", "b@x.io", "c@x.io", "d@x.io", "e@x.io", "f@x.io", "g@x.io"].map(avatarGradient));
    expect(gradients.size).toBeGreaterThan(2);
  });
});

describe("mailtoHref", () => {
  it("links plain email addresses", () => {
    expect(mailtoHref("ada@example.com")).toBe("mailto:ada@example.com");
  });

  it("refuses values that would smuggle mailto parameters or other schemes", () => {
    expect(mailtoHref("me@x.com?bcc=attacker@evil.com")).toBeNull();
    expect(mailtoHref("me@x.com&body=hi")).toBeNull();
    expect(mailtoHref("ada @example.com")).toBeNull();
    expect(mailtoHref("javascript:alert(1)//@x.com")).toBeNull();
    expect(mailtoHref(true)).toBeNull();
    expect(mailtoHref(undefined)).toBeNull();
  });
});
