import { ModuleLayout } from "@/components/module/ModuleLayout";
import { NoteForm } from "@/components/module/NoteForm";
import type { BasilModuleDefinition } from "@/types/module";
import type { ModuleRun } from "@/types/moduleRun";
import type { Note } from "@/types/note";

export function UnavailableModule({
  projectId,
  module,
  run,
  notes,
}: {
  projectId: string;
  module: BasilModuleDefinition;
  run: ModuleRun | null;
  notes: Note[];
}) {
  return (
    <ModuleLayout module={module} run={run}>
      <section className="card">
        <h3>Inputs</h3>
        <p className="muted">
          This module cannot be executed yet. No API has been invented for it.
        </p>
      </section>
      <section className="card">
        <h3>Student observations</h3>
        {notes.map((note) => (
          <p key={note.id}>{note.content}</p>
        ))}
        <NoteForm projectId={projectId} moduleId={module.id} />
      </section>
    </ModuleLayout>
  );
}
