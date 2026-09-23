import type { PdbStructure } from "@/types/structure";
import { validateUniProtAccession } from "@/lib/validation/uniprotAccession";

/**
 * Read UniProt accessions already stored from RCSB / SIFTS metadata.
 * Never invents accessions; returns [] when none are present.
 */
export function readUniprotAccessionsFromStructure(
  structure: PdbStructure | null,
): string[] {
  if (!structure?.metadata) {
    return [];
  }
  const raw = structure.metadata.uniprotAccessions;
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const validation = validateUniProtAccession(item);
    if (validation.ok) {
      out.push(validation.accession);
    }
  }
  return [...new Set(out)];
}

export function isLigandMissingError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("no non-solvent hetatm ligand") ||
    lower.includes("no smiles") ||
    lower.includes("ligand smiles is required") ||
    lower.includes("could not look up smiles") ||
    lower.includes("had no smiles")
  );
}
