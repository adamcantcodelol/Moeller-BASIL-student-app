import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { projects } from "@/db/schema";
import { canAccessProject, type RequestIdentity } from "@/lib/auth/identity";
import { ServiceError } from "@/lib/services/projectService";

/**
 * Single ownership gate for every project-scoped page and API route.
 * Throws a 404 (not 403) so other students can't even confirm a project exists.
 */
export async function requireProjectAccess(
  db: AppDatabase,
  projectId: string,
  identity: RequestIdentity,
): Promise<void> {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));
  const row = rows[0];
  if (!row || !canAccessProject(row, identity)) {
    throw new ServiceError("Project not found.", 404);
  }
}
