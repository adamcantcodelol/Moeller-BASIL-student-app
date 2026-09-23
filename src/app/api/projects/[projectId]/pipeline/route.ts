import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import {
  getPipelineStatus,
  startPipeline,
  tickPipeline,
} from "@/lib/services/pipelineService";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getRequestDatabase();
    const pipeline = await getPipelineStatus(db, projectId);
    return Response.json({ pipeline });
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
    let action: "start" | "tick" = "tick";
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { action?: string };
      if (body.action === "start" || body.action === "tick") {
        action = body.action;
      } else if (body.action !== undefined) {
        return jsonError('Send { "action": "start" | "tick" }.', 400);
      }
    }

    const db = await getRequestDatabase();
    if (action === "start") {
      const pipeline = await startPipeline(db, projectId);
      return Response.json({ pipeline }, { status: 201 });
    }

    const result = await tickPipeline(db, projectId);
    return Response.json(result, {
      status: result.waiting ? 202 : 200,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON when provided.", 400);
    }
    return handleServiceError(error);
  }
}
