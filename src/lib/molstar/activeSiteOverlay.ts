import type { EvidenceResidue } from "@/types/evidence";

/**
 * Mol* StructureElement.Schema item fields used by Viewer.structureInteractivity.
 * Kept as a plain object so we never invent residue numbers — callers pass evidence only.
 */
export interface MolstarResidueElement {
  auth_asym_id?: string;
  auth_seq_id: number;
}

export function residuesToStructureElements(
  residues: EvidenceResidue[],
): MolstarResidueElement[] {
  return residues.map((residue) => {
    const chain = residue.chain?.trim();
    if (chain) {
      return { auth_asym_id: chain, auth_seq_id: residue.position };
    }
    return { auth_seq_id: residue.position };
  });
}

export function formatEvidenceResidues(residues: EvidenceResidue[]): string {
  if (residues.length === 0) {
    return "none recorded";
  }
  return residues
    .map(
      (residue) =>
        `${residue.chain ? `${residue.chain}:` : ""}${residue.position}${residue.aminoAcid ? residue.aminoAcid : ""}`,
    )
    .join(", ");
}

export function pickComparisonPdbId(
  queryPdbId: string | null | undefined,
  candidates: Array<string | null | undefined>,
): string | null {
  const query = queryPdbId?.trim().toUpperCase() || null;
  for (const candidate of candidates) {
    const value = candidate?.trim().toUpperCase() || null;
    if (value && value !== query) {
      return value;
    }
  }
  return null;
}
