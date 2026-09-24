import { and, desc, eq, inArray, or } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { analysisPipelines, projects, structures } from "@/db/schema";
import { mapProject } from "@/lib/db/mappers";
import type { Owner } from "@/lib/auth/identity";

/**
 * Projects owned by one identity (plus the shared, clearly labeled demo
 * project). Legacy unowned projects are intentionally hidden from lists.
 */
export async function listProjects(db: AppDatabase, owner: Owner | null) {
  const demo = eq(projects.isDemo, true);
  const rows = await db
    .select()
    .from(projects)
    .where(
      owner
        ? or(
            demo,
            and(
              eq(projects.ownerType, owner.ownerType),
              eq(projects.ownerKey, owner.ownerKey),
            ),
          )
        : demo,
    )
    .orderBy(desc(projects.createdAt));
  return rows.map(mapProject);
}

export async function getProjectById(db: AppDatabase, id: string) {
  const rows = await db.select().from(projects).where(eq(projects.id, id));
  return rows[0] ? mapProject(rows[0]) : null;
}

export async function countDeviceProjects(db: AppDatabase, deviceId: string) {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.ownerType, "device"), eq(projects.ownerKey, deviceId)));
  return rows.length;
}

/** Move this device's anonymous projects to the student's class identity. */
export async function moveDeviceProjectsToOwner(
  db: AppDatabase,
  deviceId: string,
  owner: Owner,
) {
  const moved = await db
    .update(projects)
    .set({
      ownerType: owner.ownerType,
      ownerKey: owner.ownerKey,
      classCode: owner.classCode,
      studentName: owner.studentName,
    })
    .where(and(eq(projects.ownerType, "device"), eq(projects.ownerKey, deviceId)))
    .returning({ id: projects.id });
  return moved.length;
}

export interface ClassProjectRow {
  id: string;
  name: string;
  classCode: string | null;
  studentName: string | null;
  createdAt: string;
  pdbId: string | null;
  pipelineStatus: string | null;
}

/** Teacher dashboard: projects of students who joined these classes. */
export async function listProjectsForClasses(
  db: AppDatabase,
  classCodes: string[],
): Promise<ClassProjectRow[]> {
  if (classCodes.length === 0) return [];
  const rows = await db
    .select()
    .from(projects)
    .leftJoin(structures, eq(structures.projectId, projects.id))
    .leftJoin(analysisPipelines, eq(analysisPipelines.projectId, projects.id))
    .where(and(eq(projects.ownerType, "class"), inArray(projects.classCode, classCodes)))
    .orderBy(projects.studentName, desc(projects.createdAt));
  return rows.map((row) => ({
    id: row.projects.id,
    name: row.projects.name,
    classCode: row.projects.classCode,
    studentName: row.projects.studentName,
    createdAt: row.projects.createdAt,
    pdbId: row.structures?.pdbId ?? null,
    pipelineStatus: row.analysis_pipelines?.status ?? null,
  }));
}
