import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildPrediction,
  cleanConfidenceLevel,
  CleanAdapterError,
  normalizeEcNumber,
  parseCleanMaxsepCsv,
  parseCleanResultsBody,
  parseExpasyEnzymeName,
} from "@/adapters/clean";
import {
  normalizeCleanImport,
  normalizeCleanLiveResult,
  prepareCleanSequence,
} from "@/lib/services/cleanService";
import { buildProvenance } from "@/lib/provenance/buildProvenance";

/**
 * Shape confirmed from mmli-backend CleanService.cleanResultPostProcess and
 * the official CLEAN SPA (which JSON.parse()s the body). Values here are a
 * test fixture, not a real CLEAN prediction.
 */
const confirmedShape = [
  {
    sequence: "P00918_CA2",
    result: [
      { ecNumber: "EC:4.2.1.69", score: 0.1523 },
      { ecNumber: "EC:4.2.1.1", score: 0.9866 },
    ],
  },
];

describe("CLEAN confidence levels (web app thresholds)", () => {
  it("maps ≥0.8 High, 0.2–0.8 Medium, <0.2 Low", () => {
    expect(cleanConfidenceLevel(1)).toBe("High");
    expect(cleanConfidenceLevel(0.8)).toBe("High");
    expect(cleanConfidenceLevel(0.7999)).toBe("Medium");
    expect(cleanConfidenceLevel(0.2)).toBe("Medium");
    expect(cleanConfidenceLevel(0.1999)).toBe("Low");
    expect(cleanConfidenceLevel(0)).toBe("Low");
  });
});

describe("normalizeEcNumber", () => {
  it("strips EC: prefix and accepts partial ECs", () => {
    expect(normalizeEcNumber("EC:4.2.1.1")).toBe("4.2.1.1");
    expect(normalizeEcNumber(" ec 3.4.21.- ")).toBe("3.4.21.-");
    expect(normalizeEcNumber("1.1.1.n1")).toBe("1.1.1.n1");
  });
  it("rejects non-EC strings", () => {
    expect(normalizeEcNumber("EC:9.1.1.1")).toBeNull();
    expect(normalizeEcNumber("carbonic anhydrase")).toBeNull();
    expect(normalizeEcNumber(42)).toBeNull();
  });
});

describe("parseCleanResultsBody", () => {
  it("parses the confirmed array shape and sorts by score", () => {
    const parsed = parseCleanResultsBody(confirmedShape);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.header).toBe("P00918_CA2");
    expect(parsed[0]!.predictions.map((p) => p.ecNumber)).toEqual([
      "4.2.1.1",
      "4.2.1.69",
    ]);
    const top = parsed[0]!.predictions[0]!;
    expect(top.score).toBe(0.9866);
    expect(top.level).toBe("High");
    expect(top.enzymeClass).toBe("Lyases");
    expect(top.expasyUrl).toBe("https://enzyme.expasy.org/EC/4.2.1.1");
    expect(top.enzymeName).toBeNull();
    expect(parsed[0]!.predictions[1]!.level).toBe("Low");
  });

  it("parses a JSON-encoded string body (double-encoded)", () => {
    const body = JSON.parse(
      readFileSync("tests/fixtures/clean-results-sample.json", "utf8"),
    ) as string;
    expect(typeof body).toBe("string");
    const parsed = parseCleanResultsBody(body);
    expect(parsed[0]!.predictions[0]!.ecNumber).toBe("4.2.1.1");
    expect(parseCleanResultsBody(JSON.stringify(body))[0]!.header).toBe(
      "P00918_CA2",
    );
  });

  it("accepts string scores and drops malformed entries instead of inventing", () => {
    const parsed = parseCleanResultsBody([
      {
        sequence: "x",
        result: [
          { ecNumber: "EC:3.4.21.4", score: "0.5000" },
          { ecNumber: "not-an-ec", score: 0.9 },
          { ecNumber: "EC:1.1.1.1", score: "NaN" },
        ],
      },
    ]);
    expect(parsed[0]!.predictions).toHaveLength(1);
    expect(parsed[0]!.predictions[0]!).toMatchObject({
      ecNumber: "3.4.21.4",
      score: 0.5,
      level: "Medium",
      enzymeClass: "Hydrolases",
    });
  });

  it("throws INVALID_RESPONSE on non-list / invalid JSON bodies", () => {
    expect(() => parseCleanResultsBody({ detail: "x" })).toThrow(
      CleanAdapterError,
    );
    expect(() => parseCleanResultsBody("Internal Server Error")).toThrow(
      /not valid JSON/,
    );
    expect(() => parseCleanResultsBody([42])).toThrow(/not an object/);
  });

  it("returns empty predictions when CLEAN returned none", () => {
    expect(
      parseCleanResultsBody([{ sequence: "q", result: [] }])[0]!.predictions,
    ).toEqual([]);
  });
});

