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

  it("ignores selenomethionine (MSE) and other in-chain modified residues", () => {
    const pdb = [
      "HETATM    1  SE  MSE A  10      50.000  50.000  50.000  1.00 10.00          SE",
      "HETATM    2  CA  MSE A  10      51.000  50.000  50.000  1.00 10.00           C",
      "HETATM    3  CE  MSE A  10      52.000  50.000  50.000  1.00 10.00           C",
      "HETATM    4  C1  EDO A 301       1.000   2.000   3.000  1.00 10.00           C",
    ].join("\n");
    expect(extractLigandFromPdbText(pdb)).toBeNull();
    const withLigand = `${pdb}\nHETATM    5  C1  BEN A   1       1.000   1.000   1.000  1.00 10.00           C\nHETATM    6  C2  BEN A   1       3.000   1.000   1.000  1.00 10.00           C`;
    expect(extractLigandFromPdbText(withLigand)).toMatchObject({ resName: "BEN", boxCenter: "2.000_1.000_1.000" });
  });
});
