import type { SpriteResidueNormalized } from "@/adapters/sprite";

/** Format one residue as e.g. "HIS E:57" or "—" if empty. */
export function formatOneResidue(
  residue: SpriteResidueNormalized | null | undefined,
): string {
  if (!residue) {
    return "—";
  }
  const loc = [residue.chain, residue.resNo].filter(Boolean).join(":");
  if (residue.resType) {
    return loc ? `${residue.resType} ${loc}` : residue.resType;
  }
  return loc || "—";
}

/** Format a list of residues as a comma-separated blob (fallback). */
export function formatResidueList(
  residues: SpriteResidueNormalized[],
): string {
  if (residues.length === 0) {
    return "—";
  }
  return residues.map((r) => formatOneResidue(r)).join(", ");
}

export type ResiduePair = {
  index: number;
  pattern: SpriteResidueNormalized | null;
  match: SpriteResidueNormalized | null;
  label: string;
};

/**
 * Pair pattern (known active site) residues with student match residues by index.
 * Leftover residues on either side are kept with a null partner.
 */
export function pairResidues(
  patResidues: SpriteResidueNormalized[],
  matchResidues: SpriteResidueNormalized[],
): ResiduePair[] {
  const len = Math.max(patResidues.length, matchResidues.length);
  if (len === 0) {
    return [];
  }
  const pairs: ResiduePair[] = [];
  for (let i = 0; i < len; i += 1) {
    const pattern = patResidues[i] ?? null;
    const match = matchResidues[i] ?? null;
    const left = formatOneResidue(pattern);
    const right = formatOneResidue(match);
    pairs.push({
      index: i,
      pattern,
      match,
      label: `${left} ↔ ${right}`,
    });
  }
  return pairs;
}
