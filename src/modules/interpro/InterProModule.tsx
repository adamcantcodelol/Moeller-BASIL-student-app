import { ModuleLayout } from "@/components/module/ModuleLayout";
import { NoteForm } from "@/components/module/NoteForm";
import { UniProtForm } from "@/components/interpro/UniProtForm";
import { InterProImportForm } from "@/components/interpro/InterProImportForm";
import { InterProResults } from "@/components/interpro/InterProResults";
import { CompleteInterProButton } from "@/components/interpro/CompleteInterProButton";
import type { BasilModuleDefinition } from "@/types/module";
import type { ModuleRun } from "@/types/moduleRun";
import type { Note } from "@/types/note";
import type { InterProNormalizedAnnotation } from "@/adapters/interpro";
import type { ScientificJob } from "@/types/scientificJob";

export function InterProModule({
  projectId,
  module,
  run,
  notes,
  normalized,
  jobs,
}: {
  projectId: string;
  module: BasilModuleDefinition;
  run: ModuleRun | null;
  notes: Note[];
  normalized: InterProNormalizedAnnotation | null;
  jobs: ScientificJob[];
}) {
  const hasSuccess = jobs.some((job) => job.status === "succeeded");
  const currentAccession =
    normalized?.uniprotAccession ??
    (typeof run?.parameters?.uniprotAccession === "string"
      ? run.parameters.uniprotAccession
      : null);

  return (
    <ModuleLayout module={module} run={run}>
      <UniProtForm projectId={projectId} currentAccession={currentAccession} />
      <InterProResults normalized={normalized} jobs={jobs} />
      <InterProImportForm projectId={projectId} />
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
        <p>
          InterPro is complete when a live InterPro retrieval or a legitimate
          import has succeeded. Domain annotations are never invented by the
          platform.
        </p>
        <CompleteInterProButton
          projectId={projectId}
          disabled={!hasSuccess || run?.status === "complete"}
        />
      </section>
    </ModuleLayout>
  );
}
