"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunDaliButton({
  projectId,
  pdbId,
  defaultChain,
  disabled,
}: {
  projectId: string;
  pdbId?: string | null;
  defaultChain?: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [chain, setChain] = useState((defaultChain ?? "A").slice(0, 1));

  async function poll(jobId: string) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      setStatus(
        `Dali still running — polling Worker (attempt ${attempt + 1}/60)…`,
      );
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      const response = await fetch(
        `/api/projects/${projectId}/modules/dali/poll`,
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
      if (!response.ok && response.status !== 202) {
        setError(payload.error ?? "Dali poll failed.");
        return;
      }
      if (!payload.pending) {
        setStatus("Dali search complete.");
        router.refresh();
        return;
      }
    }
    setError(
      "Dali is still queued/running after ~10 minutes. Refresh later or use import fallback. No hits were invented.",
    );
  }

  async function onClick() {
    setPending(true);
    setError(null);
    setStatus("Submitting Dali via Moeller Worker…");
    const response = await fetch(`/api/projects/${projectId}/modules/dali`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(pdbId ? { pdbId } : {}),
        chain: chain.trim() || "A",
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      pending?: boolean;
      job?: { id: string };
    };
    if (!response.ok && response.status !== 202) {
      setPending(false);
      setError(payload.error ?? "Dali submit failed.");
      return;
    }
    if (payload.pending && payload.job?.id) {
      await poll(payload.job.id);
      setPending(false);
      return;
    }
    setPending(false);
    setStatus("Dali search complete.");
    router.refresh();
  }

  return (
    <div className="form-stack">
      <label>
        Chain
        <input
          value={chain}
          maxLength={1}
          disabled={pending}
          onChange={(e) => setChain(e.target.value.toUpperCase())}
        />
      </label>
      <button
        type="button"
        disabled={disabled || pending || !pdbId}
        onClick={() => {
          void onClick();
        }}
      >
        {pending ? "Running Dali…" : "Run Dali (PDB search)"}
      </button>
      <p className="muted">
        The Worker submits PDB+chain to the public Dali server
        (ekhidna2.biocenter.helsinki.fi) and polls the job page. Students stay on
        this site. Jobs are often queued — be patient. Z-scores are never
        invented.
      </p>
      {status ? <p className="muted">{status}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
