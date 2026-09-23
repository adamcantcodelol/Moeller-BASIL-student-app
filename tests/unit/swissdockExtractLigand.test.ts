import { describe, expect, it } from "vitest";
import {
  extractLigandFromPdbText,
  parseChemCompSmiles,
} from "@/adapters/swissdock";

// Fixed-column PDB HETATM lines (resName cols 18–20, chain col 22, xyz 31–54)
const PDB = `HETATM 1001  O   HOH A   1      0.000   0.000   0.000  1.00 10.00           O
HETATM 1002  FE  HEM A 142      10.000  20.000  30.000  1.00 10.00          FE
HETATM 1003  CHA HEM A 142      12.000  22.000  32.000  1.00 10.00           C
END
`;

describe("extractLigandFromPdbText", () => {
  it("picks HEM over water and computes centroid", () => {
    const lig = extractLigandFromPdbText(PDB);
    expect(lig?.resName).toBe("HEM");
    expect(lig?.atomCount).toBe(2);
    expect(lig?.boxCenter).toBe("11.000_21.000_31.000");
  });

  it("returns null when only solvents", () => {
    expect(
      extractLigandFromPdbText(
        "HETATM 1001  O   HOH A   1      0.000   0.000   0.000  1.00 10.00           O\n",
      ),
    ).toBeNull();
  });
});

describe("parseChemCompSmiles", () => {
  it("reads RCSB chemcomp SMILES", () => {
    expect(
      parseChemCompSmiles({
        rcsb_chem_comp_descriptor: { SMILES: "CCO" },
      }),
    ).toBe("CCO");
  });
});
