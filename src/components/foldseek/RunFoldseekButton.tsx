"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunFoldseekButton({
  projectId,
  pdbId,
  disabled,
}: {
  projectId: string;
  pdbId?: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function poll(jobId: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      setStatus(`Polling Foldseek ticket (attempt ${attempt + 1})…`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const response = await fetch(
        `/api/projects/${projectId}/modules/foldseek/poll`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        pending?: boolean;
      };
      if (!response.ok) {
        setError(payload.error ?? "Foldseek poll failed.");
        return;
      }
      if (!payload.pending) {
        setStatus("Foldseek search complete.");
        router.refresh();
        return;
      }
    }
    setError(
      "Foldseek is still running after several polls. Refresh later or use import fallback. No hits were invented.",
    );
  }

  async function onClick() {
    setPending(true);
    setError(null);
    setStatus("Submitting to Foldseek…");
    const response = await fetch(
      `/api/projects/${projectId}/modules/foldseek`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pdbId ? { pdbId } : {}),
      },
    );
    const payload = (await response.json()) as {
      error?: string;
      pending?: boolean;
      job?: { id: string };
    };
    if (!response.ok) {
      setPending(false);
      setError(payload.error ?? "Foldseek submit failed.");
      return;
    }
    if (payload.pending && payload.job?.id) {
      await poll(payload.job.id);
      setPending(false);
      return;
    }
    setPending(false);
    setStatus("Foldseek search complete.");
    router.refresh();
  }

  return (
    <div className="form-stack">
      <button
        type="button"
        disabled={disabled || pending || !pdbId}
        onClick={() => {
          void onClick();
        }}
      >
        {pending ? "Running Foldseek…" : "Run Foldseek (pdb100)"}
      </button>
      <p className="muted">
        Downloads the project PDB from RCSB files and searches the free Foldseek
        server (`search.foldseek.com/api`). Async tickets are polled from the
        browser; Workers never invent structural hits.
      </p>
      {status ? <p className="muted">{status}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
