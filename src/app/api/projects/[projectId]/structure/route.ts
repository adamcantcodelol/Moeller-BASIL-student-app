import { getProjectDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { savePdbIdWithAutoRcsb } from "@/lib/services/structureService";

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
    const db = await getProjectDatabase(projectId);
    // One student action: save PDB ID + retrieve RCSB sequence/metadata.
    const result = await savePdbIdWithAutoRcsb(db, projectId, body.pdbId);
    return Response.json(result);
  } catch (error) {
    return handleServiceError(error);
  }
}
