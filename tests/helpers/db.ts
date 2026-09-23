import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { schema } from "@/db/schema";
import type { AppDatabase } from "@/db/client";

export async function createTestDatabase(): Promise<AppDatabase> {
  const client = createClient({ url: ":memory:" });
  const migrations = [
    "drizzle/0001_init.sql",
    "drizzle/0002_seed_modules.sql",
    "drizzle/0003_phase3_jobs_cache.sql",
    "drizzle/0004_phase4_interpro.sql",
    "drizzle/0005_phase4_remaining_modules.sql",
  ];

  for (const relative of migrations) {
    const sql = readFileSync(path.join(process.cwd(), relative), "utf8");
    await client.executeMultiple(sql);
  }

  return drizzle(client, { schema });
}
