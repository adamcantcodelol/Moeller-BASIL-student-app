import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/db";
import { createProject } from "@/lib/services/projectService";
import { getModuleRun } from "@/lib/db/queries/moduleRuns";
import {
  createScientificJob,
  executeAdapterJob,
  executeImportJob,
  listJobsForModuleRun,
  markJobFailed,
  markJobRunning,
  markJobSucceeded,
} from "@/lib/jobs/scientificJobService";
import { createNotImplementedAdapter } from "@/adapters/scientificAdapter";
import { ScientificAdapterNotImplementedError } from "@/adapters/scientificAdapter";
import type { ScientificAdapter } from "@/adapters/scientificAdapter";
import { buildProvenance } from "@/lib/provenance/buildProvenance";

describe("scientific job system", () => {
  it("tracks queued → running → succeeded and syncs module run", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "Job flow" });
    const run = await getModuleRun(db, project.id, "pdb-setup");
    expect(run).toBeTruthy();

    const job = await createScientificJob(db, {
      moduleRunId: run!.id,
      tool: "rcsb",
      mode: "adapter",
      parameters: { pdbId: "4HHB" },
    });
    expect(job.status).toBe("queued");

    const running = await markJobRunning(db, job.id);
    expect(running.status).toBe("running");

    const succeeded = await markJobSucceeded(db, job.id, { resultId: null });
    expect(succeeded.status).toBe("succeeded");

    const updatedRun = await getModuleRun(db, project.id, "pdb-setup");
    expect(updatedRun?.status).toBe("in_progress");
  });

  it("marks failed jobs and never fabricates results", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "Job fail" });
    const run = await getModuleRun(db, project.id, "blast");

    const job = await createScientificJob(db, {
      moduleRunId: run!.id,
      tool: "blast",
      mode: "adapter",
    });
    await markJobFailed(db, job.id, "BLAST is not implemented.");

    const jobs = await listJobsForModuleRun(db, run!.id);
    expect(jobs[0]?.status).toBe("failed");
    expect(jobs[0]?.error).toContain("not implemented");
  });

  it("executeAdapterJob fails closed for stubs", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "Stub exec" });
    const run = await getModuleRun(db, project.id, "blast");

    await expect(
      executeAdapterJob(db, {
        moduleRunId: run!.id,
        tool: "blast",
        adapter: createNotImplementedAdapter("BLAST"),
        input: { sequence: "MVLSPADKTNVKAAW" },
        useCache: false,
      }),
    ).rejects.toBeInstanceOf(ScientificAdapterNotImplementedError);

    const jobs = await listJobsForModuleRun(db, run!.id);
    expect(jobs[0]?.status).toBe("failed");
  });

  it("executeAdapterJob caches successful adapter responses", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "Cache exec" });
    const run = await getModuleRun(db, project.id, "pdb-setup");

    let runs = 0;
    const adapter: ScientificAdapter<{ q: string }, { value: number }, { value: number }> = {
      async run(input) {
        runs += 1;
        return { value: input.q.length };
      },
      normalize(output) {
        return output;
      },
      getProvenance() {
        return buildProvenance({
          tool: "test-adapter",
          source: "unit-test",
          parameters: {},
        });
      },
    };

    const first = await executeAdapterJob(db, {
      moduleRunId: run!.id,
      tool: "test-adapter",
      adapter,
      input: { q: "abcd" },
    });
    expect(first.cacheHit).toBe(false);
    expect(first.normalized.value).toBe(4);

    const second = await executeAdapterJob(db, {
      moduleRunId: run!.id,
      tool: "test-adapter",
      adapter,
      input: { q: "abcd" },
    });
    expect(second.cacheHit).toBe(true);
    expect(runs).toBe(1);
  });

  it("stores import jobs with provenance source=import", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "Import job" });
    const run = await getModuleRun(db, project.id, "sprite");

    const { job, rawResultId } = await executeImportJob(db, {
      moduleRunId: run!.id,
      payload: {
        tool: "sprite",
        format: "text",
        content: "DEMO-looking but student-imported SPRITE paste",
        notes: "from local SPRITE run",
      },
      isDemo: false,
    });

    expect(job.status).toBe("succeeded");
    expect(job.mode).toBe("import");
    expect(rawResultId).toBeTruthy();
  });

  it("rejects empty import payloads", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "Bad import" });
    const run = await getModuleRun(db, project.id, "blast");

    await expect(
      executeImportJob(db, {
        moduleRunId: run!.id,
        payload: { tool: "blast", format: "json", content: "   " },
      }),
    ).rejects.toThrow(/empty/i);
  });
});
