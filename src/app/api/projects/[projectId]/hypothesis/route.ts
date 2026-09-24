import { getProjectDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import {
  getHypothesisForProject,
  saveHypothesis,
} from "@/lib/services/hypothesisService";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getProjectDatabase(projectId);
    return Response.json(await getHypothesisForProject(db, projectId));
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as {
      text?: string;
      reasonForChange?: string;
    };
    if (!body.text || typeof body.text !== "string") {
      return jsonError("Send { \"text\": \"...\" } with your hypothesis.", 400);
    }
    const db = await getProjectDatabase(projectId);
    return Response.json(
      await saveHypothesis(db, projectId, {
        text: body.text,
        reasonForChange: body.reasonForChange,
      }),
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
    }
    return handleServiceError(error);
  }
}
