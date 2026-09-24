import { describe, expect, it, vi } from "vitest";
import { createTestDatabase } from "../helpers/db";
import { createProject } from "@/lib/services/projectService";
import { saveStudentPdbId } from "@/lib/services/structureService";
import {
  buildInitialPipelineSteps,
  findActiveStepIndex,
  isTerminalStepStatus,
} from "@/lib/pipeline/buildSteps";
import {
  isLigandMissingError,
  readUniprotAccessionsFromStructure,
} from "@/lib/pipeline/context";
import {
  getPipelineStatus,
  getProjectResultsSections,
  retryPipelineStep,
  startPipeline,
  tickPipeline,
} from "@/lib/services/pipelineService";
import { analysisPipelines, structures } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nowIso } from "@/lib/ids";
import type { PdbStructure } from "@/types/structure";

vi.mock("@/lib/services/spriteService", () => ({
  submitSpriteSearch: vi.fn(async () => ({
    job: { id: "sprite-job", status: "succeeded" },
    pending: false,
    sessionId: "s1",
    normalized: { hitCount: 2 },
  })),
  pollSpriteJob: vi.fn(),
  listSpriteResults: vi.fn(async () => ({
    results: [],
    jobs: [],
    latestNormalized: null,
  })),
}));

vi.mock("@/lib/services/blastService", () => ({
  runRcsbSequenceSearchForProject: vi.fn(async () => {
    throw new Error("RCSB search unavailable in this test");
  }),
  submitBlastSearch: vi.fn(async () => ({
    job: { id: "blast-job", status: "running" },
    pending: true,
    rid: "RID1",
    rtoe: 10,
    normalized: null,
  })),
  pollBlastJob: vi.fn(async () => ({
    job: { id: "blast-job", status: "succeeded" },
    pending: false,
    rid: "RID1",
    rtoe: 10,
    normalized: { hitCount: 3 },
  })),
  listBlastResults: vi.fn(async () => ({
    results: [],
    jobs: [],
    latestNormalized: null,
  })),
}));

vi.mock("@/lib/services/foldseekService", () => ({
  submitFoldseekSearch: vi.fn(async () => ({
    job: { id: "fs-job", status: "succeeded" },
    pending: false,
    ticketId: "t1",
    normalized: { hitCount: 1 },
  })),
  pollFoldseekJob: vi.fn(),
  listFoldseekResults: vi.fn(async () => ({
    results: [],
    jobs: [],
    latestNormalized: null,
  })),
}));

vi.mock("@/lib/services/daliService", () => ({
  submitDaliSearch: vi.fn(async () => ({
    job: { id: "dali-job", status: "succeeded" },
    pending: false,
    jobUrl: "https://example.test/dali",
    normalized: { hitCount: 4 },
  })),
  pollDaliJob: vi.fn(),
  listDaliResults: vi.fn(async () => ({
    results: [],
    jobs: [],
    latestNormalized: null,
  })),
}));

vi.mock("@/lib/services/interproService", () => ({
  fetchAndSaveInterProAnnotations: vi.fn(async () => ({
    job: { id: "ip-job", status: "succeeded" },
    normalized: { entryCount: 5, uniprotAccession: "P69905" },
    cacheHit: false,
    rawResultId: "raw1",
  })),
  listInterProResults: vi.fn(async () => ({
    results: [],
    jobs: [],
    latestNormalized: null,
  })),
}));

vi.mock("@/lib/services/swissdockService", () => ({
  submitSwissDock: vi.fn(async () => {
    const { ServiceError } = await import("@/lib/services/projectService");
    throw new ServiceError(
      "No non-solvent HETATM ligand found in 4HHB. Provide a SMILES only if your curriculum ligand is not in the PDB. Nothing was invented.",
      400,
    );
  }),
  pollSwissDockJob: vi.fn(),
  listSwissDockResults: vi.fn(async () => ({
    results: [],
    jobs: [],
    latestNormalized: null,
  })),
}));

vi.mock("@/lib/services/cleanService", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/cleanService")
  >("@/lib/services/cleanService");
  return {
    ...actual,
    submitCleanPrediction: vi.fn(async () => {
      throw new actual.CleanUnavailableError(
        "Results endpoint returned HTTP 500.",
      );
    }),
    pollCleanJob: vi.fn(),
    listCleanResults: vi.fn(async () => ({
      results: [],
      jobs: [],
      latestNormalized: null,
    })),
  };
});

