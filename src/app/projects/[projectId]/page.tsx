import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { ModuleCardList } from "@/components/project/ModuleCard";
import { ProjectStatus } from "@/components/project/ProjectStatus";
import { getRequestDatabase } from "@/lib/db/request";
import { getProjectOverview, ServiceError } from "@/lib/services/projectService";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const db = await getRequestDatabase();
  const overview = await getProjectOverview(db, projectId).catch((error: unknown) => {
    if (error instanceof ServiceError && error.status === 404) {
      notFound();
    }
    throw error;
  });

  return (
    <AppShell projectId={projectId} moduleRuns={overview.moduleRuns}>
      <DemoBanner show={overview.project.isDemo} />
      <ProjectStatus
        project={overview.project}
        structure={overview.structure}
      />
      <section className="card">
        <h2>Modules</h2>
        <ModuleCardList
          projectId={projectId}
          moduleRuns={overview.moduleRuns}
        />
      </section>
    </AppShell>
  );
}
