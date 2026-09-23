import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import {
  completeSwissDockModule,
  listSwissDockResults,
  submitSwissDock,
} from "@/lib/services/swissdockService";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getRequestDatabase();
    return Response.json(await listSwissDockResults(db, projectId));
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
    const body = (await request.json()) as {
      smiles?: string;
      boxCenter?: string;
      boxSize?: string;
      pdbId?: string;
      exhaustiveness?: number;
    };
    if (!body.smiles || !body.boxCenter || !body.boxSize) {
      return jsonError(
        "Send { smiles, boxCenter, boxSize }. Ligands and boxes are never invented.",
        400,
      );
    }
    const db = await getRequestDatabase();
    const result = await submitSwissDock(db, projectId, {
      smiles: body.smiles,
      boxCenter: body.boxCenter,
      boxSize: body.boxSize,
      pdbId: body.pdbId,
      exhaustiveness: body.exhaustiveness,
    });
    return Response.json(result, { status: result.pending ? 202 : 200 });
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
      return jsonError('Send { "complete": true } to finish SwissDock.', 400);
    }
    const db = await getRequestDatabase();
    return Response.json(await completeSwissDockModule(db, projectId));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
    }
    return handleServiceError(error);
  }
}
