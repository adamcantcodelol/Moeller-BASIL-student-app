import type { Provenance } from "@/types/provenance";

export interface InterProFetchInput {
  uniprotAccession: string;
}

/** Raw InterPro REST payloads — never invent fields not returned by EBI. */
export interface InterProRawPayload {
  protein: Record<string, unknown>;
  entries: Record<string, unknown>;
}

export interface InterProGoTermNormalized {
  id: string;
  name: string;
  category: string | null;
}

export interface InterProLocationNormalized {
  start: number;
  end: number;
}

export interface InterProMemberDbNormalized {
  database: string;
  accession: string;
  name: string;
}

export interface InterProEntryNormalized {
  accession: string;
  name: string;
  type: string;
  goTerms: InterProGoTermNormalized[];
  locations: InterProLocationNormalized[];
  memberDatabases: InterProMemberDbNormalized[];
}

export interface InterProNormalizedAnnotation {
  uniprotAccession: string;
  proteinName: string | null;
  proteinId: string | null;
  organism: string | null;
  length: number | null;
  entryCount: number;
  entries: InterProEntryNormalized[];
  proteinPageUrl: string;
  provenance: Provenance;
}

export class InterProAdapterError extends Error {
  readonly code:
    | "NOT_FOUND"
    | "INVALID_RESPONSE"
    | "NETWORK"
    | "TIMEOUT"
    | "VALIDATION";

  constructor(
    code: InterProAdapterError["code"],
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "InterProAdapterError";
    this.code = code;
  }
}
