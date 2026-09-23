import { describe, expect, it } from "vitest";
import { normalizeFoldseekPayload } from "@/adapters/foldseek";
import type { FoldseekRawPayload } from "@/adapters/foldseek";

describe("normalizeFoldseekPayload", () => {
  it("maps alignment hits without inventing targets", () => {
    const payload: FoldseekRawPayload = {
      ticketId: "abc",
      ticketStatus: "COMPLETE",
      pdbId: "1CRN",
      result: {
        results: [
          {
            db: "pdb100",
            alignments: [
              [
                {
                  target: "1crn_A",
                  seqId: 100,
                  alnLength: 46,
                  eval: 1e-9,
                  score: 300,
                  prob: 1,
                  qStartPos: 1,
                  qEndPos: 46,
                  dbStartPos: 1,
                  dbEndPos: 46,
                },
              ],
            ],
          },
        ],
      },
    };
    const normalized = normalizeFoldseekPayload(payload, {
      mode: "3diaa",
      database: "pdb100",
      retrievedAt: "2026-09-23T00:00:00.000Z",
    });
    expect(normalized.hitCount).toBe(1);
    expect(normalized.hits[0]?.target).toBe("1crn_A");
    expect(normalized.provenance.source).toContain("foldseek");
  });
});
