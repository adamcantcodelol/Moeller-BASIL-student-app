/**
 * Teacher session token: "<expiryMs>.<hex HMAC>" signed with a key derived
 * from the TEACHER_PASSWORD Worker secret. Web Crypto only (Workers + Node).
 */

export const TEACHER_SESSION_MS = 12 * 60 * 60 * 1000;

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(keyBytes: ArrayBuffer | Uint8Array<ArrayBuffer>, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, encoder.encode(message));
}

async function derivedKey(password: string): Promise<ArrayBuffer> {
  return hmac(encoder.encode(password), "basil-teacher-session-v1");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Compare a submitted password without leaking length/timing. */
/** Forgiving comparison: ignore surrounding/inner spaces, dashes and letter case. */
export function normalizeTeacherPassword(value: string): string {
  return value.replace(/[\s\-\u2010-\u2015]/g, "").toLowerCase();
}

export async function verifyTeacherPassword(
  submitted: string,
  actual: string | undefined,
): Promise<boolean> {
  if (!actual) return false;
  const pepper = encoder.encode("basil-teacher-password-check");
  const [a, b] = await Promise.all([
    hmac(pepper, normalizeTeacherPassword(submitted)),
    hmac(pepper, normalizeTeacherPassword(actual)),
  ]);
  return constantTimeEqual(toHex(a), toHex(b));
}

export async function signTeacherToken(
  password: string,
  now = Date.now(),
): Promise<string> {
  const expiry = now + TEACHER_SESSION_MS;
  const sig = toHex(await hmac(await derivedKey(password), `teacher:${expiry}`));
  return `${expiry}.${sig}`;
}

export async function verifyTeacherToken(
  token: string | null | undefined,
  password: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!token || !password) return false;
  const [expiryText, sig] = token.split(".");
  const expiry = Number(expiryText);
  if (!Number.isFinite(expiry) || !sig || expiry <= now) return false;
  if (expiry > now + TEACHER_SESSION_MS + 60_000) return false;
  const expected = toHex(await hmac(await derivedKey(password), `teacher:${expiry}`));
  return constantTimeEqual(sig, expected);
}

/** Tiny per-isolate failed-login limiter (free tier friendly, best effort). */
const failures = new Map<string, { count: number; until: number }>();

export function loginBlockedFor(ip: string, now = Date.now()): number {
  const entry = failures.get(ip);
  if (!entry || entry.until <= now) return 0;
  return entry.count >= 20 ? entry.until - now : 0;
}

export function recordLoginFailure(ip: string, now = Date.now()): void {
  const entry = failures.get(ip);
  const count = entry && entry.until > now ? entry.count + 1 : 1;
  failures.set(ip, { count, until: now + 60 * 1000 });
  if (failures.size > 1000) failures.clear();
}

export function clearLoginFailures(ip: string): void {
  failures.delete(ip);
}
