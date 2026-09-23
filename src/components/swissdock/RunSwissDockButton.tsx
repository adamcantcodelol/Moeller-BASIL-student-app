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
  const [smilesOverride, setSmilesOverride] = useState("");
  const [showOverride, setShowOverride] = useState(false);

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
    setPending(true);
    setError(null);
    setStatus(
      "Submitting SwissDock (Vina) via Moeller Worker — extracting ligand from project PDB when needed…",
    );
    const body: Record<string, string> = {};
    if (pdbId) body.pdbId = pdbId;
    if (smilesOverride.trim()) body.smiles = smilesOverride.trim();
    const response = await fetch(
      `/api/projects/${projectId}/modules/swissdock`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
        Uses your project PDB only. The Worker downloads the PDB from RCSB,
        extracts a non-solvent HETATM ligand (e.g. HEM), looks up its SMILES on
        RCSB chemcomp, and centers the box on that ligand. Ligands are never
        invented. Students stay on this site.
      </p>
      <button
        type="button"
        className="secondary"
        disabled={pending}
        onClick={() => setShowOverride((v) => !v)}
      >
        {showOverride
          ? "Hide optional SMILES override"
          : "PDB has no ligand? Optional SMILES"}
      </button>
      {showOverride ? (
        <label>
          Ligand SMILES override (only if PDB has no HETATM ligand)
          <input
            value={smilesOverride}
            disabled={pending}
            placeholder="Only when unavoidable — never invent"
            onChange={(e) => setSmilesOverride(e.target.value)}
          />
        </label>
      ) : null}
      {!pdbId ? (
        <p className="error">
          Save a PDB ID in Protein / PDB Setup first (RCSB retrieve is
          automatic).
        </p>
      ) : null}
      {status ? <p className="muted">{status}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
