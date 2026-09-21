"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CompletePdbSetupButton({
  projectId,
  disabled,
}: {
  projectId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function complete() {
    setError(null);
    const response = await fetch(
      `/api/projects/${projectId}/modules/pdb-setup`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true }),
      },
    );
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Could not complete PDB Setup.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button type="button" disabled={disabled} onClick={() => void complete()}>
        Mark PDB Setup complete
      </button>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
