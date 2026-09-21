import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { moduleRuns, structures } from "@/db/schema";
import { createId, nowIso } from "@/lib/ids";
import { getProjectById } from "@/lib/db/queries/projects";
import { getStructureByProjectId } from "@/lib/db/queries/structures";
import { getModuleRun } from "@/lib/db/queries/moduleRuns";
import { validatePdbId } from "@/lib/validation/pdbId";
import { PDB_SETUP_MODULE_ID } from "@/modules/registry";
import type { PdbStructure } from "@/types/structure";
import { ServiceError } from "@/lib/services/projectService";

export async function saveStudentPdbId(
  db: AppDatabase,
  projectId: string,
  rawPdbId: string,
): Promise<PdbStructure> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }

  const validation = validatePdbId(rawPdbId);
  if (!validation.ok) {
    throw new ServiceError(validation.error, 400);
  }

  const existing = await getStructureByProjectId(db, projectId);
  const timestamp = nowIso();

  if (existing) {
    await db
      .update(structures)
      .set({
        pdbId: validation.pdbId,
        source: project.isDemo ? "demo" : "student_input",
        title: null,
        organism: null,
        chainsJson: null,
        sequence: null,
        metadataJson: null,
        retrievedAt: null,
        updatedAt: timestamp,
      })
      .where(eq(structures.id, existing.id));
  } else {
    await db.insert(structures).values({
      id: createId(),
      projectId,
      pdbId: validation.pdbId,
      title: null,
      organism: null,
      chainsJson: null,
      sequence: null,
      metadataJson: null,
      source: project.isDemo ? "demo" : "student_input",
      retrievedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  const run = await getModuleRun(db, projectId, PDB_SETUP_MODULE_ID);
  if (run && run.status === "not_started") {
    await db
      .update(moduleRuns)
      .set({
        status: "in_progress",
        startedAt: timestamp,
        updatedAt: timestamp,
      })
      .where(eq(moduleRuns.id, run.id));
  }

  const saved = await getStructureByProjectId(db, projectId);
  if (!saved) {
    throw new ServiceError("Structure could not be saved.", 500);
  }
  return saved;
}
