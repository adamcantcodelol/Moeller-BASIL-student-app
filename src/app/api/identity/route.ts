import { z } from "zod";
import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { findActiveClass } from "@/lib/db/queries/classes";
import {
  STUDENT_COOKIE,
  encodeStudentCookie,
  normalizeClassCode,
  normalizeStudentName,
} from "@/lib/auth/identity";
import { clearAppCookie, ensureDeviceIdentity, getRequestIdentity, setAppCookie } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

const joinSchema = z.object({
  studentName: z.string().max(200),
  classCode: z.string().max(40),
});

export async function GET() {
  const identity = await getRequestIdentity();
  return Response.json({ student: identity.student });
}

/** Join a class: name + an existing, active teacher-issued class code. */
export async function POST(request: Request) {
  try {
    const parsed = joinSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Enter your name and class code.", 400);
    const studentName = normalizeStudentName(parsed.data.studentName);
    const classCode = normalizeClassCode(parsed.data.classCode);
    if (!studentName || !classCode) {
      return jsonError("Enter your name and class code.", 400);
    }
    const db = await getRequestDatabase();
    const found = await findActiveClass(db, classCode);
    if (!found) {
      return jsonError(
        "We couldn't find that class code. Check the code on the board (or ask your teacher). You can also skip this and keep working on this computer.",
        404,
      );
    }
    await ensureDeviceIdentity();
    const student = { classCode: found.code, studentName };
    await setAppCookie(STUDENT_COOKIE, encodeStudentCookie(student));
    return Response.json({ student, className: found.name });
  } catch (error) {
    return handleServiceError(error);
  }
}

/** Switch / leave: forget the class identity on this device. */
export async function DELETE() {
  await clearAppCookie(STUDENT_COOKIE);
  return Response.json({ ok: true });
}
