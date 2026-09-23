import { describe, expect, it } from "vitest";
import { extractClassicPdbId, validatePdbId } from "@/lib/validation/pdbId";

describe("validatePdbId", () => {
  it("accepts classic four-character identifiers and uppercases them", () => {
    expect(validatePdbId("4hhb")).toEqual({ ok: true, pdbId: "4HHB" });
    expect(validatePdbId("1TIM")).toEqual({ ok: true, pdbId: "1TIM" });
  });

  it("rejects empty, spaced, or malformed identifiers", () => {
    expect(validatePdbId("").ok).toBe(false);
    expect(validatePdbId("   ").ok).toBe(false);
    expect(validatePdbId("HHB").ok).toBe(false);
    expect(validatePdbId("4HHBB").ok).toBe(false);
    expect(validatePdbId("4H H").ok).toBe(false);
    expect(validatePdbId("ABCD").ok).toBe(false);
  });

  it("does not substitute a different identifier", () => {
    const result = validatePdbId("9xyz");
    expect(result).toEqual({ ok: true, pdbId: "9XYZ" });
  });
});

describe("extractClassicPdbId", () => {
  it("accepts classic IDs with chain suffixes and rejects non-PDB tokens", () => {
    expect(extractClassicPdbId("4hhb_A")).toBe("4HHB");
    expect(extractClassicPdbId("AF-P04637-F1")).toBeNull();
  });
});
