import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { ModuleCardList } from "@/components/project/ModuleCard";
import { ProjectStatus } from "@/components/project/ProjectStatus";
import { StartAnalysisButton } from "@/components/pipeline/StartAnalysisButton";
import { getProjectPageDatabase } from "@/lib/db/request";
import { getProjectOverview, ServiceError } from "@/lib/services/projectService";
import { getPipelineStatus } from "@/lib/services/pipelineService";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const db = await getProjectPageDatabase(projectId);
  const overview = await getProjectOverview(db, projectId).catch(
    (error: unknown) => {
      if (error instanceof ServiceError && error.status === 404) {
        notFound();
      }
      throw error;
    },
  );
  const pipeline = await getPipelineStatus(db, projectId);
  const rcsbReady =
    overview.structure?.source === "rcsb" &&
    Boolean(overview.structure.pdbId);

  return (
    <AppShell projectId={projectId} moduleRuns={overview.moduleRuns}>
      <DemoBanner show={overview.project.isDemo} />
      <ProjectStatus
        project={overview.project}
        structure={overview.structure}
      />
      <section className="card classroom-path">
        <h2>Your path (4 steps)</h2>
        <ol className="classroom-path-list classroom-path-numbered">
          <li>
            <span className="path-step-num">1</span>
            <div>
              <Link href={`/projects/${projectId}/modules/pdb-setup`}>
                Enter PDB
              </Link>
              <p className="muted path-hint">Load your protein from RCSB</p>
            </div>
          </li>
          <li>
            <span className="path-step-num">2</span>
            <div>
              <Link href={`/projects/${projectId}/analysis`}>
                Run analysis
              </Link>
              <p className="muted path-hint">
                One button runs the live tools on this site
              </p>
            </div>
          </li>
          <li>
            <span className="path-step-num">3</span>
            <div>
              <Link href={`/projects/${projectId}/results`}>Results</Link>
              <p className="muted path-hint">
                See SPRITE pairs, BLAST hits, and more
              </p>
            </div>
          </li>
          <li>
            <span className="path-step-num">4</span>
            <div>
              <Link href={`/projects/${projectId}/hypothesis`}>
                Hypothesis
              </Link>
              <p className="muted path-hint">
                Write your claim + chat with ShannonBot
              </p>
            </div>
          </li>
        </ol>
      </section>
      <StartAnalysisButton
        projectId={projectId}
        initialPipeline={pipeline}
        rcsbReady={rcsbReady}
      />
      <section className="card">
        <details className="all-modules-details">
          <summary>All modules (optional deep dives)</summary>
          <p className="muted">
            The classroom path above is enough for class. Open a module only if
            you need a closer look or an import fallback.
          </p>
          <ModuleCardList
            projectId={projectId}
            moduleRuns={overview.moduleRuns}
          />
        </details>
      </section>
    </AppShell>
  );
}
