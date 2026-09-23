import { describe, expect, it } from "vitest";
import { normalizeBlastPayload } from "@/adapters/blast";

const sampleXml = `<?xml version="1.0"?>
<BlastOutput>
  <BlastOutput_program>blastp</BlastOutput_program>
  <BlastOutput_db>swissprot</BlastOutput_db>
  <BlastOutput_iterations>
    <Iteration>
      <Hit>
        <Hit_num>1</Hit_num>
        <Hit_id>sp|P69905|HBA_HUMAN</Hit_id>
        <Hit_def>Hemoglobin subunit alpha OS=Homo sapiens</Hit_def>
        <Hit_accession>P69905</Hit_accession>
        <Hit_hsps>
          <Hsp>
            <Hsp_bit-score>287.3</Hsp_bit-score>
            <Hsp_evalue>2e-95</Hsp_evalue>
            <Hsp_query-from>1</Hsp_query-from>
            <Hsp_query-to>141</Hsp_query-to>
            <Hsp_hit-from>1</Hsp_hit-from>
            <Hsp_hit-to>141</Hsp_hit-to>
            <Hsp_identity>141</Hsp_identity>
            <Hsp_align-len>141</Hsp_align-len>
          </Hsp>
        </Hit_hsps>
      </Hit>
    </Iteration>
  </BlastOutput_iterations>
</BlastOutput>`;

describe("normalizeBlastPayload", () => {
  it("parses XML hits with identity and provenance source", () => {
    const normalized = normalizeBlastPayload({
      rid: "TEST_RID",
      rtoe: 10,
      database: "swissprot",
      program: "blastp",
      status: "READY",
      resultsText: sampleXml,
      resultsFormat: "XML",
      queryLength: 141,
      thereAreHits: true,
    });
    expect(normalized.hitCount).toBe(1);
    expect(normalized.hits[0]?.accession).toBe("P69905");
    expect(normalized.hits[0]?.identityPct).toBe(100);
    expect(normalized.hits[0]?.evalue).toBe("2e-95");
    expect(normalized.provenance.source).toBe(
      "https://blast.ncbi.nlm.nih.gov",
    );
  });

  it("returns zero hits while pending without inventing data", () => {
    const normalized = normalizeBlastPayload({
      rid: "PENDING_RID",
      rtoe: 60,
      database: "swissprot",
      program: "blastp",
      status: "WAITING",
      resultsText: null,
      resultsFormat: null,
      queryLength: 141,
      thereAreHits: null,
    });
    expect(normalized.hitCount).toBe(0);
    expect(normalized.hits).toEqual([]);
  });
});
