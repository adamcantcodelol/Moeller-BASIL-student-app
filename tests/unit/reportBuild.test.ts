import { describe, expect, it } from "vitest";
import { buildStudentReportMarkdown } from "@/lib/reports/buildReport";

describe("buildStudentReportMarkdown", () => {
  it("includes only provided data and never invents residues", () => {
    const markdown = buildStudentReportMarkdown({
      project: {
        id: "p1",
        name: "Demo",
        studentId: null,
        status: "active",
        isDemo: false,
        createdAt: "t",
        updatedAt: "t",
      },
      structure: {
        id: "s1",
        projectId: "p1",
        pdbId: "4HHB",
        title: null,
        organism: null,
        chains: null,
        sequence: null,
        metadata: null,
        source: "student_input",
        retrievedAt: null,
        createdAt: "t",
        updatedAt: "t",
      },
      moduleRuns: [],
      evidence: [],
      hypothesis: null,
    });
    expect(markdown).toContain("4HHB");
    expect(markdown).toContain("No residues were invented");
    expect(markdown).not.toMatch(/catalytic triad/i);
  });
});
