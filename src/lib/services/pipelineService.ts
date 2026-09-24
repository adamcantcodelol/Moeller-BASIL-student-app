import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { analysisPipelines } from "@/db/schema";
import { createId, nowIso, parseJson } from "@/lib/ids";
import { getProjectById } from "@/lib/db/queries/projects";
import { getStructureByProjectId } from "@/lib/db/queries/structures";
import { ServiceError } from "@/lib/services/projectService";
import {
  buildInitialPipelineSteps,
  findActiveStepIndex,
  isTerminalStepStatus,
  summarizePipelineOutcome,
} from "@/lib/pipeline/buildSteps";
import {
  isLigandMissingError,
  readUniprotAccessionsFromStructure,
} from "@/lib/pipeline/context";
import {
  pollSpriteJob,
  submitSpriteSearch,
  listSpriteResults,
} from "@/lib/services/spriteService";
import {
  pollBlastJob,
  submitBlastSearch,
  listBlastResults,
  runRcsbSequenceSearchForProject,
} from "@/lib/services/blastService";
import {
  BLAST_NCBI_MIN_POLL_INTERVAL_MS,
  BLAST_PIPELINE_TIMEOUT_MS,
} from "@/adapters/blast";
import { markJobFailed } from "@/lib/jobs/scientificJobService";
import {
  describeErrorForLog,
  toSafeErrorMessage,
} from "@/lib/db/storageLimits";
import {
  pollFoldseekJob,
  submitFoldseekSearch,
  listFoldseekResults,
} from "@/lib/services/foldseekService";
import {
  pollDaliJob,
  submitDaliSearch,
  listDaliResults,
} from "@/lib/services/daliService";
import {
  fetchAndSaveInterProAnnotations,
  listInterProResults,
} from "@/lib/services/interproService";
import {
  pollSwissDockJob,
  submitSwissDock,
  listSwissDockResults,
} from "@/lib/services/swissdockService";
import {
  isCleanUnavailableError,
  listCleanResults,
  pollCleanJob,
} from "@/lib/services/cleanService";
import {
  CLEAN_UNAVAILABLE_MESSAGE,
  clearCleanResultsHealthCache,
  type CleanNormalizedResult,
} from "@/adapters/clean";
import type {
  AnalysisPipeline,
  PipelineStep,
  PipelineStatus,
  PipelineTool,
} from "@/types/pipeline";

