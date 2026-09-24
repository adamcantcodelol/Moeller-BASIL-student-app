import { getProjectDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import {
  completeShannonBotModule,
  getShannonBotConversation,
  sendShannonBotMessage,
} from "@/lib/services/shannonBotService";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getProjectDatabase(projectId);
    return Response.json(await getShannonBotConversation(db, projectId));
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
    const body = (await request.json()) as { message?: string };
    if (!body.message || typeof body.message !== "string") {
      return jsonError('Send { "message": "..." }.', 400);
    }
    const db = await getProjectDatabase(projectId);
    return Response.json(await sendShannonBotMessage(db, projectId, body.message));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
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
      return jsonError('Send { "complete": true }.', 400);
    }
    const db = await getProjectDatabase(projectId);
    return Response.json(await completeShannonBotModule(db, projectId));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
    }
    return handleServiceError(error);
  }
}
