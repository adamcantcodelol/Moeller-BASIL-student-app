import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/db";
import { createProject } from "@/lib/services/projectService";
import { saveStudentPdbId } from "@/lib/services/structureService";
import {
  completePdbSetup,
} from "@/lib/services/moduleRunService";
import { ServiceError } from "@/lib/services/projectService";
import { getModuleRun } from "@/lib/db/queries/moduleRuns";

describe("moduleRunService", () => {
  it("completes PDB Setup only after a structure is saved", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "Completion test" });

    await expect(completePdbSetup(db, project.id)).rejects.toBeInstanceOf(
      ServiceError,
    );

    await saveStudentPdbId(db, project.id, "4hhb");
    const run = await completePdbSetup(db, project.id);
    expect(run.status).toBe("complete");
  });

  it("does not mark unimplemented modules complete", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "BLAST guard" });
    const blast = await getModuleRun(db, project.id, "blast");
    expect(blast?.status).toBe("not_available_yet");
  });
});
