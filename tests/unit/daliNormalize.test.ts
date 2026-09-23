import { describe, expect, it } from "vitest";
import { parseDaliSummaryText, normalizeDaliPayload } from "@/adapters/dali";

const sample = `# No:  Chain   Z    rmsd lali nres  %id PDB  Description
   1:  1crn-A 37.1  0.0  46   46  100   1crn  CRAMBIN
   2:  1ab1-A 12.4  1.8  40   46   25   1ab1  OTHER
# Structural equivalences
`;

describe("parseDaliSummaryText", () => {
  it("parses Z-scores from real table lines without inventing rows", () => {
    const hits = parseDaliSummaryText(sample);
    expect(hits).toHaveLength(2);
    expect(hits[0]?.zScore).toBe(37.1);
    expect(hits[0]?.pdbChain).toBe("1crn-A");
    expect(hits[1]?.identityPct).toBe(25);
  });
});

describe("normalizeDaliPayload", () => {
  it("returns empty hits while pending", () => {
    const normalized = normalizeDaliPayload({
      pdbId: "1crn",
      chain: "A",
      jobUrl: "http://example/job/",
      status: "Queued",
      summaryText: null,
      indexHtml: null,
    });
    expect(normalized.hitCount).toBe(0);
    expect(normalized.provenance.source).toContain("ekhidna2");
  });
});
