"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisPipeline } from "@/types/pipeline";
import { LabExplainer } from "@/components/module/LabExplainer";
import { RetryStepButton } from "@/components/pipeline/RetryStepButton";

const MAX_TICKS = 400;
const DEFAULT_TICK_MS = 4_000;
/** Give up (with a Resume button) after this many failed ticks in a row. */
const MAX_CONSECUTIVE_FAILURES = 12;

type TickPayload = {
  error?: string;
  pipeline?: AnalysisPipeline;
  waiting?: boolean;
  suggestedWaitMs?: number;
};

/**
 * Read a pipeline API response without ever throwing. Cloudflare returns an
 * HTML page (e.g. "error code: 1102" when the Worker hits its CPU limit), so
 * response.json() alone would crash the tick loop.
 */
async function readPipelineResponse(response: Response): Promise<{
  payload: TickPayload | null;
  friendlyError: string | null;
}> {
  const text = await response.text().catch(() => "");
  let payload: TickPayload | null = null;
  try {
    payload = text ? (JSON.parse(text) as TickPayload) : null;
  } catch {
    payload = null;
  }
  if (response.ok || response.status === 202) {
    return { payload, friendlyError: null };
  }
  if (payload?.error) {
    return { payload, friendlyError: payload.error };
  }
  if (/1102|exceeded|resource limit/i.test(text) || response.status === 503) {
    return {
      payload,
      friendlyError:
        "The class server is busy right now (Cloudflare usage limit). Your progress is saved; retrying shortly.",
    };
  }
  return {
    payload,
    friendlyError: `The analysis server answered with an error (HTTP ${response.status}). Your progress is saved; retrying shortly.`,
  };
}

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
    setError(null);
    let failures = 0;
    try {
      for (let attempt = 0; attempt < MAX_TICKS; attempt += 1) {
        if (stopRef.current) break;
        let waitMs = DEFAULT_TICK_MS;
        try {
          const response = await fetch(`/api/projects/${projectId}/pipeline`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "tick" }),
          });
          const { payload, friendlyError } = await readPipelineResponse(response);
          if (friendlyError) {
            failures += 1;
            if (response.status >= 400 && response.status < 500) {
              // Client-side problem (e.g. pipeline not started): retrying won't help.
              setError(friendlyError);
              break;
            }
            if (failures >= MAX_CONSECUTIVE_FAILURES) {
              setError(
                `${friendlyError} Stopped retrying after ${failures} attempts — press "Resume analysis" to continue.`,
              );
              break;
            }
            setError(friendlyError);
            // Back off: 5s, 10s, 20s … capped at 60s (eases CPU-limit lockouts).
            waitMs = Math.min(60_000, 5_000 * 2 ** Math.min(failures - 1, 4));
          } else {
            failures = 0;
            setError(null);
            if (payload?.pipeline) {
              const current = payload.pipeline;
              setPipeline(current);
              const active = current.steps.find(
                (step) =>
                  step.status === "running" ||
                  (step.status === "pending" &&
                    current.steps.indexOf(step) === current.currentStepIndex),
              );
              setStatus(
                active?.summary ??
                  `Advancing analysis (step ${Math.min(current.currentStepIndex + 1, current.steps.length)}/${current.steps.length})…`,
              );
              if (current.status === "completed" || current.status === "failed") {
                setStatus(
                  current.status === "completed"
                    ? "Full analysis finished. Open Results, then continue to Hypothesis."
                    : "Pipeline finished with failures recorded — open Results for honest status per tool.",
                );
                router.refresh();
                break;
              }
            }
            waitMs = payload?.suggestedWaitMs ?? DEFAULT_TICK_MS;
          }
        } catch {
          // Network drop (e.g. school Wi-Fi): keep going with backoff.
          failures += 1;
          if (failures >= MAX_CONSECUTIVE_FAILURES) {
            setError(
              'Lost connection to the analysis server. Press "Resume analysis" when you are back online.',
            );
            break;
          }
          setError("Connection problem — retrying shortly. Your progress is saved.");
          waitMs = Math.min(60_000, 5_000 * 2 ** Math.min(failures - 1, 4));
        }
        waitMs = Math.min(90_000, Math.max(2_000, waitMs));
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
  }, [initialPipeline?.status, tickLoop]);

  // Stop the loop only on unmount. (Previously the status-change cleanup
  // also fired after router.refresh() and silently stopped a running loop.)
  useEffect(() => {
    return () => {
      stopRef.current = true;
    };
  }, []);

  async function onStart() {
    setBusy(true);
    setError(null);
    setStatus("Starting full analysis pipeline…");
    try {
      const response = await fetch(`/api/projects/${projectId}/pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const { payload, friendlyError } = await readPipelineResponse(response);
      if (friendlyError) {
        setError(friendlyError);
        setBusy(false);
        return;
      }
      if (payload?.pipeline) {
        setPipeline(payload.pipeline);
      }
    } catch {
      setError("Could not reach the analysis server. Check the connection and try again.");
      setBusy(false);
      return;
    }
    router.refresh();
    await tickLoop();
  }

  const running = pipeline?.status === "running" || busy;
  const canResume = pipeline?.status === "running" && !busy;
  const done =
    pipeline?.status === "completed" || pipeline?.status === "failed";

  return (
    <div className="card classroom-cta">
      <h2>Start analysis</h2>
      <LabExplainer labKey="analysis" />
      <p className="classroom-cta-lead">
        One click runs live tools on this site (SPRITE, BLAST, Foldseek, Dali,
        CLEAN, and more when data allows). If an outside server is down, that
        step says so and offers Retry. Results are never invented.
      </p>
      {!rcsbReady ? (
        <p className="muted">
          First: open <strong>Enter PDB</strong> and load RCSB metadata.
        </p>
      ) : null}
      <div className="mode-row">
        <button
          type="button"
          className="primary-cta"
          onClick={() => void onStart()}
          disabled={!rcsbReady || running}
        >
          {running
            ? "Running…"
            : done
              ? "Re-run analysis"
              : "Start analysis"}
        </button>
        {canResume ? (
          <button
            type="button"
            onClick={() => {
              setBusy(true);
              void tickLoop();
            }}
          >
            Resume analysis
          </button>
        ) : null}
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
      {pipeline ? (
        <PipelineStepList pipeline={pipeline} projectId={projectId} />
      ) : null}
    </div>
  );
}

/** Steps whose failures are usually upstream outages worth retrying. */
const RETRYABLE_TOOLS = new Set(["clean", "blast"]);

export function PipelineStepList({
  pipeline,
  projectId,
}: {
  pipeline: AnalysisPipeline;
  projectId?: string;
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
            {projectId &&
            RETRYABLE_TOOLS.has(step.tool) &&
            (step.status === "unavailable" || step.status === "failed") &&
            pipeline.status !== "running" ? (
              <div>
                <RetryStepButton projectId={projectId} tool={step.tool} />{" "}
                <a href={`/projects/${projectId}/modules/${step.tool}`}>
                  {step.tool === "clean" ? "or import a CSV" : "or open the module"}
                </a>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
