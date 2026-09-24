import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { moduleRuns, results, scientificJobs } from "@/db/schema";
import { createId, nowIso } from "@/lib/ids";
import { getProjectById } from "@/lib/db/queries/projects";
import { getModuleRun } from "@/lib/db/queries/moduleRuns";
import { getStructureByProjectId } from "@/lib/db/queries/structures";
import { ServiceError } from "@/lib/services/projectService";
import {
  CLEAN_API_LABEL,
  CLEAN_MAX_SEQUENCE_LENGTH,
  CLEAN_MIN_SEQUENCE_LENGTH,
  CLEAN_PROVENANCE_SOURCE,
  CLEAN_UNAVAILABLE_MESSAGE,
  CleanAdapterError,
  CleanClient,
  fetchExpasyEnzymeNames,
  getCleanResultsHealth,
  parseCleanMaxsepCsv,
  parseCleanResultsBody,
  recordCleanResultsHealth,
  type CleanHealthStatus,
  type CleanNormalizedResult,
  type CleanPrediction,
  type CleanRawPayload,
} from "@/adapters/clean";
import {
  createScientificJob,
  getScientificJob,
  listJobsForModuleRun,
  markJobFailed,
  markJobRunning,
  markJobSucceeded,
} from "@/lib/jobs/scientificJobService";
import { buildProvenance, withRawResultId } from "@/lib/provenance/buildProvenance";
import { mapResultRow } from "@/lib/db/mappers";
import type { ScientificJob } from "@/types/scientificJob";
import type { ScientificResult } from "@/types/result";

export const CLEAN_MODULE_ID = "clean";
/** Space results retries ~30s apart after the job reports completed. */
export const CLEAN_RESULT_RETRY_SPACING_MS = 30_000;
/** First results fetch + 2 retries. */
export const CLEAN_RESULT_MAX_ATTEMPTS = 3;
/** Observed runtime ~77s for one 260-aa sequence; give queues room. */
export const CLEAN_JOB_TIMEOUT_MS = 12 * 60_000;
/** Suggested client/pipeline poll spacing while queued/processing. */
export const CLEAN_POLL_SPACING_MS = 15_000;

const STANDARD_AA = /[GPAVLIMCFYWHKRQNEDST]/g;

/** Upstream results storage is failing — no predictions can be retrieved. */
export class CleanUnavailableError extends ServiceError {
  constructor(
    readonly detail: string,
    message: string = CLEAN_UNAVAILABLE_MESSAGE,
  ) {
    super(message, 503);
    this.name = "CleanUnavailableError";
  }
}

export function isCleanUnavailableError(
  error: unknown,
): error is CleanUnavailableError {
  return error instanceof CleanUnavailableError;
}

function mapCleanError(error: unknown): never {
  if (error instanceof ServiceError) throw error;
  if (error instanceof CleanAdapterError) {
    const status =
      error.code === "VALIDATION"
        ? 400
        : error.code === "NOT_FOUND"
          ? 404
          : error.code === "RESULTS_UNAVAILABLE"
            ? 503
            : 502;
    throw new ServiceError(error.message, status);
  }
  throw error;
}

/**
 * Prepare an RCSB sequence for CLEAN: strip FASTA headers/whitespace and
 * drop non-standard residue letters (X, U, B, Z…) the CLEAN web app rejects.
 * Refuses (never truncates) sequences outside CLEAN's 10–1022 aa window.
 */
export function prepareCleanSequence(raw: string | null | undefined): {
  sequence: string;
  removedNonStandard: number;
} {
  const letters = (raw ?? "")
    .split("\n")
    .filter((line) => !line.trim().startsWith(">"))
    .join("")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  const standard = (letters.match(STANDARD_AA) ?? []).join("");
  const removedNonStandard = letters.length - standard.length;
  if (standard.length < CLEAN_MIN_SEQUENCE_LENGTH) {
    throw new ServiceError(
      "CLEAN needs a protein sequence of at least 10 amino acids. Load RCSB metadata in Enter PDB first. No EC numbers were invented.",
      400,
    );
  }
  if (removedNonStandard > Math.max(5, letters.length * 0.05)) {
    throw new ServiceError(
      `This sequence has ${removedNonStandard} non-standard residue letters (X/U/B/Z…), too many for a trustworthy CLEAN prediction. No EC numbers were invented.`,
      400,
    );
  }
  if (standard.length > CLEAN_MAX_SEQUENCE_LENGTH) {
    throw new ServiceError(
      `CLEAN accepts sequences up to ${CLEAN_MAX_SEQUENCE_LENGTH} amino acids; this chain has ${standard.length}. Run CLEAN on a single domain externally and import the CSV. No EC numbers were invented.`,
      400,
    );
  }
  return { sequence: standard, removedNonStandard };
}

