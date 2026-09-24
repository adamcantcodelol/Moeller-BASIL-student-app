import { describe, expect, it } from "vitest";
import {
  serializeRawForStorage,
  toSafeErrorMessage,
} from "@/lib/db/storageLimits";
import { trimFoldseekRawForStorage } from "@/lib/services/foldseekService";

describe("storage limits", () => {
  it("keeps small raw payloads verbatim", () => {
    const raw = { a: 1, b: "two" };
    expect(serializeRawForStorage(raw, { tool: "X", source: "s" })).toBe(
      JSON.stringify(raw),
    );
  });

  it("replaces an oversized raw payload with an honest placeholder", () => {
    const raw = { big: "y".repeat(2_500_000) };
    const stored = JSON.parse(
      serializeRawForStorage(raw, { tool: "Foldseek", source: "https://x" }),
    );
    expect(stored.rawPayloadStored).toBe(false);
    expect(stored.originalBytes).toBeGreaterThan(2_000_000);
    expect(stored.reason).toMatch(/not stored/);
  });

  it("turns drizzle/D1 errors into short plain English", () => {
    const message = toSafeErrorMessage(
      new Error(`Failed query: insert into "results"\nparams: ${"z".repeat(100_000)}`),
      "fallback",
    );
    expect(message.length).toBeLessThan(300);
    expect(message).toMatch(/class database/);
  });

  it("clamps long ordinary messages", () => {
    const message = toSafeErrorMessage(new Error("e".repeat(5_000)), "fallback");
    expect(message.length).toBeLessThanOrEqual(600);
  });

  it("trims Foldseek alignments to the top 100 per query with a note", () => {
    const alignments = [Array.from({ length: 851 }, (_, i) => ({ target: `t${i}` }))];
    const trimmed = trimFoldseekRawForStorage({
      ticketId: "t",
      ticketStatus: "COMPLETE",
      pdbId: "2QRU",
      result: { results: [{ db: "pdb100", alignments }] },
    });
    const blocks = (trimmed.result as { results: { alignments: unknown[][] }[] })
      .results;
    expect(blocks[0]!.alignments[0]!.length).toBe(100);
    expect((blocks[0]!.alignments[0]![0] as { target: string }).target).toBe("t0");
    expect(trimmed.storageNote).toMatch(/100 of 851/);
  });
});
