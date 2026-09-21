import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { notes } from "@/db/schema";
import { mapNote } from "@/lib/db/mappers";

export async function listNotesForModule(
  db: AppDatabase,
  projectId: string,
  moduleId: string,
) {
  const rows = await db
    .select()
    .from(notes)
    .where(and(eq(notes.projectId, projectId), eq(notes.moduleId, moduleId)));
  return rows.map(mapNote);
}
