import type { Provenance } from "@/types/provenance";

/** NCBI blastp databases safe for classroom use. */
export const BLAST_SAFE_DATABASES = [
  "swissprot",
  "pdbaa",
  "refseq_protein",
  "nr",
] as const;

export type BlastDatabase = (typeof BLAST_SAFE_DATABASES)[number];

/** Default: Swiss-Prot — smaller/faster than nr for school demos. */
export const DEFAULT_BLAST_DATABASE: BlastDatabase = "swissprot";

export const BLAST_API_URL = "https://blast.ncbi.nlm.nih.gov/Blast.cgi";
export const BLAST_PROVENANCE_SOURCE = "https://blast.ncbi.nlm.nih.gov";
export const BLAST_TOOL_NAME = "moeller-basil";
export const BLAST_CONTACT_EMAIL = "adamjfalci2@gmail.com";

/** NCBI guidance: poll RID at most once per 60 seconds. */
export const BLAST_NCBI_MIN_POLL_INTERVAL_MS = 60_000;

export const BLAST_HITLIST_SIZE = 50;

/**
 * Classroom pipeline gives NCBI this long before recording an honest timeout
 * (with a retry button). NCBI's public queue sometimes estimates hours.
 */
export const BLAST_PIPELINE_TIMEOUT_MS = 10 * 60_000;

export interface BlastFetchInput {
  sequence: string;
  database?: BlastDatabase | string;
  /** Optional FASTA header without leading '>'. */
  queryTitle?: string;
}

export interface BlastRawPayload {
  rid: string;
  rtoe: number | null;
  database: string;
  program: "blastp";
  status: "WAITING" | "READY" | "UNKNOWN" | "FAILED" | string;
  /** Null while waiting / before results fetch. */
  resultsText: string | null;
  resultsFormat: "XML" | "Text" | null;
  queryLength: number | null;
  thereAreHits: boolean | null;
}

export interface BlastHitNormalized {
  accession: string | null;
  hitId: string | null;
  title: string | null;
  evalue: string | null;
  bitScore: number | null;
  identityPct: number | null;
  alignmentLength: number | null;
  queryFrom: number | null;
  queryTo: number | null;
  hitFrom: number | null;
  hitTo: number | null;
}

export type SequenceSearchMethod = "ncbi-blast" | "rcsb-mmseqs2";

export interface BlastNormalizedSearch {
  /** NCBI RID, or the RCSB query id for RCSB sequence search. */
  rid: string;
  database: string;
  program: "blastp" | "mmseqs2";
  /** Which search produced these hits (older rows: undefined = NCBI BLAST). */
  method?: SequenceSearchMethod;
  methodLabel?: string;
  status: string;
  queryLength: number | null;
  hitCount: number;
  hits: BlastHitNormalized[];
  provenance: Provenance;
}

export class BlastAdapterError extends Error {
  readonly code:
    | "NOT_FOUND"
    | "INVALID_RESPONSE"
    | "NETWORK"
    | "TIMEOUT"
    | "VALIDATION"
    | "PENDING"
    | "FAILED"
    | "RATE_LIMIT";

  constructor(
    code: BlastAdapterError["code"],
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "BlastAdapterError";
    this.code = code;
  }
}

export function isBlastDatabase(value: string): value is BlastDatabase {
  return (BLAST_SAFE_DATABASES as readonly string[]).includes(value);
}
