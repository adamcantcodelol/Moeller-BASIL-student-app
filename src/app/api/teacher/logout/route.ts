import { TEACHER_COOKIE } from "@/lib/auth/identity";
import { clearAppCookie } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearAppCookie(TEACHER_COOKIE);
  return Response.json({ ok: true });
}
