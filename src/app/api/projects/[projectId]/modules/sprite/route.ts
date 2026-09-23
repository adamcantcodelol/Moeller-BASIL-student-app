import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import {
  completeSpriteModule,
  listSpriteResults,
  submitSpriteSearch,
} from "@/lib/services/spriteService";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getRequestDatabase();
    return Response.json(await listSpriteResults(db, projectId));
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
    let pdbId: string | undefined;
    let database: string | undefined;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        pdbId?: string;
        database?: string;
      };
      pdbId = body.pdbId;
      database = body.database;
    }
    const db = await getRequestDatabase();
    const result = await submitSpriteSearch(db, projectId, { pdbId, database });
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
      return jsonError('Send { "complete": true } to finish SPRITE.', 400);
    }
    const db = await getRequestDatabase();
    return Response.json(await completeSpriteModule(db, projectId));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
    }
    return handleServiceError(error);
  }
}
