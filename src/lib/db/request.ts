import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { schema } from "@/db/schema";
import type { AppDatabase } from "@/db/client";

export async function getRequestDatabase(): Promise<AppDatabase> {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
}
