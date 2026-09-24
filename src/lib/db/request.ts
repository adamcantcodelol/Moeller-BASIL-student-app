import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { schema } from "@/db/schema";
import type { AppDatabase } from "@/db/client";
import { notFound } from "next/navigation";
import { requireProjectAccess } from "@/lib/auth/access";
import { getRequestIdentity } from "@/lib/auth/request";
import { ServiceError } from "@/lib/services/projectService";

export async function getRequestDatabase(): Promise<AppDatabase> {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
}

/** API routes: database handle after the ownership check (404 if not yours). */
export async function getProjectDatabase(projectId: string): Promise<AppDatabase> {
  const db = await getRequestDatabase();
  await requireProjectAccess(db, projectId, await getRequestIdentity());
  return db;
}

/** Pages: same check, but renders the Next.js 404 page. */
export async function getProjectPageDatabase(projectId: string): Promise<AppDatabase> {
  try {
    return await getProjectDatabase(projectId);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
}
