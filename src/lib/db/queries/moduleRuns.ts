import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { moduleRuns } from "@/db/schema";
import { mapModuleRun } from "@/lib/db/mappers";

export async function listModuleRunsForProject(
  db: AppDatabase,
  projectId: string,
) {
  const rows = await db
    .select()
    .from(moduleRuns)
    .where(eq(moduleRuns.projectId, projectId));
  return rows.map(mapModuleRun);
}

export async function getModuleRun(
  db: AppDatabase,
  projectId: string,
  moduleId: string,
) {
  const rows = await db
    .select()
    .from(moduleRuns)
    .where(
      and(eq(moduleRuns.projectId, projectId), eq(moduleRuns.moduleId, moduleId)),
    );
  return rows[0] ? mapModuleRun(rows[0]) : null;
}
