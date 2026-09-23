import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import {
  createEvidenceRecord,
  listEvidenceForProject,
} from "@/lib/services/evidenceService";
import type { CreateEvidenceInput } from "@/types/evidence";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getRequestDatabase();
    return Response.json({
      evidence: await listEvidenceForProject(db, projectId),
    });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as CreateEvidenceInput;
    const db = await getRequestDatabase();
    const created = await createEvidenceRecord(db, projectId, body);
    return Response.json({ evidence: created }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
    }
    return handleServiceError(error);
  }
}
