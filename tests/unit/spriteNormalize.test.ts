import { describe, expect, it } from "vitest";
import { normalizeSpritePayload } from "@/adapters/sprite";
import type { SpriteRawPayload } from "@/adapters/sprite";

describe("normalizeSpritePayload", () => {
  it("maps SPRITE matches without inventing pdb ids", () => {
    const payload: SpriteRawPayload = {
      sessionId: "sess1",
      strucId: "0",
      pdbId: "4CHA",
      database: "csa3",
      celeryState: "COMPLETED",
      sessionSnapshot: null,
      results: {
        total_results: 2,
        total_pages: 1,
        total_matches: 2,
        matches: [
          {
            pdb_id: "1ds2",
            pattern_id: "1ds2_c00",
            size: 5,
            description: "PROTEINASE B",
            rmsd: 0.26,
            transform: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
            pat_residues: [
              { chain: "E", res_no: "57", res_type: "HIS" },
            ],
            match_residues: [
              { chain: "F", res_no: "57", res_type: "HIS" },
            ],
          },
          {
            // missing pdb_id — must be dropped, never invented
            pattern_id: "bad",
            rmsd: 0.1,
          },
        ],
      },
    };

    const normalized = normalizeSpritePayload(payload, {
      retrievedAt: "2026-09-23T00:00:00.000Z",
    });

    expect(normalized.hitCount).toBe(1);
    expect(normalized.totalResults).toBe(2);
    expect(normalized.hits[0]?.pdbId).toBe("1ds2");
    expect(normalized.hits[0]?.patternId).toBe("1ds2_c00");
    expect(normalized.hits[0]?.rmsd).toBe(0.26);
    expect(normalized.hits[0]?.matchResidues[0]?.resType).toBe("HIS");
    expect(normalized.provenance.source).toBe("https://grafss.ukm.my");
    expect(normalized.provenance.tool).toContain("SPRITE");
  });


  it("sorts hits by ascending RMSD (best first, nulls last)", () => {
    const payload: SpriteRawPayload = {
      sessionId: "sess3",
      strucId: "0",
      pdbId: "4CHA",
      database: "csa3",
      celeryState: "COMPLETED",
      sessionSnapshot: null,
      results: {
        total_results: 3,
        matches: [
          {
            pdb_id: "high",
            pattern_id: "a",
            rmsd: 2.5,
          },
          {
            pdb_id: "best",
            pattern_id: "b",
            rmsd: 0.4,
          },
          {
            pdb_id: "mid",
            pattern_id: "c",
            rmsd: 1.2,
          },
          {
            pdb_id: "none",
            pattern_id: "d",
            // rmsd omitted → null
          },
        ],
      },
    };
    const normalized = normalizeSpritePayload(payload, {
      retrievedAt: "2026-09-23T00:00:00.000Z",
    });
    expect(normalized.hits.map((h) => h.pdbId)).toEqual([
      "best",
      "mid",
      "high",
      "none",
    ]);
    expect(normalized.hits.map((h) => h.rmsd)).toEqual([0.4, 1.2, 2.5, null]);
  });

  it("returns empty hits for a real empty matches array", () => {
    const payload: SpriteRawPayload = {
      sessionId: "sess2",
      strucId: "0",
      pdbId: "1CRN",
      database: "csa3",
      celeryState: "COMPLETED",
      sessionSnapshot: null,
      results: { total_results: 0, matches: [] },
    };
    const normalized = normalizeSpritePayload(payload, {
      retrievedAt: "2026-09-23T00:00:00.000Z",
    });
    expect(normalized.hitCount).toBe(0);
    expect(normalized.hits).toEqual([]);
  });
});
