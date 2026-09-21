import { EmptyScientificPanel } from "@/components/module/EmptyScientificPanel";
import { ModuleLayout } from "@/components/module/ModuleLayout";
import { NoteForm } from "@/components/module/NoteForm";
import { CompletePdbSetupButton } from "@/components/pdb/CompletePdbSetupButton";
import { PdbIdForm } from "@/components/pdb/PdbIdForm";
import { StructureRecord } from "@/components/pdb/StructureRecord";
import type { BasilModuleDefinition } from "@/types/module";
import type { ModuleRun } from "@/types/moduleRun";
import type { Note } from "@/types/note";
import type { PdbStructure } from "@/types/structure";

export function PdbSetupModule({
  projectId,
  module,
  run,
  structure,
  notes,
}: {
  projectId: string;
  module: BasilModuleDefinition;
  run: ModuleRun | null;
  structure: PdbStructure | null;
  notes: Note[];
}) {
  return (
    <ModuleLayout module={module} run={run}>
      <PdbIdForm projectId={projectId} currentPdbId={structure?.pdbId} />
      <StructureRecord structure={structure} />
      <div className="card">
        <EmptyScientificPanel
          title="Raw results"
          message="No external scientific result has been retrieved. Phase 1 does not call RCSB or Mol*."
        />
        <EmptyScientificPanel
          title="Normalized results"
          message="No normalized structure metadata is stored yet."
        />
        <EmptyScientificPanel
          title="Interpretation"
          message="Interpretation is not generated automatically."
        />
        <EmptyScientificPanel
          title="Evidence"
          message="No active-site or computational evidence is attached to this identifier."
        />
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
        <p>
          PDB Setup is complete when a valid PDB identifier is stored. Later
          modules remain unavailable until they are implemented.
        </p>
        <CompletePdbSetupButton
          projectId={projectId}
          disabled={!structure}
        />
      </section>
    </ModuleLayout>
  );
}
