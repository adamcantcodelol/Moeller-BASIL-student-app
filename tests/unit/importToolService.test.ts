import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/db";
import { createProject } from "@/lib/services/projectService";
import {
  completeImportModule,
  importToolResults,
  listModuleJobs,
} from "@/lib/services/importToolService";

describe("importToolService", () => {
  it("imports BLAST raw output and allows completion", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "BLAST import" });

    const imported = await importToolResults(db, project.id, "blast", {
      format: "text",
      content: "Query= demo\n>sp|P69905| Legitimate BLAST export placeholder",
      notes: "From NCBI BLAST web",
    });
    expect(imported.job.status).toBe("succeeded");
    expect(imported.job.mode).toBe("import");

    const jobs = await listModuleJobs(db, project.id, "blast");
    expect(jobs[0]?.status).toBe("succeeded");

    const completed = await completeImportModule(db, project.id, "blast");
    expect(completed.status).toBe("complete");
  });
});
