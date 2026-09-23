import { ModuleLayout } from "@/components/module/ModuleLayout";
import { NoteForm } from "@/components/module/NoteForm";
import { RunDaliButton } from "@/components/dali/RunDaliButton";
import { DaliResults } from "@/components/dali/DaliResults";
import { ImportToolForm } from "@/components/import-tool/ImportToolForm";
import { CompleteImportModuleButton } from "@/components/import-tool/CompleteImportModuleButton";
import type { BasilModuleDefinition } from "@/types/module";
import type { ModuleRun } from "@/types/moduleRun";
import type { Note } from "@/types/note";
import type { DaliNormalizedSearch } from "@/adapters/dali";
import type { ScientificJob } from "@/types/scientificJob";

export function DaliModule({
  projectId,
  module,
  run,
  notes,
  normalized,
  jobs,
  pdbId,
  defaultChain,
}: {
  projectId: string;
  module: BasilModuleDefinition;
  run: ModuleRun | null;
  notes: Note[];
  normalized: DaliNormalizedSearch | null;
  jobs: ScientificJob[];
  pdbId: string | null;
  defaultChain: string | null;
}) {
  const hasSuccess = jobs.some((job) => job.status === "succeeded");
  return (
    <ModuleLayout module={module} run={run}>
      <section className="card">
        <h3>Live Dali search</h3>
        <p className="muted">
          Runs the public Dali PDB search through this app&apos;s Worker.
          Students never leave the Moeller BASIL site.
        </p>
        <RunDaliButton
          projectId={projectId}
          pdbId={pdbId}
          defaultChain={defaultChain}
        />
      </section>
      <DaliResults normalized={normalized} jobs={jobs} />
      <ImportToolForm
        projectId={projectId}
        moduleSlug="dali"
        toolName="Dali"
        instructions="Optional fallback only: if live Dali is down or still queued too long, paste a legitimate Dali summary export. Do not invent Z-scores. Prefer the Run Dali button above."
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
          moduleSlug="dali"
          label="Mark Dali complete"
          disabled={!hasSuccess || run?.status === "complete"}
          alreadyComplete={run?.status === "complete"}
        />
      </section>
    </ModuleLayout>
  );
}
