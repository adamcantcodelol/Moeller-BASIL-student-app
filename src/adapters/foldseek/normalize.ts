import type {
  FoldseekHitNormalized,
  FoldseekNormalizedSearch,
  FoldseekRawPayload,
} from "@/adapters/foldseek/types";
import type { Provenance } from "@/types/provenance";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizeHit(raw: unknown): FoldseekHitNormalized | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }
  const target = asString(record.target);
  if (!target) {
    return null;
  }
  return {
    target,
    seqId: asNumber(record.seqId),
    alnLength: asNumber(record.alnLength),
    eValue: asNumber(record.eval),
    score: asNumber(record.score),
    probability: asNumber(record.prob),
    qStart: asNumber(record.qStartPos),
    qEnd: asNumber(record.qEndPos),
    dbStart: asNumber(record.dbStartPos),
    dbEnd: asNumber(record.dbEndPos),
  };
}

export function buildFoldseekProvenance(input: {
  pdbId: string;
  ticketId: string;
  mode: string;
  database: string;
  retrievedAt: string;
}): Provenance {
  return {
    tool: "Foldseek Search Server",
    source: "https://search.foldseek.com/api",
    retrievedAt: input.retrievedAt,
    parameters: {
      pdbId: input.pdbId,
      ticketId: input.ticketId,
      mode: input.mode,
      database: input.database,
    },
    rawResultId: null,
    version: "search.foldseek.com/api",
  };
}

export function normalizeFoldseekPayload(
  payload: FoldseekRawPayload,
  options: { mode: string; database: string; retrievedAt: string },
): FoldseekNormalizedSearch {
  const hits: FoldseekHitNormalized[] = [];
  const result = payload.result;
  const results = Array.isArray(result?.results) ? result.results : [];
  for (const dbBlock of results) {
    const block = asRecord(dbBlock);
    const alignments = block?.alignments;
    if (!Array.isArray(alignments)) {
      continue;
    }
    for (const group of alignments) {
      const rows = Array.isArray(group) ? group : [group];
      for (const row of rows) {
        const hit = normalizeHit(row);
        if (hit) {
          hits.push(hit);
        }
      }
    }
  }

  return {
    pdbId: payload.pdbId,
    ticketId: payload.ticketId,
    mode: options.mode,
    database: options.database,
    hitCount: hits.length,
    hits: hits.slice(0, 50),
    provenance: buildFoldseekProvenance({
      pdbId: payload.pdbId,
      ticketId: payload.ticketId,
      mode: options.mode,
      database: options.database,
      retrievedAt: options.retrievedAt,
    }),
  };
}
