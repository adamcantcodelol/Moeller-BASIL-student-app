import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { moduleRuns, results } from "@/db/schema";
import { nowIso } from "@/lib/ids";
import { getProjectById } from "@/lib/db/queries/projects";
import { getModuleRun } from "@/lib/db/queries/moduleRuns";
import { ServiceError } from "@/lib/services/projectService";
import {
  createInterProDataAdapter,
  InterProAdapterError,
  type InterProNormalizedAnnotation,
  type InterProRawPayload,
} from "@/adapters/interpro";
import { validateUniProtAccession } from "@/lib/validation/uniprotAccession";
import {
  executeAdapterJob,
  executeImportJob,
  listJobsForModuleRun,
} from "@/lib/jobs/scientificJobService";
import type { ImportPayload } from "@/types/importWorkflow";
import type { ScientificJob } from "@/types/scientificJob";
import type { ScientificResult } from "@/types/result";
import { mapResultRow } from "@/lib/db/mappers";
import { scientificErrorHttpStatus, ScientificError } from "@/adapters/errors";

export const INTERPRO_MODULE_ID = "interpro";

export interface InterProFetchResult {
  job: ScientificJob;
  normalized: InterProNormalizedAnnotation;
  cacheHit: boolean;
  rawResultId: string;
}

function mapInterProError(error: unknown): never {
  if (error instanceof InterProAdapterError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "TIMEOUT" || error.code === "NETWORK"
          ? 502
          : 400;
    throw new ServiceError(error.message, status);
  }
  if (error instanceof ScientificError) {
    throw new ServiceError(error.message, scientificErrorHttpStatus(error));
  }
  throw error;
}

/**
 * Live InterPro REST lookup via Phase 3 job + cache + provenance.
 * Never invents domain/family annotations on failure.
 */
export async function fetchAndSaveInterProAnnotations(
  db: AppDatabase,
  projectId: string,
  rawAccession: string,
): Promise<InterProFetchResult> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }

  const validation = validateUniProtAccession(rawAccession);
  if (!validation.ok) {
    throw new ServiceError(validation.error, 400);
  }

  const run = await getModuleRun(db, projectId, INTERPRO_MODULE_ID);
  if (!run) {
    throw new ServiceError("InterPro module run is missing.", 500);
  }

  const adapter = createInterProDataAdapter();

  try {
    const executed = await executeAdapterJob<
      { uniprotAccession: string },
      InterProRawPayload,
      InterProNormalizedAnnotation
    >(db, {
      moduleRunId: run.id,
      tool: "interpro",
      adapter,
      input: { uniprotAccession: validation.accession },
      isDemo: project.isDemo,
      useCache: true,
    });

    const timestamp = nowIso();
    await db
      .update(moduleRuns)
      .set({
        status: run.status === "complete" ? "complete" : "in_progress",
        startedAt: run.startedAt ?? timestamp,
        parametersJson: JSON.stringify({
          uniprotAccession: validation.accession,
        }),
        error: null,
        updatedAt: timestamp,
      })
      .where(eq(moduleRuns.id, run.id));

    return {
      job: executed.job,
      normalized: executed.normalized,
      cacheHit: executed.cacheHit,
      rawResultId: executed.rawResultId,
    };
  } catch (error) {
    mapInterProError(error);
  }
}

export async function importInterProResults(
  db: AppDatabase,
  projectId: string,
  payload: Omit<ImportPayload, "tool"> & { tool?: string },
): Promise<{ job: ScientificJob; rawResultId: string }> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }

  const run = await getModuleRun(db, projectId, INTERPRO_MODULE_ID);
  if (!run) {
    throw new ServiceError("InterPro module run is missing.", 500);
  }

  try {
    return await executeImportJob(db, {
      moduleRunId: run.id,
      payload: {
        tool: "interpro",
        format: payload.format,
        content: payload.content,
        notes: payload.notes,
      },
      isDemo: project.isDemo,
    });
  } catch (error) {
    mapInterProError(error);
  }
}

export async function completeInterProModule(
  db: AppDatabase,
  projectId: string,
): Promise<{ runId: string; status: string }> {
  const run = await getModuleRun(db, projectId, INTERPRO_MODULE_ID);
  if (!run) {
    throw new ServiceError("InterPro module run is missing.", 500);
  }

  const jobs = await listJobsForModuleRun(db, run.id);
  const hasSuccess = jobs.some((job) => job.status === "succeeded");
  if (!hasSuccess) {
    throw new ServiceError(
      "Retrieve InterPro annotations (or import legitimate InterPro output) before completing this module. The platform will not invent domain annotations.",
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

export async function listInterProResults(
  db: AppDatabase,
  projectId: string,
): Promise<{
  results: ScientificResult[];
  jobs: ScientificJob[];
  latestNormalized: InterProNormalizedAnnotation | null;
}> {
  const run = await getModuleRun(db, projectId, INTERPRO_MODULE_ID);
  if (!run) {
    throw new ServiceError("InterPro module run is missing.", 500);
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
    (row) =>
      row.type === "normalized" &&
      row.source !== "import" &&
      row.normalizedData !== null,
  );

  return {
    results: mapped,
    jobs,
    latestNormalized:
      (latestNormalizedRow?.normalizedData as InterProNormalizedAnnotation | null) ??
      null,
  };
}
