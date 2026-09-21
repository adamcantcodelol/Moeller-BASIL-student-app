import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { schema } from "./schema";

export type AppDatabase =
  | DrizzleD1Database<typeof schema>
  | LibSQLDatabase<typeof schema>;
