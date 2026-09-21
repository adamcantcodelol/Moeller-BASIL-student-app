import type { Provenance } from "./provenance";

export interface Evidence {
  id: string;
  projectId: string;
  type: string;
  description: string;
  sourceResultId: string | null;
  residues: unknown | null;
  strength: string | null;
  provenance: Provenance | null;
  isDemo: boolean;
  createdAt: string;
}
