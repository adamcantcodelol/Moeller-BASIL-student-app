import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { DemoBanner } from "@/components/demo/DemoBanner";
import {
  PipelineStepList,
  StartAnalysisButton,
} from "@/components/pipeline/StartAnalysisButton";
import { getProjectPageDatabase } from "@/lib/db/request";
import { getProjectOverview, ServiceError } from "@/lib/services/projectService";
import { getPipelineStatus } from "@/lib/services/pipelineService";

export const dynamic = "force-dynamic";

export default async function AnalysisProgressPage({
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
      <section className="card">
        <h1>Analysis progress</h1>
        <p className="muted">
          Client-driven ticks advance one live tool at a time under Worker
          request limits (same pattern as SPRITE poll).
        </p>
        <div className="mode-row">
          <Link href={`/projects/${projectId}`}>Project overview</Link>
          <Link href={`/projects/${projectId}/results`}>Results</Link>
          <Link href={`/projects/${projectId}/hypothesis`}>Hypothesis</Link>
        </div>
      </section>
      <StartAnalysisButton
        projectId={projectId}
        initialPipeline={pipeline}
        rcsbReady={rcsbReady}
      />
      {pipeline ? (
        <section className="card">
          <h2>Step detail</h2>
          <PipelineStepList pipeline={pipeline} projectId={projectId} />
        </section>
      ) : null}
    </AppShell>
  );
}
