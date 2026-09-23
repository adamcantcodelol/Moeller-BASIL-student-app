"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FetchRcsbButton({
  projectId,
  pdbId,
  disabled,
}: {
  projectId: string;
  pdbId?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/projects/${projectId}/structure/rcsb`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pdbId ? { pdbId } : {}),
    });
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "RCSB retrieval failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="form-stack">
      <button
        type="button"
        className="secondary"
        disabled={disabled || pending || !pdbId}
        onClick={() => {
          void onClick();
        }}
      >
        {pending ? "Retrieving from RCSB…" : "Retry RCSB retrieve"}
      </button>
      <p className="muted">
        Usually automatic when you Save PDB ID. Use this only if the automatic
        retrieve failed. Calls the free RCSB PDB Data API — nothing is invented
        on failure.
      </p>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
