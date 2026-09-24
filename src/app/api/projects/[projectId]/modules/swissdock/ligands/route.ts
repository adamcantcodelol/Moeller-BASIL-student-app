import { getProjectDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { parseResidueList } from "@/adapters/swissdock";
import {
  centerOnResidues,
  checkSmiles,
  getLigandChooserSetup,
  searchLigands,
} from "@/lib/services/swissdockLigands";

export const dynamic = "force-dynamic";

/**
 * Ligand chooser data.
 *  GET            → ligands in the PDB entry, docking-box candidates, grounded suggestions
 *  GET ?q=        → search RCSB chemical components (by ID) + PubChem (by name)
 *  GET ?residues= → box center for residues like "A:114,A:207"
 *  POST {smiles}  → syntax check + PubChem identity
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getProjectDatabase(projectId);
    const url = new URL(request.url);
    const q = url.searchParams.get("q");
    if (q !== null) return Response.json(await searchLigands(q));
    const residues = url.searchParams.get("residues");
    if (residues !== null) {
      return Response.json(await centerOnResidues(db, projectId, parseResidueList(residues)));
    }
    return Response.json(await getLigandChooserSetup(db, projectId));
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
    await getProjectDatabase(projectId);
    const body = (await request.json().catch(() => null)) as { smiles?: unknown } | null;
    if (typeof body?.smiles !== "string") return jsonError('Send { "smiles": "..." }.', 400);
    return Response.json(await checkSmiles(body.smiles));
  } catch (error) {
    return handleServiceError(error);
  }
}