describe("pipeline ordering helpers", () => {
  it("builds canonical classroom order", () => {
    const steps = buildInitialPipelineSteps();
    expect(steps.map((s) => s.tool)).toEqual([
      "sprite",
      "blast",
      "foldseek",
      "dali",
      "interpro",
      "clean",
      "swissdock",
    ]);
    expect(steps.every((s) => s.status === "pending")).toBe(true);
  });

  it("finds first non-terminal step", () => {
    const steps = buildInitialPipelineSteps();
    steps[0]!.status = "succeeded";
    steps[1]!.status = "skipped";
    expect(findActiveStepIndex(steps)).toBe(2);
    expect(isTerminalStepStatus("failed")).toBe(true);
    expect(isTerminalStepStatus("running")).toBe(false);
  });
});

describe("pipeline skip context", () => {
  it("reads UniProt accessions from structure metadata only when valid", () => {
    const structure = {
      metadata: { uniprotAccessions: ["P69905", "not-valid", "P68871"] },
    } as unknown as PdbStructure;
    expect(readUniprotAccessionsFromStructure(structure)).toEqual([
      "P69905",
      "P68871",
    ]);
    expect(readUniprotAccessionsFromStructure(null)).toEqual([]);
  });

  it("detects ligand-missing errors for SwissDock skip", () => {
    expect(
      isLigandMissingError("No non-solvent HETATM ligand found in X"),
    ).toBe(true);
    expect(isLigandMissingError("Network timeout")).toBe(false);
  });
});

