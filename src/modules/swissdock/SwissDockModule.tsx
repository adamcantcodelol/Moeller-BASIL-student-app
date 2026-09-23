import { ModuleLayout } from "@/components/module/ModuleLayout";
import { NoteForm } from "@/components/module/NoteForm";
import { RunSwissDockButton } from "@/components/swissdock/RunSwissDockButton";
import { SwissDockResults } from "@/components/swissdock/SwissDockResults";
import { ImportToolForm } from "@/components/import-tool/ImportToolForm";
import { CompleteImportModuleButton } from "@/components/import-tool/CompleteImportModuleButton";
import type { BasilModuleDefinition } from "@/types/module";
import type { ModuleRun } from "@/types/moduleRun";
import type { Note } from "@/types/note";
import type { SwissDockNormalizedSearch } from "@/adapters/swissdock";
import type { ScientificJob } from "@/types/scientificJob";

export function SwissDockModule({
  projectId,
  module,
  run,
  notes,
  normalized,
  jobs,
  pdbId,
}: {
  projectId: string;
  module: BasilModuleDefinition;
  run: ModuleRun | null;
  notes: Note[];
  normalized: SwissDockNormalizedSearch | null;
  jobs: ScientificJob[];
  pdbId: string | null;
}) {
  const hasSuccess = jobs.some((job) => job.status === "succeeded");
  return (
    <ModuleLayout module={module} run={run}>
      <section className="card">
        <h3>Live SwissDock (Vina)</h3>
        <p className="muted">
          Runs SwissDock through this app&apos;s Worker from your project PDB.
          Ligand SMILES and box center come from HETATM + RCSB chemcomp when
          present — nothing is invented. Docking stays distinct from
          experimental structures.
        </p>
        <RunSwissDockButton projectId={projectId} pdbId={pdbId} />
      </section>
      <SwissDockResults normalized={normalized} jobs={jobs} />
      <ImportToolForm
        projectId={projectId}
        moduleSlug="swissdock"
        toolName="SwissDock"
        instructions="Optional fallback only: if live SwissDock (:8443) is unreachable, import a legitimate SwissDock export. Prefer the Run button above."
        acceptedFormats={["text", "json"]}
      />
      <section className="card">
        <h3>Student observations</h3>
        {notes.length === 0 ? (
          <p className="muted">No observations yet.</p>
        ) : (
          notes.map((note) => (
            <p key={note.id}>
              <span className="muted">{note.createdAt}</span>
              <br />
              {note.content}
            </p>
          ))
        )}
        <NoteForm projectId={projectId} moduleId={module.id} />
      </section>
      <section className="card">
        <h3>Completion</h3>
        <CompleteImportModuleButton
          projectId={projectId}
          moduleSlug="swissdock"
          label="Mark SwissDock complete"
          disabled={!hasSuccess || run?.status === "complete"}
          alreadyComplete={run?.status === "complete"}
        />
      </section>
    </ModuleLayout>
  );
}