function mapPipeline(row: {
  id: string;
  projectId: string;
  status: string;
  currentStepIndex: number;
  stepsJson: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}): AnalysisPipeline {
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status as PipelineStatus,
    currentStepIndex: row.currentStepIndex,
    steps: parseJson<PipelineStep[]>(row.stepsJson, []),
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function loadPipelineRow(
  db: AppDatabase,
  projectId: string,
): Promise<AnalysisPipeline | null> {
  const rows = await db
    .select()
    .from(analysisPipelines)
    .where(eq(analysisPipelines.projectId, projectId))
    .limit(1);
  return rows[0] ? mapPipeline(rows[0]) : null;
}

function clampStepText(steps: PipelineStep[], max: number): PipelineStep[] {
  const clamp = (value: string | null) =>
    value && value.length > max ? `${value.slice(0, max - 1)}…` : value;
  return steps.map((step) => ({
    ...step,
    error: clamp(step.error),
    summary: clamp(step.summary),
    skipReason: clamp(step.skipReason),
  }));
}

async function persistPipeline(
  db: AppDatabase,
  pipeline: AnalysisPipeline,
): Promise<AnalysisPipeline> {
  const timestamp = nowIso();
  const write = (steps: PipelineStep[]) =>
    db
      .update(analysisPipelines)
      .set({
        status: pipeline.status,
        currentStepIndex: pipeline.currentStepIndex,
        stepsJson: JSON.stringify(steps),
        startedAt: pipeline.startedAt,
        finishedAt: pipeline.finishedAt,
        updatedAt: timestamp,
      })
      .where(eq(analysisPipelines.id, pipeline.id));
  let steps = clampStepText(pipeline.steps, 1_000);
  try {
    await write(steps);
  } catch (error) {
    console.error(
      "[pipeline] persist failed, retrying with short step text:",
      describeErrorForLog(error),
    );
    steps = clampStepText(steps, 200);
    try {
      await write(steps);
    } catch (retryError) {
      console.error(
        "[pipeline] persist retry failed:",
        describeErrorForLog(retryError),
      );
      throw new ServiceError(
        "Could not save analysis progress to the class database just now (it may be busy). Nothing was lost — the page will try again automatically.",
        503,
      );
    }
  }
  return { ...pipeline, steps, updatedAt: timestamp };
}

function patchStep(
  steps: PipelineStep[],
  index: number,
  patch: Partial<PipelineStep>,
): PipelineStep[] {
  return steps.map((step, i) => (i === index ? { ...step, ...patch } : step));
}

/**
 * Start (or restart) the classroom auto-analysis pipeline.
 * Requires a saved PDB / RCSB structure — never invents inputs.
 */
export async function startPipeline(
  db: AppDatabase,
  projectId: string,
): Promise<AnalysisPipeline> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }
  const structure = await getStructureByProjectId(db, projectId);
  if (!structure?.pdbId) {
    throw new ServiceError(
      "Save a PDB identifier and load RCSB metadata before starting full analysis.",
      400,
    );
  }
  if (structure.source !== "rcsb" && !structure.sequence) {
    throw new ServiceError(
      "Retrieve RCSB metadata for this PDB before starting full analysis. Sequence is required for BLAST.",
      400,
    );
  }

  const timestamp = nowIso();
  const steps = buildInitialPipelineSteps();
  const existing = await loadPipelineRow(db, projectId);

  if (existing) {
    const next: AnalysisPipeline = {
      ...existing,
      status: "running",
      currentStepIndex: 0,
      steps,
      startedAt: timestamp,
      finishedAt: null,
      updatedAt: timestamp,
    };
    return persistPipeline(db, next);
  }

  const id = createId();
  await db.insert(analysisPipelines).values({
    id,
    projectId,
    status: "running",
    currentStepIndex: 0,
    stepsJson: JSON.stringify(steps),
    startedAt: timestamp,
    finishedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const created = await loadPipelineRow(db, projectId);
  if (!created) {
    throw new ServiceError("Pipeline could not be created.", 500);
  }
  return created;
}

export async function getPipelineStatus(
  db: AppDatabase,
  projectId: string,
): Promise<AnalysisPipeline | null> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }
  return loadPipelineRow(db, projectId);
}

type TickActionResult = {
  steps: PipelineStep[];
  /** True when current tool is still pending remote work. */
  waiting: boolean;
  /** Hint for the client tick loop (BLAST NCBI spacing, etc.). */
  suggestedWaitMs?: number;
};

function cleanUnavailablePatch(
  timestamp: string,
  detail: string,
): Partial<PipelineStep> {
  return {
    status: "unavailable",
    finishedAt: timestamp,
    summary: CLEAN_UNAVAILABLE_MESSAGE,
    error: null,
    skipReason: null,
    nextPollAt: null,
    // Technical reason kept for teachers without alarming students.
    unavailableDetail: detail,
  };
}

