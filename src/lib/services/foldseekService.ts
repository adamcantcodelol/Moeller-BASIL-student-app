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
  createFoldseekSearchAdapter,
  FoldseekAdapterError,
  type FoldseekNormalizedSearch,
  type FoldseekRawPayload,
} from "@/adapters/foldseek";
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

export const FOLDSEEK_MODULE_ID = "foldseek";

function mapFoldseekError(error: unknown): never {
  if (error instanceof FoldseekAdapterError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "PENDING"
          ? 202
          : error.code === "TIMEOUT" || error.code === "NETWORK"
            ? 502
            : 400;
    throw new ServiceError(error.message, status);
  }
  throw error;
}

/** Top alignments kept per query in the stored raw payload. */
const FOLDSEEK_RAW_STORED_HITS = 100;

/**
 * Foldseek returns every alignment with full coordinates (7.5 MB for 2QRU),
 * which exceeds D1's 2 MB row limit. Store the top hits (upstream order) and
 * say so explicitly; normalized hitCount still reflects the full response.
 */
export function trimFoldseekRawForStorage(
  raw: FoldseekRawPayload,
): FoldseekRawPayload & { storageNote?: string } {
  const result = raw.result;
  const blocks = Array.isArray(result?.results) ? result.results : null;
  if (!result || !blocks) return raw;
  let original = 0;
  let kept = 0;
  const trimmedBlocks = blocks.map((block: unknown) => {
    if (block === null || typeof block !== "object") return block;
    const record = block as Record<string, unknown>;
    if (!Array.isArray(record.alignments)) return block;
    return {
      ...record,
      alignments: record.alignments.map((group: unknown) => {
        if (!Array.isArray(group)) {
          original += 1;
          kept += 1;
          return group;
        }
        original += group.length;
        const slice = group.slice(0, FOLDSEEK_RAW_STORED_HITS);
        kept += slice.length;
        return slice;
      }),
    };
  });
  if (kept === original) return raw;
  return {
    ...raw,
    result: { ...result, results: trimmedBlocks },
    storageNote: `Stored raw payload keeps the top ${FOLDSEEK_RAW_STORED_HITS} alignments per query (${kept} of ${original}) in Foldseek's own ranking to fit the database row limit. Nothing was altered or invented.`,
  };
}

async function persistSuccess(
  db: AppDatabase,
  options: {
    projectIsDemo: boolean;
    moduleRunId: string;
    jobId: string;
    raw: FoldseekRawPayload;
    normalized: FoldseekNormalizedSearch;
    provenance: ReturnType<
      ReturnType<typeof createFoldseekSearchAdapter>["getProvenance"]
    >;
  },
): Promise<{ job: ScientificJob; normalized: FoldseekNormalizedSearch; rawResultId: string }> {
  const timestamp = nowIso();
  const rawResultId = createId();
  const provenance = withRawResultId(options.provenance, rawResultId);

  await db.insert(results).values([
    {
      id: rawResultId,
      moduleRunId: options.moduleRunId,
      type: "raw",
      rawDataJson: serializeRawForStorage(trimFoldseekRawForStorage(options.raw), {
        tool: "Foldseek",
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
        ticketId: options.normalized.ticketId,
      }),
      error: null,
      updatedAt: timestamp,
    })
    .where(eq(moduleRuns.id, options.moduleRunId));

  return { job, normalized: options.normalized, rawResultId };
}

export async function submitFoldseekSearch(
  db: AppDatabase,
  projectId: string,
  rawPdbId?: string,
): Promise<{
  job: ScientificJob;
  pending: boolean;
  ticketId: string | null;
  normalized: FoldseekNormalizedSearch | null;
}> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }

  const structure = await getStructureByProjectId(db, projectId);
  const pdbInput = rawPdbId ?? structure?.pdbId;
  if (!pdbInput) {
    throw new ServiceError(
      "Save a PDB identifier (Protein / PDB Setup) before running Foldseek.",
      400,
    );
  }
  const validation = validatePdbId(pdbInput);
  if (!validation.ok) {
    throw new ServiceError(validation.error, 400);
  }

  const run = await getModuleRun(db, projectId, FOLDSEEK_MODULE_ID);
  if (!run) {
    throw new ServiceError("Foldseek module run is missing.", 500);
  }

  const job = await createScientificJob(db, {
    moduleRunId: run.id,
    tool: "foldseek",
    mode: "adapter",
    parameters: { pdbId: validation.pdbId },
  });
  await markJobRunning(db, job.id);

  const adapter = createFoldseekSearchAdapter();
  try {
    const raw = await adapter.run({ pdbId: validation.pdbId });
    if (!raw.result) {
      const timestamp = nowIso();
      await db
        .update(scientificJobs)
        .set({
          parametersJson: JSON.stringify({
            pdbId: validation.pdbId,
            ticketId: raw.ticketId,
            ticketStatus: raw.ticketStatus,
          }),
          updatedAt: timestamp,
        })
        .where(eq(scientificJobs.id, job.id));
      return {
        job: (await getScientificJob(db, job.id))!,
        pending: true,
        ticketId: raw.ticketId,
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
      ticketId: raw.ticketId,
      normalized: persisted.normalized,
    };
  } catch (error) {
    const message =
      error instanceof FoldseekAdapterError || error instanceof Error
        ? error.message
        : "Foldseek failed without fabricating results.";
    await markJobFailed(db, job.id, message);
    mapFoldseekError(error);
  }
}

