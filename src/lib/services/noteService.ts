import type { AppDatabase } from "@/db/client";
import { notes } from "@/db/schema";
import { createId, nowIso } from "@/lib/ids";
import { getProjectById } from "@/lib/db/queries/projects";
import { listNotesForModule } from "@/lib/db/queries/notes";
import { getModuleBySlug } from "@/modules/registry";
import type { Note } from "@/types/note";
import { ServiceError } from "@/lib/services/projectService";

export async function addModuleNote(
  db: AppDatabase,
  projectId: string,
  moduleId: string,
  content: string,
): Promise<Note> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }

  const moduleDefinition = getModuleBySlug(moduleId);
  if (!moduleDefinition) {
    throw new ServiceError("Unknown curriculum module.", 404);
  }

  const timestamp = nowIso();
  const id = createId();

  await db.insert(notes).values({
    id,
    projectId,
    moduleId,
    content: content.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const allNotes = await listNotesForModule(db, projectId, moduleId);
  const created = allNotes.find((note) => note.id === id);
  if (!created) {
    throw new ServiceError("Note could not be saved.", 500);
  }
  return created;
}

export { listNotesForModule };
