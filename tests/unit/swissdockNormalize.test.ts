import { describe, expect, it } from "vitest";
import {
  parseSwissDockStatusText,
  normalizeSwissDockPayload,
} from "@/adapters/swissdock";

describe("parseSwissDockStatusText", () => {
  it("extracts affinity lines only when present", () => {
    const poses = parseSwissDockStatusText(
      "Pose 1 affinity: -6.4\nPose 2 affinity=-5.1\nhello",
    );
    expect(poses).toHaveLength(2);
    expect(poses[0]?.affinity).toBe(-6.4);
  });
});

describe("normalizeSwissDockPayload", () => {
  it("does not invent poses while docking", () => {
    const normalized = normalizeSwissDockPayload({
      sessionNumber: "123",
      pdbId: "4HHB",
      smiles: "CCO",
      statusText: "running",
      phase: "docking",
      resultsText: null,
    });
    expect(normalized.poseCount).toBe(0);
    expect(normalized.provenance.source).toBe("https://swissdock.ch");
  });
});
