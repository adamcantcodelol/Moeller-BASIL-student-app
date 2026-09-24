import { describe, expect, it } from "vitest";
import { buildResultSummaryLine, defaultPanelOpen } from "@/lib/results/summaryLine";
import type { ToolResultSection } from "@/lib/services/pipelineService";
import { isSwissDockStepTimedOut, swissDockUnavailablePatch } from "@/lib/services/pipelineService";
import type { PipelineStep } from "@/types/pipeline";

function section(partial: Partial<ToolResultSection>): ToolResultSection {
  return {
    tool: "sprite",
    label: "SPRITE",
    moduleSlug: "sprite",
    status: "succeeded",
    summary: "stored summary",
    provenanceSource: null,
    provenanceRetrievedAt: null,
    normalized: null,
    error: null,
    skipReason: null,
    ...partial,
  };
}

describe("results summary line", () => {
  it("uses only real stored numbers", () => {
    expect(
      buildResultSummaryLine(
        section({ normalized: { hits: [{ rmsd: 1.5 }, { rmsd: 0.72 }, { rmsd: null }] } }),
      ),
    ).toBe("3 matches · best RMSD 0.72 Å");
    expect(
      buildResultSummaryLine(
        section({ tool: "dali", normalized: { hits: [{ zScore: 12.1, pdbChain: "1abcA" }, { zScore: 30.2, pdbChain: "2xyzB" }] } }),
      ),
    ).toBe("2 hits · top Z 30.2 (2xyzB)");
    expect(
      buildResultSummaryLine(
        section({ tool: "blast", normalized: { hits: [{ evalue: "1e-50", identityPct: 98.6 }] } }),
      ),
    ).toBe("1 hit · best E-value 1.0e-50 · top identity 99%");
    expect(
      buildResultSummaryLine(section({ tool: "swissdock", normalized: { poses: [{ affinity: -4.477 }] } })),
    ).toBe("1 pose · best affinity -4.48 kcal/mol");
    // No RMSD present → no invented RMSD.
    expect(buildResultSummaryLine(section({ normalized: { hits: [{ rmsd: null }] } }))).toBe("1 match");
  });

  it("falls back to status text without data", () => {
    expect(
      buildResultSummaryLine(section({ status: "running", summary: "SwissDock docking…", normalized: null })),
    ).toBe("SwissDock docking…");
  });

  it("opens problem sections, the first section and CLEAN awaiting a run", () => {
    expect(defaultPanelOpen(section({ status: "failed" }), 3)).toBe(true);
    expect(defaultPanelOpen(section({ status: "succeeded" }), 0)).toBe(true);
    expect(defaultPanelOpen(section({ status: "succeeded", normalized: {} }), 2)).toBe(false);
    expect(defaultPanelOpen(section({ tool: "clean", status: "empty" }), 5)).toBe(true);
  });
});

describe("SwissDock pipeline timeout", () => {
  it("times out stalled steps and reports an honest unavailable status", () => {
    const now = Date.parse("2026-09-24T22:00:00Z");
    const step = { startedAt: "2026-09-24T21:00:00Z" } as PipelineStep;
    expect(isSwissDockStepTimedOut(step, now)).toBe(true);
    expect(isSwissDockStepTimedOut({ startedAt: "2026-09-24T21:55:00Z" } as PipelineStep, now)).toBe(false);
    const patch = swissDockUnavailablePatch("t", "SwissDock refused the session.");
    expect(patch.status).toBe("unavailable");
    expect(patch.summary).toMatch(/Retry/);
  });
});
