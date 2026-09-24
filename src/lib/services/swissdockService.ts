import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { moduleRuns, results, scientificJobs } from "@/db/schema";
import { createId, nowIso } from "@/lib/ids";
import { serializeRawForStorage } from "@/lib/db/storageLimits";
import { getProjectById } from "@/lib/db/queries/projects";
import { getModuleRun } from "@/lib/db/queries/moduleRuns";
import { getStructureByProjectId } from "@/lib/db/queries/structures";
import { ServiceError } from "@/lib/services/projectService";
import {
  createSwissDockSearchAdapter,
  SwissDockAdapterError,
  SWISSDOCK_JOB_TIMEOUT_MS,
  type SwissDockLigandChoice,
  type SwissDockNormalizedSearch,
  type SwissDockRawPayload,
} from "@/adapters/swissdock";

/** Attach the recorded ligand/box choice (from job parameters) to results. */
function withChoice(
  normalized: SwissDockNormalizedSearch,
  params: Record<string, unknown>,
): SwissDockNormalizedSearch {
  const ligand = (params.ligand as SwissDockLigandChoice | undefined) ?? null;
  const center = typeof params.boxCenter === "string" ? params.boxCenter : null;
  return {
    ...normalized,
    ligand: ligand ?? {
      name: "Auto-picked from PDB",
      source: "structure",
      smiles: normalized.smiles,
    },
    box: center
      ? {
          center,
          size: typeof params.boxSize === "string" ? params.boxSize : "20_20_20",
          label: typeof params.boxLabel === "string" ? params.boxLabel : "Auto: centered on the PDB ligand",
        }
      : null,
  };
}
import { validatePdbId } from "@/lib/validation/pdbId";
import {
  createScientificJob,
  getScientificJob,
  listJobsForModuleRun,
  markJobFailed,
  markJobRunning,
  markJobSucceeded,
} from "@/lib/jobs/scientificJobService";
import { withRawResultId } from "@/lib/provenance/buildProvenance";
import { mapResultRow } from "@/lib/db/mappers";
import type { ScientificResult } from "@/types/result";

export const SWISSDOCK_MODULE_ID = "swissdock";

function mapError(error: unknown): never {
  if (error instanceof SwissDockAdapterError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "PENDING"
          ? 202
          : error.code === "TIMEOUT" ||
              error.code === "NETWORK" ||
              error.code === "FAILED"
            ? 502
            : 400;
    throw new ServiceError(error.message, status);
  }
  throw error;
}

async function persistSuccess(
  db: AppDatabase,
  options: {
    projectIsDemo: boolean;
    moduleRunId: string;
    jobId: string;
    raw: SwissDockRawPayload;
    normalized: SwissDockNormalizedSearch;
    provenance: ReturnType<
      ReturnType<typeof createSwissDockSearchAdapter>["getProvenance"]
    >;
  },
) {
  const timestamp = nowIso();
  const rawResultId = createId();
  const provenance = withRawResultId(options.provenance, rawResultId);
  await db.insert(results).values([
    {
      id: rawResultId,
      moduleRunId: options.moduleRunId,
      type: "raw",
      rawDataJson: serializeRawForStorage(options.raw, {
        tool: "SwissDock",
        source: provenance.source,
      }),
      normalizedDataJson: null,
      source: provenance.source,
      provenanceJson: JSON.stringify(provenance),
      isDemo: options.projectIsDemo,
      createdAt: timestamp,
    },
    {
      id: createId(),
      moduleRunId: options.moduleRunId,
      type: "normalized",
      rawDataJson: null,
      normalizedDataJson: JSON.stringify(options.normalized),
      source: provenance.source,
      provenanceJson: JSON.stringify(provenance),
      isDemo: options.projectIsDemo,
      createdAt: timestamp,
    },
  ]);
  const job = await markJobSucceeded(db, options.jobId, {
    resultId: rawResultId,
    cacheHit: false,
  });
  await db
    .update(moduleRuns)
    .set({
      status: "in_progress",
      parametersJson: JSON.stringify({
        sessionNumber: options.normalized.sessionNumber,
        pdbId: options.normalized.pdbId,
        poseCount: options.normalized.poseCount,
      }),
      error: null,
      updatedAt: timestamp,
    })
    .where(eq(moduleRuns.id, options.moduleRunId));
  return { job, normalized: options.normalized };
}

