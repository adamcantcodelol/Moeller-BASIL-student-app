import { ModuleLayout } from "@/components/module/ModuleLayout";
import { NoteForm } from "@/components/module/NoteForm";
import { EmptyScientificPanel } from "@/components/module/EmptyScientificPanel";
import { ImportToolForm } from "@/components/import-tool/ImportToolForm";
import { CompleteImportModuleButton } from "@/components/import-tool/CompleteImportModuleButton";
import type { BasilModuleDefinition } from "@/types/module";
import type { ModuleRun } from "@/types/moduleRun";
import type { Note } from "@/types/note";
import type { ScientificJob } from "@/types/scientificJob";
import type { ImportFormat } from "@/types/importWorkflow";

export function ImportToolModule({
  projectId,
  module,
  run,
  notes,
  jobs,
  toolName,
  instructions,
  acceptedFormats,
  verificationNote,
}: {
  projectId: string;
  module: BasilModuleDefinition;
  run: ModuleRun | null;
  notes: Note[];
  jobs: ScientificJob[];
  toolName: string;
  instructions: string;
  acceptedFormats: readonly ImportFormat[];
  verificationNote: string;
}) {
  const hasSuccess = jobs.some((job) => job.status === "succeeded");
  const latestJob = jobs[0] ?? null;

  return (
    <ModuleLayout module={module} run={run}>
      <section className="card">
        <h3>Automation status</h3>
        <p className="muted">{verificationNote}</p>
      </section>
      <ImportToolForm
        projectId={projectId}
        moduleSlug={module.slug}
        toolName={toolName}
        instructions={instructions}
        acceptedFormats={acceptedFormats}
      />
      <div className="card">
        <EmptyScientificPanel
          title="Normalized results"
          message={`Live normalized ${toolName} parsing is limited in this phase. Imported raw output is stored with provenance source=import. The platform will not invent hits.`}
        />
        {latestJob?.status === "failed" && latestJob.error ? (
          <p className="error">Last job failed: {latestJob.error}</p>
        ) : null}
        {hasSuccess ? (
          <p className="muted">
            At least one successful import job is on record for this module.
          </p>
        ) : null}
      </div>
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
          moduleSlug={module.slug}
          label={`Mark ${toolName} complete`}
          disabled={!hasSuccess || run?.status === "complete"}
        />
      </section>
    </ModuleLayout>
  );
}
