import { getProjectDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { pollDaliJob } from "@/lib/services/daliService";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as { jobId?: string };
    if (!body.jobId || typeof body.jobId !== "string") {
      return jsonError('Send { "jobId": "..." } to poll Dali.', 400);
    }
    const db = await getProjectDatabase(projectId);
    const result = await pollDaliJob(db, projectId, body.jobId);
    return Response.json(result, { status: result.pending ? 202 : 200 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
    }
    return handleServiceError(error);
  }
}
