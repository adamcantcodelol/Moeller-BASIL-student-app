import { ModuleLayout } from "@/components/module/ModuleLayout";
import { NoteForm } from "@/components/module/NoteForm";
import { HypothesisForm } from "@/components/hypothesis/HypothesisForm";
import { CompleteImportModuleButton } from "@/components/import-tool/CompleteImportModuleButton";
import type { BasilModuleDefinition } from "@/types/module";
import type { ModuleRun } from "@/types/moduleRun";
import type { Note } from "@/types/note";
import type { Evidence } from "@/types/evidence";
import type { Hypothesis, HypothesisReview, HypothesisVersion } from "@/types/hypothesis";

export function HypothesisBuilderModule({
  projectId,
  module,
  run,
  notes,
  hypothesis,
  versions,
  review,
  evidence,
}: {
  projectId: string;
  module: BasilModuleDefinition;
  run: ModuleRun | null;
  notes: Note[];
  hypothesis: Hypothesis | null;
  versions: HypothesisVersion[];
  review: HypothesisReview | null;
  evidence: Evidence[];
}) {
  return (
    <ModuleLayout module={module} run={run}>
      <section className="card">
        <h3>Evidence available to cite</h3>
        {evidence.length === 0 ? (
          <p className="muted">
            No evidence residues yet. Complete Active-Site Evidence Synthesis
            first so your hypothesis can reference real residues you recorded.
          </p>
        ) : (
          <ul>
            {evidence.map((item) => (
              <li key={item.id}>
                {item.sourceModuleId}: {item.description} (
                {item.residues
                  ?.map((residue) => `${residue.chain ?? ""}:${residue.position}`)
                  .join(", ")}
                )
              </li>
            ))}
          </ul>
        )}
      </section>
      <HypothesisForm
        projectId={projectId}
        initialText={hypothesis?.text ?? ""}
        initialReview={review}
      />
      {versions.length > 0 ? (
        <section className="card">
          <h3>Version history</h3>
          {versions.map((version) => (
            <p key={version.id}>
              <span className="muted">
                {version.createdAt}
                {version.reasonForChange ? ` — ${version.reasonForChange}` : ""}
              </span>
              <br />
              {version.text}
            </p>
          ))}
        </section>
      ) : null}
      <section className="card">
        <h3>Student observations</h3>
        <NoteForm projectId={projectId} moduleId={module.id} />
        {notes.map((note) => (
          <p key={note.id}>
            <span className="muted">{note.createdAt}</span>
            <br />
            {note.content}
          </p>
        ))}
      </section>
      <section className="card">
        <h3>Completion</h3>
        <CompleteImportModuleButton
          projectId={projectId}
          moduleSlug="hypothesis-builder"
          label="Mark Hypothesis Builder complete"
          disabled={!hypothesis || run?.status === "complete"}
        />
      </section>
    </ModuleLayout>
  );
}
