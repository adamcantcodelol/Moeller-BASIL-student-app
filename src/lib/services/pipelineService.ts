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
} from "@/lib/services/blastService";
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

async function persistPipeline(
  db: AppDatabase,
  pipeline: AnalysisPipeline,
): Promise<AnalysisPipeline> {
  const timestamp = nowIso();
  await db
    .update(analysisPipelines)
    .set({
      status: pipeline.status,
      currentStepIndex: pipeline.currentStepIndex,
      stepsJson: JSON.stringify(pipeline.steps),
      startedAt: pipeline.startedAt,
      finishedAt: pipeline.finishedAt,
      updatedAt: timestamp,
    })
    .where(eq(analysisPipelines.id, pipeline.id));
  return { ...pipeline, updatedAt: timestamp };
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
};

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
        skipReason:
          "CLEAN is import-only after probing live Illinois / MMLi backends (no Worker adapter). Use the CLEAN module to import legitimate output.",
        finishedAt: timestamp,
        summary: "Skipped — import-only",
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
      const message =
        error instanceof ServiceError || error instanceof Error
          ? error.message
          : "InterPro failed without fabricating annotations.";
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
      const result = await submitBlastSearch(db, projectId);
      jobId = result.job.id;
      pending = result.pending;
      summary = pending
        ? `BLAST submitted (RID ${result.rid ?? "—"})`
        : `BLAST complete (${result.normalized?.hitCount ?? 0} hits)`;
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
    const message =
      error instanceof ServiceError || error instanceof Error
        ? error.message
        : "Tool failed without fabricating results.";

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

    if (step.tool === "sprite") {
      const result = await pollSpriteJob(db, projectId, step.jobId);
      pending = result.pending;
      if (!pending) {
        summary = `SPRITE complete (${result.normalized?.hitCount ?? 0} hits)`;
      }
    } else if (step.tool === "blast") {
      const result = await pollBlastJob(db, projectId, step.jobId);
      pending = result.pending;
      if (!pending) {
        summary = `BLAST complete (${result.normalized?.hitCount ?? 0} hits)`;
      } else if (result.deferredNcbiPoll) {
        summary = "BLAST waiting for NCBI ≥60s poll spacing";
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
        steps: patchStep(steps, index, {
          status: "running",
          summary,
        }),
      };
    }

    return {
      waiting: false,
      steps: patchStep(steps, index, {
        status: "succeeded",
        finishedAt: nowIso(),
        summary,
        error: null,
      }),
    };
  } catch (error) {
    const message =
      error instanceof ServiceError || error instanceof Error
        ? error.message
        : "Poll failed without fabricating results.";

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
    return { pipeline, waiting: false, advanced: false };
  }
  if (pipeline.status === "idle") {
    throw new ServiceError("Pipeline is idle. Start full analysis first.", 400);
  }

  const index = findActiveStepIndex(pipeline.steps);
  if (index >= pipeline.steps.length) {
    const outcome = summarizePipelineOutcome(pipeline.steps);
    pipeline = await persistPipeline(db, {
      ...pipeline,
      status: outcome.status,
      currentStepIndex: pipeline.steps.length,
      finishedAt: nowIso(),
    });
    return { pipeline, waiting: false, advanced: true };
  }

  const step = pipeline.steps[index]!;
  let result: TickActionResult;

  if (step.status === "pending") {
    result = await submitOrSkipStep(
      db,
      projectId,
      step,
      index,
      pipeline.steps,
    );
  } else if (step.status === "running") {
    result = await pollRunningStep(db, projectId, step, index, pipeline.steps);
  } else {
    // Should not happen — terminal steps are skipped by findActiveStepIndex.
    return { pipeline, waiting: false, advanced: false };
  }

  let nextIndex = index;
  if (!result.waiting) {
    const finished = result.steps[index]!;
    if (isTerminalStepStatus(finished.status)) {
      nextIndex = index + 1;
    }
  }

  let status: PipelineStatus = "running";
  let finishedAt: string | null = null;
  if (nextIndex >= result.steps.length && !result.waiting) {
    const outcome = summarizePipelineOutcome(result.steps);
    status = outcome.status;
    finishedAt = nowIso();
  }

  pipeline = await persistPipeline(db, {
    ...pipeline,
    steps: result.steps,
    currentStepIndex: Math.min(nextIndex, result.steps.length),
    status,
    finishedAt: finishedAt ?? pipeline.finishedAt,
  });

  return {
    pipeline,
    waiting: result.waiting,
    advanced: !result.waiting,
  };
}

export interface ToolResultSection {
  tool: PipelineTool | "rcsb";
  label: string;
  moduleSlug: string;
  status: "empty" | "succeeded" | "failed" | "skipped" | "running";
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
  await pushTool("blast", () => listBlastResults(db, projectId), (n) =>
    `BLAST · ${n.hitCount ?? 0} hits`,
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

  // CLEAN — always honest about import-only
  {
    const pipeStep = stepByTool.get("clean");
    sections.push({
      tool: "clean",
      label: "CLEAN",
      moduleSlug: "clean",
      status: pipeStep?.status === "skipped" ? "skipped" : "empty",
      summary:
        pipeStep?.summary ??
        "CLEAN has no live Worker adapter — import-only.",
      provenanceSource: null,
      provenanceRetrievedAt: null,
      normalized: null,
      error: null,
      skipReason:
        pipeStep?.skipReason ??
        "Live CLEAN automation unavailable; use the CLEAN module import workflow.",
    });
  }

  await pushTool("swissdock", () => listSwissDockResults(db, projectId), (n) =>
    `SwissDock · ${n.poseCount ?? 0} poses`,
  );

  return { pipeline, sections };
}
