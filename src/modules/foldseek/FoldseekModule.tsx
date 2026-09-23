import { ModuleLayout } from "@/components/module/ModuleLayout";
import { NoteForm } from "@/components/module/NoteForm";
import { RunFoldseekButton } from "@/components/foldseek/RunFoldseekButton";
import { FoldseekResults } from "@/components/foldseek/FoldseekResults";
import { ImportToolForm } from "@/components/import-tool/ImportToolForm";
import { CompleteImportModuleButton } from "@/components/import-tool/CompleteImportModuleButton";
import type { BasilModuleDefinition } from "@/types/module";
import type { ModuleRun } from "@/types/moduleRun";
import type { Note } from "@/types/note";
import type { FoldseekNormalizedSearch } from "@/adapters/foldseek";
import type { ScientificJob } from "@/types/scientificJob";

export function FoldseekModule({
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
  normalized: FoldseekNormalizedSearch | null;
  jobs: ScientificJob[];
  pdbId: string | null;
}) {
  const hasSuccess = jobs.some((job) => job.status === "succeeded");

  return (
    <ModuleLayout module={module} run={run}>
      <section className="card">
        <h3>Live Foldseek search</h3>
        <p className="muted">
          Uses the free Foldseek Search Server API (no API key). Prefer a PDB ID
          already saved in Protein / PDB Setup.
        </p>
        <RunFoldseekButton projectId={projectId} pdbId={pdbId} />
      </section>
      <FoldseekResults normalized={normalized} jobs={jobs} />
      <ImportToolForm
        projectId={projectId}
        moduleSlug="foldseek"
        toolName="Foldseek"
        instructions="If the live Foldseek API is unavailable, export results from search.foldseek.com and import them here."
        acceptedFormats={["text", "tsv", "json"]}
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
          moduleSlug="foldseek"
          label="Mark Foldseek complete"
          disabled={!hasSuccess || run?.status === "complete"}
          alreadyComplete={run?.status === "complete"}
        />
      </section>
    </ModuleLayout>
  );
}
