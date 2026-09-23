import type { AppDatabase } from "@/db/client";
import { moduleRuns, projects, structures } from "@/db/schema";
import { nowIso } from "@/lib/ids";
import { CURRICULUM_MODULES, PDB_SETUP_MODULE_ID } from "@/modules/registry";
import { getProjectById } from "@/lib/db/queries/projects";
import { listModuleRunsForProject } from "@/lib/db/queries/moduleRuns";
import {
  DEMO_PDB_ID,
  DEMO_PROJECT_ID,
  DEMO_PROJECT_NAME,
  DEMO_STRUCTURE_ID,
} from "@/types/demo";

function demoRunId(order: number): string {
  return `00000000-0000-4000-8000-${String(100 + order).padStart(12, "0")}`;
}

async function ensureDemoModuleRuns(
  db: AppDatabase,
  timestamp: string,
): Promise<void> {
  const existing = await listModuleRunsForProject(db, DEMO_PROJECT_ID);
  const existingIds = new Set(existing.map((run) => run.moduleId));

  // Insert one row at a time to stay under D1/SQLite variable limits.
  for (const curriculumModule of CURRICULUM_MODULES) {
    if (existingIds.has(curriculumModule.id)) {
      continue;
    }
    await db.insert(moduleRuns).values({
      id: demoRunId(curriculumModule.order),
      projectId: DEMO_PROJECT_ID,
      moduleId: curriculumModule.id,
      status:
        curriculumModule.id === PDB_SETUP_MODULE_ID
          ? "complete"
          : curriculumModule.implemented
            ? "not_started"
            : "not_available_yet",
      startedAt: curriculumModule.id === PDB_SETUP_MODULE_ID ? timestamp : null,
      completedAt: curriculumModule.id === PDB_SETUP_MODULE_ID ? timestamp : null,
      parametersJson: null,
      error: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
}

export async function ensureDemoProject(db: AppDatabase): Promise<void> {
  const existing = await getProjectById(db, DEMO_PROJECT_ID);
  const timestamp = nowIso();

  if (!existing) {
    await db.insert(projects).values({
      id: DEMO_PROJECT_ID,
      name: DEMO_PROJECT_NAME,
      studentId: null,
      status: "demo",
      isDemo: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await db.insert(structures).values({
      id: DEMO_STRUCTURE_ID,
      projectId: DEMO_PROJECT_ID,
      pdbId: DEMO_PDB_ID,
      title: null,
      organism: null,
      chainsJson: null,
      sequence: null,
      metadataJson: null,
      source: "demo",
      retrievedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  await ensureDemoModuleRuns(db, timestamp);
}

export function requiresDemoBanner(isDemo: boolean): string | null {
  return isDemo ? "DEMO DATA" : null;
}
