import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { projects } from "@/db/schema";
import { mapProject } from "@/lib/db/mappers";

export async function listProjects(db: AppDatabase) {
  const rows = await db.select().from(projects);
  return rows.map(mapProject);
}

export async function getProjectById(db: AppDatabase, id: string) {
  const rows = await db.select().from(projects).where(eq(projects.id, id));
  return rows[0] ? mapProject(rows[0]) : null;
}
