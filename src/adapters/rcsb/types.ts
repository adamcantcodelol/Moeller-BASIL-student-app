import type { Provenance } from "@/types/provenance";

export interface RcsbFetchInput {
  pdbId: string;
}

/** Raw payload retained for provenance — only RCSB responses, never invented fields. */
export interface RcsbRawPayload {
  entry: Record<string, unknown>;
  polymerEntities: Record<string, unknown>[];
}

export interface RcsbPolymerEntityNormalized {
  entityId: string;
  chains: string[];
  sequence: string | null;
  organism: string | null;
}

export interface RcsbNormalizedStructure {
  pdbId: string;
  title: string | null;
  organism: string | null;
  chains: string[];
  /** Sequence of the first polymer entity, if any. Full per-entity sequences live in polymerEntities. */
  sequence: string | null;
  experimentalMethod: string | null;
  resolutionAngstrom: number | null;
  polymerEntities: RcsbPolymerEntityNormalized[];
  structureCifUrl: string;
  structurePdbUrl: string;
  entryPageUrl: string;
  provenance: Provenance;
}

export class RcsbAdapterError extends Error {
  readonly code: "NOT_FOUND" | "INVALID_RESPONSE" | "NETWORK" | "TIMEOUT";

  constructor(
    code: RcsbAdapterError["code"],
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RcsbAdapterError";
    this.code = code;
  }
}
