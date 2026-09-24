"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisPipeline } from "@/types/pipeline";

const MAX_TICKS = 400;
const DEFAULT_TICK_MS = 4_000;

export function StartAnalysisButton({
  projectId,
  initialPipeline,
  rcsbReady,
}: {
  projectId: string;
  initialPipeline: AnalysisPipeline | null;
  rcsbReady: boolean;
}) {
  const router = useRouter();
  const [pipeline, setPipeline] = useState<AnalysisPipeline | null>(
    initialPipeline,
  );
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ticking = useRef(false);
  const stopRef = useRef(false);

  const tickLoop = useCallback(async () => {
    if (ticking.current) return;
    ticking.current = true;
    stopRef.current = false;
    try {
      for (let attempt = 0; attempt < MAX_TICKS; attempt += 1) {
        if (stopRef.current) break;
        setStatus(
          `Advancing analysis (tick ${attempt + 1}/${MAX_TICKS})… BLAST can take several minutes at NCBI; other tools keep going.`,
        );
        const response = await fetch(`/api/projects/${projectId}/pipeline`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "tick" }),
        });
        const payload = (await response.json()) as {
          error?: string;
          pipeline?: AnalysisPipeline;
          waiting?: boolean;
          suggestedWaitMs?: number;
        };
        if (!response.ok && response.status !== 202) {
          setError(payload.error ?? "Pipeline tick failed.");
          break;
        }
        if (payload.pipeline) {
          setPipeline(payload.pipeline);
          const active = payload.pipeline.steps.find(
            (step) =>
              step.status === "running" ||
              (step.status === "pending" &&
                payload.pipeline!.steps.indexOf(step) ===
                  payload.pipeline!.currentStepIndex),
          );
          if (active?.summary) {
            setStatus(active.summary);
          }
          if (
            payload.pipeline.status === "completed" ||
            payload.pipeline.status === "failed"
          ) {
            setStatus(
              payload.pipeline.status === "completed"
                ? "Full analysis finished. Open Results, then continue to Hypothesis."
                : "Pipeline finished with failures recorded — open Results for honest status per tool.",
            );
            router.refresh();
            break;
          }
        }
        const waitMs = Math.min(
          90_000,
          Math.max(2_000, payload.suggestedWaitMs ?? DEFAULT_TICK_MS),
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    } finally {
      ticking.current = false;
      setBusy(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    if (initialPipeline?.status === "running" && !ticking.current) {
      setBusy(true);
      void tickLoop();
    }
    return () => {
      stopRef.current = true;
    };
  }, [initialPipeline?.status, tickLoop]);

  async function onStart() {
    setBusy(true);
    setError(null);
    setStatus("Starting full analysis pipeline…");
    const response = await fetch(`/api/projects/${projectId}/pipeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    const payload = (await response.json()) as {
      error?: string;
      pipeline?: AnalysisPipeline;
    };
    if (!response.ok) {
      setError(payload.error ?? "Could not start analysis.");
      setBusy(false);
      return;
    }
    if (payload.pipeline) {
      setPipeline(payload.pipeline);
    }
    router.refresh();
    await tickLoop();
  }

  const running = pipeline?.status === "running" || busy;
  const done =
    pipeline?.status === "completed" || pipeline?.status === "failed";

  return (
    <div className="card classroom-cta">
      <h2>Classroom analysis</h2>
      <p>
        After your PDB loads from RCSB, run the full live search sequence
        (SPRITE → BLAST → Foldseek → Dali → InterPro when UniProt is mapped →
        SwissDock when a ligand is present). CLEAN stays import-only and is
        skipped honestly. BLAST uses the faster PDB protein database (pdbaa)
        and does not block later tools. Results are never invented.
      </p>
      {!rcsbReady ? (
        <p className="muted">
          Load RCSB metadata from Protein / PDB Setup first.
        </p>
      ) : null}
      <div className="mode-row">
        <button
          type="button"
          onClick={() => void onStart()}
          disabled={!rcsbReady || running}
        >
          {running
            ? "Analysis running…"
            : done
              ? "Re-run full analysis"
              : "Start full analysis"}
        </button>
        {done || pipeline?.status === "running" ? (
          <a className="button-link" href={`/projects/${projectId}/results`}>
            View Results
          </a>
        ) : null}
        {done ? (
          <a
            className="button-link"
            href={`/projects/${projectId}/hypothesis`}
          >
            Continue to Hypothesis
          </a>
        ) : null}
        {pipeline?.status === "running" ? (
          <a className="button-link" href={`/projects/${projectId}/analysis`}>
            Analysis progress
          </a>
        ) : null}
      </div>
      {status ? <p className="action-success">{status}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {pipeline ? <PipelineStepList pipeline={pipeline} /> : null}
    </div>
  );
}

export function PipelineStepList({
  pipeline,
}: {
  pipeline: AnalysisPipeline;
}) {
  return (
    <ol className="pipeline-steps">
      {pipeline.steps.map((step, index) => {
        const active = index === pipeline.currentStepIndex;
        return (
          <li
            key={step.tool}
            className={`pipeline-step pipeline-step-${step.status}${active ? " pipeline-step-active" : ""}`}
          >
            <strong>{step.label}</strong>
            <span className="muted"> · {step.status.replaceAll("_", " ")}</span>
            {step.summary ? (
              <div className="muted">{step.summary}</div>
            ) : null}
            {step.skipReason ? (
              <div className="muted">Skip: {step.skipReason}</div>
            ) : null}
            {step.error ? <div className="error">{step.error}</div> : null}
          </li>
        );
      })}
    </ol>
  );
}
