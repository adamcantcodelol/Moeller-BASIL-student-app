import { getProjectDatabase } from "@/lib/db/request";
import { handleServiceError } from "@/lib/http";
import { getProjectResultsSections } from "@/lib/services/pipelineService";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getProjectDatabase(projectId);
    return Response.json(await getProjectResultsSections(db, projectId));
  } catch (error) {
    return handleServiceError(error);
  }
}
