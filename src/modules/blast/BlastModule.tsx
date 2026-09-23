import { ModuleLayout } from "@/components/module/ModuleLayout";
import { NoteForm } from "@/components/module/NoteForm";
import { RunBlastButton } from "@/components/blast/RunBlastButton";
import { BlastResults } from "@/components/blast/BlastResults";
import { ImportToolForm } from "@/components/import-tool/ImportToolForm";
import { CompleteImportModuleButton } from "@/components/import-tool/CompleteImportModuleButton";
import type { BasilModuleDefinition } from "@/types/module";
import type { ModuleRun } from "@/types/moduleRun";
import type { Note } from "@/types/note";
import type { BlastNormalizedSearch } from "@/adapters/blast";
import type { ScientificJob } from "@/types/scientificJob";

export function BlastModule({
  projectId,
  module,
  run,
  notes,
  normalized,
  jobs,
  hasSequence,
}: {
  projectId: string;
  module: BasilModuleDefinition;
  run: ModuleRun | null;
  notes: Note[];
  normalized: BlastNormalizedSearch | null;
  jobs: ScientificJob[];
  hasSequence: boolean;
}) {
  const hasSuccess = jobs.some((job) => job.status === "succeeded");

  return (
    <ModuleLayout module={module} run={run}>
      <section className="card">
        <h3>Live BLAST search</h3>
        <p className="muted">
          Runs NCBI blastp through this app&apos;s Cloudflare Worker. Students
          never leave the Moeller BASIL site. Default database is{" "}
          <code>swissprot</code> (faster for class); switch to{" "}
          <code>pdbaa</code>, <code>refseq_protein</code>, or <code>nr</code> if
          needed.
        </p>
        <RunBlastButton projectId={projectId} hasSequence={hasSequence} />
      </section>
      <BlastResults normalized={normalized} jobs={jobs} />
      <ImportToolForm
        projectId={projectId}
        moduleSlug="blast"
        toolName="BLAST"
        instructions="Optional fallback only: if live NCBI BLAST is down, paste or upload a legitimate BLAST export (Text/JSON/XML/TSV). Do not paste fabricated hits. Prefer the Run BLAST button above so students never open blast.ncbi.nlm.nih.gov."
        acceptedFormats={["text", "json", "xml", "tsv"]}
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
          moduleSlug="blast"
          label="Mark BLAST complete"
          disabled={!hasSuccess || run?.status === "complete"}
          alreadyComplete={run?.status === "complete"}
        />
      </section>
    </ModuleLayout>
  );
}
