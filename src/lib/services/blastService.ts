import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { moduleRuns, results, scientificJobs } from "@/db/schema";
import { createId, nowIso } from "@/lib/ids";
import { getProjectById } from "@/lib/db/queries/projects";
import { getModuleRun } from "@/lib/db/queries/moduleRuns";
import { getStructureByProjectId } from "@/lib/db/queries/structures";
import { ServiceError } from "@/lib/services/projectService";
import {
  BLAST_NCBI_MIN_POLL_INTERVAL_MS,
  createBlastSearchAdapter,
  DEFAULT_BLAST_DATABASE,
  isBlastDatabase,
  BlastAdapterError,
  sanitizeProteinSequence,
  type BlastNormalizedSearch,
  type BlastRawPayload,
} from "@/adapters/blast";
import {
  createScientificJob,
  getScientificJob,
  listJobsForModuleRun,
  markJobFailed,
  markJobRunning,
  markJobSucceeded,
} from "@/lib/jobs/scientificJobService";
import { withRawResultId } from "@/lib/provenance/buildProvenance";
import type { ScientificJob } from "@/types/scientificJob";
import { mapResultRow } from "@/lib/db/mappers";
import type { ScientificResult } from "@/types/result";

export const BLAST_MODULE_ID = "blast";

function mapBlastError(error: unknown): never {
  if (error instanceof BlastAdapterError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "PENDING" || error.code === "RATE_LIMIT"
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

function jobParams(job: ScientificJob): Record<string, unknown> {
  return job.parameters ?? {};
}

async function persistSuccess(
  db: AppDatabase,
  options: {
    projectIsDemo: boolean;
    moduleRunId: string;
    jobId: string;
    raw: BlastRawPayload;
    normalized: BlastNormalizedSearch;
    provenance: ReturnType<
      ReturnType<typeof createBlastSearchAdapter>["getProvenance"]
    >;
  },
): Promise<{
  job: ScientificJob;
  normalized: BlastNormalizedSearch;
  rawResultId: string;
}> {
  const timestamp = nowIso();
  const rawResultId = createId();
  const provenance = withRawResultId(options.provenance, rawResultId);

  await db.insert(results).values([
    {
      id: rawResultId,
      moduleRunId: options.moduleRunId,
      type: "raw",
      rawDataJson: JSON.stringify(options.raw),
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
        rid: options.normalized.rid,
        database: options.normalized.database,
        hitCount: options.normalized.hitCount,
      }),
      error: null,
      updatedAt: timestamp,
    })
    .where(eq(moduleRuns.id, options.moduleRunId));

  return { job, normalized: options.normalized, rawResultId };
}

function resolveSequence(
  structureSequence: string | null | undefined,
  override?: string,
): string {
  const raw = (override ?? structureSequence ?? "").trim();
  return sanitizeProteinSequence(raw);
}

export async function submitBlastSearch(
  db: AppDatabase,
  projectId: string,
  options?: { sequence?: string; database?: string },
): Promise<{
  job: ScientificJob;
  pending: boolean;
  rid: string | null;
  rtoe: number | null;
  normalized: BlastNormalizedSearch | null;
}> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }

  const structure = await getStructureByProjectId(db, projectId);
  const sequence = resolveSequence(structure?.sequence, options?.sequence);
  if (sequence.length < 10) {
    throw new ServiceError(
      "Save a PDB structure with a sequence (Protein / PDB Setup → retrieve from RCSB) before running BLAST, or provide a sequence.",
      400,
    );
  }

  const databaseRaw = options?.database ?? DEFAULT_BLAST_DATABASE;
  if (!isBlastDatabase(databaseRaw)) {
    throw new ServiceError(
      `Unsupported BLAST database "${databaseRaw}". Allowed: swissprot, pdbaa, refseq_protein, nr.`,
      400,
    );
  }

  const run = await getModuleRun(db, projectId, BLAST_MODULE_ID);
  if (!run) {
    throw new ServiceError("BLAST module run is missing.", 500);
  }

  const job = await createScientificJob(db, {
    moduleRunId: run.id,
    tool: "blast",
    mode: "adapter",
    parameters: {
      database: databaseRaw,
      queryLength: sequence.length,
      pdbId: structure?.pdbId ?? null,
    },
  });
  await markJobRunning(db, job.id);

  const adapter = createBlastSearchAdapter();
  try {
    const raw = await adapter.run({
      sequence,
      database: databaseRaw,
      queryTitle: structure?.pdbId ?? "moeller-basil",
    });
    const timestamp = nowIso();
    await db
      .update(scientificJobs)
      .set({
        parametersJson: JSON.stringify({
          database: databaseRaw,
          queryLength: sequence.length,
          pdbId: structure?.pdbId ?? null,
          rid: raw.rid,
          rtoe: raw.rtoe,
          status: raw.status,
          lastPollAt: timestamp,
        }),
        updatedAt: timestamp,
      })
      .where(eq(scientificJobs.id, job.id));

    if (raw.status !== "READY" || !raw.resultsText) {
      return {
        job: (await getScientificJob(db, job.id))!,
        pending: true,
        rid: raw.rid,
        rtoe: raw.rtoe,
        normalized: null,
      };
    }

    const normalized = adapter.normalize(raw);
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
      rid: raw.rid,
      rtoe: raw.rtoe,
      normalized: persisted.normalized,
    };
  } catch (error) {
    const message =
      error instanceof BlastAdapterError || error instanceof Error
        ? error.message
        : "BLAST failed without fabricating results.";
    await markJobFailed(db, job.id, message);
    mapBlastError(error);
  }
}

