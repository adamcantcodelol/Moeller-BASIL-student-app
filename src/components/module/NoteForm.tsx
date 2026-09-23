"use client";

import { useRouter } from "next/navigation";
import { useConfirmingAction } from "@/hooks/useConfirmingAction";
import { ActionStatus } from "@/components/ui/ActionStatus";

export function NoteForm({
  projectId,
  moduleId,
}: {
  projectId: string;
  moduleId: string;
}) {
  const router = useRouter();
  const action = useConfirmingAction();

  async function onSubmit(formData: FormData) {
    action.begin();
    const response = await fetch(`/api/projects/${projectId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        moduleId,
        content: formData.get("content"),
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      action.fail(payload.error ?? "Could not save the observation.");
      return;
    }
    (document.getElementById(`note-${moduleId}`) as HTMLFormElement | null)?.reset();
    action.flashSuccess();
    router.refresh();
  }

  const label = action.pending
    ? "Saving…"
    : action.success
      ? "Saved ✓"
      : "Add observation";

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
      <button
        type="submit"
        className={action.buttonClassName}
        disabled={action.pending}
        aria-live="polite"
      >
        {label}
      </button>
      <ActionStatus
        success={action.success}
        successLabel="Observation saved."
        error={action.error}
      />
    </form>
  );
}