async function submitOrSkipStep(
  db: AppDatabase,
  projectId: string,
  step: PipelineStep,
  index: number,
  steps: PipelineStep[],
): Promise<TickActionResult> {
  const timestamp = nowIso();

  if (step.tool === "clean") {
    return {
      waiting: false,
      steps: patchStep(steps, index, {
        status: "skipped",
        finishedAt: timestamp,
        summary: "Optional: run CLEAN from the Results page when you need it",
        skipReason:
          "CLEAN is student-requested and is not run by the classroom pipeline.",
        error: null,
      }),
    };
  }

  if (step.tool === "interpro") {
    const structure = await getStructureByProjectId(db, projectId);
    const accessions = readUniprotAccessionsFromStructure(structure);
    if (accessions.length === 0) {
      return {
        waiting: false,
        steps: patchStep(steps, index, {
          status: "skipped",
          skipReason:
            "No UniProt accession was present in RCSB / SIFTS structure metadata. Open InterPro and enter an accession, or re-fetch RCSB if mapping should exist.",
          finishedAt: timestamp,
          summary: "Skipped — no UniProt accession",
        }),
      };
    }

    try {
      const result = await fetchAndSaveInterProAnnotations(
        db,
        projectId,
        accessions[0]!,
      );
      return {
        waiting: false,
        steps: patchStep(steps, index, {
          status: "succeeded",
          jobId: result.job.id,
          startedAt: timestamp,
          finishedAt: nowIso(),
          summary: `InterPro annotations for ${accessions[0]} (${result.normalized.entryCount} entries)`,
          error: null,
          skipReason: null,
        }),
      };
    } catch (error) {
      const message = toSafeErrorMessage(
        error,
        "InterPro failed without fabricating annotations.",
      );
      return {
        waiting: false,
        steps: patchStep(steps, index, {
          status: "failed",
          startedAt: timestamp,
          finishedAt: nowIso(),
          error: message,
          summary: "Failed",
        }),
      };
    }
  }

  // Async submit tools
  try {
    let jobId: string | null = null;
    let pending = false;
    let summary: string | null = null;

    if (step.tool === "sprite") {
      const result = await submitSpriteSearch(db, projectId);
      jobId = result.job.id;
      pending = result.pending;
      summary = pending
        ? "SPRITE submitted — waiting for matches"
        : `SPRITE complete (${result.normalized?.hitCount ?? 0} hits)`;
    } else if (step.tool === "blast") {
      // Classroom default: RCSB sequence search (MMseqs2 vs PDB) answers in
      // seconds. Fall back to NCBI BLAST (pdbaa) only if RCSB is unavailable.
      let rcsbFailure: string | null = null;
      try {
        const started = Date.now();
        const rcsb = await runRcsbSequenceSearchForProject(db, projectId);
        const secs = Math.max(1, Math.round((Date.now() - started) / 1000));
        return {
          waiting: false,
          steps: patchStep(steps, index, {
            status: "succeeded",
            jobId: rcsb.job.id,
            startedAt: timestamp,
            finishedAt: nowIso(),
            summary: `RCSB sequence search (MMseqs2 vs PDB, BLAST-style): ${rcsb.normalized.hitCount} non-redundant hit${rcsb.normalized.hitCount === 1 ? "" : "s"} in ~${secs}s. Full NCBI BLAST is optional in the BLAST module.`,
            error: null,
            skipReason: null,
          }),
        };
      } catch (error) {
        rcsbFailure = toSafeErrorMessage(error, "RCSB sequence search failed.");
        console.error("[pipeline] RCSB sequence search failed:", describeErrorForLog(error));
      }
      const result = await submitBlastSearch(db, projectId, {
        database: "pdbaa",
      });
      jobId = result.job.id;
      pending = result.pending;
      summary = pending
        ? `RCSB sequence search was unavailable (${rcsbFailure}), so NCBI BLAST was submitted on pdbaa (RID ${result.rid ?? "—"}). Still running at NCBI — usually 1–5 min; other tools keep going.`
        : `NCBI BLAST complete on pdbaa (${result.normalized?.hitCount ?? 0} hits)`;
    } else if (step.tool === "foldseek") {
      const result = await submitFoldseekSearch(db, projectId);
      jobId = result.job.id;
      pending = result.pending;
      summary = pending
        ? "Foldseek submitted — waiting for ticket"
        : `Foldseek complete (${result.normalized?.hitCount ?? 0} hits)`;
    } else if (step.tool === "dali") {
      const result = await submitDaliSearch(db, projectId);
      jobId = result.job.id;
      pending = result.pending;
      summary = pending
        ? "Dali submitted — waiting for job page"
        : `Dali complete (${result.normalized?.hitCount ?? 0} hits)`;
    } else if (step.tool === "swissdock") {
      const result = await submitSwissDock(db, projectId);
      jobId = result.job.id;
      pending = result.pending;
      summary = pending
        ? "SwissDock submitted — waiting for docking"
        : `SwissDock complete (${result.normalized?.poseCount ?? 0} poses)`;
    } else {
      return {
        waiting: false,
        steps: patchStep(steps, index, {
          status: "skipped",
          skipReason: `Unknown pipeline tool "${step.tool as string}" — skipped honestly.`,
          finishedAt: timestamp,
        }),
      };
    }

    if (pending) {
      return {
        waiting: true,
        steps: patchStep(steps, index, {
          status: "running",
          jobId,
          startedAt: timestamp,
          summary,
          error: null,
          skipReason: null,
          nextPollAt: null,
        }),
      };
    }

    return {
      waiting: false,
      steps: patchStep(steps, index, {
        status: "succeeded",
        jobId,
        startedAt: timestamp,
        finishedAt: nowIso(),
        summary,
        error: null,
        skipReason: null,
      }),
    };
  } catch (error) {
    const message = toSafeErrorMessage(
      error,
      `${step.label} failed without fabricating results.`,
    );
    console.error(`[pipeline] ${step.tool} submit failed:`, describeErrorForLog(error));

    if (step.tool === "swissdock" && isLigandMissingError(message)) {
      return {
        waiting: false,
        steps: patchStep(steps, index, {
          status: "skipped",
          startedAt: timestamp,
          finishedAt: nowIso(),
          skipReason: message,
          summary: "Skipped — no ligand SMILES available",
          error: null,
        }),
      };
    }

    return {
      waiting: false,
      steps: patchStep(steps, index, {
        status: "failed",
        startedAt: timestamp,
        finishedAt: nowIso(),
        error: message,
        summary: "Failed",
      }),
    };
  }
}

