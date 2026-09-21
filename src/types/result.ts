import type { Provenance } from "./provenance";

export const RESULT_TYPES = ["raw", "normalized", "interpretation"] as const;

export type ResultType = (typeof RESULT_TYPES)[number];

export interface ScientificResult {
  id: string;
  moduleRunId: string;
  type: ResultType;
  rawData: unknown | null;
  normalizedData: unknown | null;
  source: string | null;
  provenance: Provenance | null;
  isDemo: boolean;
  createdAt: string;
}
