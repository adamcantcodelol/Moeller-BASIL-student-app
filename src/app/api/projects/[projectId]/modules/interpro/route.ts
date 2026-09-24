import { getProjectDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import {
  completeInterProModule,
  fetchAndSaveInterProAnnotations,
  listInterProResults,
} from "@/lib/services/interproService";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getProjectDatabase(projectId);
    const payload = await listInterProResults(db, projectId);
    return Response.json(payload);
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
    const body = (await request.json()) as { uniprotAccession?: string };
    if (!body.uniprotAccession || typeof body.uniprotAccession !== "string") {
      return jsonError(
        "Send { \"uniprotAccession\": \"P04637\" } to retrieve InterPro annotations.",
        400,
      );
    }
    const db = await getProjectDatabase(projectId);
    const result = await fetchAndSaveInterProAnnotations(
      db,
      projectId,
      body.uniprotAccession,
    );
    return Response.json(result);
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
      return jsonError('Send { "complete": true } to finish InterPro.', 400);
    }
    const db = await getProjectDatabase(projectId);
    const result = await completeInterProModule(db, projectId);
    return Response.json(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
    }
    return handleServiceError(error);
  }
}
