"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunSwissDockButton({
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
  const [smiles, setSmiles] = useState("");
  const [boxCenter, setBoxCenter] = useState("");
  const [boxSize, setBoxSize] = useState("20_20_20");

  async function poll(jobId: string) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      setStatus(
        `SwissDock still running — polling Worker (attempt ${attempt + 1}/60)…`,
      );
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      const response = await fetch(
        `/api/projects/${projectId}/modules/swissdock/poll`,
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
        setError(payload.error ?? "SwissDock poll failed.");
        return;
      }
      if (!payload.pending) {
        setStatus("SwissDock docking complete.");
        router.refresh();
        return;
      }
    }
    setError(
      "SwissDock is still running after ~10 minutes. Refresh later or use import fallback. No poses were invented.",
    );
  }

  async function onClick() {
    if (!smiles.trim() || !boxCenter.trim() || !boxSize.trim()) {
      setError(
        "SMILES, boxCenter (x_y_z), and boxSize (a_b_c) are required. Nothing is invented.",
      );
      return;
    }
    setPending(true);
    setError(null);
    setStatus("Submitting SwissDock (Vina) via Moeller Worker…");
    const response = await fetch(
      `/api/projects/${projectId}/modules/swissdock`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smiles: smiles.trim(),
          boxCenter: boxCenter.trim(),
          boxSize: boxSize.trim(),
          ...(pdbId ? { pdbId } : {}),
        }),
      },
    );
    const payload = (await response.json()) as {
      error?: string;
      pending?: boolean;
      job?: { id: string };
      sessionNumber?: string;
    };
    if (!response.ok && response.status !== 202) {
      setPending(false);
      setError(payload.error ?? "SwissDock submit failed.");
      return;
    }
    if (payload.pending && payload.job?.id) {
      setStatus(
        `Session ${payload.sessionNumber ?? "…"} started. Waiting for docking…`,
      );
      await poll(payload.job.id);
      setPending(false);
      return;
    }
    setPending(false);
    setStatus("SwissDock docking complete.");
    router.refresh();
  }

  return (
    <div className="form-stack">
      <label>
        Ligand SMILES (required)
        <input
          value={smiles}
          disabled={pending}
          placeholder="e.g. CCO (ethanol) — use your curriculum ligand"
          onChange={(e) => setSmiles(e.target.value)}
        />
      </label>
      <label>
        Box center x_y_z (required)
        <input
          value={boxCenter}
          disabled={pending}
          placeholder="e.g. 10.5_-3.0_22.1"
          onChange={(e) => setBoxCenter(e.target.value)}
        />
      </label>
      <label>
        Box size a_b_c
        <input
          value={boxSize}
          disabled={pending}
          onChange={(e) => setBoxSize(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={disabled || pending || !pdbId}
        onClick={() => {
          void onClick();
        }}
      >
        {pending ? "Running SwissDock…" : "Run SwissDock (Vina)"}
      </button>
      <p className="muted">
        Worker uses SwissDock CLI REST on port 8443 (Vina path): preplig →
        preptarget (RCSB PDB) → setparameters → startdock → checkstatus. Ligands
        and boxes are never invented. Students stay on this site.
      </p>
      {status ? <p className="muted">{status}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
