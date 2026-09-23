/**
 * Scientific job execution states (adapter / import lifecycle).
 * Distinct from curriculum ModuleRunStatus in DATA_MODEL.md.
 */
export const SCIENTIFIC_JOB_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "awaiting_import",
] as const;

export type ScientificJobStatus = (typeof SCIENTIFIC_JOB_STATUSES)[number];

export const SCIENTIFIC_JOB_MODES = ["adapter", "import"] as const;

export type ScientificJobMode = (typeof SCIENTIFIC_JOB_MODES)[number];

export interface ScientificJob {
  id: string;
  moduleRunId: string;
  tool: string;
  status: ScientificJobStatus;
  mode: ScientificJobMode;
  parameters: Record<string, unknown> | null;
  error: string | null;
  cacheHit: boolean;
  resultId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
