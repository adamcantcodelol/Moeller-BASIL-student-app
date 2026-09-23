import type { Provenance } from "@/types/provenance";

/** Safe GrAfSS SPRITE pattern databases documented on grafss.ukm.my. */
export const SPRITE_SAFE_DATABASES = [
  "csa3",
  "all3",
  "m-csa3",
  "csa32",
  "m-csa32",
] as const;

export type SpriteDatabase = (typeof SPRITE_SAFE_DATABASES)[number];

export const DEFAULT_SPRITE_DATABASE: SpriteDatabase = "csa3";

export const SPRITE_API_BASE = "https://grafss.ukm.my/api/sprite";
export const SPRITE_PROVENANCE_SOURCE = "https://grafss.ukm.my";

export interface SpriteFetchInput {
  pdbId: string;
  database?: SpriteDatabase | string;
}

export interface SpriteUploadStructure {
  strucId: string;
  oriName: string | null;
  filepath: string | null;
}

export interface SpriteRawPayload {
  sessionId: string;
  strucId: string;
  pdbId: string;
  database: string;
  celeryState: string | null;
  /** Null while Celery is still running. */
  results: Record<string, unknown> | null;
  sessionSnapshot: Record<string, unknown> | null;
}

export interface SpriteResidueNormalized {
  chain: string | null;
  resNo: string | null;
  resType: string | null;
}

export interface SpriteHitNormalized {
  pdbId: string;
  patternId: string | null;
  size: number | null;
  description: string | null;
  rmsd: number | null;
  transform: number[] | null;
  patResidues: SpriteResidueNormalized[];
  matchResidues: SpriteResidueNormalized[];
}

export interface SpriteNormalizedSearch {
  pdbId: string;
  sessionId: string;
  strucId: string;
  database: string;
  celeryState: string;
  totalResults: number | null;
  hitCount: number;
  hits: SpriteHitNormalized[];
  provenance: Provenance;
}

export class SpriteAdapterError extends Error {
  readonly code:
    | "NOT_FOUND"
    | "INVALID_RESPONSE"
    | "NETWORK"
    | "TIMEOUT"
    | "VALIDATION"
    | "PENDING"
    | "FAILED";

  constructor(
    code: SpriteAdapterError["code"],
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SpriteAdapterError";
    this.code = code;
  }
}

export function isSpriteDatabase(value: string): value is SpriteDatabase {
  return (SPRITE_SAFE_DATABASES as readonly string[]).includes(value);
}
