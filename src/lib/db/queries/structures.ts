import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { structures } from "@/db/schema";
import { mapStructure } from "@/lib/db/mappers";

export async function getStructureByProjectId(
  db: AppDatabase,
  projectId: string,
) {
  const rows = await db
    .select()
    .from(structures)
    .where(eq(structures.projectId, projectId));
  return rows[0] ? mapStructure(rows[0]) : null;
}
