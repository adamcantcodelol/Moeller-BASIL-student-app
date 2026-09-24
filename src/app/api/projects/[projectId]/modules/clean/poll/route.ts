import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import {
  isCleanUnavailableError,
  pollCleanJob,
} from "@/lib/services/cleanService";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as { jobId?: string };
    if (!body.jobId || typeof body.jobId !== "string") {
      return jsonError('Send { "jobId": "..." } to poll CLEAN.', 400);
    }
    const db = await getRequestDatabase();
    const result = await pollCleanJob(db, projectId, body.jobId);
    return Response.json(result, { status: result.pending ? 202 : 200 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
    }
    if (isCleanUnavailableError(error)) {
      return Response.json(
        { error: error.message, unavailable: true, detail: error.detail },
        { status: 503 },
      );
    }
    return handleServiceError(error);
  }
}
