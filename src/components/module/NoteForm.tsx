"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NoteForm({
  projectId,
  moduleId,
}: {
  projectId: string;
  moduleId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/projects/${projectId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        moduleId,
        content: formData.get("content"),
      }),
    });
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not save the observation.");
      return;
    }
    (document.getElementById(`note-${moduleId}`) as HTMLFormElement | null)?.reset();
    router.refresh();
  }

  return (
    <form
      id={`note-${moduleId}`}
      className="form-stack"
      action={(formData) => {
        void onSubmit(formData);
      }}
    >
      <label>
        Student observation
        <textarea name="content" rows={4} required maxLength={8000} />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add observation"}
      </button>
    </form>
  );
}