export async function pollFoldseekJob(
  db: AppDatabase,
  projectId: string,
  jobId: string,
): Promise<{
  job: ScientificJob;
  pending: boolean;
  normalized: FoldseekNormalizedSearch | null;
}> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }

  const job = await getScientificJob(db, jobId);
  if (!job || job.tool !== "foldseek") {
    throw new ServiceError("Foldseek job not found.", 404);
  }

  const ticketId =
    typeof job.parameters?.ticketId === "string"
      ? job.parameters.ticketId
      : null;
  const pdbId =
    typeof job.parameters?.pdbId === "string" ? job.parameters.pdbId : null;
  if (!ticketId || !pdbId) {
    throw new ServiceError(
      "Foldseek job is missing ticket metadata. Submit a new search.",
      400,
    );
  }

  if (job.status === "succeeded") {
    const listed = await listFoldseekResults(db, projectId);
    return { job, pending: false, normalized: listed.latestNormalized };
  }

  const adapter = createFoldseekSearchAdapter();
  try {
    const raw = await adapter.pollTicket(pdbId, ticketId);
    if (!raw.result) {
      return { job, pending: true, normalized: null };
    }
    const normalized = adapter.normalize(raw);
    const run = await getModuleRun(db, projectId, FOLDSEEK_MODULE_ID);
    if (!run) {
      throw new ServiceError("Foldseek module run is missing.", 500);
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
    if (error instanceof FoldseekAdapterError && error.code === "PENDING") {
      return { job, pending: true, normalized: null };
    }
    const message =
      error instanceof FoldseekAdapterError || error instanceof Error
        ? error.message
        : "Foldseek poll failed without fabricating results.";
    await markJobFailed(db, job.id, message);
    mapFoldseekError(error);
  }
}

export async function completeFoldseekModule(
  db: AppDatabase,
  projectId: string,
): Promise<{ runId: string; status: string }> {
  const run = await getModuleRun(db, projectId, FOLDSEEK_MODULE_ID);
  if (!run) {
    throw new ServiceError("Foldseek module run is missing.", 500);
  }
  const jobs = await listJobsForModuleRun(db, run.id);
  const hasSuccess = jobs.some((job) => job.status === "succeeded");
  if (!hasSuccess) {
    throw new ServiceError(
      "Retrieve Foldseek hits (or import legitimate Foldseek output) before completing this module.",
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

export async function listFoldseekResults(
  db: AppDatabase,
  projectId: string,
): Promise<{
  results: ScientificResult[];
  jobs: ScientificJob[];
  latestNormalized: FoldseekNormalizedSearch | null;
}> {
  const run = await getModuleRun(db, projectId, FOLDSEEK_MODULE_ID);
  if (!run) {
    throw new ServiceError("Foldseek module run is missing.", 500);
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
      (latestNormalizedRow?.normalizedData as FoldseekNormalizedSearch | null) ??
      null,
  };
}