async function pollRunningStep(
  db: AppDatabase,
  projectId: string,
  step: PipelineStep,
  index: number,
  steps: PipelineStep[],
): Promise<TickActionResult> {
  if (!step.jobId) {
    return {
      waiting: false,
      steps: patchStep(steps, index, {
        status: "failed",
        finishedAt: nowIso(),
        error: "Pipeline step is running but has no job id. Restart analysis.",
        summary: "Failed",
      }),
    };
  }

  try {
    let pending = false;
    let summary = step.summary;
    let suggestedWaitMs = 4_000;

    if (step.tool === "sprite") {
      const result = await pollSpriteJob(db, projectId, step.jobId);
      pending = result.pending;
      if (!pending) {
        summary = `SPRITE complete (${result.normalized?.hitCount ?? 0} hits)`;
      }
    } else if (step.tool === "blast") {
      const startedMs = step.startedAt ? Date.parse(step.startedAt) : NaN;
      const elapsedMs = Number.isFinite(startedMs) ? Date.now() - startedMs : 0;
      if (elapsedMs >= BLAST_PIPELINE_TIMEOUT_MS) {
        const minutes = Math.round(BLAST_PIPELINE_TIMEOUT_MS / 60_000);
        const message = `NCBI BLAST did not finish within ${minutes} minutes (NCBI's public queue is busy). No hits were invented. Press "Retry" to try again.`;
        try {
          await markJobFailed(db, step.jobId, message);
        } catch (markError) {
          console.error(
            "[pipeline] could not mark timed-out BLAST job failed:",
            toSafeErrorMessage(markError, "unknown"),
          );
        }
        return {
          waiting: false,
          steps: patchStep(steps, index, {
            status: "failed",
            finishedAt: nowIso(),
            error: message,
            summary: "Timed out at NCBI",
          }),
        };
      }
      const elapsedText = `${Math.max(1, Math.round(elapsedMs / 60_000))} min elapsed`;
      const result = await pollBlastJob(db, projectId, step.jobId);
      pending = result.pending;
      if (!pending) {
        summary = `NCBI BLAST complete (${result.normalized?.hitCount ?? 0} hits)`;
      } else {
        // Next NCBI poll is allowed once 60s have passed since the last one.
        suggestedWaitMs = result.deferredNcbiPoll
          ? Math.max(1_000, result.ncbiWaitRemainingMs ?? BLAST_NCBI_MIN_POLL_INTERVAL_MS)
          : BLAST_NCBI_MIN_POLL_INTERVAL_MS;
        summary = `NCBI BLAST still running (${elapsedText}; usually 1–5 min, times out at ${Math.round(BLAST_PIPELINE_TIMEOUT_MS / 60_000)} min). Other tools and Results keep working.`;
      }
    } else if (step.tool === "foldseek") {
      const result = await pollFoldseekJob(db, projectId, step.jobId);
      pending = result.pending;
      if (!pending) {
        summary = `Foldseek complete (${result.normalized?.hitCount ?? 0} hits)`;
      }
    } else if (step.tool === "dali") {
      const result = await pollDaliJob(db, projectId, step.jobId);
      pending = result.pending;
      if (!pending) {
        summary = `Dali complete (${result.normalized?.hitCount ?? 0} hits)`;
      }
    } else if (step.tool === "clean") {
      // Respect CLEAN poll spacing without slowing the whole tick loop.
      if (step.nextPollAt && Date.parse(step.nextPollAt) > Date.now()) {
        return { waiting: true, steps };
      }
      const result = await pollCleanJob(db, projectId, step.jobId);
      pending = result.pending;
      if (!pending) {
        const top = result.normalized?.topPrediction;
        summary = top
          ? `CLEAN complete — top EC ${top.ecNumber} (${top.level}, ${top.score.toFixed(2)})`
          : "CLEAN complete — no EC prediction returned";
      } else {
        summary =
          result.phase === "completed"
            ? "CLEAN finished — retrying results download (server storage slow)…"
            : `CLEAN ${result.phase ?? "running"} at UIUC MoleculeMaker…`;
        return {
          waiting: true,
          steps: patchStep(steps, index, {
            status: "running",
            summary,
            nextPollAt: new Date(Date.now() + result.nextCheckMs).toISOString(),
          }),
        };
      }
    } else if (step.tool === "swissdock") {
      const result = await pollSwissDockJob(db, projectId, step.jobId);
      pending = result.pending;
      if (!pending) {
        summary = `SwissDock complete (${result.normalized?.poseCount ?? 0} poses)`;
      }
    } else {
      return {
        waiting: false,
        steps: patchStep(steps, index, {
          status: "failed",
          finishedAt: nowIso(),
          error: `Cannot poll tool "${step.tool}".`,
          summary: "Failed",
        }),
      };
    }

    if (pending) {
      return {
        waiting: true,
        suggestedWaitMs,
        steps: patchStep(steps, index, {
          status: "running",
          summary,
        }),
      };
    }

    return {
      waiting: false,
      suggestedWaitMs: 4_000,
      steps: patchStep(steps, index, {
        status: "succeeded",
        finishedAt: nowIso(),
        summary,
        error: null,
      }),
    };
  } catch (error) {
    const message = toSafeErrorMessage(
      error,
      `${step.label} check failed without fabricating results.`,
    );
    console.error(`[pipeline] ${step.tool} poll failed:`, describeErrorForLog(error));

    if (step.tool === "clean" && isCleanUnavailableError(error)) {
      return {
        waiting: false,
        steps: patchStep(steps, index, cleanUnavailablePatch(nowIso(), error.detail)),
      };
    }

    if (step.tool === "swissdock" && isLigandMissingError(message)) {
      return {
        waiting: false,
        steps: patchStep(steps, index, {
          status: "skipped",
          finishedAt: nowIso(),
          skipReason: message,
          summary: "Skipped — no ligand SMILES available",
          error: null,
        }),
      };
    }

    return {
      waiting: false,
      steps: patchStep(steps, index, {
        status: "failed",
        finishedAt: nowIso(),
        error: message,
        summary: "Failed",
      }),
    };
  }
}

