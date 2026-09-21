import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { saveStudentPdbId } from "@/lib/services/structureService";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as { pdbId?: string };
    if (!body.pdbId) {
      return jsonError("pdbId is required.", 400);
    }
    const db = await getRequestDatabase();
    const structure = await saveStudentPdbId(db, projectId, body.pdbId);
    return Response.json({ structure });
  } catch (error) {
    return handleServiceError(error);
  }
}
