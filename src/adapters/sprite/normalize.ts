import type {
  SpriteHitNormalized,
  SpriteNormalizedSearch,
  SpriteRawPayload,
  SpriteResidueNormalized,
} from "@/adapters/sprite/types";
import { SPRITE_PROVENANCE_SOURCE } from "@/adapters/sprite/types";
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

function normalizeResidue(raw: unknown): SpriteResidueNormalized | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }
  return {
    chain: asString(record.chain),
    resNo:
      asString(record.res_no) ??
      (typeof record.res_no === "number" ? String(record.res_no) : null),
    resType: asString(record.res_type),
  };
}

function normalizeResidues(raw: unknown): SpriteResidueNormalized[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: SpriteResidueNormalized[] = [];
  for (const item of raw) {
    const residue = normalizeResidue(item);
    if (residue) {
      out.push(residue);
    }
  }
  return out;
}

function normalizeHit(raw: unknown): SpriteHitNormalized | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }
  const pdbId = asString(record.pdb_id);
  if (!pdbId) {
    return null;
  }
  const transformRaw = record.transform;
  const transform =
    Array.isArray(transformRaw) &&
    transformRaw.every((n) => typeof n === "number" && Number.isFinite(n))
      ? (transformRaw as number[])
      : null;
  return {
    pdbId,
    patternId: asString(record.pattern_id),
    size: asNumber(record.size),
    description: asString(record.description),
    rmsd: asNumber(record.rmsd),
    transform,
    patResidues: normalizeResidues(record.pat_residues),
    matchResidues: normalizeResidues(record.match_residues),
  };
}

export function buildSpriteProvenance(input: {
  pdbId: string;
  sessionId: string;
  strucId: string;
  database: string;
  retrievedAt: string;
}): Provenance {
  return {
    tool: "GrAfSS SPRITE",
    source: SPRITE_PROVENANCE_SOURCE,
    retrievedAt: input.retrievedAt,
    parameters: {
      pdbId: input.pdbId,
      sessionId: input.sessionId,
      strucId: input.strucId,
      database: input.database,
      api: "grafss.ukm.my/api/sprite",
    },
    rawResultId: null,
    version: "grafss.ukm.my/api/sprite",
  };
}

export function normalizeSpritePayload(
  payload: SpriteRawPayload,
  options: { retrievedAt: string },
): SpriteNormalizedSearch {
  const hits: SpriteHitNormalized[] = [];
  const results = payload.results;
  const matches = Array.isArray(results?.matches) ? results.matches : [];
  for (const row of matches) {
    const hit = normalizeHit(row);
    if (hit) {
      hits.push(hit);
    }
  }

  const totalResults = asNumber(results?.total_results);

  return {
    pdbId: payload.pdbId,
    sessionId: payload.sessionId,
    strucId: payload.strucId,
    database: payload.database,
    celeryState: payload.celeryState ?? "UNKNOWN",
    totalResults,
    hitCount: hits.length,
    hits: hits.slice(0, 50),
    provenance: buildSpriteProvenance({
      pdbId: payload.pdbId,
      sessionId: payload.sessionId,
      strucId: payload.strucId,
      database: payload.database,
      retrievedAt: options.retrievedAt,
    }),
  };
}
