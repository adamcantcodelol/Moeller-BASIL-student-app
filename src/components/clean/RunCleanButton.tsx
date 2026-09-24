"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 10_000;
const MAX_POLLS = 72; // ~12 minutes

/** Submit the project's RCSB sequence to CLEAN via this app's Worker. */
export function RunCleanButton({
  projectId,
  hasSequence,
}: {
  projectId: string;
  hasSequence: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function poll(jobId: string) {
    for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      const response = await fetch(
        `/api/projects/${projectId}/modules/clean/poll`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        pending?: boolean;
        phase?: string | null;
      };
      if (!response.ok && response.status !== 202) {
        setError(payload.error ?? "CLEAN poll failed.");
        return;
      }
      if (!payload.pending) {
        setStatus("CLEAN finished — predictions saved.");
        router.refresh();
        return;
      }
      setStatus(
        payload.phase === "completed"
          ? "CLEAN finished; retrying the results download…"
          : `CLEAN ${payload.phase ?? "running"} at UIUC MoleculeMaker (check ${attempt + 1})…`,
      );
    }
    setError(
      "CLEAN is still running after ~12 minutes. Refresh later or import a CLEAN CSV. No EC numbers were invented.",
    );
  }

  async function onClick() {
    setPending(true);
    setError(null);
    setStatus("Checking CLEAN server and submitting your sequence…");
    try {
      const response = await fetch(`/api/projects/${projectId}/modules/clean`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as {
        error?: string;
        pending?: boolean;
        job?: { id: string };
      };
      if (!response.ok && response.status !== 202) {
        setStatus(null);
        setError(payload.error ?? "CLEAN submit failed.");
        return;
      }
      if (payload.pending && payload.job?.id) {
        setStatus("CLEAN submitted — this usually takes 1–2 minutes…");
        await poll(payload.job.id);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach this app's server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="form-stack">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={pending || !hasSequence}
      >
        {pending ? "Running CLEAN…" : "Run CLEAN on my protein"}
      </button>
      {!hasSequence ? (
        <p className="muted">Load RCSB metadata in Enter PDB first.</p>
      ) : null}
      {status ? <p className="action-success">{status}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
