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
import { structures } from "@/db/schema";
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
    expect(tick2.suggestedWaitMs).toBeGreaterThanOrEqual(55_000);

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
    expect(overlapped.suggestedWaitMs).toBeGreaterThanOrEqual(45_000);
  });

  it("marks CLEAN unavailable (not a fake result) when MoleculeMaker storage is down; SwissDock skipped when ligand missing; InterPro runs", async () => {
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
    expect(byTool.clean).toBe("unavailable");
    const cleanStep = final!.steps.find((s) => s.tool === "clean")!;
    expect(cleanStep.summary).toMatch(/can't return results right now/);
    expect(cleanStep.unavailableDetail).toMatch(/HTTP 500/);
    expect(cleanStep.error).toBeNull();
    expect(byTool.swissdock).toBe("skipped");
    expect(final!.status).toBe("completed");

    const { sections } = await getProjectResultsSections(db, project.id);
    const cleanSection = sections.find((s) => s.tool === "clean")!;
    expect(cleanSection.status).toBe("unavailable");
    expect(cleanSection.normalized).toBeNull();
  });

  it("Retry re-queues only the CLEAN step and resumes the pipeline", async () => {
    const clean = await import("@/lib/services/cleanService");
    const { db, project } = await seedRcsbProject();
    await startPipeline(db, project.id);
    for (let i = 0; i < 20; i += 1) {
      const result = await tickPipeline(db, project.id);
      if (result.pipeline.status !== "running") break;
    }
    const retried = await retryPipelineStep(db, project.id, "clean");
    expect(retried.status).toBe("running");
    expect(retried.steps.find((s) => s.tool === "clean")?.status).toBe("pending");
    expect(retried.steps.find((s) => s.tool === "sprite")?.status).toBe("succeeded");

    vi.mocked(clean.submitCleanPrediction).mockResolvedValueOnce({
      job: { id: "clean-job", status: "running" } as never,
      pending: true,
      mmliJobId: "mmli-9",
      normalized: null,
      health: null,
    });
    const tick = await tickPipeline(db, project.id);
    const step = tick.pipeline.steps.find((s) => s.tool === "clean")!;
    expect(step.status).toBe("running");
    expect(step.nextPollAt).toBeTruthy();
    // Poll spacing: an immediate tick does not call upstream again.
    await tickPipeline(db, project.id);
    expect(vi.mocked(clean.pollCleanJob)).not.toHaveBeenCalled();

    await expect(
      retryPipelineStep(db, project.id, "sprite"),
    ).rejects.toThrow(/only unavailable or failed/);
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