export async function submitSwissDock(
  db: AppDatabase,
  projectId: string,
  options?: {
    smiles?: string;
    boxCenter?: string;
    boxSize?: string;
    pdbId?: string;
    exhaustiveness?: number;
    ligand?: SwissDockLigandChoice;
    boxLabel?: string;
  },
) {
  const project = await getProjectById(db, projectId);
  if (!project) throw new ServiceError("Project not found.", 404);
  const structure = await getStructureByProjectId(db, projectId);
  const pdbInput = options?.pdbId ?? structure?.pdbId;
  if (!pdbInput) {
    throw new ServiceError(
      "Save a PDB identifier (Protein / PDB Setup) before running SwissDock.",
      400,
    );
  }
  const validation = validatePdbId(pdbInput);
  if (!validation.ok) throw new ServiceError(validation.error, 400);

  const run = await getModuleRun(db, projectId, SWISSDOCK_MODULE_ID);
  if (!run) throw new ServiceError("SwissDock module run is missing.", 500);

  const job = await createScientificJob(db, {
    moduleRunId: run.id,
    tool: "swissdock",
    mode: "adapter",
    parameters: {
      pdbId: validation.pdbId,
      smiles: options?.smiles?.trim() || null,
      boxCenter: options?.boxCenter || null,
      boxSize: options?.boxSize || "20_20_20",
      autoLigand: !options?.smiles?.trim(),
    },
  });
  await markJobRunning(db, job.id);

  const adapter = createSwissDockSearchAdapter();
  try {
    const raw = await adapter.run({
      pdbId: validation.pdbId,
      smiles: options?.smiles,
      boxCenter: options?.boxCenter,
      boxSize: options?.boxSize,
      exhaustiveness: options?.exhaustiveness,
    });
    const timestamp = nowIso();
    const jobParams: Record<string, unknown> = {
      pdbId: validation.pdbId,
      smiles: raw.smiles,
      boxCenter: raw.boxCenter ?? options?.boxCenter ?? null,
      boxSize: raw.boxSize ?? options?.boxSize ?? "20_20_20",
      boxLabel: options?.boxLabel ?? (options?.boxCenter ? "Student-chosen box" : "Auto: centered on the PDB ligand"),
      ligand: options?.ligand ? { ...options.ligand, smiles: raw.smiles } : null,
      sessionNumber: raw.sessionNumber,
      phase: raw.phase,
    };
    await db
      .update(scientificJobs)
      .set({
        parametersJson: JSON.stringify(jobParams),
        updatedAt: timestamp,
      })
      .where(eq(scientificJobs.id, job.id));

    if (raw.phase !== "ready") {
      return {
        job: (await getScientificJob(db, job.id))!,
        pending: true,
        sessionNumber: raw.sessionNumber,
        normalized: null as SwissDockNormalizedSearch | null,
      };
    }
    const normalized = withChoice(adapter.normalize(raw), jobParams);
    const persisted = await persistSuccess(db, {
      projectIsDemo: project.isDemo,
      moduleRunId: run.id,
      jobId: job.id,
      raw,
      normalized,
      provenance: adapter.getProvenance(),
    });
    return {
      job: persisted.job,
      pending: false,
      sessionNumber: raw.sessionNumber,
      normalized: persisted.normalized,
    };
  } catch (error) {
    const message =
      error instanceof SwissDockAdapterError || error instanceof Error
        ? error.message
        : "SwissDock failed without fabricating poses.";
    await markJobFailed(db, job.id, message);
    mapError(error);
  }
}

