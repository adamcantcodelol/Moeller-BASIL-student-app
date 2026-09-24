import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { listClasses } from "@/lib/db/queries/classes";
import { teacherGuard } from "@/lib/auth/request";
import {
  hypothesesToCsv,
  listLatestHypotheses,
  safeFilename,
} from "@/lib/teacher/hypothesisExport";

export const dynamic = "force-dynamic";

/**
 * Teacher only. Latest hypothesis per student project.
 * ?class=CODE limits to one class (default: all classes). ?format=json|csv (default csv).
 */
export async function GET(request: Request) {
  const denied = await teacherGuard();
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const classCode = url.searchParams.get("class")?.trim().toUpperCase() || null;
    const format = url.searchParams.get("format") ?? "csv";
    const db = await getRequestDatabase();
    const classes = await listClasses(db);
    const codes = classCode
      ? classes.filter((c) => c.code.toUpperCase() === classCode).map((c) => c.code)
      : classes.map((c) => c.code);
    if (classCode && codes.length === 0) return jsonError("Class not found.", 404);
    const rows = await listLatestHypotheses(db, codes);
    if (format === "json") return Response.json({ rows });
    const date = new Date().toISOString().slice(0, 10);
    const name = `hypotheses_${safeFilename(classCode ?? "all-classes")}_${date}.csv`;
    return new Response(hypothesesToCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
