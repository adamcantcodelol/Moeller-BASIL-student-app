import type { Provenance } from "@/types/provenance";
import type {
  RcsbNormalizedStructure,
  RcsbPolymerEntityNormalized,
  RcsbRawPayload,
} from "@/adapters/rcsb/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function readOrganism(entity: Record<string, unknown>): string | null {
  const sources = entity.rcsb_entity_source_organism;
  if (!Array.isArray(sources) || sources.length === 0) {
    return null;
  }
  const names = new Set<string>();
  for (const source of sources) {
    const record = asRecord(source);
    if (!record) {
      continue;
    }
    const name =
      asString(record.scientific_name) ??
      asString(record.ncbi_scientific_name) ??
      asString(record.common_name);
    if (name) {
      names.add(name);
    }
  }
  if (names.size === 0) {
    return null;
  }
  return [...names].join("; ");
}

function normalizePolymerEntity(
  entity: Record<string, unknown>,
): RcsbPolymerEntityNormalized | null {
  const identifiers = asRecord(entity.rcsb_polymer_entity_container_identifiers);
  const entityPoly = asRecord(entity.entity_poly);
  const entityId =
    asString(identifiers?.entity_id) ??
    asString(entity.rcsb_id)?.split("_").at(-1) ??
    null;
  if (!entityId) {
    return null;
  }

  const chains = asStringArray(identifiers?.auth_asym_ids);
  const sequence =
    asString(entityPoly?.pdbx_seq_one_letter_code_can)?.replace(/\s+/g, "") ??
    asString(entityPoly?.pdbx_seq_one_letter_code)?.replace(/\s+/g, "") ??
    null;

  return {
    entityId,
    chains,
    sequence,
    organism: readOrganism(entity),
  };
}

export function buildRcsbProvenance(
  pdbId: string,
  retrievedAt: string,
): Provenance {
  return {
    tool: "RCSB PDB Data API",
    source: "https://data.rcsb.org/",
    retrievedAt,
    parameters: {
      pdbId,
      entryEndpoint: `https://data.rcsb.org/rest/v1/core/entry/${pdbId}`,
      polymerEntityEndpointTemplate:
        "https://data.rcsb.org/rest/v1/core/polymer_entity/{pdbId}/{entityId}",
    },
    rawResultId: null,
    version: "rest/v1",
  };
}

export function normalizeRcsbPayload(
  pdbId: string,
  payload: RcsbRawPayload,
  retrievedAt: string,
): RcsbNormalizedStructure {
  const entry = payload.entry;
  const struct = asRecord(entry.struct);
  const entryInfo = asRecord(entry.rcsb_entry_info);
  const exptl = Array.isArray(entry.exptl) ? entry.exptl : [];
  const firstExptl = asRecord(exptl[0]);

  const polymerEntities = payload.polymerEntities
    .map((entity) => normalizePolymerEntity(entity))
    .filter((entity): entity is RcsbPolymerEntityNormalized => entity !== null);

  const chains = [
    ...new Set(polymerEntities.flatMap((entity) => entity.chains)),
  ];
  const organisms = [
    ...new Set(
      polymerEntities
        .map((entity) => entity.organism)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const resolutionRaw = entryInfo?.resolution_combined;
  let resolutionAngstrom: number | null = null;
  if (Array.isArray(resolutionRaw) && typeof resolutionRaw[0] === "number") {
    resolutionAngstrom = resolutionRaw[0];
  }

  return {
    pdbId,
    title: asString(struct?.title),
    organism: organisms.length > 0 ? organisms.join("; ") : null,
    chains,
    sequence: polymerEntities[0]?.sequence ?? null,
    experimentalMethod:
      asString(firstExptl?.method) ??
      asString(entryInfo?.experimental_method),
    resolutionAngstrom,
    polymerEntities,
    structureCifUrl: `https://files.rcsb.org/download/${pdbId}.cif`,
    structurePdbUrl: `https://files.rcsb.org/download/${pdbId}.pdb`,
    entryPageUrl: `https://www.rcsb.org/structure/${pdbId}`,
    provenance: buildRcsbProvenance(pdbId, retrievedAt),
  };
}
