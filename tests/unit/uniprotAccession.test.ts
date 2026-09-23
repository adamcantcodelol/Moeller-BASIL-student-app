import { describe, expect, it } from "vitest";
import { validateUniProtAccession } from "@/lib/validation/uniprotAccession";

describe("validateUniProtAccession", () => {
  it("accepts classic and extended accessions", () => {
    expect(validateUniProtAccession("p04637")).toEqual({
      ok: true,
      accession: "P04637",
    });
    expect(validateUniProtAccession("A0A024R1R8").ok).toBe(true);
  });

  it("rejects entry names and empty input", () => {
    expect(validateUniProtAccession("P53_HUMAN").ok).toBe(false);
    expect(validateUniProtAccession("").ok).toBe(false);
  });
});