describe("parseCleanMaxsepCsv (import fallback)", () => {
  it("parses CLEAN maxsep lines from the official example format", () => {
    const rows = parseCleanMaxsepCsv(
      "WP_063460136,EC:5.3.1.7/0.0431\nWP_041412631,EC:4.2.1.25/0.9903,EC:4.2.1.67/0.9781\n\n",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]!.predictions[0]).toMatchObject({
      ecNumber: "5.3.1.7",
      level: "Low",
      enzymeClass: "Isomerases",
    });
    expect(rows[1]!.predictions.map((p) => p.ecNumber)).toEqual([
      "4.2.1.25",
      "4.2.1.67",
    ]);
  });
  it("returns [] for non-CLEAN text", () => {
    expect(parseCleanMaxsepCsv("hello world\nfoo,bar")).toEqual([]);
  });
});

describe("parseExpasyEnzymeName", () => {
  it("reads the DE line", () => {
    expect(
      parseExpasyEnzymeName(
        "ID   4.2.1.1\nDE   carbonic anhydrase.\nAN   carbonate dehydratase.\n",
      ),
    ).toBe("carbonic anhydrase");
    expect(parseExpasyEnzymeName("ID   1.1.1.1\n")).toBeNull();
    expect(
      parseExpasyEnzymeName("ID   1.1.1.5\nDE   Transferred entry: 1.1.1.303.\n"),
    ).toBeNull();
  });
});

describe("normalizeCleanLiveResult", () => {
  it("builds stored shape with provenance and enzyme names", () => {
    const normalized = normalizeCleanLiveResult(
      {
        mmliJobId: "job123",
        phase: "completed",
        header: "P00918_CA2",
        sequenceLength: 260,
        results: JSON.stringify(confirmedShape),
      },
      {
        retrievedAt: "2026-09-24T20:00:00.000Z",
        enzymeNames: { "4.2.1.1": "carbonic anhydrase" },
      },
    );
    expect(normalized.kind).toBe("clean-live");
    expect(normalized.predictionCount).toBe(2);
    expect(normalized.topPrediction).toMatchObject({
      ecNumber: "4.2.1.1",
      enzymeName: "carbonic anhydrase",
      level: "High",
    });
    expect(normalized.provenance.source).toBe(
      "https://clean.platform.ibiofoundry.illinois.edu",
    );
    expect(normalized.provenance.parameters.mmliJobId).toBe("job123");
  });

  it("derives an import view only when the CSV parses", () => {
    const provenance = buildProvenance({ tool: "CLEAN", source: "import" });
    expect(
      normalizeCleanImport("Q,EC:4.2.1.1/0.91", provenance)?.topPrediction
        ?.ecNumber,
    ).toBe("4.2.1.1");
    expect(normalizeCleanImport("free text", provenance)).toBeNull();
  });

  it("buildPrediction returns null for missing score", () => {
    expect(buildPrediction("EC:4.2.1.1", undefined)).toBeNull();
  });
});

describe("prepareCleanSequence", () => {
  it("strips FASTA headers, whitespace and a few non-standard letters", () => {
    const { sequence, removedNonStandard } = prepareCleanSequence(
      ">x\nMSHHWGYGKH NGPEHWHKDF\nPIAKGERQSX",
    );
    expect(sequence).toBe("MSHHWGYGKHNGPEHWHKDFPIAKGERQS");
    expect(removedNonStandard).toBe(1);
  });
  it("refuses too-short and too-long sequences (never truncates)", () => {
    expect(() => prepareCleanSequence("MKT")).toThrow(/at least 10/);
    expect(() => prepareCleanSequence("A".repeat(1023))).toThrow(/1022/);
  });
});
