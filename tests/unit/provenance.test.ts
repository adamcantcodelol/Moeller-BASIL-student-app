import { describe, expect, it } from "vitest";
import {
  assertProvenance,
  buildImportProvenance,
  buildProvenance,
  withRawResultId,
} from "@/lib/provenance/buildProvenance";
import { ScientificError } from "@/adapters/errors";

describe("provenance helpers", () => {
  it("builds consistent provenance records", () => {
    const provenance = buildProvenance({
      tool: "RCSB PDB Data API",
      source: "https://data.rcsb.org/",
      parameters: { pdbId: "4HHB" },
      version: "rest/v1",
    });
    expect(provenance.tool).toBe("RCSB PDB Data API");
    expect(provenance.retrievedAt).toBeTruthy();
    expect(withRawResultId(provenance, "raw-1").rawResultId).toBe("raw-1");
  });

  it("labels imports as source=import", () => {
    const provenance = buildImportProvenance({
      tool: "blast",
      format: "json",
    });
    expect(provenance.source).toBe("import");
    expect(provenance.parameters.importFormat).toBe("json");
  });

  it("rejects incomplete provenance", () => {
    expect(() => assertProvenance({ tool: "", source: "x" })).toThrow(
      ScientificError,
    );
  });
});
