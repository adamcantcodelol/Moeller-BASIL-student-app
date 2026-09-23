import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeRcsbPayload } from "@/adapters/rcsb/normalize";
import type { RcsbRawPayload } from "@/adapters/rcsb/types";

const fixture = JSON.parse(
  readFileSync("tests/fixtures/rcsb-4hhb.json", "utf8"),
) as RcsbRawPayload;

describe("normalizeRcsbPayload", () => {
  it("maps verified 4HHB RCSB fields without inventing active sites", () => {
    const normalized = normalizeRcsbPayload(
      "4HHB",
      fixture,
      "2026-09-23T21:00:00.000Z",
    );

    expect(normalized.pdbId).toBe("4HHB");
    expect(normalized.title).toMatch(/DEOXYHAEMOGLOBIN/i);
    expect(normalized.organism).toMatch(/Homo sapiens/i);
    expect(normalized.chains).toEqual(
      expect.arrayContaining(["A", "B", "C", "D"]),
    );
    expect(normalized.sequence?.startsWith("VLSPADKTNV")).toBe(true);
    expect(normalized.experimentalMethod).toMatch(/X-RAY/i);
    expect(normalized.resolutionAngstrom).toBe(1.74);
    expect(normalized.polymerEntities).toHaveLength(2);
    expect(normalized.structureCifUrl).toBe(
      "https://files.rcsb.org/download/4HHB.cif",
    );
    expect(normalized.provenance.tool).toBe("RCSB PDB Data API");
    expect(normalized.provenance.source).toBe("https://data.rcsb.org/");
    expect(JSON.stringify(normalized)).not.toMatch(/active.?site/i);
  });
});
