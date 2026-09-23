"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ModuleLayout } from "@/components/module/ModuleLayout";
import { NoteForm } from "@/components/module/NoteForm";
import type { BasilModuleDefinition } from "@/types/module";
import type { ModuleRun } from "@/types/moduleRun";
import type { Note } from "@/types/note";

export function ReportsModule({
  projectId,
  module,
  run,
  notes,
  initialStudent,
  initialTeacher,
}: {
  projectId: string;
  module: BasilModuleDefinition;
  run: ModuleRun | null;
  notes: Note[];
  initialStudent: string | null;
  initialTeacher: string | null;
}) {
  const router = useRouter();
  const [student, setStudent] = useState(initialStudent);
  const [teacher, setTeacher] = useState(initialTeacher);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function generate() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/projects/${projectId}/reports`, {
      method: "POST",
    });
    const payload = (await response.json()) as {
      error?: string;
      student?: { content: string };
      teacher?: { content: string };
    };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Report generation failed.");
      return;
    }
    setStudent(payload.student?.content ?? null);
    setTeacher(payload.teacher?.content ?? null);
    router.refresh();
  }

  return (
    <ModuleLayout module={module} run={run}>
      <section className="card form-stack">
        <h3>Reports</h3>
        <p className="muted">
          Generates student and teacher markdown reports from stored project
          data only — never invents scientific results.
        </p>
        <button type="button" disabled={pending} onClick={() => void generate()}>
          {pending ? "Generating…" : "Generate reports"}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </section>
      {student ? (
        <section className="card">
          <h3>Student report</h3>
          <pre className="provenance-block">{student}</pre>
        </section>
      ) : null}
      {teacher ? (
        <section className="card">
          <h3>Teacher report</h3>
          <pre className="provenance-block">{teacher}</pre>
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
    </ModuleLayout>
  );
}
