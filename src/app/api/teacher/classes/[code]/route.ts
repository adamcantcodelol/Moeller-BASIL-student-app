import { z } from "zod";
import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { setClassActive } from "@/lib/db/queries/classes";
import { teacherGuard } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

const patchSchema = z.object({ active: z.boolean() });

/** Deactivate / reactivate a class code (teacher only). */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const denied = await teacherGuard();
  if (denied) return denied;
  try {
    const { code } = await context.params;
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Send { active: true | false }.", 400);
    const db = await getRequestDatabase();
    const updated = await setClassActive(db, decodeURIComponent(code), parsed.data.active);
    if (!updated) return jsonError("Class not found.", 404);
    return Response.json({ class: updated });
  } catch (error) {
    return handleServiceError(error);
  }
}
