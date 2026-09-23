import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeInterProPayload } from "@/adapters/interpro";
import type { InterProRawPayload } from "@/adapters/interpro";

const fixture = JSON.parse(
  readFileSync("tests/fixtures/interpro-p04637.json", "utf8"),
) as InterProRawPayload;

describe("normalizeInterProPayload", () => {
  it("maps InterPro REST fields without inventing entries", () => {
    const normalized = normalizeInterProPayload(
      "P04637",
      fixture,
      "2026-09-23T00:00:00.000Z",
    );
    expect(normalized.uniprotAccession).toBe("P04637");
    expect(normalized.proteinId).toBe("P53_HUMAN");
    expect(normalized.entryCount).toBeGreaterThan(0);
    expect(normalized.entries[0]?.accession).toMatch(/^IPR/);
    expect(normalized.provenance.source).toContain("interpro");
    expect(normalized.provenance.tool).toBe("InterPro REST API");
  });
});
