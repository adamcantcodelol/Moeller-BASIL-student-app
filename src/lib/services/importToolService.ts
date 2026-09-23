import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { moduleRuns } from "@/db/schema";
import { nowIso } from "@/lib/ids";
import { getProjectById } from "@/lib/db/queries/projects";
import { getModuleRun } from "@/lib/db/queries/moduleRuns";
import { ServiceError } from "@/lib/services/projectService";
import {
  executeImportJob,
  listJobsForModuleRun,
} from "@/lib/jobs/scientificJobService";
import { getImportWorkflowForTool, getToolRegistration } from "@/adapters/registry";
import type { ImportFormat, ImportPayload } from "@/types/importWorkflow";
import type { ScientificJob } from "@/types/scientificJob";
import { ScientificError, scientificErrorHttpStatus } from "@/adapters/errors";
import { getModuleBySlug } from "@/modules/registry";

function mapError(error: unknown): never {
  if (error instanceof ScientificError) {
    throw new ServiceError(error.message, scientificErrorHttpStatus(error));
  }
  if (error instanceof ServiceError) {
    throw error;
  }
  throw error;
}

export async function importToolResults(
  db: AppDatabase,
  projectId: string,
  moduleSlug: string,
  payload: { format: ImportFormat; content: string; notes?: string },
): Promise<{ job: ScientificJob; rawResultId: string }> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }

  const definition = getModuleBySlug(moduleSlug);
  if (!definition?.implemented) {
    throw new ServiceError(
      "This module is not implemented for import yet.",
      400,
    );
  }

  const registration = getToolRegistration(moduleSlug);
  if (!registration?.importSupported) {
    throw new ServiceError(
      `Import is not supported for module "${moduleSlug}".`,
      400,
    );
  }

  const workflow = getImportWorkflowForTool(registration.id);
  if (!workflow) {
    throw new ServiceError(
      `No import workflow is registered for "${moduleSlug}".`,
      400,
    );
  }

  const run = await getModuleRun(db, projectId, definition.id);
  if (!run) {
    throw new ServiceError("Module run is missing.", 500);
  }

  const importPayload: ImportPayload = {
    tool: registration.id,
    format: payload.format,
    content: payload.content,
    notes: payload.notes,
  };

  try {
    return await executeImportJob(db, {
      moduleRunId: run.id,
      payload: importPayload,
      isDemo: project.isDemo,
    });
  } catch (error) {
    mapError(error);
  }
}

export async function completeImportModule(
  db: AppDatabase,
  projectId: string,
  moduleSlug: string,
): Promise<{ runId: string; status: string }> {
  const definition = getModuleBySlug(moduleSlug);
  if (!definition?.implemented) {
    throw new ServiceError("This module cannot be marked complete yet.", 400);
  }

  const run = await getModuleRun(db, projectId, definition.id);
  if (!run) {
    throw new ServiceError("Module run is missing.", 500);
  }

  const jobs = await listJobsForModuleRun(db, run.id);
  const hasSuccess = jobs.some((job) => job.status === "succeeded");
  if (!hasSuccess) {
    throw new ServiceError(
      `Import legitimate ${definition.name} output before completing this module. The platform will not invent results.`,
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

export async function listModuleJobs(
  db: AppDatabase,
  projectId: string,
  moduleSlug: string,
): Promise<ScientificJob[]> {
  const definition = getModuleBySlug(moduleSlug);
  if (!definition) {
    throw new ServiceError("Unknown curriculum module.", 404);
  }
  const run = await getModuleRun(db, projectId, definition.id);
  if (!run) {
    throw new ServiceError("Module run is missing.", 500);
  }
  return listJobsForModuleRun(db, run.id);
}
