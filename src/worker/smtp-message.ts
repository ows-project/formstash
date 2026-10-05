export interface EmailContent {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const encoder = new TextEncoder();

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function base64(value: string): string {
  const bytes = encoder.encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function wrapBase64(value: string): string {
  return base64(value).match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function encodedHeader(value: string): string {
  return /^[\x20-\x7E]*$/.test(value) ? sanitizeHeader(value) : `=?UTF-8?B?${base64(value)}?=`;
}

function dotStuff(value: string): string {
  return value.split("\r\n").map((line) => line.startsWith(".") ? `.${line}` : line).join("\r\n");
}

export function buildMessage(config: { fromName: string; fromEmail: string }, content: EmailContent): string {
  const boundary = `formstash-${crypto.randomUUID()}`;
  return dotStuff([
    `From: ${encodedHeader(config.fromName)} <${sanitizeHeader(config.fromEmail)}>`,
    `To: <${sanitizeHeader(content.to)}>`,
    `Subject: ${encodedHeader(content.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@formstash>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(content.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(content.html),
    `--${boundary}--`,
    "",
  ].join("\r\n"));
}

export function smtpAuthPlain(username: string, password: string): string {
  return base64(`\0${username}\0${password}`);
}
