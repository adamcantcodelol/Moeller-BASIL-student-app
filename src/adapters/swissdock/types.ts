import type { Provenance } from "@/types/provenance";

export const SWISSDOCK_API_BASE = "https://swissdock.ch:8443";
export const SWISSDOCK_PROVENANCE_SOURCE = "https://swissdock.ch";

export interface SwissDockFetchInput {
  pdbId: string;
  /**
   * Optional override. When omitted, Worker extracts a HETATM ligand from the
   * project PDB and looks up SMILES on RCSB chemcomp — never invented.
   */
  smiles?: string;
  /** Optional override; defaults to ligand centroid from PDB. */
  boxCenter?: string;
  /** Box size a_b_c (default 20_20_20). */
  boxSize?: string;
  /** Exhaustiveness for Vina (default 8 for school). */
  exhaustiveness?: number;
}

export interface SwissDockRawPayload {
  sessionNumber: string;
  pdbId: string;
  smiles: string;
  statusText: string;
  phase:
    | "preplig"
    | "preptarget"
    | "setparameters"
    | "docking"
    | "ready"
    | "error";
  /** Raw checkstatus / retrieve text when available. */
  resultsText: string | null;
  /** Box actually sent to SwissDock (set on submit). */
  boxCenter?: string;
  boxSize?: string;
}

export interface SwissDockPoseNormalized {
  rank: number | null;
  affinity: number | null;
  note: string | null;
}

/** SwissDock's Vina limit is ~10 min compute; allow queue time too. */
export const SWISSDOCK_JOB_TIMEOUT_MS = 20 * 60_000;

/** What the student chose (recorded alongside results). */
export interface SwissDockLigandChoice {
  name: string;
  source: "structure" | "rcsb-chemcomp" | "pubchem" | "smiles";
  id?: string | null;
  formula?: string | null;
  smiles: string;
}

export interface SwissDockBoxChoice {
  center: string;
  size: string;
  label: string;
}

export interface SwissDockNormalizedSearch {
  ligand?: SwissDockLigandChoice | null;
  box?: SwissDockBoxChoice | null;
  sessionNumber: string;
  pdbId: string;
  smiles: string;
  phase: string;
  poseCount: number;
  poses: SwissDockPoseNormalized[];
  statusSummary: string;
  provenance: Provenance;
}

export class SwissDockAdapterError extends Error {
  readonly code:
    | "NOT_FOUND"
    | "INVALID_RESPONSE"
    | "NETWORK"
    | "TIMEOUT"
    | "VALIDATION"
    | "PENDING"
    | "FAILED";

  constructor(
    code: SwissDockAdapterError["code"],
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SwissDockAdapterError";
    this.code = code;
  }
}