export async function pollBlastJob(
  db: AppDatabase,
  projectId: string,
  jobId: string,
): Promise<{
  job: ScientificJob;
  pending: boolean;
  rid: string | null;
  rtoe: number | null;
  normalized: BlastNormalizedSearch | null;
  /** True when Worker skipped NCBI due to ≥60s spacing. */
  deferredNcbiPoll?: boolean;
}> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }

  const job = await getScientificJob(db, jobId);
  if (!job || job.tool !== "blast") {
    throw new ServiceError("BLAST job not found.", 404);
  }

  const params = jobParams(job);
  const rid = typeof params.rid === "string" ? params.rid : null;
  const database =
    typeof params.database === "string"
      ? params.database
      : DEFAULT_BLAST_DATABASE;
  const rtoe = typeof params.rtoe === "number" ? params.rtoe : null;
  const queryLength =
    typeof params.queryLength === "number" ? params.queryLength : null;
  const lastPollAt =
    typeof params.lastPollAt === "string" ? params.lastPollAt : null;

  if (!rid) {
    throw new ServiceError(
      "BLAST job is missing RID. Submit a new search.",
      400,
    );
  }

  if (job.status === "succeeded") {
    const listed = await listBlastResults(db, projectId);
    return {
      job,
      pending: false,
      rid,
      rtoe,
      normalized: listed.latestNormalized,
    };
  }

  // Enforce NCBI guidance: at most one upstream poll per RID per 60s.
  if (lastPollAt) {
    const elapsed = Date.now() - Date.parse(lastPollAt);
    if (
      Number.isFinite(elapsed) &&
      elapsed >= 0 &&
      elapsed < BLAST_NCBI_MIN_POLL_INTERVAL_MS
    ) {
      return {
        job,
        pending: true,
        rid,
        rtoe,
        normalized: null,
        deferredNcbiPoll: true,
      };
    }
  }

  const adapter = createBlastSearchAdapter();
  try {
    const raw = await adapter.pollRid(rid, database, {
      allowPending: true,
      queryLength,
      rtoe,
    });
    const timestamp = nowIso();
    await db
      .update(scientificJobs)
      .set({
        parametersJson: JSON.stringify({
          ...params,
          rid,
          database,
          rtoe: raw.rtoe ?? rtoe,
          status: raw.status,
          lastPollAt: timestamp,
          thereAreHits: raw.thereAreHits,
        }),
        updatedAt: timestamp,
      })
      .where(eq(scientificJobs.id, job.id));

    if (raw.status !== "READY" || !raw.resultsText) {
      return {
        job: (await getScientificJob(db, job.id))!,
        pending: true,
        rid,
        rtoe: raw.rtoe ?? rtoe,
        normalized: null,
      };
    }

    const normalized = adapter.normalize(raw);
    const run = await getModuleRun(db, projectId, BLAST_MODULE_ID);
    if (!run) {
      throw new ServiceError("BLAST module run is missing.", 500);
    }
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
      rid,
      rtoe: raw.rtoe ?? rtoe,
      normalized: persisted.normalized,
    };
  } catch (error) {
    if (error instanceof BlastAdapterError && error.code === "PENDING") {
      return {
        job: (await getScientificJob(db, job.id))!,
        pending: true,
        rid,
        rtoe,
        normalized: null,
      };
    }
    const message =
      error instanceof BlastAdapterError || error instanceof Error
        ? error.message
        : "BLAST poll failed without fabricating results.";
    await markJobFailed(db, job.id, message);
    mapBlastError(error);
  }
}

export async function completeBlastModule(
  db: AppDatabase,
  projectId: string,
): Promise<{ runId: string; status: string }> {
  const run = await getModuleRun(db, projectId, BLAST_MODULE_ID);
  if (!run) {
    throw new ServiceError("BLAST module run is missing.", 500);
  }
  const jobs = await listJobsForModuleRun(db, run.id);
  const hasSuccess = jobs.some((j) => j.status === "succeeded");
  if (!hasSuccess) {
    throw new ServiceError(
      "Retrieve BLAST hits (or import legitimate BLAST output) before completing this module.",
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

export async function listBlastResults(
  db: AppDatabase,
  projectId: string,
): Promise<{
  results: ScientificResult[];
  jobs: ScientificJob[];
  latestNormalized: BlastNormalizedSearch | null;
}> {
  const run = await getModuleRun(db, projectId, BLAST_MODULE_ID);
  if (!run) {
    throw new ServiceError("BLAST module run is missing.", 500);
  }
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
    results: mapped,
    jobs,
    latestNormalized:
      (latestNormalizedRow?.normalizedData as BlastNormalizedSearch | null) ??
      null,
  };
}
