import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/db";
import { createProject, getProjectOverview } from "@/lib/services/projectService";
import { PDB_SETUP_MODULE_ID } from "@/modules/registry";

describe("projectService", () => {
  it("creates a project with 12 module runs and no invented structure metadata", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "Lab group A" });
    const overview = await getProjectOverview(db, project.id);

    expect(overview.project.name).toBe("Lab group A");
    expect(overview.project.isDemo).toBe(false);
    expect(overview.structure).toBeNull();
    expect(overview.moduleRuns).toHaveLength(12);
    expect(
      overview.moduleRuns.find((run) => run.moduleId === PDB_SETUP_MODULE_ID)
        ?.status,
    ).toBe("not_started");
    expect(
      overview.moduleRuns.filter((run) => run.status === "not_started"),
    ).toHaveLength(12);
    expect(
      overview.moduleRuns.filter((run) => run.status === "not_available_yet"),
    ).toHaveLength(0);
  });
});
