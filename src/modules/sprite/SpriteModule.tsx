import { ModuleLayout } from "@/components/module/ModuleLayout";
import { NoteForm } from "@/components/module/NoteForm";
import { RunSpriteButton } from "@/components/sprite/RunSpriteButton";
import { SpriteResults } from "@/components/sprite/SpriteResults";
import { ImportToolForm } from "@/components/import-tool/ImportToolForm";
import { CompleteImportModuleButton } from "@/components/import-tool/CompleteImportModuleButton";
import type { BasilModuleDefinition } from "@/types/module";
import type { ModuleRun } from "@/types/moduleRun";
import type { Note } from "@/types/note";
import type { SpriteNormalizedSearch } from "@/adapters/sprite";
import type { ScientificJob } from "@/types/scientificJob";

export function SpriteModule({
  projectId,
  module,
  run,
  notes,
  normalized,
  jobs,
  pdbId,
}: {
  projectId: string;
  module: BasilModuleDefinition;
  run: ModuleRun | null;
  notes: Note[];
  normalized: SpriteNormalizedSearch | null;
  jobs: ScientificJob[];
  pdbId: string | null;
}) {
  const hasSuccess = jobs.some((job) => job.status === "succeeded");

  return (
    <ModuleLayout module={module} run={run}>
      <section className="card">
        <h3>Live SPRITE search</h3>
        <p className="muted">
          Runs GrAfSS SPRITE through this app&apos;s Cloudflare Worker. Students
          never leave the Moeller BASIL site. Default database is{" "}
          <code>csa3</code> (BASIL active-site relevant).
        </p>
        <RunSpriteButton projectId={projectId} pdbId={pdbId} />
      </section>
      <SpriteResults normalized={normalized} jobs={jobs} />
      <ImportToolForm
        projectId={projectId}
        moduleSlug="sprite"
        toolName="SPRITE"
        instructions="Optional fallback only: if live SPRITE is down, paste or upload a legitimate GrAfSS SPRITE export. Do not paste fabricated hits. Prefer the Run SPRITE button above so students never open grafss.ukm.my."
        acceptedFormats={["text", "tsv", "csv", "json"]}
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
          moduleSlug="sprite"
          label="Mark SPRITE complete"
          disabled={!hasSuccess || run?.status === "complete"}
          alreadyComplete={run?.status === "complete"}
        />
      </section>
    </ModuleLayout>
  );
}
