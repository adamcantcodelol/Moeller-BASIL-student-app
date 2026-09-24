import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { ResultsSections } from "@/components/results/ResultsSections";
import { getProjectPageDatabase } from "@/lib/db/request";
import { getProjectOverview, ServiceError } from "@/lib/services/projectService";
import { getProjectResultsSections } from "@/lib/services/pipelineService";

export const dynamic = "force-dynamic";

export default async function ResultsPage({
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
  const { pipeline, sections } = await getProjectResultsSections(db, projectId);
  const hasSequence = Boolean(
    overview.structure?.sequence &&
      overview.structure.sequence.replace(/[^A-Za-z]/g, "").length >= 10,
  );

  return (
    <AppShell projectId={projectId} moduleRuns={overview.moduleRuns}>
      <DemoBanner show={overview.project.isDemo} />
      <section className="card">
        <h1>Results</h1>
        <p className="muted">
          One page of stored scientific outputs with provenance. Empty, skipped,
          and failed sections say so honestly — nothing is invented.
        </p>
        <p>
          Pipeline:{" "}
          {pipeline
            ? `${pipeline.status} · step ${Math.min(pipeline.currentStepIndex + 1, pipeline.steps.length)}/${pipeline.steps.length}`
            : "not started"}
        </p>
        <div className="mode-row">
          <Link href={`/projects/${projectId}`}>Project overview</Link>
          <Link href={`/projects/${projectId}/analysis`}>Analysis progress</Link>
          <Link href={`/projects/${projectId}/hypothesis`}>
            Continue to Hypothesis
          </Link>
        </div>
      </section>
      <ResultsSections
        projectId={projectId}
        sections={sections}
        hasSequence={hasSequence}
      />
    </AppShell>
  );
}
