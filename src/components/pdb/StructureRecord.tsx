import type { PdbStructure } from "@/types/structure";
import { EmptyScientificPanel } from "@/components/module/EmptyScientificPanel";

export function StructureRecord({ structure }: { structure: PdbStructure | null }) {
  if (!structure) {
    return (
      <EmptyScientificPanel
        title="Structure record"
        message="No PDB identifier has been saved for this project."
      />
    );
  }

  return (
    <section className="card">
      <h3>Structure record</h3>
      <p>
        <strong>PDB ID:</strong> {structure.pdbId}
      </p>
      <p>
        <strong>Source:</strong> {structure.source}
      </p>
      <p className="muted">
        Title, organism, chains, sequence, and retrieved metadata are empty until
        a later phase performs a verified fetch. Empty fields are not filled with
        guessed values. Mol* is not loaded in Phase 1.
      </p>
      <dl>
        <dt>Title</dt>
        <dd>{structure.title ?? "not retrieved"}</dd>
        <dt>Organism</dt>
        <dd>{structure.organism ?? "not retrieved"}</dd>
        <dt>Chains</dt>
        <dd>{structure.chains ? structure.chains.join(", ") : "not retrieved"}</dd>
        <dt>Sequence</dt>
        <dd>{structure.sequence ?? "not retrieved"}</dd>
        <dt>Retrieved at</dt>
        <dd>{structure.retrievedAt ?? "not retrieved"}</dd>
      </dl>
    </section>
  );
}
