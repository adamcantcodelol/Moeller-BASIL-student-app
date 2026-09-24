import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { teacherGuard } from "@/lib/auth/request";
import {
  getLatestHypothesisForProject,
  hypothesesToCsv,
  hypothesisToText,
  safeFilename,
} from "@/lib/teacher/hypothesisExport";

export const dynamic = "force-dynamic";

/** Teacher only. One project's current hypothesis. ?format=json (default) | txt | csv. */
export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const denied = await teacherGuard();
  if (denied) return denied;
  try {
    const { projectId } = await context.params;
    const db = await getRequestDatabase();
    const row = await getLatestHypothesisForProject(db, projectId);
    if (!row) return jsonError("Project not found.", 404);
    const format = new URL(request.url).searchParams.get("format") ?? "json";
    if (format === "json") return Response.json({ hypothesis: row });
    const base = `hypothesis_${safeFilename(row.studentName ?? "student")}_${safeFilename(row.projectName)}`;
    const isCsv = format === "csv";
    return new Response(isCsv ? hypothesesToCsv([row]) : hypothesisToText(row), {
      headers: {
        "Content-Type": isCsv ? "text/csv; charset=utf-8" : "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.${isCsv ? "csv" : "txt"}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