describe("pipelineService tick flow", () => {
  async function seedRcsbProject() {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "Pipeline 4HHB" });
    await saveStudentPdbId(db, project.id, "4HHB");
    const timestamp = nowIso();
    await db
      .update(structures)
      .set({
        source: "rcsb",
        title: "Deoxyhemoglobin",
        sequence: "VLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSHGSAQVKGHGKKVADALTNAVAHVDDMPNALSALSDLHAHKLRVDPVNFKLLSHCLLVTLAAHLPAEFTPAVHASLDKFLASVSTVLTSKYR",
        chainsJson: JSON.stringify(["A", "B", "C", "D"]),
        metadataJson: JSON.stringify({
          uniprotAccessions: ["P69905", "P68871"],
          provenance: {
            source: "https://data.rcsb.org/",
            retrievedAt: timestamp,
          },
        }),
        retrievedAt: timestamp,
        updatedAt: timestamp,
      })
      .where(eq(structures.projectId, project.id));
    return { db, project };
  }

  it("starts pipeline and advances sprite → blast (pending) then overlaps later tools", async () => {
    const { db, project } = await seedRcsbProject();
    const started = await startPipeline(db, project.id);
    expect(started.status).toBe("running");
    expect(started.steps.map((s) => s.tool)[0]).toBe("sprite");

    const tick1 = await tickPipeline(db, project.id);
    expect(tick1.pipeline.steps[0]?.status).toBe("succeeded");
    expect(tick1.waiting).toBe(false);

    const tick2 = await tickPipeline(db, project.id);
    expect(tick2.pipeline.steps[1]?.tool).toBe("blast");
    expect(tick2.pipeline.steps[1]?.status).toBe("running");
    expect(tick2.waiting).toBe(true);
    expect(tick2.pipeline.steps[1]?.summary).toMatch(/RCSB sequence search was unavailable/);
    // Later tools are pending, so the client is NOT held to NCBI's 60s spacing.
    expect(tick2.suggestedWaitMs).toBe(4_000);

    // Poll finishes BLAST and starts Foldseek in the same tick (overlap).
    const tick3 = await tickPipeline(db, project.id);
    expect(tick3.pipeline.steps[1]?.status).toBe("succeeded");
    expect(tick3.pipeline.steps[2]?.status).toBe("succeeded");
  });

  it("keeps later tools moving while BLAST stays pending", async () => {
    const blast = await import("@/lib/services/blastService");
    vi.mocked(blast.pollBlastJob).mockResolvedValueOnce({
      job: { id: "blast-job", status: "running" } as never,
      pending: true,
      rid: "RID1",
      rtoe: 120,
      normalized: null,
      deferredNcbiPoll: true,
      ncbiWaitRemainingMs: 45_000,
    });

    const { db, project } = await seedRcsbProject();
    await startPipeline(db, project.id);
    await tickPipeline(db, project.id); // sprite
    await tickPipeline(db, project.id); // blast submit

    const overlapped = await tickPipeline(db, project.id);
    expect(overlapped.pipeline.steps[1]?.status).toBe("running");
    expect(overlapped.pipeline.steps[2]?.status).toBe("succeeded");
    expect(overlapped.waiting).toBe(true);
    // Dali etc. still pending → short tick, BLAST deferral handled server-side.
    expect(overlapped.suggestedWaitMs).toBe(4_000);
  });

  it("uses the fast RCSB sequence search for the BLAST step when available", async () => {
    const blast = await import("@/lib/services/blastService");
    vi.mocked(blast.runRcsbSequenceSearchForProject).mockResolvedValueOnce({
      job: { id: "rcsb-job", status: "succeeded" } as never,
      normalized: { hitCount: 36 } as never,
    });
    const submitCallsBefore = vi.mocked(blast.submitBlastSearch).mock.calls.length;
    const { db, project } = await seedRcsbProject();
    await startPipeline(db, project.id);
    await tickPipeline(db, project.id); // sprite
    const tick = await tickPipeline(db, project.id); // blast via RCSB
    const step = tick.pipeline.steps[1]!;
    expect(step.status).toBe("succeeded");
    expect(step.jobId).toBe("rcsb-job");
    expect(step.summary).toMatch(/RCSB sequence search \(MMseqs2 vs PDB/);
    expect(step.summary).toMatch(/36 non-redundant hits/);
    expect(vi.mocked(blast.submitBlastSearch).mock.calls.length).toBe(submitCallsBefore);
  });

  it("waits for NCBI spacing only when BLAST is the last thing running", async () => {
    const blast = await import("@/lib/services/blastService");
    vi.mocked(blast.pollBlastJob).mockResolvedValue({
      job: { id: "blast-job", status: "running" } as never,
      pending: true,
      rid: "RID1",
      rtoe: 120,
      normalized: null,
      deferredNcbiPoll: true,
      ncbiWaitRemainingMs: 42_000,
    });
    try {
      const { db, project } = await seedRcsbProject();
      await startPipeline(db, project.id);
      let last = await tickPipeline(db, project.id);
      for (let i = 0; i < 12; i += 1) {
        last = await tickPipeline(db, project.id);
      }
      const others = last.pipeline.steps.filter((s) => s.tool !== "blast");
      expect(others.every((s) => s.status !== "pending" && s.status !== "running")).toBe(true);
      expect(last.pipeline.steps[1]?.status).toBe("running");
      expect(last.pipeline.steps[1]?.summary).toMatch(/usually 1–5 min/);
      expect(last.waiting).toBe(true);
      expect(last.suggestedWaitMs).toBe(42_000);
    } finally {
      vi.mocked(blast.pollBlastJob).mockReset();
      vi.mocked(blast.pollBlastJob).mockImplementation(async () => ({
        job: { id: "blast-job", status: "succeeded" } as never,
        pending: false,
        rid: "RID1",
        rtoe: 10,
        normalized: { hitCount: 3 } as never,
      }));
    }
  });

  it("times BLAST out after 10 minutes honestly and lets the teacher retry it", async () => {
    const { db, project } = await seedRcsbProject();
    await startPipeline(db, project.id);
    await tickPipeline(db, project.id); // sprite
    await tickPipeline(db, project.id); // blast submitted to NCBI (RCSB mocked down)

    // Pretend BLAST was submitted 11 minutes ago.
    const row = (await db.select().from(analysisPipelines))[0]!;
    const steps = JSON.parse(row.stepsJson) as { tool: string; startedAt: string | null }[];
    steps[1]!.startedAt = new Date(Date.now() - 11 * 60_000).toISOString();
    await db
      .update(analysisPipelines)
      .set({ stepsJson: JSON.stringify(steps) })
      .where(eq(analysisPipelines.id, row.id));

    const timedOut = await tickPipeline(db, project.id);
    const blastStep = timedOut.pipeline.steps[1]!;
    expect(blastStep.status).toBe("failed");
    expect(blastStep.error).toMatch(/did not finish within 10 minutes/);
    expect(blastStep.error).toMatch(/No hits were invented/);

    const retried = await retryPipelineStep(db, project.id, "blast");
    expect(retried.status).toBe("running");
    expect(retried.steps[1]?.status).toBe("pending");
    expect(retried.steps[1]?.error).toBeNull();
    // Already-finished tools are not re-run.
    expect(retried.steps[0]?.status).toBe("succeeded");
  });

  it("records a huge tool error as a short plain-English step error instead of crashing the tick", async () => {
    const foldseek = await import("@/lib/services/foldseekService");
    const hugeParams = "x".repeat(5_000_000);
    vi.mocked(foldseek.submitFoldseekSearch).mockRejectedValueOnce(
      new Error(`Failed query: insert into "results" values (?, ?)\nparams: ${hugeParams}`),
    );
    const { db, project } = await seedRcsbProject();
    await startPipeline(db, project.id);
    await tickPipeline(db, project.id); // sprite
    await tickPipeline(db, project.id); // blast
    const tick = await tickPipeline(db, project.id); // foldseek throws
    const step = tick.pipeline.steps[2]!;
    expect(step.tool).toBe("foldseek");
    expect(step.status).toBe("failed");
    expect(step.error!.length).toBeLessThan(700);
    expect(step.error).toMatch(/class database/);
    expect(step.error).not.toMatch(/Failed query/);
    // Pipeline keeps going to the next tool on the following tick.
    const next = await tickPipeline(db, project.id);
    expect(next.pipeline.steps[3]?.status).toBe("succeeded");
  });

  it("skips CLEAN in the classroom pipeline; SwissDock skips when ligand is missing; InterPro runs", async () => {
    const { db, project } = await seedRcsbProject();
    await startPipeline(db, project.id);

    // Drive through all steps
    for (let i = 0; i < 20; i += 1) {
      const result = await tickPipeline(db, project.id);
      if (
        result.pipeline.status === "completed" ||
        result.pipeline.status === "failed"
      ) {
        break;
      }
    }

    const final = await getPipelineStatus(db, project.id);
    expect(final).toBeTruthy();
    const byTool = Object.fromEntries(
      final!.steps.map((s) => [s.tool, s.status]),
    );
    expect(byTool.sprite).toBe("succeeded");
    expect(byTool.blast).toBe("succeeded");
    expect(byTool.foldseek).toBe("succeeded");
    expect(byTool.dali).toBe("succeeded");
    expect(byTool.interpro).toBe("succeeded");
    expect(byTool.clean).toBe("skipped");
    const cleanStep = final!.steps.find((s) => s.tool === "clean")!;
    expect(cleanStep.summary).toBe(
      "Optional: run CLEAN from the Results page when you need it",
    );
    expect(cleanStep.skipReason).toMatch(/student-requested/);
    expect(cleanStep.error).toBeNull();
    const clean = await import("@/lib/services/cleanService");
    expect(clean.submitCleanPrediction).not.toHaveBeenCalled();
    expect(byTool.swissdock).toBe("skipped");
    expect(final!.status).toBe("completed");

    const { sections } = await getProjectResultsSections(db, project.id);
    const cleanSection = sections.find((s) => s.tool === "clean")!;
    expect(cleanSection.status).toBe("skipped");
    expect(cleanSection.normalized).toBeNull();
  });

  it("does not auto-submit CLEAN; the student must use the manual CLEAN button", async () => {
    const clean = await import("@/lib/services/cleanService");
    vi.mocked(clean.submitCleanPrediction).mockClear();
    const { db, project } = await seedRcsbProject();
    await startPipeline(db, project.id);
    for (let i = 0; i < 20; i += 1) {
      const result = await tickPipeline(db, project.id);
      if (result.pipeline.status !== "running") break;
    }
    const final = await getPipelineStatus(db, project.id);
    const step = final!.steps.find((s) => s.tool === "clean")!;
    expect(step.status).toBe("skipped");
    expect(clean.submitCleanPrediction).not.toHaveBeenCalled();
  });

  it("skips InterPro when no UniProt accession in metadata", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "No UniProt" });
    await saveStudentPdbId(db, project.id, "1ABC");
    const timestamp = nowIso();
    await db
      .update(structures)
      .set({
        source: "rcsb",
        sequence: "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRSQL",
        metadataJson: JSON.stringify({ uniprotAccessions: [] }),
        retrievedAt: timestamp,
        updatedAt: timestamp,
      })
      .where(eq(structures.projectId, project.id));

    await startPipeline(db, project.id);
    for (let i = 0; i < 20; i += 1) {
      const result = await tickPipeline(db, project.id);
      if (
        result.pipeline.status === "completed" ||
        result.pipeline.status === "failed"
      ) {
        break;
      }
    }
    const final = await getPipelineStatus(db, project.id);
    const interpro = final!.steps.find((s) => s.tool === "interpro");
    expect(interpro?.status).toBe("skipped");
    expect(interpro?.skipReason).toMatch(/UniProt/i);
  });
});
