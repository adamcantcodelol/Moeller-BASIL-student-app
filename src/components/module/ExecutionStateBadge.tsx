import type { ModuleRunStatus } from "@/types/moduleRun";

export function ExecutionStateBadge({ status }: { status: ModuleRunStatus }) {
  return <span className={`badge ${status}`}>{status.replaceAll("_", " ")}</span>;
}
