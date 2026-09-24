import { buildProvenance } from "@/lib/provenance/buildProvenance";
import { nowIso } from "@/lib/ids";
import type { Provenance } from "@/types/provenance";
import {
  BLAST_PROVENANCE_SOURCE,
  type BlastHitNormalized,
  type BlastNormalizedSearch,
  type BlastRawPayload,
} from "@/adapters/blast/types";

function parseNumber(value: string | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function tag(xml: string, name: string): string | null {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i");
  const match = xml.match(re);
  return match?.[1]?.trim() ?? null;
}

function allBlocks(xml: string, name: string): string[] {
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "gi");
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    blocks.push(match[1] ?? "");
  }
  return blocks;
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function normalizeXmlHits(xml: string): BlastHitNormalized[] {
  const hits: BlastHitNormalized[] = [];
  for (const hitXml of allBlocks(xml, "Hit")) {
    const accession = tag(hitXml, "Hit_accession");
    const hitId = tag(hitXml, "Hit_id");
    const title = tag(hitXml, "Hit_def");
    const hsps = allBlocks(hitXml, "Hsp");
    const primary = hsps[0] ?? "";
    const identity = parseNumber(tag(primary, "Hsp_identity"));
    const alignLen = parseNumber(tag(primary, "Hsp_align-len"));
    const identityPct =
      identity !== null && alignLen !== null && alignLen > 0
        ? Math.round((1000 * identity) / alignLen) / 10
        : null;
    hits.push({
      accession,
      hitId,
      title: title ? decodeXml(title) : null,
      evalue: tag(primary, "Hsp_evalue"),
      bitScore: parseNumber(tag(primary, "Hsp_bit-score")),
      identityPct,
      alignmentLength: alignLen,
      queryFrom: parseNumber(tag(primary, "Hsp_query-from")),
      queryTo: parseNumber(tag(primary, "Hsp_query-to")),
      hitFrom: parseNumber(tag(primary, "Hsp_hit-from")),
      hitTo: parseNumber(tag(primary, "Hsp_hit-to")),
    });
  }
  return hits;
}

/**
 * Best-effort Text BLAST table/alignment parse when XML is unavailable.
 * Never invents accessions — only extracts lines that clearly look like hits.
 */
function normalizeTextHits(text: string): BlastHitNormalized[] {
  const hits: BlastHitNormalized[] = [];
  // Classic "Sequences producing significant alignments" table rows:
  // accession... description... score... E-value
  const tableSection = text.split(/Sequences producing significant alignments:/i)[1];
  if (!tableSection) {
    return hits;
  }
  const body = tableSection.split(/\n\s*\n/)[0] ?? tableSection;
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("Query") || trimmed.startsWith("---")) {
      continue;
    }
    // accession ... score evalue at end
    const match = trimmed.match(
      /^(\S+)\s+(.+?)\s+(\d+(?:\.\d+)?)\s+([0-9.eE+-]+)\s*$/,
    );
    if (!match) continue;
    hits.push({
      accession: match[1] ?? null,
      hitId: match[1] ?? null,
      title: (match[2] ?? "").trim() || null,
      evalue: match[4] ?? null,
      bitScore: parseNumber(match[3]),
      identityPct: null,
      alignmentLength: null,
      queryFrom: null,
      queryTo: null,
      hitFrom: null,
      hitTo: null,
    });
  }
  return hits;
}

export function buildBlastProvenance(input: {
  rid: string;
  database: string;
  status: string;
  retrievedAt?: string;
  queryLength?: number | null;
  hitCount?: number | null;
}): Provenance {
  return buildProvenance({
    tool: "NCBI BLAST",
    source: BLAST_PROVENANCE_SOURCE,
    retrievedAt: input.retrievedAt ?? nowIso(),
    parameters: {
      rid: input.rid,
      database: input.database,
      program: "blastp",
      status: input.status,
      queryLength: input.queryLength ?? null,
      hitCount: input.hitCount ?? null,
      api: BLAST_PROVENANCE_SOURCE + "/Blast.cgi",
    },
    version: "NCBI BLAST Common URL API",
  });
}

export function normalizeBlastPayload(
  output: BlastRawPayload,
  options?: { retrievedAt?: string; provenance?: Provenance },
): BlastNormalizedSearch {
  const retrievedAt = options?.retrievedAt ?? nowIso();
  let hits: BlastHitNormalized[] = [];
  if (output.resultsText && output.status === "READY") {
    if (output.resultsFormat === "XML" || output.resultsText.includes("<Hit>")) {
      hits = normalizeXmlHits(output.resultsText);
    } else {
      hits = normalizeTextHits(output.resultsText);
    }
  }

  const provenance =
    options?.provenance ??
    buildBlastProvenance({
      rid: output.rid,
      database: output.database,
      status: output.status,
      retrievedAt,
      queryLength: output.queryLength,
      hitCount: hits.length,
    });

  return {
    rid: output.rid,
    database: output.database,
    program: "blastp",
    method: "ncbi-blast",
    methodLabel: `NCBI BLAST (blastp vs ${output.database})`,
    status: output.status,
    queryLength: output.queryLength,
    hitCount: hits.length,
    hits,
    provenance,
  };
}
