import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { moduleRuns, results, scientificJobs } from "@/db/schema";
import { createId, nowIso } from "@/lib/ids";
import { getProjectById } from "@/lib/db/queries/projects";
import { getModuleRun } from "@/lib/db/queries/moduleRuns";
import { getStructureByProjectId } from "@/lib/db/queries/structures";
import { ServiceError } from "@/lib/services/projectService";
import {
  createDaliSearchAdapter,
  DaliAdapterError,
  type DaliNormalizedSearch,
  type DaliRawPayload,
} from "@/adapters/dali";
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

export const DALI_MODULE_ID = "dali";

function mapDaliError(error: unknown): never {
  if (error instanceof DaliAdapterError) {
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

function resolveChain(
  structureChains: string[] | null | undefined,
  override?: string,
): string {
  if (override && override.trim()) {
    return override.trim().toUpperCase();
  }
  const first = structureChains?.[0];
  if (first && /^[A-Za-z0-9]$/.test(first)) {
    return first.toUpperCase();
  }
  // Many PDB entries use chain A as default when chains missing
  return "A";
}

async function persistSuccess(
  db: AppDatabase,
  options: {
    projectIsDemo: boolean;
    moduleRunId: string;
    jobId: string;
    raw: DaliRawPayload;
    normalized: DaliNormalizedSearch;
    provenance: ReturnType<
      ReturnType<typeof createDaliSearchAdapter>["getProvenance"]
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
        pdbId: options.normalized.pdbId,
        chain: options.normalized.chain,
        jobUrl: options.normalized.jobUrl,
        hitCount: options.normalized.hitCount,
      }),
      error: null,
      updatedAt: timestamp,
    })
    .where(eq(moduleRuns.id, options.moduleRunId));
  return { job, normalized: options.normalized, rawResultId };
}

export async function submitDaliSearch(
  db: AppDatabase,
  projectId: string,
  options?: { pdbId?: string; chain?: string },
) {
  const project = await getProjectById(db, projectId);
  if (!project) throw new ServiceError("Project not found.", 404);
  const structure = await getStructureByProjectId(db, projectId);
  const pdbInput = options?.pdbId ?? structure?.pdbId;
  if (!pdbInput) {
    throw new ServiceError(
      "Save a PDB identifier (Protein / PDB Setup) before running Dali.",
      400,
    );
  }
  const validation = validatePdbId(pdbInput);
  if (!validation.ok) throw new ServiceError(validation.error, 400);
  const chain = resolveChain(structure?.chains, options?.chain);

  const run = await getModuleRun(db, projectId, DALI_MODULE_ID);
  if (!run) throw new ServiceError("Dali module run is missing.", 500);

  const job = await createScientificJob(db, {
    moduleRunId: run.id,
    tool: "dali",
    mode: "adapter",
    parameters: { pdbId: validation.pdbId, chain },
  });
  await markJobRunning(db, job.id);

  const adapter = createDaliSearchAdapter();
  try {
    const raw = await adapter.run({ pdbId: validation.pdbId, chain });
    const timestamp = nowIso();
    await db
      .update(scientificJobs)
      .set({
        parametersJson: JSON.stringify({
          pdbId: validation.pdbId,
          chain,
          jobUrl: raw.jobUrl,
          status: raw.status,
        }),
        updatedAt: timestamp,
      })
      .where(eq(scientificJobs.id, job.id));

    if (raw.status !== "READY" || !raw.summaryText) {
      return {
        job: (await getScientificJob(db, job.id))!,
        pending: true,
        jobUrl: raw.jobUrl,
        normalized: null as DaliNormalizedSearch | null,
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
      jobUrl: raw.jobUrl,
      normalized: persisted.normalized,
    };
  } catch (error) {
    const message =
      error instanceof DaliAdapterError || error instanceof Error
        ? error.message
        : "Dali failed without fabricating results.";
    await markJobFailed(db, job.id, message);
    mapDaliError(error);
  }
}

export async function pollDaliJob(
  db: AppDatabase,
  projectId: string,
  jobId: string,
) {
  const project = await getProjectById(db, projectId);
  if (!project) throw new ServiceError("Project not found.", 404);
  const job = await getScientificJob(db, jobId);
  if (!job || job.tool !== "dali") {
    throw new ServiceError("Dali job not found.", 404);
  }
  const params = job.parameters ?? {};
  const jobUrl = typeof params.jobUrl === "string" ? params.jobUrl : null;
  const pdbId = typeof params.pdbId === "string" ? params.pdbId : null;
  const chain = typeof params.chain === "string" ? params.chain : null;
  if (!jobUrl || !pdbId || !chain) {
    throw new ServiceError(
      "Dali job is missing job URL metadata. Submit a new search.",
      400,
    );
  }
  if (job.status === "succeeded") {
    const listed = await listDaliResults(db, projectId);
    return {
      job,
      pending: false,
      jobUrl,
      normalized: listed.latestNormalized,
    };
  }

  const adapter = createDaliSearchAdapter();
  try {
    const raw = await adapter.pollJob(pdbId, chain, jobUrl, {
      allowPending: true,
    });
    const timestamp = nowIso();
    await db
      .update(scientificJobs)
      .set({
        parametersJson: JSON.stringify({
          pdbId,
          chain,
          jobUrl: raw.jobUrl,
          status: raw.status,
        }),
        updatedAt: timestamp,
      })
      .where(eq(scientificJobs.id, job.id));

    if (raw.status !== "READY" || !raw.summaryText) {
      return {
        job: (await getScientificJob(db, job.id))!,
        pending: true,
        jobUrl: raw.jobUrl,
        normalized: null as DaliNormalizedSearch | null,
      };
    }
    const normalized = adapter.normalize(raw);
    const run = await getModuleRun(db, projectId, DALI_MODULE_ID);
    if (!run) throw new ServiceError("Dali module run is missing.", 500);
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
      jobUrl: raw.jobUrl,
      normalized: persisted.normalized,
    };
  } catch (error) {
    if (error instanceof DaliAdapterError && error.code === "PENDING") {
      return {
        job: (await getScientificJob(db, job.id))!,
        pending: true,
        jobUrl,
        normalized: null as DaliNormalizedSearch | null,
      };
    }
    const message =
      error instanceof DaliAdapterError || error instanceof Error
        ? error.message
        : "Dali poll failed without fabricating results.";
    await markJobFailed(db, job.id, message);
    mapDaliError(error);
  }
}

export async function completeDaliModule(db: AppDatabase, projectId: string) {
  const run = await getModuleRun(db, projectId, DALI_MODULE_ID);
  if (!run) throw new ServiceError("Dali module run is missing.", 500);
  const jobs = await listJobsForModuleRun(db, run.id);
  if (!jobs.some((j) => j.status === "succeeded")) {
    throw new ServiceError(
      "Retrieve Dali hits (or import legitimate Dali output) before completing this module.",
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

export async function listDaliResults(db: AppDatabase, projectId: string) {
  const run = await getModuleRun(db, projectId, DALI_MODULE_ID);
  if (!run) throw new ServiceError("Dali module run is missing.", 500);
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
      (latestNormalizedRow?.normalizedData as DaliNormalizedSearch | null) ??
      null,
  };
}
