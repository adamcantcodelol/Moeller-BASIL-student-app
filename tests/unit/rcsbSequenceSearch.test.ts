import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildRcsbSequenceQuery,
  normalizeRcsbSequenceSearch,
  runRcsbSequenceSearch,
} from "@/adapters/blast/rcsbSequenceSearch";
import { BlastAdapterError } from "@/adapters/blast/types";

// Real RCSB response for 1CA2 chain A (aligned sequences shortened).
const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/fixtures/rcsb-seqsearch-1ca2.json"),
    "utf8",
  ),
);

const SEQ = "SHHWGYGKHNGPEHWHKDFPIAKGERQSPVDIDTHTAKYDPSLKPLSVSYDQATSLRILNNGHAFNVEFDD";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("RCSB sequence search adapter", () => {
  it("builds a grouped, verbose MMseqs2 query against experimental PDB entries", () => {
    const q = buildRcsbSequenceQuery(SEQ);
    expect(q.query.service).toBe("sequence");
    expect(q.query.parameters.value).toBe(SEQ);
    expect(q.request_options.results_verbosity).toBe("verbose");
    expect(q.request_options.group_by.similarity_cutoff).toBe(95);
    expect(q.request_options.paginate.rows).toBe(50);
  });

  it("runs search + entity-name lookup and normalizes to BLAST-shaped hits", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("search.rcsb.org")) return jsonResponse(fixture);
      return jsonResponse({
        data: {
          polymer_entities: [
            {
              rcsb_id: "1A42_1",
              rcsb_polymer_entity: { pdbx_description: "CARBONIC ANHYDRASE II" },
              rcsb_entity_source_organism: [{ scientific_name: "Homo sapiens" }],
              entry: { struct: { title: "HUMAN CARBONIC ANHYDRASE II" } },
            },
          ],
        },
      });
    }) as unknown as typeof fetch;

    const raw = await runRcsbSequenceSearch({ sequence: SEQ }, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const normalized = normalizeRcsbSequenceSearch(raw, {
      queryLength: 259,
      retrievedAt: "2026-09-24T20:00:00.000Z",
      pdbId: "1CA2",
    });
    expect(normalized.method).toBe("rcsb-mmseqs2");
    expect(normalized.program).toBe("mmseqs2");
    expect(normalized.methodLabel).toMatch(/RCSB PDB sequence search/);
    expect(normalized.hitCount).toBe(3);
    const top = normalized.hits[0]!;
    expect(top.accession).toBe("1A42_1");
    expect(top.title).toBe("CARBONIC ANHYDRASE II [Homo sapiens]");
    expect(top.identityPct).toBe(100);
    expect(top.bitScore).toBe(557);
    expect(top.evalue).toBe("5.4e-180");
    // Hits without a name lookup keep a null title (never invented).
    expect(normalized.hits[1]!.title).toBeNull();
    expect(normalized.provenance.source).toBe(
      "https://search.rcsb.org/rcsbsearch/v2/query",
    );
    expect(normalized.provenance.parameters.pdbId).toBe("1CA2");
  });

  it("treats HTTP 204 as a real empty result", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(null, { status: 204 }),
    ) as unknown as typeof fetch;
    const raw = await runRcsbSequenceSearch({ sequence: SEQ }, { fetchImpl });
    const normalized = normalizeRcsbSequenceSearch(raw, { queryLength: 70 });
    expect(normalized.hitCount).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("throws a BlastAdapterError on upstream errors (no fabricated hits)", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("oops", { status: 500 }),
    ) as unknown as typeof fetch;
    await expect(
      runRcsbSequenceSearch({ sequence: SEQ }, { fetchImpl }),
    ).rejects.toBeInstanceOf(BlastAdapterError);
  });
});
