import type { Provenance } from "./provenance";

export const EVIDENCE_STRENGTHS = [
  "supporting",
  "strong",
  "conflicting",
  "preliminary",
] as const;

export type EvidenceStrength = (typeof EVIDENCE_STRENGTHS)[number];

export interface EvidenceResidue {
  chain?: string | null;
  position: number;
  aminoAcid?: string | null;
  note?: string | null;
}

export interface Evidence {
  id: string;
  projectId: string;
  type: string;
  description: string;
  sourceResultId: string | null;
  /** Curriculum module that produced the supporting observation. */
  sourceModuleId: string | null;
  residues: EvidenceResidue[] | null;
  strength: EvidenceStrength | null;
  provenance: Provenance | null;
  isDemo: boolean;
  createdAt: string;
}

export interface CreateEvidenceInput {
  type: string;
  description: string;
  sourceModuleId: string;
  sourceResultId?: string | null;
  residues: EvidenceResidue[];
  strength?: EvidenceStrength | null;
}
