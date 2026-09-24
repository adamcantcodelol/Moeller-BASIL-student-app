import { getProjectDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { fetchAndSaveRcsbStructure } from "@/lib/services/structureService";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    let pdbId: string | undefined;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { pdbId?: string };
      pdbId = body.pdbId;
    }
    const db = await getProjectDatabase(projectId);
    const result = await fetchAndSaveRcsbStructure(db, projectId, pdbId);
    return Response.json(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON when provided.", 400);
    }
    return handleServiceError(error);
  }
}
