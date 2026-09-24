import { cookies, headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  DEVICE_COOKIE,
  STUDENT_COOKIE,
  TEACHER_COOKIE,
  decodeStudentCookie,
  isValidDeviceId,
  type RequestIdentity,
} from "@/lib/auth/identity";
import { verifyTeacherToken } from "@/lib/auth/teacherToken";

const YEAR_SECONDS = 60 * 60 * 24 * 400;

export async function getTeacherPassword(): Promise<string | undefined> {
  const { env } = await getCloudflareContext({ async: true });
  const value = (env as { TEACHER_PASSWORD?: string }).TEACHER_PASSWORD;
  return value && value.length > 0 ? value : undefined;
}

export async function isTeacherRequest(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(TEACHER_COOKIE)?.value;
  if (!token) return false;
  return verifyTeacherToken(token, await getTeacherPassword());
}

export async function getRequestIdentity(): Promise<RequestIdentity> {
  const store = await cookies();
  const device = store.get(DEVICE_COOKIE)?.value;
  return {
    deviceId: isValidDeviceId(device) ? device : null,
    student: decodeStudentCookie(store.get(STUDENT_COOKIE)?.value),
    isTeacher: store.get(TEACHER_COOKIE) ? await isTeacherRequest() : false,
  };
}

async function isSecureRequest(): Promise<boolean> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto");
  const host = h.get("host") ?? "";
  return proto === "https" || !/^(localhost|127\.0\.0\.1)(:|$)/.test(host);
}

/** Only callable from route handlers / server actions (cookies are writable there). */
export async function setAppCookie(name: string, value: string, maxAgeSeconds = YEAR_SECONDS) {
  const store = await cookies();
  store.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isSecureRequest(),
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearAppCookie(name: string) {
  const store = await cookies();
  store.delete(name);
}

/** Route handlers: the identity, creating the anonymous device id if missing. */
export async function ensureDeviceIdentity(): Promise<RequestIdentity> {
  const identity = await getRequestIdentity();
  if (!identity.deviceId) {
    identity.deviceId = crypto.randomUUID();
    await setAppCookie(DEVICE_COOKIE, identity.deviceId);
  }
  return identity;
}

/** Teacher APIs: null when authorized, else a 401 response to return. */
export async function teacherGuard(): Promise<Response | null> {
  if (await isTeacherRequest()) return null;
  return Response.json({ error: "Teacher sign-in required." }, { status: 401 });
}
