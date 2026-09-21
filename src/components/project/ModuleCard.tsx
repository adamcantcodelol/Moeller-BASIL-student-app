import Link from "next/link";
import { CURRICULUM_MODULES } from "@/modules/registry";
import { ExecutionStateBadge } from "@/components/module/ExecutionStateBadge";
import type { ModuleRun } from "@/types/moduleRun";

export function ModuleCardList({
  projectId,
  moduleRuns,
}: {
  projectId: string;
  moduleRuns: ModuleRun[];
}) {
  return (
    <div className="project-grid">
      {CURRICULUM_MODULES.map((module) => {
        const run = moduleRuns.find((item) => item.moduleId === module.id);
        return (
          <Link
            key={module.id}
            href={`/projects/${projectId}/modules/${module.slug}`}
            className="card"
          >
            <h3>
              {module.number} {module.name}
            </h3>
            <p>{module.description}</p>
            {run ? <ExecutionStateBadge status={run.status} /> : null}
          </Link>
        );
      })}
    </div>
  );
}
