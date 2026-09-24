import { getProjectDatabase } from "@/lib/db/request";
import { handleServiceError } from "@/lib/http";
import { deleteEvidenceRecord } from "@/lib/services/evidenceService";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ projectId: string; evidenceId: string }> },
) {
  try {
    const { projectId, evidenceId } = await context.params;
    const db = await getProjectDatabase(projectId);
    await deleteEvidenceRecord(db, projectId, evidenceId);
    return Response.json({ ok: true });
  } catch (error) {
    return handleServiceError(error);
  }
}
