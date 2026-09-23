import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { ModuleCardList } from "@/components/project/ModuleCard";
import { ProjectStatus } from "@/components/project/ProjectStatus";
import { StartAnalysisButton } from "@/components/pipeline/StartAnalysisButton";
import { getRequestDatabase } from "@/lib/db/request";
import { getProjectOverview, ServiceError } from "@/lib/services/projectService";
import { getPipelineStatus } from "@/lib/services/pipelineService";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const db = await getRequestDatabase();
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
        <h2>Classroom path</h2>
        <ol className="classroom-path-list">
          <li>
            <Link href={`/projects/${projectId}/modules/pdb-setup`}>
              1. PDB setup (RCSB)
            </Link>
          </li>
          <li>
            <Link href={`/projects/${projectId}/analysis`}>
              2. Analysis progress
            </Link>
          </li>
          <li>
            <Link href={`/projects/${projectId}/results`}>3. Results</Link>
          </li>
          <li>
            <Link href={`/projects/${projectId}/hypothesis`}>
              4. Hypothesis + ShannonBot
            </Link>
          </li>
        </ol>
      </section>
      <StartAnalysisButton
        projectId={projectId}
        initialPipeline={pipeline}
        rcsbReady={rcsbReady}
      />
      <section className="card">
        <h2>Curriculum modules</h2>
        <p className="muted">
          Optional deep dives — the classroom path above runs the live tools in
          order.
        </p>
        <ModuleCardList
          projectId={projectId}
          moduleRuns={overview.moduleRuns}
        />
      </section>
    </AppShell>
  );
}
