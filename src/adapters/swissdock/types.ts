import type { Provenance } from "@/types/provenance";

export const SWISSDOCK_API_BASE = "https://swissdock.ch:8443";
export const SWISSDOCK_PROVENANCE_SOURCE = "https://swissdock.ch";

export interface SwissDockFetchInput {
  pdbId: string;
  /** Required ligand SMILES — never invented. */
  smiles: string;
  /** Box center x_y_z */
  boxCenter: string;
  /** Box size a_b_c */
  boxSize: string;
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
}

export interface SwissDockPoseNormalized {
  rank: number | null;
  affinity: number | null;
  note: string | null;
}

export interface SwissDockNormalizedSearch {
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
