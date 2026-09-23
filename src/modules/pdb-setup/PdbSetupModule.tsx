import { EmptyScientificPanel } from "@/components/module/EmptyScientificPanel";
import { ModuleLayout } from "@/components/module/ModuleLayout";
import { NoteForm } from "@/components/module/NoteForm";
import { CompletePdbSetupButton } from "@/components/pdb/CompletePdbSetupButton";
import { PdbIdForm } from "@/components/pdb/PdbIdForm";
import { StructureRecord } from "@/components/pdb/StructureRecord";
import { MolstarViewer } from "@/components/visualization/MolstarViewer";
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
  const rcsbReady =
    Boolean(structure?.pdbId) &&
    structure?.source === "rcsb" &&
    Boolean(structure.retrievedAt);

  return (
    <ModuleLayout module={module} run={run}>
      <PdbIdForm projectId={projectId} currentPdbId={structure?.pdbId} />
      <StructureRecord projectId={projectId} structure={structure} />
      <MolstarViewer
        pdbId={structure?.pdbId ?? ""}
        enabled={Boolean(rcsbReady && structure?.pdbId)}
      />
      <div className="card">
        {rcsbReady ? (
          <>
            <section className="empty-scientific">
              <h3>Raw / normalized results</h3>
              <p>
                RCSB entry metadata and polymer-entity records are stored on the
                module run with provenance. Active-site residues are not
                inferred from this step.
              </p>
            </section>
            <EmptyScientificPanel
              title="Interpretation"
              message="Interpretation is not generated automatically."
            />
            <EmptyScientificPanel
              title="Evidence"
              message="No active-site or computational evidence is attached yet. Later modules must supply evidence before residues can be highlighted."
            />
          </>
        ) : (
          <>
            <EmptyScientificPanel
              title="Raw results"
              message="No external scientific result has been retrieved yet. Use Retrieve metadata from RCSB after saving a PDB ID."
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
          </>
        )}
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
          PDB Setup is complete when a valid PDB identifier is stored and RCSB
          metadata has been retrieved. Later modules remain unavailable until
          they are implemented.
        </p>
        <CompletePdbSetupButton
          projectId={projectId}
          disabled={!rcsbReady}
          alreadyComplete={run?.status === "complete"}
        />
      </section>
    </ModuleLayout>
  );
}
