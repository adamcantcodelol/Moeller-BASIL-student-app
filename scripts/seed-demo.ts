import { getPlatformProxy } from "wrangler";
import { drizzle } from "drizzle-orm/d1";
import { schema } from "../src/db/schema";
import { ensureDemoProject } from "../src/lib/services/demoService";

async function main() {
  const proxy = await getPlatformProxy<{
    DB: import("@cloudflare/workers-types").D1Database;
  }>();
  try {
    const db = drizzle(proxy.env.DB, { schema });
    await ensureDemoProject(db);
    console.log("DEMO DATA project is present and labeled.");
  } finally {
    await proxy.dispose();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
