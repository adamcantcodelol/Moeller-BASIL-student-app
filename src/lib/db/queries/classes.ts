import { desc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { classes } from "@/db/schema";
import { generateClassCode, normalizeClassCode } from "@/lib/auth/identity";
import { nowIso } from "@/lib/ids";

export async function listClasses(db: AppDatabase) {
  return db.select().from(classes).orderBy(desc(classes.createdAt));
}

export async function getClassByCode(db: AppDatabase, code: string) {
  const rows = await db
    .select()
    .from(classes)
    .where(eq(classes.code, normalizeClassCode(code)));
  return rows[0] ?? null;
}

export async function findActiveClass(db: AppDatabase, code: string) {
  const found = await getClassByCode(db, code);
  return found && found.active ? found : null;
}

export async function createClass(db: AppDatabase, name: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateClassCode();
    if (await getClassByCode(db, code)) continue;
    const row = { code, name, active: true, createdAt: nowIso() };
    await db.insert(classes).values(row);
    return row;
  }
  throw new Error("Could not generate a unique class code.");
}

export async function setClassActive(db: AppDatabase, code: string, active: boolean) {
  const updated = await db
    .update(classes)
    .set({ active })
    .where(eq(classes.code, normalizeClassCode(code)))
    .returning();
  return updated[0] ?? null;
}
