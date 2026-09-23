import { ModuleLayout } from "@/components/module/ModuleLayout";
import { NoteForm } from "@/components/module/NoteForm";
import { ShannonBotChat } from "@/components/shannonbot/ShannonBotChat";
import { CompleteImportModuleButton } from "@/components/import-tool/CompleteImportModuleButton";
import type { BasilModuleDefinition } from "@/types/module";
import type { ModuleRun } from "@/types/moduleRun";
import type { Note } from "@/types/note";
import type { ShannonBotMessage } from "@/ai/shannonBot";

export function ShannonBotModule({
  projectId,
  module,
  run,
  notes,
  messages,
  blocker,
  mode,
  notice,
  provider,
}: {
  projectId: string;
  module: BasilModuleDefinition;
  run: ModuleRun | null;
  notes: Note[];
  messages: ShannonBotMessage[];
  blocker: string | null;
  mode: "local" | "llm";
  notice: string | null;
  provider: string | null;
}) {
  return (
    <ModuleLayout module={module} run={run}>
      <ShannonBotChat
        projectId={projectId}
        initialMessages={messages}
        blocker={blocker}
        mode={mode}
        notice={notice}
        provider={provider}
      />
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
          moduleSlug="shannonbot-review"
          label="Mark ShannonBot Review complete"
          disabled={messages.length < 2 || run?.status === "complete"}
          alreadyComplete={run?.status === "complete"}
        />
      </section>
    </ModuleLayout>
  );
}
