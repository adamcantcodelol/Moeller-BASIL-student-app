import { getProjectDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import {
  collectUniqueResidues,
  completeActiveSiteModule,
  listEvidenceForProject,
} from "@/lib/services/evidenceService";
import { generateChimeraXCommands } from "@/lib/chimerax/generateCommands";
import { getStructureByProjectId } from "@/lib/db/queries/structures";
import { listFoldseekResults } from "@/lib/services/foldseekService";
import { pickComparisonPdbId } from "@/lib/molstar/activeSiteOverlay";
import { extractClassicPdbId } from "@/lib/validation/pdbId";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getProjectDatabase(projectId);
    const items = await listEvidenceForProject(db, projectId);
    const structure = await getStructureByProjectId(db, projectId);
    const residues = collectUniqueResidues(items);
    let comparisonPdbId: string | null = null;
    try {
      const foldseek = await listFoldseekResults(db, projectId);
      const candidates = (foldseek.latestNormalized?.hits ?? [])
        .map((hit) => extractClassicPdbId(hit.target))
        .filter((id): id is string => Boolean(id));
      comparisonPdbId = pickComparisonPdbId(structure?.pdbId, candidates);
    } catch {
      comparisonPdbId = null;
    }
    const chimerax = structure
      ? generateChimeraXCommands({
          pdbId: structure.pdbId,
          comparisonPdbId,
          residues,
        })
      : null;
    return Response.json({ evidence: items, residues, comparisonPdbId, chimerax });
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
    const db = await getProjectDatabase(projectId);
    return Response.json(await completeActiveSiteModule(db, projectId));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
    }
    return handleServiceError(error);
  }
}
