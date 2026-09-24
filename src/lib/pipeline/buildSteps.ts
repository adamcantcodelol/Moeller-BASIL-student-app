import {
  PIPELINE_STEP_ORDER,
  PIPELINE_TOOL_LABELS,
  type PipelineStep,
  type PipelineTool,
} from "@/types/pipeline";

/**
 * Build the canonical classroom step list.
 * Skip / unavailable decisions (InterPro / CLEAN / SwissDock) are applied at tick time
 * from live project context — never invent prerequisites.
 */
export function buildInitialPipelineSteps(
  tools: readonly PipelineTool[] = PIPELINE_STEP_ORDER,
): PipelineStep[] {
  return tools.map((tool) => ({
    tool,
    label: PIPELINE_TOOL_LABELS[tool],
    status: "pending",
    jobId: null,
    skipReason: null,
    error: null,
    summary: null,
    startedAt: null,
    finishedAt: null,
  }));
}

export function isTerminalStepStatus(status: PipelineStep["status"]): boolean {
  return (
    status === "succeeded" ||
    status === "failed" ||
    status === "skipped" ||
    status === "unavailable"
  );
}

export function findActiveStepIndex(steps: PipelineStep[]): number {
  const idx = steps.findIndex((step) => !isTerminalStepStatus(step.status));
  return idx === -1 ? steps.length : idx;
}

export function summarizePipelineOutcome(steps: PipelineStep[]): {
  status: "completed" | "failed";
  allSkippedOrFailed: boolean;
} {
  const anySucceeded = steps.some((s) => s.status === "succeeded");
  const anyFailed = steps.some((s) => s.status === "failed");
  if (anySucceeded || !anyFailed) {
    return { status: "completed", allSkippedOrFailed: !anySucceeded };
  }
  return { status: "failed", allSkippedOrFailed: true };
}
