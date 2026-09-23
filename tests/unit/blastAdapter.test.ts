import { describe, expect, it, vi } from "vitest";
import {
  createBlastSearchAdapter,
  BlastAdapterError,
  sanitizeProteinSequence,
} from "@/adapters/blast";

const SEQ =
  "VLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSHGSAQVKGHGKKVADALTNAVAHVDDMPNALSALSDLHAHKLRVDPVNFKLLSHCLLVTLAAHLPAEFTPAVHASLDKFLASVSTVLTSKYR";

describe("sanitizeProteinSequence", () => {
  it("strips FASTA headers and non-letters", () => {
    expect(sanitizeProteinSequence(">hdr\nacid-1\nXYZ")).toBe("ACIDXYZ");
  });
});

describe("BlastSearchAdapter", () => {
  it("submits Put, parses RID, and returns pending when WAITING", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST" && url.includes("Blast.cgi")) {
        return new Response(
          `<!--QBlastInfoBegin\n    RID = ABC123XYZ\n    RTOE = 42\nQBlastInfoEnd-->`,
          { status: 200 },
        );
      }
      if (url.includes("FORMAT_OBJECT=SearchInfo") && url.includes("ABC123XYZ")) {
        return new Response(
          `QBlastInfoBegin\n    Status=WAITING\nQBlastInfoEnd`,
          { status: 200 },
        );
      }
      return new Response("not found", { status: 404 });
    });

    const adapter = createBlastSearchAdapter({
      fetchImpl: fetchImpl as typeof fetch,
    });
    const raw = await adapter.run({ sequence: SEQ, database: "swissprot" });
    expect(raw.rid).toBe("ABC123XYZ");
    expect(raw.status).toBe("WAITING");
    expect(raw.resultsText).toBeNull();
    expect(adapter.getProvenance().source).toBe(
      "https://blast.ncbi.nlm.nih.gov",
    );
  });

  it("fetches XML results when Status=READY", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("FORMAT_OBJECT=SearchInfo")) {
        return new Response(
          `QBlastInfoBegin\n    Status=READY\n    ThereAreHits=yes\nQBlastInfoEnd`,
          { status: 200 },
        );
      }
      if (url.includes("FORMAT_TYPE=XML")) {
        return new Response(
          `<BlastOutput><Hit><Hit_accession>P69905</Hit_accession><Hit_def>HBA</Hit_def><Hsp><Hsp_evalue>1e-90</Hsp_evalue><Hsp_bit-score>200</Hsp_bit-score><Hsp_identity>100</Hsp_identity><Hsp_align-len>100</Hsp_align-len></Hsp></Hit></BlastOutput>`,
          { status: 200 },
        );
      }
      return new Response("no", { status: 404 });
    });

    const adapter = createBlastSearchAdapter({
      fetchImpl: fetchImpl as typeof fetch,
    });
    const raw = await adapter.pollRid("READYRID", "swissprot");
    expect(raw.status).toBe("READY");
    expect(raw.resultsFormat).toBe("XML");
    const normalized = adapter.normalize(raw);
    expect(normalized.hitCount).toBe(1);
    expect(normalized.hits[0]?.accession).toBe("P69905");
  });

  it("pollRid throws PENDING when not allowPending", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        `QBlastInfoBegin\n    Status=WAITING\nQBlastInfoEnd`,
        { status: 200 },
      ),
    );
    const adapter = createBlastSearchAdapter({
      fetchImpl: fetchImpl as typeof fetch,
    });
    await expect(adapter.pollRid("X", "swissprot")).rejects.toMatchObject({
      code: "PENDING",
    } satisfies Partial<BlastAdapterError>);
  });

  it("rejects short sequences", async () => {
    const adapter = createBlastSearchAdapter({
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    await expect(adapter.run({ sequence: "ACDE" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });
});