function buildHeader(pdbId: string | null | undefined): string {
  const base = (pdbId ?? "query").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return `${base || "QUERY"}_entity1`;
}

function numberParam(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Normalize a completed CLEAN results body into the stored shape. */
export function normalizeCleanLiveResult(
  raw: CleanRawPayload,
  options: { retrievedAt: string; enzymeNames?: Record<string, string> },
): CleanNormalizedResult {
  const sequences = parseCleanResultsBody(raw.results);
  const match =
    sequences.find((entry) => entry.header === raw.header) ?? sequences[0];
  const names = options.enzymeNames ?? {};
  const predictions: CleanPrediction[] = (match?.predictions ?? []).map(
    (prediction) => ({
      ...prediction,
      enzymeName: names[prediction.ecNumber] ?? prediction.enzymeName ?? null,
    }),
  );
  return {
    kind: "clean-live",
    mmliJobId: raw.mmliJobId,
    header: match?.header ?? raw.header,
    sequenceLength: raw.sequenceLength,
    predictionCount: predictions.length,
    predictions,
    topPrediction: predictions[0] ?? null,
    provenance: buildProvenance({
      tool: "CLEAN",
      source: CLEAN_PROVENANCE_SOURCE,
      retrievedAt: options.retrievedAt,
      parameters: {
        mmliJobId: raw.mmliJobId,
        header: raw.header,
        sequenceLength: raw.sequenceLength,
        api: CLEAN_API_LABEL,
        model: "CLEAN (Yu et al., Science 2023) via UIUC MoleculeMaker",
        confidenceThresholds: "High ≥0.8 · Medium 0.2–0.8 · Low <0.2",
      },
      version: CLEAN_API_LABEL,
    }),
  };
}

/** Derive a display-only normalized view from an imported CLEAN CSV. */
export function normalizeCleanImport(
  content: string,
  provenance: CleanNormalizedResult["provenance"],
): CleanNormalizedResult | null {
  const rows = parseCleanMaxsepCsv(content);
  const first = rows[0];
  if (!first) return null;
  return {
    kind: "clean-import",
    mmliJobId: null,
    header: first.header,
    sequenceLength: null,
    predictionCount: first.predictions.length,
    predictions: first.predictions,
    topPrediction: first.predictions[0] ?? null,
    provenance,
  };
}

async function persistSuccess(
  db: AppDatabase,
  options: {
    projectIsDemo: boolean;
    moduleRunId: string;
    jobId: string;
    raw: CleanRawPayload;
    normalized: CleanNormalizedResult;
  },
): Promise<{ job: ScientificJob; normalized: CleanNormalizedResult }> {
  const timestamp = nowIso();
  const rawResultId = createId();
  const provenance = withRawResultId(options.normalized.provenance, rawResultId);
  const normalized = { ...options.normalized, provenance };

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
      normalizedDataJson: JSON.stringify(normalized),
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
        mmliJobId: options.raw.mmliJobId,
        topEc: normalized.topPrediction?.ecNumber ?? null,
      }),
      error: null,
      updatedAt: timestamp,
    })
    .where(eq(moduleRuns.id, options.moduleRunId));

  return { job, normalized };
}

async function updateJobParameters(
  db: AppDatabase,
  jobId: string,
  parameters: Record<string, unknown>,
): Promise<ScientificJob> {
  await db
    .update(scientificJobs)
    .set({ parametersJson: JSON.stringify(parameters), updatedAt: nowIso() })
    .where(eq(scientificJobs.id, jobId));
  return (await getScientificJob(db, jobId))!;
}

export interface CleanServiceDeps {
  client?: CleanClient;
  now?: () => number;
  /** Bypass the ~5 min health cache (Retry button). */
  forceHealthCheck?: boolean;
  skipHealthCheck?: boolean;
  enzymeNameFetch?: typeof fetch;
}

/**
 * Check the upstream results store, then submit the project's RCSB sequence.
 * Throws CleanUnavailableError (no job created) when MMLI cannot return
 * results, so students do not wait ~77s+ for a guaranteed failure.
 */
