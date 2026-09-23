export const PIPELINE_TOOLS = [
  "sprite",
  "blast",
  "foldseek",
  "dali",
  "interpro",
  "clean",
  "swissdock",
] as const;

export type PipelineTool = (typeof PIPELINE_TOOLS)[number];

export const PIPELINE_STEP_STATUSES = [
  "pending",
  "running",
  "succeeded",
  "failed",
  "skipped",
] as const;

export type PipelineStepStatus = (typeof PIPELINE_STEP_STATUSES)[number];

export const PIPELINE_STATUSES = [
  "idle",
  "running",
  "completed",
  "failed",
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export interface PipelineStep {
  tool: PipelineTool;
  label: string;
  status: PipelineStepStatus;
  jobId: string | null;
  skipReason: string | null;
  error: string | null;
  summary: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface AnalysisPipeline {
  id: string;
  projectId: string;
  status: PipelineStatus;
  currentStepIndex: number;
  steps: PipelineStep[];
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Canonical classroom auto-run order. */
export const PIPELINE_STEP_ORDER: readonly PipelineTool[] = [
  "sprite",
  "blast",
  "foldseek",
  "dali",
  "interpro",
  "clean",
  "swissdock",
] as const;

export const PIPELINE_TOOL_LABELS: Record<PipelineTool, string> = {
  sprite: "SPRITE",
  blast: "BLAST",
  foldseek: "Foldseek",
  dali: "Dali",
  interpro: "InterPro",
  clean: "CLEAN",
  swissdock: "SwissDock",
};

export const PIPELINE_MODULE_SLUGS: Record<PipelineTool, string> = {
  sprite: "sprite",
  blast: "blast",
  foldseek: "foldseek",
  dali: "dali",
  interpro: "interpro",
  clean: "clean",
  swissdock: "swissdock",
};
