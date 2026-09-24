import { ModuleLayout } from "@/components/module/ModuleLayout";
import { NoteForm } from "@/components/module/NoteForm";
import { RunCleanButton } from "@/components/clean/RunCleanButton";
import { CleanResults } from "@/components/clean/CleanResults";
import { ImportToolForm } from "@/components/import-tool/ImportToolForm";
import { CompleteImportModuleButton } from "@/components/import-tool/CompleteImportModuleButton";
import type { BasilModuleDefinition } from "@/types/module";
import type { ModuleRun } from "@/types/moduleRun";
import type { Note } from "@/types/note";
import type { CleanNormalizedResult } from "@/adapters/clean";
import type { ScientificJob } from "@/types/scientificJob";

export function CleanModule({
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
  normalized: CleanNormalizedResult | null;
  jobs: ScientificJob[];
  hasSequence: boolean;
}) {
  const hasSuccess = jobs.some((job) => job.status === "succeeded");
  return (
    <ModuleLayout module={module} run={run}>
      <section className="card">
        <h3>Live CLEAN prediction</h3>
        <p className="muted">
          Sends your protein&apos;s RCSB sequence to the public CLEAN server
          (UIUC MoleculeMaker) through this app&apos;s Cloudflare Worker. The
          app checks the server first; if it can&apos;t return results right
          now you&apos;ll see that immediately. No EC numbers are ever
          invented.
        </p>
        <RunCleanButton projectId={projectId} hasSequence={hasSequence} />
      </section>
      <CleanResults normalized={normalized} jobs={jobs} />
      <ImportToolForm
        projectId={projectId}
        moduleSlug="clean"
        toolName="CLEAN"
        instructions="Fallback: if live CLEAN is unavailable, run CLEAN elsewhere (clean.platform.ibiofoundry.illinois.edu or the CLEAN GitHub code) and paste/upload its maxsep CSV, e.g. `MyProtein,EC:4.2.1.1/0.9866`. Do not paste invented EC numbers."
        acceptedFormats={["csv", "text", "tsv", "json"]}
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
          moduleSlug="clean"
          label="Mark CLEAN complete"
          disabled={!hasSuccess || run?.status === "complete"}
          alreadyComplete={run?.status === "complete"}
        />
      </section>
    </ModuleLayout>
  );
}
