import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { schema } from "@/db/schema";
import type { AppDatabase } from "@/db/client";

export async function createTestDatabase(): Promise<AppDatabase> {
  const client = createClient({ url: ":memory:" });
  const initSql = readFileSync(
    path.join(process.cwd(), "drizzle/0001_init.sql"),
    "utf8",
  );
  const seedSql = readFileSync(
    path.join(process.cwd(), "drizzle/0002_seed_modules.sql"),
    "utf8",
  );

  await client.executeMultiple(initSql);
  await client.executeMultiple(seedSql);

  return drizzle(client, { schema });
}
