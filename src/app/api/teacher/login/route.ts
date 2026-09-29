import { headers } from "next/headers";
import { jsonError } from "@/lib/http";
import { TEACHER_COOKIE } from "@/lib/auth/identity";
import {
  TEACHER_SESSION_MS,
  clearLoginFailures,
  loginBlockedFor,
  recordLoginFailure,
  signTeacherToken,
  verifyTeacherPassword,
} from "@/lib/auth/teacherToken";
import { getTeacherPassword, setAppCookie } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for") ?? "unknown";
  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const submitted = typeof body?.password === "string" ? body.password : "";
  const actual = await getTeacherPassword();
  if (!actual) {
    return jsonError("Teacher mode is not configured yet.", 503);
  }
  if (!(await verifyTeacherPassword(submitted, actual))) {
    // A correct password always works; only repeated wrong guesses are slowed.
    if (loginBlockedFor(ip) > 0) {
      return jsonError("Too many wrong attempts from this network. Wait a minute and try again.", 429);
    }
    recordLoginFailure(ip);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // slow down guessing
    return jsonError("Incorrect password.", 401);
  }
  clearLoginFailures(ip);
  await setAppCookie(
    TEACHER_COOKIE,
    await signTeacherToken(actual),
    Math.floor(TEACHER_SESSION_MS / 1000),
  );
  return Response.json({ ok: true });
}