/**
 * Advance one pipeline unit of work: submit the next pending tool, or poll
 * the currently running async job. Designed for client-driven ticks under
 * Cloudflare Worker request time limits (same pattern as SPRITE poll).
 *
 * On tool failure: record the real error and continue to the next step.
 * Never invents scientific results.
 */
export async function tickPipeline(
  db: AppDatabase,
  projectId: string,
): Promise<{
  pipeline: AnalysisPipeline;
  waiting: boolean;
  advanced: boolean;
  suggestedWaitMs: number;
}> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }

  let pipeline = await loadPipelineRow(db, projectId);
  if (!pipeline) {
    throw new ServiceError(
      "No analysis pipeline yet. Start full analysis first.",
      400,
    );
  }
  if (pipeline.status === "completed" || pipeline.status === "failed") {
    return {
      pipeline,
      waiting: false,
      advanced: false,
      suggestedWaitMs: 4_000,
    };
  }
  if (pipeline.status === "idle") {
    throw new ServiceError("Pipeline is idle. Start full analysis first.", 400);
  }

  let steps = pipeline.steps;
  let advanced = false;
  // Only NCBI BLAST needs long spacing (≥60s between upstream checks). Other
  // tools are polled every few seconds so they are never held back by BLAST.
  let blastWaitMs: number | null = null;

  // Poll every running job first (BLAST can sit for minutes without blocking others).
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i]!;
    if (step.status !== "running") continue;
    const result = await pollRunningStep(db, projectId, step, i, steps);
    steps = result.steps;
    if (
      step.tool === "blast" &&
      result.waiting &&
      typeof result.suggestedWaitMs === "number"
    ) {
      blastWaitMs = result.suggestedWaitMs;
    }
    if (!result.waiting && isTerminalStepStatus(steps[i]!.status)) {
      advanced = true;
    }
  }

  // Start at most one new pending tool per tick, even while earlier tools still run.
  const pendingIndex = steps.findIndex((step) => step.status === "pending");
  if (pendingIndex >= 0) {
    const result = await submitOrSkipStep(
      db,
      projectId,
      steps[pendingIndex]!,
      pendingIndex,
      steps,
    );
    steps = result.steps;
    advanced = true;
    if (result.waiting && steps[pendingIndex]!.tool === "blast") {
      // NCBI fallback: Put + first SearchInfo just happened.
      blastWaitMs = BLAST_NCBI_MIN_POLL_INTERVAL_MS;
    }
  }

  const otherWork = steps.some(
    (step) =>
      step.status === "pending" ||
      (step.status === "running" && step.tool !== "blast"),
  );
  const suggestedWaitMs =
    otherWork || blastWaitMs === null ? 4_000 : blastWaitMs;

  const stillWaiting = steps.some((step) => step.status === "running");
  const allTerminal = steps.every((step) => isTerminalStepStatus(step.status));

  let status: PipelineStatus = "running";
  let finishedAt: string | null = pipeline.finishedAt;
  if (allTerminal) {
    const outcome = summarizePipelineOutcome(steps);
    status = outcome.status;
    finishedAt = nowIso();
  }

  const currentStepIndex = allTerminal
    ? steps.length
    : findActiveStepIndex(steps);

  pipeline = await persistPipeline(db, {
    ...pipeline,
    steps,
    currentStepIndex,
    status,
    finishedAt,
  });

  return {
    pipeline,
    waiting: stillWaiting && !allTerminal,
    advanced,
    suggestedWaitMs: stillWaiting ? suggestedWaitMs : 4_000,
  };
}

