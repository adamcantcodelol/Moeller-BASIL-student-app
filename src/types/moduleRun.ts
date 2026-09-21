export const MODULE_RUN_STATUSES = [
  "not_started",
  "in_progress",
  "complete",
  "error",
  "not_available_yet",
] as const;

export type ModuleRunStatus = (typeof MODULE_RUN_STATUSES)[number];

export interface ModuleRun {
  id: string;
  projectId: string;
  moduleId: string;
  status: ModuleRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  parameters: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}
