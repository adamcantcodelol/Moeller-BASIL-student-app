import Link from "next/link";
import { CURRICULUM_MODULES } from "@/modules/registry";
import type { ModuleRun } from "@/types/moduleRun";

export function ModuleNav({
  projectId,
  moduleRuns,
}: {
  projectId?: string;
  moduleRuns?: ModuleRun[];
}) {
  return (
    <nav className="module-nav" aria-label="BASIL navigation">
      {projectId ? (
        <>
          <h2>Classroom path</h2>
          <ol className="classroom-nav">
            <li>
              <Link href={`/projects/${projectId}`}>Overview</Link>
            </li>
            <li>
              <Link href={`/projects/${projectId}/modules/pdb-setup`}>
                PDB / RCSB
              </Link>
            </li>
            <li>
              <Link href={`/projects/${projectId}/analysis`}>
                Analysis progress
              </Link>
            </li>
            <li>
              <Link href={`/projects/${projectId}/results`}>Results</Link>
            </li>
            <li>
              <Link href={`/projects/${projectId}/hypothesis`}>
                Hypothesis
              </Link>
            </li>
          </ol>
        </>
      ) : null}
      <h2>Curriculum 00–11</h2>
      <ol className="curriculum-nav">
        {CURRICULUM_MODULES.map((module) => {
          const run = moduleRuns?.find((item) => item.moduleId === module.id);
          const href = projectId
            ? `/projects/${projectId}/modules/${module.slug}`
            : undefined;
          const label = `${module.number} ${module.name}`;
          return (
            <li key={module.id}>
              {href ? (
                <Link href={href}>
                  {label}
                  {run ? ` · ${run.status.replaceAll("_", " ")}` : ""}
                </Link>
              ) : (
                <span className={module.implemented ? undefined : "unavailable"}>
                  {label}
                  {module.implemented ? "" : " · later phase"}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
