import { getProjectDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import {
  getPipelineStatus,
  retryPipelineStep,
  startPipeline,
  tickPipeline,
} from "@/lib/services/pipelineService";
import { PIPELINE_TOOLS, type PipelineTool } from "@/types/pipeline";

const PIPELINE_FALLBACK_ERROR =
  "The analysis server hit a temporary problem. Your progress is saved — the page will keep retrying automatically.";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getProjectDatabase(projectId);
    const pipeline = await getPipelineStatus(db, projectId);
    return Response.json({ pipeline });
  } catch (error) {
    return handleServiceError(error, PIPELINE_FALLBACK_ERROR);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    let action: "start" | "tick" | "retry-step" = "tick";
    let tool: PipelineTool | null = null;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { action?: string; tool?: string };
      if (
        body.action === "start" ||
        body.action === "tick" ||
        body.action === "retry-step"
      ) {
        action = body.action;
      } else if (body.action !== undefined) {
        return jsonError(
          'Send { "action": "start" | "tick" | "retry-step", "tool"?: "clean" }.',
          400,
        );
      }
      if (action === "retry-step") {
        if (
          typeof body.tool !== "string" ||
          !(PIPELINE_TOOLS as readonly string[]).includes(body.tool)
        ) {
          return jsonError('retry-step needs a valid "tool" (e.g. "clean").', 400);
        }
        tool = body.tool as PipelineTool;
      }
    }

    const db = await getProjectDatabase(projectId);
    if (action === "retry-step" && tool) {
      const pipeline = await retryPipelineStep(db, projectId, tool);
      return Response.json({ pipeline });
    }
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
    return handleServiceError(error, PIPELINE_FALLBACK_ERROR);
  }
}
