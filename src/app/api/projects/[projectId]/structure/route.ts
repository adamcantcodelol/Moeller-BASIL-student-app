import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import {
  fetchAndSaveRcsbStructure,
  saveStudentPdbId,
} from "@/lib/services/structureService";

export const dynamic = "force-dynamic";

/**
 * Save PDB ID and immediately load verified RCSB metadata/sequence.
 * Students only enter a PDB identifier — no separate retrieve step.
 */
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
    await saveStudentPdbId(db, projectId, body.pdbId);
    const result = await fetchAndSaveRcsbStructure(db, projectId, body.pdbId);
    return Response.json({
      structure: result.structure,
      normalized: result.normalized,
      rcsbLoaded: true,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
