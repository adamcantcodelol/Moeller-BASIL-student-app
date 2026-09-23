import { describe, expect, it } from "vitest";
import { generateChimeraXCommands } from "@/lib/chimerax/generateCommands";

describe("generateChimeraXCommands", () => {
  it("never invents residues when evidence is empty", () => {
    const commands = generateChimeraXCommands({
      pdbId: "4hhb",
      residues: [],
    });
    expect(commands.script).toContain("open 4HHB");
    expect(commands.script).toContain("No evidence residues");
    expect(commands.script).not.toMatch(/select #1:\d+/);
  });

  it("selects only provided evidence residues", () => {
    const commands = generateChimeraXCommands({
      pdbId: "1CRN",
      comparisonPdbId: "1CBS",
      residues: [{ chain: "A", position: 10, aminoAcid: "C" }],
    });
    expect(commands.script).toContain("select #1/A:10");
    expect(commands.script).toContain("open 1CBS");
  });
});
