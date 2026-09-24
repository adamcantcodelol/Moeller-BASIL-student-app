import { getProjectDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import {
  completeBlastModule,
  listBlastResults,
  submitBlastSearch,
} from "@/lib/services/blastService";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getProjectDatabase(projectId);
    return Response.json(await listBlastResults(db, projectId));
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
    let sequence: string | undefined;
    let database: string | undefined;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        sequence?: string;
        database?: string;
      };
      sequence = body.sequence;
      database = body.database;
    }
    const db = await getProjectDatabase(projectId);
    const result = await submitBlastSearch(db, projectId, {
      sequence,
      database,
    });
    return Response.json(result, { status: result.pending ? 202 : 200 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON when provided.", 400);
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
      return jsonError('Send { "complete": true } to finish BLAST.', 400);
    }
    const db = await getProjectDatabase(projectId);
    return Response.json(await completeBlastModule(db, projectId));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
    }
    return handleServiceError(error);
  }
}
