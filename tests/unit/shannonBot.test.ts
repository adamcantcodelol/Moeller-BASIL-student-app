import { describe, expect, it } from "vitest";
import { generateShannonBotReply } from "@/ai/shannonBot";

describe("ShannonBot local mentor", () => {
  it("refuses to invent residues when none are recorded", () => {
    const reply = generateShannonBotReply("I think residue 143 is important.", {
      evidence: [],
      hypothesis: null,
      moduleStatuses: [],
    });
    expect(reply.toLowerCase()).toContain("no recorded evidence");
    expect(reply).not.toMatch(/residue 143 is catalytic/i);
  });

  it("grounds residue discussion in recorded evidence", () => {
    const reply = generateShannonBotReply("Is residue 57 important?", {
      evidence: [
        {
          id: "e1",
          projectId: "p",
          type: "domain_residue",
          description: "InterPro catalytic hint",
          sourceResultId: null,
          sourceModuleId: "interpro",
          residues: [{ chain: "A", position: 57, aminoAcid: "H" }],
          strength: "supporting",
          provenance: null,
          isDemo: false,
          createdAt: "2026-09-23T00:00:00.000Z",
        },
      ],
      hypothesis: null,
      moduleStatuses: [],
    });
    expect(reply).toContain("57");
    expect(reply).toContain("interpro");
  });
});
