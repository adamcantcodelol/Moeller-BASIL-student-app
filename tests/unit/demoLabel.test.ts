import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/db";
import { ensureDemoProject, requiresDemoBanner } from "@/lib/services/demoService";
import { getProjectOverview } from "@/lib/services/projectService";
import { DEMO_BANNER_LABEL, DEMO_PDB_ID, DEMO_PROJECT_ID } from "@/types/demo";

describe("demo data", () => {
  it("labels demo projects and does not attach fabricated scientific fields", async () => {
    const db = await createTestDatabase();
    await ensureDemoProject(db);
    const overview = await getProjectOverview(db, DEMO_PROJECT_ID);

    expect(overview.project.isDemo).toBe(true);
    expect(requiresDemoBanner(overview.project.isDemo)).toBe(DEMO_BANNER_LABEL);
    expect(overview.structure?.pdbId).toBe(DEMO_PDB_ID);
    expect(overview.structure?.source).toBe("demo");
    expect(overview.structure?.title).toBeNull();
    expect(overview.structure?.sequence).toBeNull();
    expect(overview.structure?.organism).toBeNull();
  });

  it("never treats demo as a fallback label for student projects", () => {
    expect(requiresDemoBanner(false)).toBeNull();
  });
});
