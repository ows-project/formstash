import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

const ITERATIONS = 210_000;
const SESSION_DAYS = 30;
const encoder = new TextEncoder();

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  EMAIL_QUEUE: Queue<import("./delivery").EmailJob>;
  APP_SECRET?: string;
}

export interface User {
  id: string;
  email: string;
}

export type Variables = {
  user: User;
};

function encode(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2-sha256$${ITERATIONS}$${encode(salt)}$${encode(hash)}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, iterationValue, saltValue, hashValue] = encoded.split("$");
  if (algorithm !== "pbkdf2-sha256" || !iterationValue || !saltValue || !hashValue) return false;

  const iterations = Number(iterationValue);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;

  const expected = decode(hashValue);
  const actual = await derive(password, decode(saltValue), iterations);
  if (actual.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

export function randomToken(): string {
  return encode(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashOpaqueToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return encode(new Uint8Array(digest));
}

export async function createSession(context: Context<{ Bindings: Env; Variables: Variables }>, userId: string): Promise<void> {
  const token = randomToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  await context.env.DB.prepare(
    "INSERT INTO sessions (id_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  ).bind(await hashOpaqueToken(token), userId, expiresAt.toISOString(), now.toISOString()).run();

  setCookie(context, "formstash_session", token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: new URL(context.req.url).protocol === "https:",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession(context: Context<{ Bindings: Env; Variables: Variables }>): Promise<void> {
  const token = getCookie(context, "formstash_session");
  if (token) {
    await context.env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(await hashOpaqueToken(token)).run();
  }
  deleteCookie(context, "formstash_session", { path: "/" });
}

export const requireUser: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (context, next) => {
  const token = getCookie(context, "formstash_session");
  if (!token) return context.json({ error: "Authentication required" }, 401);

  const row = await context.env.DB.prepare(
    `SELECT users.id, users.email
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.id_hash = ? AND sessions.expires_at > ?`,
  ).bind(await hashOpaqueToken(token), new Date().toISOString()).first<User>();

  if (!row) {
    deleteCookie(context, "formstash_session", { path: "/" });
    return context.json({ error: "Authentication required" }, 401);
  }

  context.set("user", row);
  await next();
};
