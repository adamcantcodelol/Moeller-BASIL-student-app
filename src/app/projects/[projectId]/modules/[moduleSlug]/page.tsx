import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { getRequestDatabase } from "@/lib/db/request";
import { getProjectOverview, ServiceError } from "@/lib/services/projectService";
import { listNotesForModule } from "@/lib/services/noteService";
import { getModuleBySlug, PDB_SETUP_MODULE_ID } from "@/modules/registry";
import { PdbSetupModule } from "@/modules/pdb-setup/PdbSetupModule";
import { UnavailableModule } from "@/modules/placeholders/UnavailableModule";

export const dynamic = "force-dynamic";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ projectId: string; moduleSlug: string }>;
}) {
  const { projectId, moduleSlug } = await params;
  const definition = getModuleBySlug(moduleSlug);
  if (!definition) {
    notFound();
  }

  const db = await getRequestDatabase();
  const overview = await getProjectOverview(db, projectId).catch((error: unknown) => {
    if (error instanceof ServiceError && error.status === 404) {
      notFound();
    }
    throw error;
  });
  const run =
    overview.moduleRuns.find((item) => item.moduleId === definition.id) ?? null;
  const notes = await listNotesForModule(db, projectId, definition.id);

  return (
    <AppShell projectId={projectId} moduleRuns={overview.moduleRuns}>
      <DemoBanner show={overview.project.isDemo} />
      {definition.id === PDB_SETUP_MODULE_ID ? (
        <PdbSetupModule
          projectId={projectId}
          module={definition}
          run={run}
          structure={overview.structure}
          notes={notes}
        />
      ) : (
        <UnavailableModule
          projectId={projectId}
          module={definition}
          run={run}
          notes={notes}
        />
      )}
    </AppShell>
  );
}