export async function pollSwissDockJob(
  db: AppDatabase,
  projectId: string,
  jobId: string,
) {
  const project = await getProjectById(db, projectId);
  if (!project) throw new ServiceError("Project not found.", 404);
  const job = await getScientificJob(db, jobId);
  if (!job || job.tool !== "swissdock") {
    throw new ServiceError("SwissDock job not found.", 404);
  }
  const params = job.parameters ?? {};
  const sessionNumber =
    typeof params.sessionNumber === "string" ? params.sessionNumber : null;
  const pdbId = typeof params.pdbId === "string" ? params.pdbId : null;
  const smiles = typeof params.smiles === "string" ? params.smiles : null;
  if (!sessionNumber || !pdbId || !smiles) {
    throw new ServiceError(
      "SwissDock job is missing session metadata. Submit a new docking run.",
      400,
    );
  }
  if (job.status === "succeeded") {
    const listed = await listSwissDockResults(db, projectId);
    return {
      job,
      pending: false,
      sessionNumber,
      normalized: listed.latestNormalized,
    };
  }

  const startedMs = Date.parse(job.startedAt ?? job.createdAt);
  if (Number.isFinite(startedMs) && Date.now() - startedMs >= SWISSDOCK_JOB_TIMEOUT_MS) {
    const message = `SwissDock did not finish within ${Math.round(SWISSDOCK_JOB_TIMEOUT_MS / 60_000)} minutes. No poses were invented. Try again or import results.`;
    await markJobFailed(db, job.id, message);
    throw new ServiceError(message, 504);
  }

  const adapter = createSwissDockSearchAdapter();
  try {
    const raw = await adapter.pollSession(sessionNumber, pdbId, smiles, {
      allowPending: true,
    });
    const timestamp = nowIso();
    await db
      .update(scientificJobs)
      .set({
        parametersJson: JSON.stringify({
          ...params,
          sessionNumber,
          phase: raw.phase,
        }),
        updatedAt: timestamp,
      })
      .where(eq(scientificJobs.id, job.id));

    if (raw.phase !== "ready") {
      return {
        job: (await getScientificJob(db, job.id))!,
        pending: true,
        sessionNumber,
        normalized: null as SwissDockNormalizedSearch | null,
      };
    }
    const normalized = withChoice(adapter.normalize(raw), params);
    const run = await getModuleRun(db, projectId, SWISSDOCK_MODULE_ID);
    if (!run) throw new ServiceError("SwissDock module run is missing.", 500);
    const persisted = await persistSuccess(db, {
      projectIsDemo: project.isDemo,
      moduleRunId: run.id,
      jobId: job.id,
      raw,
      normalized,
      provenance: adapter.getProvenance(),
    });
    return {
      job: persisted.job,
      pending: false,
      sessionNumber,
      normalized: persisted.normalized,
    };
  } catch (error) {
    if (error instanceof SwissDockAdapterError && error.code === "PENDING") {
      return {
        job: (await getScientificJob(db, job.id))!,
        pending: true,
        sessionNumber,
        normalized: null as SwissDockNormalizedSearch | null,
      };
    }
    const message =
      error instanceof SwissDockAdapterError || error instanceof Error
        ? error.message
        : "SwissDock poll failed without fabricating poses.";
    await markJobFailed(db, job.id, message);
    mapError(error);
  }
}

export async function completeSwissDockModule(
  db: AppDatabase,
  projectId: string,
) {
  const run = await getModuleRun(db, projectId, SWISSDOCK_MODULE_ID);
  if (!run) throw new ServiceError("SwissDock module run is missing.", 500);
  const jobs = await listJobsForModuleRun(db, run.id);
  if (!jobs.some((j) => j.status === "succeeded")) {
    throw new ServiceError(
      "Retrieve SwissDock results (or import legitimate output) before completing this module.",
      400,
    );
  }
  const timestamp = nowIso();
  await db
    .update(moduleRuns)
    .set({
      status: "complete",
      completedAt: timestamp,
      startedAt: run.startedAt ?? timestamp,
      error: null,
      updatedAt: timestamp,
    })
    .where(eq(moduleRuns.id, run.id));
  return { runId: run.id, status: "complete" };
}

export async function listSwissDockResults(
  db: AppDatabase,
  projectId: string,
) {
  const run = await getModuleRun(db, projectId, SWISSDOCK_MODULE_ID);
  if (!run) throw new ServiceError("SwissDock module run is missing.", 500);
  const jobs = await listJobsForModuleRun(db, run.id);
  const rows = await db
    .select()
    .from(results)
    .where(eq(results.moduleRunId, run.id));
  const mapped = rows
    .map(mapResultRow)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const latestNormalizedRow = mapped.find(
    (row) => row.type === "normalized" && row.normalizedData !== null,
  );
  return {
    results: mapped as ScientificResult[],
    jobs,
    latestNormalized:
      (latestNormalizedRow?.normalizedData as SwissDockNormalizedSearch | null) ??
      null,
  };
}
