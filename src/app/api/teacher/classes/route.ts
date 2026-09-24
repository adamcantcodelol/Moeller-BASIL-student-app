import { z } from "zod";
import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { createClass, listClasses } from "@/lib/db/queries/classes";
import { listProjectsForClasses } from "@/lib/db/queries/projects";
import { teacherGuard } from "@/lib/auth/request";

export const dynamic = "force-dynamic";

/** Classes plus each class's student projects (teacher only). */
export async function GET() {
  const denied = await teacherGuard();
  if (denied) return denied;
  try {
    const db = await getRequestDatabase();
    const classes = await listClasses(db);
    const projects = await listProjectsForClasses(
      db,
      classes.map((c) => c.code),
    );
    return Response.json({
      classes: classes.map((c) => ({
        ...c,
        projects: projects.filter((p) => p.classCode === c.code),
      })),
    });
  } catch (error) {
    return handleServiceError(error);
  }
}

const createSchema = z.object({ name: z.string().trim().min(1).max(120) });

export async function POST(request: Request) {
  const denied = await teacherGuard();
  if (denied) return denied;
  try {
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Enter a class name.", 400);
    const db = await getRequestDatabase();
    const created = await createClass(db, parsed.data.name);
    return Response.json({ class: created }, { status: 201 });
  } catch (error) {
    return handleServiceError(error);
  }
}
