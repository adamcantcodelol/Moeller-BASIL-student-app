import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import {
  collectUniqueResidues,
  completeActiveSiteModule,
  listEvidenceForProject,
} from "@/lib/services/evidenceService";
import { generateChimeraXCommands } from "@/lib/chimerax/generateCommands";
import { getStructureByProjectId } from "@/lib/db/queries/structures";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getRequestDatabase();
    const items = await listEvidenceForProject(db, projectId);
    const structure = await getStructureByProjectId(db, projectId);
    const residues = collectUniqueResidues(items);
    const chimerax = structure
      ? generateChimeraXCommands({
          pdbId: structure.pdbId,
          residues,
        })
      : null;
    return Response.json({ evidence: items, residues, chimerax });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as { complete?: boolean };
    if (body.complete !== true) {
      return jsonError(
        'Send { "complete": true } to finish Active-Site Evidence Synthesis.',
        400,
      );
    }
    const db = await getRequestDatabase();
    return Response.json(await completeActiveSiteModule(db, projectId));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
    }
    return handleServiceError(error);
  }
}