export async function submitCleanPrediction(
  db: AppDatabase,
  projectId: string,
  options: { sequence?: string } & CleanServiceDeps = {},
): Promise<{
  job: ScientificJob;
  pending: boolean;
  mmliJobId: string;
  normalized: CleanNormalizedResult | null;
  health: CleanHealthStatus | null;
}> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }
  const structure = await getStructureByProjectId(db, projectId);
  const { sequence, removedNonStandard } = prepareCleanSequence(
    options.sequence ?? structure?.sequence,
  );

  const client = options.client ?? new CleanClient();
  let health: CleanHealthStatus | null = null;
  if (!options.skipHealthCheck) {
    health = await getCleanResultsHealth({
      client,
      force: options.forceHealthCheck,
      now: options.now,
    });
    if (!health.ok) {
      throw new CleanUnavailableError(health.detail);
    }
  }

  const run = await getModuleRun(db, projectId, CLEAN_MODULE_ID);
  if (!run) {
    throw new ServiceError("CLEAN module run is missing.", 500);
  }

  const header = buildHeader(structure?.pdbId);
  const job = await createScientificJob(db, {
    moduleRunId: run.id,
    tool: "clean",
    mode: "adapter",
    parameters: {
      header,
      sequenceLength: sequence.length,
      removedNonStandard,
      pdbId: structure?.pdbId ?? null,
    },
  });
  await markJobRunning(db, job.id);

  try {
    const mmliJobId = await client.submit(header, sequence);
    const now = options.now ?? Date.now;
    const updated = await updateJobParameters(db, job.id, {
      header,
      sequenceLength: sequence.length,
      removedNonStandard,
      pdbId: structure?.pdbId ?? null,
      mmliJobId,
      phase: "queued",
      submittedAtMs: now(),
      resultAttempts: 0,
      lastResultAttemptAtMs: null,
    });
    return { job: updated, pending: true, mmliJobId, normalized: null, health };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "CLEAN submit failed without fabricating results.";
    await markJobFailed(db, job.id, message);
    mapCleanError(error);
  }
}

/**
 * Poll one CLEAN job: status → (completed) results with up to 2 retries
 * ~30s apart when the results store 5xx's → honest failure.
 */
