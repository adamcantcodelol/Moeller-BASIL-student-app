import { ModuleLayout } from "@/components/module/ModuleLayout";
import { NoteForm } from "@/components/module/NoteForm";
import { EvidenceForm } from "@/components/evidence/EvidenceForm";
import { EvidenceList } from "@/components/evidence/EvidenceList";
import { ChimeraXPanel } from "@/components/evidence/ChimeraXPanel";
import { MolstarViewer } from "@/components/visualization/MolstarViewer";
import { CompleteImportModuleButton } from "@/components/import-tool/CompleteImportModuleButton";
import type { BasilModuleDefinition } from "@/types/module";
import type { ModuleRun } from "@/types/moduleRun";
import type { Note } from "@/types/note";
import type { Evidence, EvidenceResidue } from "@/types/evidence";
import type { ChimeraXCommandSet } from "@/lib/chimerax/generateCommands";

export function ActiveSiteEvidenceModule({
  projectId,
  module,
  run,
  notes,
  evidence,
  residues,
  chimerax,
  pdbId,
  comparisonPdbId = null,
}: {
  projectId: string;
  module: BasilModuleDefinition;
  run: ModuleRun | null;
  notes: Note[];
  evidence: Evidence[];
  residues: EvidenceResidue[];
  chimerax: ChimeraXCommandSet | null;
  pdbId: string | null;
  comparisonPdbId?: string | null;
}) {
  const rcsbReady = Boolean(pdbId);

  return (
    <ModuleLayout module={module} run={run}>
      <section className="card">
        <h3>How this works</h3>
        <p>
          Combine observations from earlier modules into candidate residues.
          Every residue must be entered by you from real module evidence. The
          platform never invents active-site positions.
        </p>
      </section>
      <EvidenceForm projectId={projectId} />
      <EvidenceList projectId={projectId} items={evidence} />
      <ChimeraXPanel commands={chimerax} />
      <MolstarViewer
        pdbId={pdbId ?? ""}
        enabled={Boolean(rcsbReady && pdbId)}
        mode="active-site"
        comparisonPdbId={comparisonPdbId}
        evidenceResidues={residues}
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
          moduleSlug="active-site-evidence"
          label="Mark Active-Site Evidence complete"
          disabled={evidence.length === 0 || run?.status === "complete"}
          alreadyComplete={run?.status === "complete"}
        />
      </section>
    </ModuleLayout>
  );
}
