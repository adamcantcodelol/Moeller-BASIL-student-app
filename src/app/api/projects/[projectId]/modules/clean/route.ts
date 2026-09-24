import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { completeImportModule } from "@/lib/services/importToolService";
import {
  isCleanUnavailableError,
  listCleanResults,
  submitCleanPrediction,
} from "@/lib/services/cleanService";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getRequestDatabase();
    return Response.json(await listCleanResults(db, projectId));
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getRequestDatabase();
    // Manual button = student asked now; bypass the cached health verdict.
    const result = await submitCleanPrediction(db, projectId, {
      forceHealthCheck: true,
    });
    return Response.json(result, { status: result.pending ? 202 : 200 });
  } catch (error) {
    if (isCleanUnavailableError(error)) {
      return Response.json(
        { error: error.message, unavailable: true, detail: error.detail },
        { status: 503 },
      );
    }
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
      return jsonError('Send { "complete": true } to finish CLEAN.', 400);
    }
    const db = await getRequestDatabase();
    return Response.json(await completeImportModule(db, projectId, "clean"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
    }
    return handleServiceError(error);
  }
}