export async function pollCleanJob(
  db: AppDatabase,
  projectId: string,
  jobId: string,
  deps: CleanServiceDeps = {},
): Promise<{
  job: ScientificJob;
  pending: boolean;
  normalized: CleanNormalizedResult | null;
  phase: string | null;
  nextCheckMs: number;
}> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }
  const job = await getScientificJob(db, jobId);
  if (!job || job.tool !== "clean") {
    throw new ServiceError("CLEAN job not found.", 404);
  }
  if (job.status === "succeeded") {
    const listed = await listCleanResults(db, projectId);
    return {
      job,
      pending: false,
      normalized: listed.latestNormalized,
      phase: "completed",
      nextCheckMs: 0,
    };
  }
  if (job.status === "failed") {
    throw new ServiceError(job.error ?? "CLEAN job failed.", 502);
  }

  const params = job.parameters ?? {};
  const mmliJobId =
    typeof params.mmliJobId === "string" ? params.mmliJobId : null;
  const header = typeof params.header === "string" ? params.header : "query";
  const sequenceLength = numberParam(params.sequenceLength);
  if (!mmliJobId) {
    await markJobFailed(db, job.id, "CLEAN job has no upstream job id.");
    throw new ServiceError(
      "CLEAN job is missing its upstream job id. Submit again.",
      400,
    );
  }

  const client = deps.client ?? new CleanClient();
  const now = deps.now ?? Date.now;
  const submittedAtMs = numberParam(params.submittedAtMs, now());
  const attempts = numberParam(params.resultAttempts);
  const lastAttempt = numberParam(params.lastResultAttemptAtMs, 0);

  try {
    const phase = attempts > 0 ? "completed" : await client.getPhase(mmliJobId);

    if (phase === "error" || phase === "canceled") {
      throw new CleanAdapterError(
        "FAILED",
        `CLEAN reported "${phase}" for job ${mmliJobId}. No EC numbers were invented.`,
      );
    }

    if (phase === "queued" || phase === "processing") {
      if (now() - submittedAtMs > CLEAN_JOB_TIMEOUT_MS) {
        throw new CleanAdapterError(
          "FAILED",
          `CLEAN was still ${phase} after ${Math.round(CLEAN_JOB_TIMEOUT_MS / 60_000)} minutes. Try again later or import a CLEAN CSV. No EC numbers were invented.`,
        );
      }
      const updated =
        params.phase === phase
          ? job
          : await updateJobParameters(db, job.id, { ...params, phase });
      return {
        job: updated,
        pending: true,
        normalized: null,
        phase,
        nextCheckMs: CLEAN_POLL_SPACING_MS,
      };
    }

    // completed — respect ~30s spacing between results attempts.
    if (attempts > 0 && now() - lastAttempt < CLEAN_RESULT_RETRY_SPACING_MS) {
      return {
        job,
        pending: true,
        normalized: null,
        phase,
        nextCheckMs: Math.max(
          1_000,
          CLEAN_RESULT_RETRY_SPACING_MS - (now() - lastAttempt),
        ),
      };
    }

    const retrievedAt = nowIso();
    let body: unknown;
    try {
      body = await client.getResults(mmliJobId);
    } catch (error) {
      const retryable =
        error instanceof CleanAdapterError &&
        (error.code === "RESULTS_UNAVAILABLE" ||
          error.code === "NOT_FOUND" ||
          error.code === "TIMEOUT" ||
          error.code === "NETWORK");
      if (!retryable) throw error;
      const nextAttempts = attempts + 1;
      if (nextAttempts >= CLEAN_RESULT_MAX_ATTEMPTS) {
        const detail = `${(error as Error).message} (after ${nextAttempts} attempts ~30s apart)`;
        if ((error as CleanAdapterError).code === "NOT_FOUND") {
          throw new CleanAdapterError(
            "FAILED",
            `CLEAN finished job ${mmliJobId} but no result file appeared after ${nextAttempts} attempts. No EC numbers were invented.`,
          );
        }
        recordCleanResultsHealth(
          {
            ok: false,
            httpStatus: (error as CleanAdapterError).httpStatus,
            checkedAt: retrievedAt,
            detail,
          },
          now,
        );
        await markJobFailed(db, job.id, `${CLEAN_UNAVAILABLE_MESSAGE} ${detail}`);
        throw new CleanUnavailableError(detail);
      }
      const updated = await updateJobParameters(db, job.id, {
        ...params,
        phase: "completed",
        resultAttempts: nextAttempts,
        lastResultAttemptAtMs: now(),
        lastResultError: (error as Error).message,
      });
      return {
        job: updated,
        pending: true,
        normalized: null,
        phase: "completed",
        nextCheckMs: CLEAN_RESULT_RETRY_SPACING_MS,
      };
    }

    const raw: CleanRawPayload = {
      mmliJobId,
      phase: "completed",
      header,
      sequenceLength,
      results: body,
    };
    // Parse first (throws on malformed) so names are only fetched for real ECs.
    const preview = normalizeCleanLiveResult(raw, { retrievedAt });
    const enzymeNames = await fetchExpasyEnzymeNames(
      preview.predictions.map((p) => p.ecNumber),
      { fetchImpl: deps.enzymeNameFetch, limit: 5 },
    );
    const normalized = normalizeCleanLiveResult(raw, { retrievedAt, enzymeNames });
    recordCleanResultsHealth(
      { ok: true, httpStatus: 200, checkedAt: retrievedAt, detail: "Results returned." },
      now,
    );

    const run = await getModuleRun(db, projectId, CLEAN_MODULE_ID);
    if (!run) {
      throw new ServiceError("CLEAN module run is missing.", 500);
    }
    const persisted = await persistSuccess(db, {
      projectIsDemo: project.isDemo,
      moduleRunId: run.id,
      jobId: job.id,
      raw,
      normalized,
    });
    return {
      job: persisted.job,
      pending: false,
      normalized: persisted.normalized,
      phase: "completed",
      nextCheckMs: 0,
    };
  } catch (error) {
    if (error instanceof CleanUnavailableError) throw error;
    const message =
      error instanceof Error
        ? error.message
        : "CLEAN poll failed without fabricating results.";
    const fresh = await getScientificJob(db, job.id);
    if (fresh?.status !== "failed") {
      await markJobFailed(db, job.id, message);
    }
    mapCleanError(error);
  }
}

export async function listCleanResults(
  db: AppDatabase,
  projectId: string,
): Promise<{
  results: ScientificResult[];
  jobs: ScientificJob[];
  latestNormalized: CleanNormalizedResult | null;
}> {
  const run = await getModuleRun(db, projectId, CLEAN_MODULE_ID);
  if (!run) {
    throw new ServiceError("CLEAN module run is missing.", 500);
  }
  const jobs = await listJobsForModuleRun(db, run.id);
  const rows = await db
    .select()
    .from(results)
    .where(eq(results.moduleRunId, run.id));
  const mapped = rows
    .map(mapResultRow)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  let latestNormalized: CleanNormalizedResult | null = null;
  for (const row of mapped) {
    if (row.type === "normalized" && row.normalizedData) {
      const data = row.normalizedData as Partial<CleanNormalizedResult>;
      if (data.kind === "clean-live" && Array.isArray(data.predictions)) {
        latestNormalized = data as CleanNormalizedResult;
        break;
      }
    }
    if (row.type === "raw" && row.source === "import" && row.provenance) {
      const content = (row.rawData as { content?: unknown } | null)?.content;
      if (typeof content === "string") {
        const derived = normalizeCleanImport(content, row.provenance);
        if (derived) {
          latestNormalized = derived;
          break;
        }
      }
    }
  }

  return { results: mapped, jobs, latestNormalized };
}
