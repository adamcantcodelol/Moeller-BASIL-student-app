import type { Provenance } from "@/types/provenance";

export const DALI_SUBMIT_URL =
  "http://ekhidna2.biocenter.helsinki.fi/cgi-bin/sans/dump.cgi";
export const DALI_PROVENANCE_SOURCE =
  "http://ekhidna2.biocenter.helsinki.fi/dali/";
export const DALI_HOME = "http://ekhidna2.biocenter.helsinki.fi/dali/";

export interface DaliFetchInput {
  pdbId: string;
  chain: string;
}

export interface DaliRawPayload {
  pdbId: string;
  chain: string;
  jobUrl: string;
  status: "Queued" | "Running" | "READY" | "ERROR" | string;
  /** Raw summary .txt when READY; null while pending. */
  summaryText: string | null;
  indexHtml: string | null;
}

/**
 * One structurally aligned segment from Dali's "# Structural equivalences"
 * block. `query`/`hit` are PDB residue numbers; `querySeq`/`hitSeq` are
 * Dali's sequential numbering; `*Res` are the end-point residue names.
 */
export interface DaliAlignedSegment {
  query: [number, number];
  hit: [number, number];
  querySeq: [number, number];
  hitSeq: [number, number];
  queryRes: [string, string];
  hitRes: [string, string];
}

export interface DaliHitNormalized {
  rank: number | null;
  pdbChain: string | null;
  zScore: number | null;
  rmsd: number | null;
  alignLength: number | null;
  nRes: number | null;
  identityPct: number | null;
  description: string | null;
  /** Kept only for the top hits; absent when Dali gave no equivalences. */
  alignedSegments?: DaliAlignedSegment[];
}

export interface DaliNormalizedSearch {
  pdbId: string;
  chain: string;
  jobUrl: string;
  status: string;
  /** Total hits Dali reported. */
  hitCount: number;
  /** Only the best hits (by Z-score) are stored; see `keptTop`. */
  hits: DaliHitNormalized[];
  /** How many top hits were kept (absent on older, untrimmed results). */
  keptTop?: number;
  provenance: Provenance;
}

export class DaliAdapterError extends Error {
  readonly code:
    | "NOT_FOUND"
    | "INVALID_RESPONSE"
    | "NETWORK"
    | "TIMEOUT"
    | "VALIDATION"
    | "PENDING"
    | "FAILED";

  constructor(
    code: DaliAdapterError["code"],
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DaliAdapterError";
    this.code = code;
  }
}
