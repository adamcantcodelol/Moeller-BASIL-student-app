import { describe, expect, it } from "vitest";
import { listHetGroups, parseResidueList, residueCentroid } from "@/adapters/swissdock";
import { checkSmilesSyntax, parseRheaParticipants } from "@/lib/services/swissdockLigands";

const PDB = [
  "MODRES 2QRU MSE A   10  MET  SELENOMETHIONINE",
  "ATOM      1  N   SER A 114       0.000   0.000   0.000  1.00 10.00           N",
  "ATOM      2  OG  SER A 114       2.000   0.000   0.000  1.00 10.00           O",
  "ATOM      3  NE2 HIS A 236       4.000   6.000   0.000  1.00 10.00           N",
  "HETATM    4 SE   MSE A  10      50.000  50.000  50.000  1.00 10.00          SE",
  "HETATM    5  C1  EDO A 301       1.000   2.000   3.000  1.00 10.00           C",
  "HETATM    6  C2  EDO A 301       3.000   2.000   3.000  1.00 10.00           C",
  "HETATM    7  P   PO4 A 302       9.000   9.000   9.000  1.00 10.00           P",
  "HETATM    8  O   HOH A 401       5.000   5.000   5.000  1.00 10.00           O",
].join("\n");

describe("SwissDock ligand chooser helpers", () => {
  it("lists het groups with honest labels and no waters", () => {
    const hets = listHetGroups(PDB);
    expect(hets.map((h) => [h.resName, h.category])).toEqual([
      ["EDO", "additive"],
      ["PO4", "ion"],
      ["MSE", "modified-residue"],
    ]);
    expect(hets[0]!.boxCenter).toBe("2.000_2.000_3.000");
  });

  it("centers on real residues only", () => {
    expect(parseResidueList("A:114, A236 ,SER114, nonsense")).toEqual([
      { chain: "A", position: 114 },
      { chain: "A", position: 236 },
      { chain: null, position: 114 },
    ]);
    const c = residueCentroid(PDB, [{ chain: "A", position: 114 }, { chain: "A", position: 236 }]);
    expect(c?.boxCenter).toBe("2.000_2.000_0.000");
    expect(c?.missing).toEqual([]);
    expect(residueCentroid(PDB, [{ chain: "B", position: 999 }])).toBeNull();
  });

  it("checks SMILES syntax honestly", () => {
    expect(checkSmilesSyntax("CC(=O)Oc1ccc(cc1)[N+](=O)[O-]")).toBeNull();
    expect(checkSmilesSyntax("CC(=O")).toMatch(/Unbalanced/);
    expect(checkSmilesSyntax("c1ccccc")).toMatch(/Ring bond 1/);
    expect(checkSmilesSyntax("C C")).toMatch(/spaces/);
    expect(checkSmilesSyntax("[N+")).toMatch(/Unclosed/);
  });

  it("extracts concrete Rhea participants, skipping generic classes and water", () => {
    expect(
      parseRheaParticipants("4-nitrophenyl acetate + H2O = 4-nitrophenol + acetate + H(+)"),
    ).toEqual(["4-nitrophenyl acetate", "4-nitrophenol", "acetate"]);
    expect(parseRheaParticipants("a carboxylic ester + H2O = an alcohol + a carboxylate + H(+)")).toEqual([]);
  });
});
