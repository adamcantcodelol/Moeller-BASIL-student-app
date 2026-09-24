"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PipelineTool } from "@/types/pipeline";

/**
 * Re-queue one unavailable/failed pipeline step (e.g. CLEAN) and resume the
 * analysis tick loop on the Analysis progress page.
 */
export function RetryStepButton({
  projectId,
  tool,
  label = "Retry",
}: {
  projectId: string;
  tool: PipelineTool;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry-step", tool }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Retry failed.");
        return;
      }
      const analysisPath = `/projects/${projectId}/analysis`;
      if (window.location.pathname === analysisPath) {
        router.refresh();
      } else {
        router.push(analysisPath);
      }
    } catch {
      setError("Retry request could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="retry-step">
      <button type="button" onClick={() => void onClick()} disabled={busy}>
        {busy ? "Retrying…" : label}
      </button>
      {error ? <span className="error"> {error}</span> : null}
    </span>
  );
}
