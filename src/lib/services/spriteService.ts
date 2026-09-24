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
  createSpriteSearchAdapter,
  DEFAULT_SPRITE_DATABASE,
  isSpriteDatabase,
  SpriteAdapterError,
  type SpriteNormalizedSearch,
  type SpriteRawPayload,
} from "@/adapters/sprite";
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
import type { ScientificJob } from "@/types/scientificJob";
import { mapResultRow } from "@/lib/db/mappers";
import type { ScientificResult } from "@/types/result";

export const SPRITE_MODULE_ID = "sprite";

function mapSpriteError(error: unknown): never {
  if (error instanceof SpriteAdapterError) {
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
    raw: SpriteRawPayload;
    normalized: SpriteNormalizedSearch;
    provenance: ReturnType<
      ReturnType<typeof createSpriteSearchAdapter>["getProvenance"]
    >;
  },
): Promise<{
  job: ScientificJob;
  normalized: SpriteNormalizedSearch;
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
      rawDataJson: serializeRawForStorage(options.raw, {
        tool: "SPRITE",
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
        pdbId: options.normalized.pdbId,
        sessionId: options.normalized.sessionId,
        strucId: options.normalized.strucId,
        database: options.normalized.database,
      }),
      error: null,
      updatedAt: timestamp,
    })
    .where(eq(moduleRuns.id, options.moduleRunId));

  return { job, normalized: options.normalized, rawResultId };
}

export async function submitSpriteSearch(
  db: AppDatabase,
  projectId: string,
  options?: { pdbId?: string; database?: string },
): Promise<{
  job: ScientificJob;
  pending: boolean;
  sessionId: string | null;
  normalized: SpriteNormalizedSearch | null;
}> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }

  const structure = await getStructureByProjectId(db, projectId);
  const pdbInput = options?.pdbId ?? structure?.pdbId;
  if (!pdbInput) {
    throw new ServiceError(
      "Save a PDB identifier (Protein / PDB Setup) before running SPRITE.",
      400,
    );
  }
  const validation = validatePdbId(pdbInput);
  if (!validation.ok) {
    throw new ServiceError(validation.error, 400);
  }

  const databaseRaw = options?.database ?? DEFAULT_SPRITE_DATABASE;
  if (!isSpriteDatabase(databaseRaw)) {
    throw new ServiceError(
      `Unsupported SPRITE database "${databaseRaw}". Allowed: csa3, all3, m-csa3, csa32, m-csa32.`,
      400,
    );
  }

  const run = await getModuleRun(db, projectId, SPRITE_MODULE_ID);
  if (!run) {
    throw new ServiceError("SPRITE module run is missing.", 500);
  }

  const job = await createScientificJob(db, {
    moduleRunId: run.id,
    tool: "sprite",
    mode: "adapter",
    parameters: { pdbId: validation.pdbId, database: databaseRaw },
  });
  await markJobRunning(db, job.id);

  const adapter = createSpriteSearchAdapter();
  try {
    const raw = await adapter.run({
      pdbId: validation.pdbId,
      database: databaseRaw,
    });
    if (!raw.results) {
      const timestamp = nowIso();
      await db
        .update(scientificJobs)
        .set({
          parametersJson: JSON.stringify({
            pdbId: validation.pdbId,
            database: databaseRaw,
            sessionId: raw.sessionId,
            strucId: raw.strucId,
            celeryState: raw.celeryState,
          }),
          updatedAt: timestamp,
        })
        .where(eq(scientificJobs.id, job.id));
      return {
        job: (await getScientificJob(db, job.id))!,
        pending: true,
        sessionId: raw.sessionId,
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
      sessionId: raw.sessionId,
      normalized: persisted.normalized,
    };
  } catch (error) {
    const message =
      error instanceof SpriteAdapterError || error instanceof Error
        ? error.message
        : "SPRITE failed without fabricating results.";
    await markJobFailed(db, job.id, message);
    mapSpriteError(error);
  }
}

export async function pollSpriteJob(
  db: AppDatabase,
  projectId: string,
  jobId: string,
): Promise<{
  job: ScientificJob;
  pending: boolean;
  normalized: SpriteNormalizedSearch | null;
}> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }

  const job = await getScientificJob(db, jobId);
  if (!job || job.tool !== "sprite") {
    throw new ServiceError("SPRITE job not found.", 404);
  }

  const sessionId =
    typeof job.parameters?.sessionId === "string"
      ? job.parameters.sessionId
      : null;
  const strucId =
    typeof job.parameters?.strucId === "string" ? job.parameters.strucId : null;
  const pdbId =
    typeof job.parameters?.pdbId === "string" ? job.parameters.pdbId : null;
  const database =
    typeof job.parameters?.database === "string"
      ? job.parameters.database
      : DEFAULT_SPRITE_DATABASE;

  if (!sessionId || !strucId || !pdbId) {
    throw new ServiceError(
      "SPRITE job is missing session metadata. Submit a new search.",
      400,
    );
  }

  if (job.status === "succeeded") {
    const listed = await listSpriteResults(db, projectId);
    return { job, pending: false, normalized: listed.latestNormalized };
  }

  const adapter = createSpriteSearchAdapter();
  try {
    const raw = await adapter.pollSession(pdbId, sessionId, strucId, database);
    if (!raw.results) {
      return { job, pending: true, normalized: null };
    }
    const normalized = adapter.normalize(raw);
    const run = await getModuleRun(db, projectId, SPRITE_MODULE_ID);
    if (!run) {
      throw new ServiceError("SPRITE module run is missing.", 500);
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
      normalized: persisted.normalized,
    };
  } catch (error) {
    if (error instanceof SpriteAdapterError && error.code === "PENDING") {
      const timestamp = nowIso();
      await db
        .update(scientificJobs)
        .set({
          parametersJson: JSON.stringify({
            pdbId,
            database,
            sessionId,
            strucId,
            celeryState: error.message,
          }),
          updatedAt: timestamp,
        })
        .where(eq(scientificJobs.id, job.id));
      return { job: (await getScientificJob(db, job.id))!, pending: true, normalized: null };
    }
    const message =
      error instanceof SpriteAdapterError || error instanceof Error
        ? error.message
        : "SPRITE poll failed without fabricating results.";
    await markJobFailed(db, job.id, message);
    mapSpriteError(error);
  }
}

export async function completeSpriteModule(
  db: AppDatabase,
  projectId: string,
): Promise<{ runId: string; status: string }> {
  const run = await getModuleRun(db, projectId, SPRITE_MODULE_ID);
  if (!run) {
    throw new ServiceError("SPRITE module run is missing.", 500);
  }
  const jobs = await listJobsForModuleRun(db, run.id);
  const hasSuccess = jobs.some((job) => job.status === "succeeded");
  if (!hasSuccess) {
    throw new ServiceError(
      "Retrieve SPRITE hits (or import legitimate SPRITE output) before completing this module.",
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

export async function listSpriteResults(
  db: AppDatabase,
  projectId: string,
): Promise<{
  results: ScientificResult[];
  jobs: ScientificJob[];
  latestNormalized: SpriteNormalizedSearch | null;
}> {
  const run = await getModuleRun(db, projectId, SPRITE_MODULE_ID);
  if (!run) {
    throw new ServiceError("SPRITE module run is missing.", 500);
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
      (latestNormalizedRow?.normalizedData as SpriteNormalizedSearch | null) ??
      null,
  };
}
