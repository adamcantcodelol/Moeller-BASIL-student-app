import type { Provenance } from "@/types/provenance";

/**
 * UIUC MoleculeMaker (MMLI) public backend used by the official CLEAN web app
 * (https://clean.platform.ibiofoundry.illinois.edu, formerly
 * clean.platform.moleculemaker.org). Discovered from the SPA's runtime
 * /assets/config/envvars.json and the backend's public /openapi.json.
 */
export const CLEAN_API_BASE = "https://mmli.fastapi.mmli2.ncsa.illinois.edu";
export const CLEAN_PROVENANCE_SOURCE =
  "https://clean.platform.ibiofoundry.illinois.edu";
export const CLEAN_API_LABEL = "mmli.fastapi.mmli2.ncsa.illinois.edu/clean";

/**
 * A real CLEAN job (human carbonic anhydrase II, P00918) submitted during the
 * 2026-09-24 probe. Used only as a health probe: a healthy results store
 * answers 200 (file present) or 404 (file missing); 5xx / timeout means the
 * backend cannot read job outputs right now.
 */
export const CLEAN_HEALTH_PROBE_JOB_ID = "d157127706a74c629b6a2559c78e6d0e";

/** Official CLEAN web app limit (ESM-1b context window). */
export const CLEAN_MAX_SEQUENCE_LENGTH = 1022;
export const CLEAN_MIN_SEQUENCE_LENGTH = 10;

export const CLEAN_UNAVAILABLE_MESSAGE =
  "CLEAN's server (UIUC MoleculeMaker) is running jobs but can't return results right now. Try again later or import a CLEAN CSV.";

export const CLEAN_PHASES = [
  "queued",
  "processing",
  "completed",
  "error",
  "canceled",
] as const;
export type CleanPhase = (typeof CLEAN_PHASES)[number];

export function isCleanPhase(value: unknown): value is CleanPhase {
  return (
    typeof value === "string" &&
    (CLEAN_PHASES as readonly string[]).includes(value)
  );
}

export type CleanConfidenceLevel = "High" | "Medium" | "Low";

export interface CleanPrediction {
  /** EC number without the "EC:" prefix, e.g. "4.2.1.1". */
  ecNumber: string;
  /** CLEAN confidence score (0–1) exactly as returned by the server. */
  score: number;
  /** Same thresholds as the official CLEAN web app: ≥0.8 High, ≥0.2 Medium. */
  level: CleanConfidenceLevel;
  /** Top-level enzyme class from the first EC digit (e.g. "Lyases"). */
  enzymeClass: string | null;
  /** Accepted name from ExPASy ENZYME when it could be fetched; else null. */
  enzymeName: string | null;
  /** ExPASy ENZYME entry for this EC number. */
  expasyUrl: string | null;
}

export interface CleanSequencePredictions {
  header: string;
  predictions: CleanPrediction[];
}

export interface CleanRawPayload {
  mmliJobId: string;
  phase: CleanPhase;
  header: string;
  sequenceLength: number;
  /** Body from GET /clean/results/{job_id} (JSON or JSON-encoded string). */
  results: unknown;
}

export interface CleanNormalizedResult {
  kind: "clean-live" | "clean-import";
  mmliJobId: string | null;
  header: string;
  sequenceLength: number | null;
  predictionCount: number;
  predictions: CleanPrediction[];
  topPrediction: CleanPrediction | null;
  provenance: Provenance;
}

export interface CleanHealthStatus {
  ok: boolean;
  /** HTTP status of the probe, or null on network error / timeout. */
  httpStatus: number | null;
  checkedAt: string;
  detail: string;
}

export class CleanAdapterError extends Error {
  readonly code:
    | "VALIDATION"
    | "NETWORK"
    | "TIMEOUT"
    | "INVALID_RESPONSE"
    | "NOT_FOUND"
    | "FAILED"
    | "RESULTS_UNAVAILABLE";

  constructor(
    code: CleanAdapterError["code"],
    message: string,
    readonly httpStatus: number | null = null,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CleanAdapterError";
    this.code = code;
  }
}
