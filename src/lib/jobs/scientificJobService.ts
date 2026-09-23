import { desc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { moduleRuns, results, scientificJobs } from "@/db/schema";
import { createId, nowIso, parseJson } from "@/lib/ids";
import { ScientificError } from "@/adapters/errors";
import {
  ScientificAdapterNotImplementedError,
  type ScientificAdapter,
} from "@/adapters/scientificAdapter";
import {
  lookupAdapterCache,
  parseCachedResponse,
  putAdapterCache,
} from "@/lib/cache/adapterCache";
import { withRawResultId } from "@/lib/provenance/buildProvenance";
import type {
  ScientificJob,
  ScientificJobMode,
  ScientificJobStatus,
} from "@/types/scientificJob";
import type { ModuleRunStatus } from "@/types/moduleRun";
import { mapScientificJob } from "@/lib/db/mappers";
import { storeImportedRawResult } from "@/adapters/import/storeImport";
import type { ImportPayload } from "@/types/importWorkflow";

function mapModuleRunStatusForJob(
  jobStatus: ScientificJobStatus,
  current: ModuleRunStatus,
): ModuleRunStatus {
  if (current === "not_available_yet") {
    return "not_available_yet";
  }
  if (current === "complete") {
    return "complete";
  }
  switch (jobStatus) {
    case "failed":
      return "error";
    case "queued":
    case "running":
    case "awaiting_import":
    case "succeeded":
      return "in_progress";
    default:
      return current;
  }
}

async function syncModuleRun(
  db: AppDatabase,
  moduleRunId: string,
  jobStatus: ScientificJobStatus,
  error: string | null,
): Promise<void> {
  const rows = await db
    .select()
    .from(moduleRuns)
    .where(eq(moduleRuns.id, moduleRunId))
    .limit(1);
  if (rows.length === 0) {
    throw new ScientificError(
      "JOB",
      `Module run ${moduleRunId} not found while updating job state.`,
    );
  }

  const current = rows[0].status as ModuleRunStatus;
  const nextStatus = mapModuleRunStatusForJob(jobStatus, current);
  const timestamp = nowIso();

  await db
    .update(moduleRuns)
    .set({
      status: nextStatus,
      startedAt:
        jobStatus === "running" || jobStatus === "awaiting_import"
          ? (rows[0].startedAt ?? timestamp)
          : rows[0].startedAt,
      error: jobStatus === "failed" ? error : jobStatus === "succeeded" ? null : rows[0].error,
      updatedAt: timestamp,
    })
    .where(eq(moduleRuns.id, moduleRunId));
}

export async function createScientificJob(
  db: AppDatabase,
  input: {
    moduleRunId: string;
    tool: string;
    mode: ScientificJobMode;
    parameters?: Record<string, unknown> | null;
    initialStatus?: Extract<
      ScientificJobStatus,
      "queued" | "awaiting_import"
    >;
  },
): Promise<ScientificJob> {
  const run = await db
    .select()
    .from(moduleRuns)
    .where(eq(moduleRuns.id, input.moduleRunId))
    .limit(1);
  if (run.length === 0) {
    throw new ScientificError(
      "JOB",
      `Cannot create job: module run ${input.moduleRunId} does not exist.`,
    );
  }

  const timestamp = nowIso();
  const status = input.initialStatus ?? "queued";
  const id = createId();

  await db.insert(scientificJobs).values({
    id,
    moduleRunId: input.moduleRunId,
    tool: input.tool,
    status,
    mode: input.mode,
    parametersJson: input.parameters
      ? JSON.stringify(input.parameters)
      : null,
    error: null,
    cacheHit: false,
    resultId: null,
    startedAt: null,
    finishedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await syncModuleRun(db, input.moduleRunId, status, null);

  const created = await getScientificJob(db, id);
  if (!created) {
    throw new ScientificError("JOB", "Job could not be created.");
  }
  return created;
}

export async function getScientificJob(
  db: AppDatabase,
  jobId: string,
): Promise<ScientificJob | null> {
  const rows = await db
    .select()
    .from(scientificJobs)
    .where(eq(scientificJobs.id, jobId))
    .limit(1);
  return rows[0] ? mapScientificJob(rows[0]) : null;
}

export async function listJobsForModuleRun(
  db: AppDatabase,
  moduleRunId: string,
): Promise<ScientificJob[]> {
  const rows = await db
    .select()
    .from(scientificJobs)
    .where(eq(scientificJobs.moduleRunId, moduleRunId))
    .orderBy(desc(scientificJobs.createdAt));
  return rows.map(mapScientificJob);
}

async function updateJob(
  db: AppDatabase,
  jobId: string,
  patch: Partial<{
    status: ScientificJobStatus;
    error: string | null;
    cacheHit: boolean;
    resultId: string | null;
    startedAt: string | null;
    finishedAt: string | null;
  }>,
): Promise<ScientificJob> {
  const existing = await getScientificJob(db, jobId);
  if (!existing) {
    throw new ScientificError("JOB", `Job ${jobId} not found.`);
  }

  const timestamp = nowIso();
  await db
    .update(scientificJobs)
    .set({
      status: patch.status ?? existing.status,
      error: patch.error !== undefined ? patch.error : existing.error,
      cacheHit: patch.cacheHit ?? existing.cacheHit,
      resultId: patch.resultId !== undefined ? patch.resultId : existing.resultId,
      startedAt:
        patch.startedAt !== undefined ? patch.startedAt : existing.startedAt,
      finishedAt:
        patch.finishedAt !== undefined ? patch.finishedAt : existing.finishedAt,
      updatedAt: timestamp,
    })
    .where(eq(scientificJobs.id, jobId));

  const status = patch.status ?? existing.status;
  await syncModuleRun(
    db,
    existing.moduleRunId,
    status,
    patch.error !== undefined ? patch.error : existing.error,
  );

  const updated = await getScientificJob(db, jobId);
  if (!updated) {
    throw new ScientificError("JOB", `Job ${jobId} disappeared after update.`);
  }
  return updated;
}

export async function markJobRunning(
  db: AppDatabase,
  jobId: string,
): Promise<ScientificJob> {
  return updateJob(db, jobId, {
    status: "running",
    startedAt: nowIso(),
    error: null,
  });
}

export async function markJobSucceeded(
  db: AppDatabase,
  jobId: string,
  options?: { resultId?: string | null; cacheHit?: boolean },
): Promise<ScientificJob> {
  return updateJob(db, jobId, {
    status: "succeeded",
    finishedAt: nowIso(),
    error: null,
    resultId: options?.resultId ?? null,
    cacheHit: options?.cacheHit ?? false,
  });
}

export async function markJobFailed(
  db: AppDatabase,
  jobId: string,
  errorMessage: string,
): Promise<ScientificJob> {
  return updateJob(db, jobId, {
    status: "failed",
    finishedAt: nowIso(),
    error: errorMessage,
  });
}

export async function markJobAwaitingImport(
  db: AppDatabase,
  jobId: string,
): Promise<ScientificJob> {
  return updateJob(db, jobId, {
    status: "awaiting_import",
    startedAt: nowIso(),
    error: null,
  });
}

export interface ExecuteAdapterJobResult<TOutput, TNormalized> {
  job: ScientificJob;
  output: TOutput;
  normalized: TNormalized;
  cacheHit: boolean;
  rawResultId: string;
}

/**
 * Queues/runs an adapter under job state machine with optional response cache.
 * On failure the job is marked failed and no fabricated result is stored.
 */
export async function executeAdapterJob<TInput, TOutput, TNormalized>(
  db: AppDatabase,
  options: {
    moduleRunId: string;
    tool: string;
    adapter: ScientificAdapter<TInput, TOutput, TNormalized>;
    input: TInput;
    isDemo?: boolean;
    useCache?: boolean;
    cacheTtlMs?: number;
  },
): Promise<ExecuteAdapterJobResult<TOutput, TNormalized>> {
  const job = await createScientificJob(db, {
    moduleRunId: options.moduleRunId,
    tool: options.tool,
    mode: "adapter",
    parameters:
      options.input !== null && typeof options.input === "object"
        ? (options.input as Record<string, unknown>)
        : { input: options.input },
    initialStatus: "queued",
  });

  await markJobRunning(db, job.id);

  try {
    let output: TOutput;
    let cacheHit = false;
    let cachedProvenance: ReturnType<typeof options.adapter.getProvenance> | null =
      null;

    if (options.useCache !== false) {
      const lookup = await lookupAdapterCache(db, options.tool, options.input);
      if (lookup.hit && lookup.entry) {
        output = parseCachedResponse<TOutput>(lookup.entry);
        cacheHit = true;
        if (lookup.entry.provenanceJson) {
          try {
            cachedProvenance = JSON.parse(
              lookup.entry.provenanceJson,
            ) as ReturnType<typeof options.adapter.getProvenance>;
          } catch {
            cachedProvenance = null;
          }
        }
      } else {
        output = await options.adapter.run(options.input);
        await putAdapterCache(db, {
          tool: options.tool,
          request: options.input,
          response: output,
          provenance: options.adapter.getProvenance(),
          ttlMs: options.cacheTtlMs,
        });
      }
    } else {
      output = await options.adapter.run(options.input);
    }

    const normalized = options.adapter.normalize(output);
    const provenanceBase = cachedProvenance ?? options.adapter.getProvenance();
    const timestamp = nowIso();
    const rawResultId = createId();
    const provenance = withRawResultId(provenanceBase, rawResultId);

    await db.insert(results).values([
      {
        id: rawResultId,
        moduleRunId: options.moduleRunId,
        type: "raw",
        rawDataJson: JSON.stringify(output),
        normalizedDataJson: null,
        source: provenance.source,
        provenanceJson: JSON.stringify(provenance),
        isDemo: Boolean(options.isDemo),
        createdAt: timestamp,
      },
      {
        id: createId(),
        moduleRunId: options.moduleRunId,
        type: "normalized",
        rawDataJson: null,
        normalizedDataJson: JSON.stringify(normalized),
        source: provenance.source,
        provenanceJson: JSON.stringify(provenance),
        isDemo: Boolean(options.isDemo),
        createdAt: timestamp,
      },
    ]);

    const succeeded = await markJobSucceeded(db, job.id, {
      resultId: rawResultId,
      cacheHit,
    });

    return {
      job: succeeded,
      output,
      normalized,
      cacheHit,
      rawResultId,
    };
  } catch (error) {
    const message =
      error instanceof ScientificAdapterNotImplementedError ||
      error instanceof ScientificError ||
      error instanceof Error
        ? error.message
        : "Scientific adapter failed without fabricating results.";

    await markJobFailed(db, job.id, message);
    throw error;
  }
}

/**
 * Starts an import-mode job and stores the raw imported payload.
 * Does not invent normalized scientific interpretations.
 */
export async function executeImportJob(
  db: AppDatabase,
  options: {
    moduleRunId: string;
    payload: ImportPayload;
    isDemo?: boolean;
  },
): Promise<{ job: ScientificJob; rawResultId: string }> {
  const job = await createScientificJob(db, {
    moduleRunId: options.moduleRunId,
    tool: options.payload.tool,
    mode: "import",
    parameters: {
      format: options.payload.format,
      notes: options.payload.notes ?? null,
    },
    initialStatus: "awaiting_import",
  });

  try {
    const stored = await storeImportedRawResult(db, {
      moduleRunId: options.moduleRunId,
      payload: options.payload,
      isDemo: Boolean(options.isDemo),
    });

    const succeeded = await markJobSucceeded(db, job.id, {
      resultId: stored.rawResult.id,
      cacheHit: false,
    });

    return { job: succeeded, rawResultId: stored.rawResult.id };
  } catch (error) {
    const message =
      error instanceof ScientificError || error instanceof Error
        ? error.message
        : "Import failed. No fabricated scientific result was stored.";
    await markJobFailed(db, job.id, message);
    throw error;
  }
}

export function readJobParameters(
  job: ScientificJob,
): Record<string, unknown> | null {
  return job.parameters;
}

/** Test helper: parse parameters JSON from a raw row if needed. */
export function parseJobParametersJson(
  parametersJson: string | null,
): Record<string, unknown> | null {
  return parseJson<Record<string, unknown> | null>(parametersJson, null);
}
