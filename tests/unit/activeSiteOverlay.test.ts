import { describe, expect, it } from "vitest";
import {
  formatEvidenceResidues,
  pickComparisonPdbId,
  residuesToStructureElements,
} from "@/lib/molstar/activeSiteOverlay";
import { extractClassicPdbId } from "@/lib/validation/pdbId";

describe("residuesToStructureElements", () => {
  it("maps evidence residues to Mol* auth_* schema items", () => {
    expect(
      residuesToStructureElements([
        { chain: "A", position: 57, aminoAcid: "H" },
        { position: 102 },
      ]),
    ).toEqual([
      { auth_asym_id: "A", auth_seq_id: 57 },
      { auth_seq_id: 102 },
    ]);
  });

  it("does not invent residues when the list is empty", () => {
    expect(residuesToStructureElements([])).toEqual([]);
  });
});

describe("formatEvidenceResidues", () => {
  it("labels empty evidence clearly", () => {
    expect(formatEvidenceResidues([])).toBe("none recorded");
  });
});

describe("extractClassicPdbId / pickComparisonPdbId", () => {
  it("parses Foldseek-style targets without inventing IDs", () => {
    expect(extractClassicPdbId("1abc_A")).toBe("1ABC");
    expect(extractClassicPdbId("1CBS-A")).toBe("1CBS");
    expect(extractClassicPdbId("not-a-pdb")).toBeNull();
  });

  it("skips the query PDB when picking a comparison", () => {
    expect(pickComparisonPdbId("1ABC", ["1ABC", "1CBS"])).toBe("1CBS");
    expect(pickComparisonPdbId("1ABC", ["1ABC"])).toBeNull();
  });
});
