import { z } from "zod";
import { getProjectDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import {
  completeSwissDockModule,
  listSwissDockResults,
  submitSwissDock,
} from "@/lib/services/swissdockService";

export const dynamic = "force-dynamic";

const ligandSchema = z.object({
  name: z.string().trim().min(1).max(200),
  source: z.enum(["structure", "rcsb-chemcomp", "pubchem", "smiles"]),
  id: z.string().max(40).nullish(),
  formula: z.string().max(80).nullish(),
  smiles: z.string().trim().min(2).max(300),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getProjectDatabase(projectId);
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
    let smiles: string | undefined;
    let boxCenter: string | undefined;
    let boxSize: string | undefined;
    let pdbId: string | undefined;
    let exhaustiveness: number | undefined;
    let ligand: z.infer<typeof ligandSchema> | undefined;
    let boxLabel: string | undefined;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        smiles?: string;
        boxCenter?: string;
        boxSize?: string;
        pdbId?: string;
        exhaustiveness?: number;
        ligand?: unknown;
        boxLabel?: unknown;
      };
      smiles = body.smiles;
      boxCenter = body.boxCenter;
      boxSize = body.boxSize;
      pdbId = body.pdbId;
      exhaustiveness = body.exhaustiveness;
      if (body.ligand !== undefined) {
        const parsed = ligandSchema.safeParse(body.ligand);
        if (!parsed.success) return jsonError("Ligand choice is incomplete.", 400);
        ligand = parsed.data;
        smiles = parsed.data.smiles;
      }
      if (typeof body.boxLabel === "string") boxLabel = body.boxLabel.slice(0, 300);
    }
    const db = await getProjectDatabase(projectId);
    const result = await submitSwissDock(db, projectId, {
      smiles,
      boxCenter,
      boxSize,
      pdbId,
      exhaustiveness,
      ligand: ligand
        ? { ...ligand, id: ligand.id ?? null, formula: ligand.formula ?? null }
        : undefined,
      boxLabel,
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
      return jsonError('Send { "complete": true } to finish SwissDock.', 400);
    }
    const db = await getProjectDatabase(projectId);
    return Response.json(await completeSwissDockModule(db, projectId));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
    }
    return handleServiceError(error);
  }
}
