import type { Provenance } from "@/types/provenance";

export interface FoldseekFetchInput {
  pdbId: string;
  /** Optional pre-fetched PDB text; when omitted the adapter downloads from RCSB. */
  pdbText?: string;
  mode?: "3diaa" | "tmalign";
  database?: string;
}

export interface FoldseekRawPayload {
  ticketId: string;
  ticketStatus: string;
  result: Record<string, unknown> | null;
  pdbId: string;
}

export interface FoldseekHitNormalized {
  target: string;
  seqId: number | null;
  alnLength: number | null;
  eValue: number | null;
  score: number | null;
  probability: number | null;
  qStart: number | null;
  qEnd: number | null;
  dbStart: number | null;
  dbEnd: number | null;
}

export interface FoldseekNormalizedSearch {
  pdbId: string;
  ticketId: string;
  mode: string;
  database: string;
  hitCount: number;
  hits: FoldseekHitNormalized[];
  provenance: Provenance;
}

export class FoldseekAdapterError extends Error {
  readonly code:
    | "NOT_FOUND"
    | "INVALID_RESPONSE"
    | "NETWORK"
    | "TIMEOUT"
    | "VALIDATION"
    | "PENDING";

  constructor(
    code: FoldseekAdapterError["code"],
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "FoldseekAdapterError";
    this.code = code;
  }
}
