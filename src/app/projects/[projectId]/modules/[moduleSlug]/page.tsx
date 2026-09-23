import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { getRequestDatabase } from "@/lib/db/request";
import { getProjectOverview, ServiceError } from "@/lib/services/projectService";
import { listNotesForModule } from "@/lib/services/noteService";
import { listInterProResults } from "@/lib/services/interproService";
import { listFoldseekResults } from "@/lib/services/foldseekService";
import { listModuleJobs } from "@/lib/services/importToolService";
import {
  collectUniqueResidues,
  listEvidenceForProject,
} from "@/lib/services/evidenceService";
import { generateChimeraXCommands } from "@/lib/chimerax/generateCommands";
import { getModuleBySlug, PDB_SETUP_MODULE_ID } from "@/modules/registry";
import { PdbSetupModule } from "@/modules/pdb-setup/PdbSetupModule";
import { InterProModule } from "@/modules/interpro/InterProModule";
import { FoldseekModule } from "@/modules/foldseek/FoldseekModule";
import { ImportToolModule } from "@/modules/import-tool/ImportToolModule";
import { ActiveSiteEvidenceModule } from "@/modules/active-site-evidence/ActiveSiteEvidenceModule";
import { IMPORT_MODULE_CONFIG } from "@/modules/import-tool/verificationNotes";
import { UnavailableModule } from "@/modules/placeholders/UnavailableModule";
import { getImportWorkflowForTool } from "@/adapters/registry";

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

  let body;
  if (definition.id === PDB_SETUP_MODULE_ID) {
    body = (
      <PdbSetupModule
        projectId={projectId}
        module={definition}
        run={run}
        structure={overview.structure}
        notes={notes}
      />
    );
  } else if (definition.id === "interpro") {
    const interpro = await listInterProResults(db, projectId);
    body = (
      <InterProModule
        projectId={projectId}
        module={definition}
        run={run}
        notes={notes}
        normalized={interpro.latestNormalized}
        jobs={interpro.jobs}
      />
    );
  } else if (definition.id === "foldseek") {
    const foldseek = await listFoldseekResults(db, projectId);
    body = (
      <FoldseekModule
        projectId={projectId}
        module={definition}
        run={run}
        notes={notes}
        normalized={foldseek.latestNormalized}
        jobs={foldseek.jobs}
        pdbId={overview.structure?.pdbId ?? null}
      />
    );
  } else if (definition.id === "active-site-evidence") {
    const evidence = await listEvidenceForProject(db, projectId);
    const residues = collectUniqueResidues(evidence);
    const chimerax = overview.structure
      ? generateChimeraXCommands({
          pdbId: overview.structure.pdbId,
          residues,
        })
      : null;
    body = (
      <ActiveSiteEvidenceModule
        projectId={projectId}
        module={definition}
        run={run}
        notes={notes}
        evidence={evidence}
        residues={residues}
        chimerax={chimerax}
        pdbId={overview.structure?.pdbId ?? null}
      />
    );
  } else if (definition.id in IMPORT_MODULE_CONFIG) {
    const config = IMPORT_MODULE_CONFIG[definition.id]!;
    const workflow = getImportWorkflowForTool(definition.id);
    const jobs = await listModuleJobs(db, projectId, definition.slug);
    body = (
      <ImportToolModule
        projectId={projectId}
        module={definition}
        run={run}
        notes={notes}
        jobs={jobs}
        toolName={config.toolName}
        instructions={workflow?.instructions ?? config.instructions}
        acceptedFormats={
          workflow?.acceptedFormats ?? config.acceptedFormats
        }
        verificationNote={config.verificationNote}
      />
    );
  } else {
    body = (
      <UnavailableModule
        projectId={projectId}
        module={definition}
        run={run}
        notes={notes}
      />
    );
  }

  return (
    <AppShell projectId={projectId} moduleRuns={overview.moduleRuns}>
      <DemoBanner show={overview.project.isDemo} />
      {body}
    </AppShell>
  );
}
