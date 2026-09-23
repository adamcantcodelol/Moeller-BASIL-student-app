"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BLAST_SAFE_DATABASES,
  DEFAULT_BLAST_DATABASE,
  type BlastDatabase,
} from "@/adapters/blast";

export function RunBlastButton({
  projectId,
  hasSequence,
  disabled,
}: {
  projectId: string;
  hasSequence: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [database, setDatabase] = useState<BlastDatabase>(
    DEFAULT_BLAST_DATABASE,
  );

  async function poll(jobId: string, rtoe: number | null) {
    // Client may poll our Worker often; the service enforces ≥60s NCBI spacing.
    const maxAttempts = 90; // ~15 min at 10s
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const waitHint =
        rtoe && rtoe > 0
          ? ` NCBI estimate ~${Math.max(1, Math.round(rtoe / 60))} min.`
          : "";
      setStatus(
        `BLAST still running — polling Worker (attempt ${attempt + 1}/${maxAttempts}).${waitHint} Students stay on this site.`,
      );
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      const response = await fetch(
        `/api/projects/${projectId}/modules/blast/poll`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        pending?: boolean;
        deferredNcbiPoll?: boolean;
        rtoe?: number | null;
      };
      if (!response.ok && response.status !== 202) {
        setError(payload.error ?? "BLAST poll failed.");
        return;
      }
      if (!payload.pending) {
        setStatus("BLAST search complete.");
        router.refresh();
        return;
      }
      if (typeof payload.rtoe === "number") {
        rtoe = payload.rtoe;
      }
    }
    setError(
      "BLAST is still running after ~15 minutes. Leave this page open and refresh later, or use the optional import fallback. No hits were invented.",
    );
  }

  async function onClick() {
    setPending(true);
    setError(null);
    setStatus("Submitting BLAST via Moeller Worker (NCBI blastp)…");
    const response = await fetch(
      `/api/projects/${projectId}/modules/blast`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ database }),
      },
    );
    const payload = (await response.json()) as {
      error?: string;
      pending?: boolean;
      job?: { id: string };
      rid?: string | null;
      rtoe?: number | null;
    };
    if (!response.ok && response.status !== 202) {
      setPending(false);
      setError(payload.error ?? "BLAST submit failed.");
      return;
    }
    if (payload.pending && payload.job?.id) {
      setStatus(
        `Submitted RID ${payload.rid ?? "…"}. Waiting for NCBI (Worker enforces ≥60s poll spacing)…`,
      );
      await poll(payload.job.id, payload.rtoe ?? null);
      setPending(false);
      return;
    }
    setPending(false);
    setStatus("BLAST search complete.");
    router.refresh();
  }

  return (
    <div className="form-stack">
      <label>
        Database
        <select
          value={database}
          disabled={pending}
          onChange={(event) =>
            setDatabase(event.target.value as BlastDatabase)
          }
        >
          {BLAST_SAFE_DATABASES.map((db) => (
            <option key={db} value={db}>
              {db}
              {db === DEFAULT_BLAST_DATABASE
                ? " (default — smaller/faster for class)"
                : db === "nr"
                  ? " (large — may wait longer)"
                  : ""}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={disabled || pending || !hasSequence}
        onClick={() => {
          void onClick();
        }}
      >
        {pending ? "Running BLAST…" : `Run BLAST (${database})`}
      </button>
      <p className="muted">
        The Worker submits your project protein sequence to NCBI BLAST
        (blastp) with tool=moeller-basil and a contact email, then polls the RID
        at most once per minute. Students stay on this Moeller BASIL site —
        you never open blast.ncbi.nlm.nih.gov. Hits are never invented.
      </p>
      {!hasSequence ? (
        <p className="error">
          No sequence on this project yet. Complete Protein / PDB Setup and
          retrieve from RCSB first.
        </p>
      ) : null}
      {status ? <p className="muted">{status}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
