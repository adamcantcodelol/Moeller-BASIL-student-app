import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { moduleRuns } from "@/db/schema";
import { nowIso } from "@/lib/ids";
import { getStructureByProjectId } from "@/lib/db/queries/structures";
import { getModuleRun } from "@/lib/db/queries/moduleRuns";
import { getModuleBySlug, PDB_SETUP_MODULE_ID } from "@/modules/registry";
import type { ModuleRun } from "@/types/moduleRun";
import { ServiceError } from "@/lib/services/projectService";

export async function completePdbSetup(
  db: AppDatabase,
  projectId: string,
): Promise<ModuleRun> {
  const structure = await getStructureByProjectId(db, projectId);
  if (!structure) {
    throw new ServiceError(
      "Save a valid PDB identifier before completing Protein / PDB Setup.",
      400,
    );
  }

  if (structure.source !== "rcsb" || !structure.retrievedAt) {
    throw new ServiceError(
      "Retrieve verified RCSB metadata before completing Protein / PDB Setup. The platform will not invent structure metadata.",
      400,
    );
  }

  const run = await getModuleRun(db, projectId, PDB_SETUP_MODULE_ID);
  if (!run) {
    throw new ServiceError("PDB Setup module run is missing.", 500);
  }

  const timestamp = nowIso();
  await db
    .update(moduleRuns)
    .set({
      status: "complete",
      completedAt: timestamp,
      startedAt: run.startedAt ?? timestamp,
      updatedAt: timestamp,
    })
    .where(eq(moduleRuns.id, run.id));

  const updated = await getModuleRun(db, projectId, PDB_SETUP_MODULE_ID);
  if (!updated) {
    throw new ServiceError("Module run could not be updated.", 500);
  }
  return updated;
}

export async function assertModuleAccessible(slug: string) {
  const definition = getModuleBySlug(slug);
  if (!definition) {
    throw new ServiceError("Unknown curriculum module.", 404);
  }
  return definition;
}