/**
 * Re-queue one unavailable/failed step (e.g. CLEAN after MoleculeMaker's
 * result storage recovers) and resume the pipeline. Other steps keep their
 * real results.
 */
export async function retryPipelineStep(
  db: AppDatabase,
  projectId: string,
  tool: PipelineTool,
): Promise<AnalysisPipeline> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }
  const pipeline = await loadPipelineRow(db, projectId);
  if (!pipeline) {
    throw new ServiceError(
      "No analysis pipeline yet. Start full analysis first.",
      400,
    );
  }
  const index = pipeline.steps.findIndex((step) => step.tool === tool);
  const step = pipeline.steps[index];
  if (!step) {
    throw new ServiceError(`Pipeline has no ${tool} step.`, 400);
  }
  if (step.status !== "unavailable" && step.status !== "failed") {
    throw new ServiceError(
      `${step.label} is ${step.status}; only unavailable or failed steps can be retried.`,
      400,
    );
  }
  if (tool === "clean") {
    // Student asked for a fresh upstream check rather than the cached verdict.
    clearCleanResultsHealthCache();
  }
  const steps = patchStep(pipeline.steps, index, {
    status: "pending",
    jobId: null,
    error: null,
    skipReason: null,
    summary: "Retry requested",
    startedAt: null,
    finishedAt: null,
    nextPollAt: null,
    unavailableDetail: null,
  });
  return persistPipeline(db, {
    ...pipeline,
    steps,
    status: "running",
    currentStepIndex: findActiveStepIndex(steps),
    finishedAt: null,
  });
}

