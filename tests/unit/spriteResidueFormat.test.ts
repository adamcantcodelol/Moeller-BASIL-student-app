import { describe, expect, it } from "vitest";
import {
  formatOneResidue,
  formatResidueList,
  pairResidues,
} from "@/components/sprite/residueFormat";
import type { SpriteResidueNormalized } from "@/adapters/sprite";

const hisE57: SpriteResidueNormalized = {
  chain: "E",
  resNo: "57",
  resType: "HIS",
};
const hisF57: SpriteResidueNormalized = {
  chain: "F",
  resNo: "57",
  resType: "HIS",
};
const aspE102: SpriteResidueNormalized = {
  chain: "E",
  resNo: "102",
  resType: "ASP",
};

describe("formatOneResidue", () => {
  it("formats resType chain:resNo", () => {
    expect(formatOneResidue(hisE57)).toBe("HIS E:57");
  });

  it("returns em dash for null/empty", () => {
    expect(formatOneResidue(null)).toBe("—");
    expect(formatOneResidue(undefined)).toBe("—");
    expect(
      formatOneResidue({ chain: null, resNo: null, resType: null }),
    ).toBe("—");
  });
});

describe("formatResidueList", () => {
  it("joins residues with commas", () => {
    expect(formatResidueList([hisE57, aspE102])).toBe("HIS E:57, ASP E:102");
  });

  it("returns em dash for empty list", () => {
    expect(formatResidueList([])).toBe("—");
  });
});

describe("pairResidues", () => {
  it("pairs by index into HIS E:57 ↔ HIS F:57 labels", () => {
    const pairs = pairResidues([hisE57, aspE102], [hisF57, aspE102]);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]?.label).toBe("HIS E:57 ↔ HIS F:57");
    expect(pairs[1]?.label).toBe("ASP E:102 ↔ ASP E:102");
  });

  it("keeps leftovers when lengths differ", () => {
    const pairs = pairResidues([hisE57, aspE102], [hisF57]);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]?.label).toBe("HIS E:57 ↔ HIS F:57");
    expect(pairs[1]?.pattern).toEqual(aspE102);
    expect(pairs[1]?.match).toBeNull();
    expect(pairs[1]?.label).toBe("ASP E:102 ↔ —");
  });

  it("returns empty when both sides empty", () => {
    expect(pairResidues([], [])).toEqual([]);
  });
});
