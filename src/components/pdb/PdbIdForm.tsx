"use client";

import { useRouter } from "next/navigation";
import { useConfirmingAction } from "@/hooks/useConfirmingAction";
import { ActionStatus } from "@/components/ui/ActionStatus";

export function PdbIdForm({ projectId, currentPdbId }: { projectId: string; currentPdbId?: string }) {
  const router = useRouter();
  const action = useConfirmingAction();

  async function onSubmit(formData: FormData) {
    action.begin();
    const response = await fetch(`/api/projects/${projectId}/structure`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdbId: formData.get("pdbId") }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      action.fail(payload.error ?? "Could not save the PDB identifier.");
      return;
    }
    action.flashSuccess();
    router.refresh();
  }

  const label = action.pending
    ? "Loading from RCSB…"
    : action.success
      ? "Loaded ✓"
      : "Save PDB ID";

  return (
    <form
      className="form-stack card"
      action={(formData) => {
        void onSubmit(formData);
      }}
    >
      <h3>Inputs</h3>
      <p className="muted">
        Enter your PDB ID once. The app loads sequence and metadata from RCSB
        automatically so later modules (BLAST, Foldseek, SPRITE, …) can run
        with one click.
      </p>
      <label>
        PDB identifier
        <input
          name="pdbId"
          defaultValue={currentPdbId}
          maxLength={4}
          required
          placeholder="4HHB"
        />
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
        successLabel="PDB saved and RCSB metadata loaded."
        error={action.error}
      />
    </form>
  );
}
