import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { getProjectOverview } from "@/lib/services/projectService";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getRequestDatabase();
    const overview = await getProjectOverview(db, projectId);
    return Response.json({
      ...overview,
      demoLabel: overview.project.isDemo ? "DEMO DATA" : null,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function POST() {
  return jsonError("Use PATCH endpoints on structure or modules instead.", 405);
}
