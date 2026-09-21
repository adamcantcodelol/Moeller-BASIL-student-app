"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PdbIdForm({ projectId, currentPdbId }: { projectId: string; currentPdbId?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/projects/${projectId}/structure`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdbId: formData.get("pdbId") }),
    });
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not save the PDB identifier.");
      return;
    }
    router.refresh();
  }

  return (
    <form
      className="form-stack card"
      action={(formData) => {
        void onSubmit(formData);
      }}
    >
      <h3>Inputs</h3>
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
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save PDB ID"}
      </button>
    </form>
  );
}