export interface ToolResultSection {
  tool: PipelineTool | "rcsb";
  label: string;
  moduleSlug: string;
  status:
    | "empty"
    | "succeeded"
    | "failed"
    | "skipped"
    | "running"
    | "unavailable";
  summary: string;
  provenanceSource: string | null;
  provenanceRetrievedAt: string | null;
  normalized: unknown | null;
  error: string | null;
  skipReason: string | null;
}

/**
 * Aggregate latest stored outputs per tool for the Results page.
 * Never invents summaries — empty/failed sections say so honestly.
 */
export async function getProjectResultsSections(
  db: AppDatabase,
  projectId: string,
): Promise<{
  pipeline: AnalysisPipeline | null;
  sections: ToolResultSection[];
}> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }

  const pipeline = await loadPipelineRow(db, projectId);
  const structure = await getStructureByProjectId(db, projectId);
  const stepByTool = new Map(
    (pipeline?.steps ?? []).map((step) => [step.tool, step]),
  );

  const sections: ToolResultSection[] = [];

  // RCSB / structure
  if (structure?.source === "rcsb" && structure.retrievedAt) {
    const provenance =
      structure.metadata &&
      typeof structure.metadata.provenance === "object" &&
      structure.metadata.provenance !== null
        ? (structure.metadata.provenance as {
            source?: string;
            retrievedAt?: string;
          })
        : null;
    sections.push({
      tool: "rcsb",
      label: "RCSB PDB",
      moduleSlug: "pdb-setup",
      status: "succeeded",
      summary: [
        structure.title ?? structure.pdbId,
        structure.organism ? `· ${structure.organism}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      provenanceSource: provenance?.source ?? "https://data.rcsb.org/",
      provenanceRetrievedAt:
        provenance?.retrievedAt ?? structure.retrievedAt ?? null,
      normalized: {
        pdbId: structure.pdbId,
        title: structure.title,
        organism: structure.organism,
        chains: structure.chains,
        uniprotAccessions: readUniprotAccessionsFromStructure(structure),
      },
      error: null,
      skipReason: null,
    });
  } else {
    sections.push({
      tool: "rcsb",
      label: "RCSB PDB",
      moduleSlug: "pdb-setup",
      status: "empty",
      summary: "No RCSB metadata stored yet.",
      provenanceSource: null,
      provenanceRetrievedAt: null,
      normalized: null,
      error: null,
      skipReason: null,
    });
  }

  async function pushTool(
    tool: PipelineTool,
    loader: () => Promise<{
      latestNormalized: { provenance?: { source?: string; retrievedAt?: string }; hitCount?: number; entryCount?: number; poseCount?: number } | null;
      jobs: { status: string; error: string | null }[];
    }>,
    summarize: (normalized: NonNullable<Awaited<ReturnType<typeof loader>>["latestNormalized"]>) => string,
  ) {
    const pipeStep = stepByTool.get(tool);
    try {
      const listed = await loader();
      const latestJob = listed.jobs[0] ?? null;
      if (listed.latestNormalized) {
        sections.push({
          tool,
          label: pipeStep?.label ?? tool,
          moduleSlug: tool === "clean" ? "clean" : tool,
          status: "succeeded",
          summary: summarize(listed.latestNormalized),
          provenanceSource: listed.latestNormalized.provenance?.source ?? null,
          provenanceRetrievedAt:
            listed.latestNormalized.provenance?.retrievedAt ?? null,
          normalized: listed.latestNormalized,
          error: null,
          skipReason: null,
        });
        return;
      }
      if (pipeStep?.status === "unavailable") {
        sections.push({
          tool,
          label: pipeStep.label,
          moduleSlug: tool,
          status: "unavailable",
          summary: pipeStep.summary ?? "Temporarily unavailable.",
          provenanceSource: null,
          provenanceRetrievedAt: null,
          normalized: null,
          error: null,
          skipReason: null,
        });
        return;
      }
      if (pipeStep?.status === "skipped") {
        sections.push({
          tool,
          label: pipeStep.label,
          moduleSlug: tool,
          status: "skipped",
          summary: pipeStep.summary ?? "Skipped",
          provenanceSource: null,
          provenanceRetrievedAt: null,
          normalized: null,
          error: null,
          skipReason: pipeStep.skipReason,
        });
        return;
      }
      if (pipeStep?.status === "failed" || latestJob?.status === "failed") {
        sections.push({
          tool,
          label: pipeStep?.label ?? tool,
          moduleSlug: tool,
          status: "failed",
          summary: "Tool failed — no fabricated result stored.",
          provenanceSource: null,
          provenanceRetrievedAt: null,
          normalized: null,
          error: pipeStep?.error ?? latestJob?.error ?? "Unknown failure",
          skipReason: null,
        });
        return;
      }
      if (
        pipeStep?.status === "running" ||
        latestJob?.status === "running" ||
        latestJob?.status === "queued"
      ) {
        sections.push({
          tool,
          label: pipeStep?.label ?? tool,
          moduleSlug: tool,
          status: "running",
          summary: pipeStep?.summary ?? "Running…",
          provenanceSource: null,
          provenanceRetrievedAt: null,
          normalized: null,
          error: null,
          skipReason: null,
        });
        return;
      }
      sections.push({
        tool,
        label: pipeStep?.label ?? tool,
        moduleSlug: tool,
        status: "empty",
        summary: "No stored result yet.",
        provenanceSource: null,
        provenanceRetrievedAt: null,
        normalized: null,
        error: null,
        skipReason: pipeStep?.skipReason ?? null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load results.";
      sections.push({
        tool,
        label: pipeStep?.label ?? tool,
        moduleSlug: tool,
        status: "failed",
        summary: "Could not load stored results.",
        provenanceSource: null,
        provenanceRetrievedAt: null,
        normalized: null,
        error: message,
        skipReason: null,
      });
    }
  }

  await pushTool("sprite", () => listSpriteResults(db, projectId), (n) =>
    `SPRITE · ${n.hitCount ?? 0} hits (RMSD ascending)`,
  );
  await pushTool("foldseek", () => listFoldseekResults(db, projectId), (n) =>
    `Foldseek · ${n.hitCount ?? 0} hits`,
  );
  await pushTool("dali", () => listDaliResults(db, projectId), (n) =>
    `Dali · ${n.hitCount ?? 0} hits`,
  );
  await pushTool("interpro", () => listInterProResults(db, projectId), (n) =>
    `InterPro · ${n.entryCount ?? 0} entries`,
  );

  await pushTool("clean", () => listCleanResults(db, projectId), (n) => {
    const clean = n as unknown as CleanNormalizedResult;
    const top = clean.topPrediction;
    const origin = clean.kind === "clean-import" ? " (imported CSV)" : "";
    return top
      ? `CLEAN${origin} · top EC ${top.ecNumber}${top.enzymeName ? ` (${top.enzymeName})` : ""} · ${top.level} confidence ${top.score.toFixed(2)}`
      : `CLEAN${origin} · no EC prediction returned`;
  });

  await pushTool("swissdock", () => listSwissDockResults(db, projectId), (n) =>
    `SwissDock · ${n.poseCount ?? 0} poses`,
  );
  await pushTool("blast", () => listBlastResults(db, projectId), (n) =>
    `${(n as { methodLabel?: string }).methodLabel ?? "NCBI BLAST"} · ${n.hitCount ?? 0} hits`,
  );

  return { pipeline, sections };
}
