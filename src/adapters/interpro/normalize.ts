import type { Provenance } from "@/types/provenance";
import type {
  InterProEntryNormalized,
  InterProGoTermNormalized,
  InterProLocationNormalized,
  InterProMemberDbNormalized,
  InterProNormalizedAnnotation,
  InterProRawPayload,
} from "@/adapters/interpro/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readGoTerms(value: unknown): InterProGoTermNormalized[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const terms: InterProGoTermNormalized[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }
    const id = asString(record.identifier);
    const name = asString(record.name);
    if (!id || !name) {
      continue;
    }
    const categoryRecord = asRecord(record.category);
    terms.push({
      id,
      name,
      category: asString(categoryRecord?.name) ?? asString(categoryRecord?.code),
    });
  }
  return terms;
}

function readLocations(proteins: unknown): InterProLocationNormalized[] {
  if (!Array.isArray(proteins) || proteins.length === 0) {
    return [];
  }
  const protein = asRecord(proteins[0]);
  const locationsRaw = protein?.entry_protein_locations;
  if (!Array.isArray(locationsRaw)) {
    return [];
  }
  const locations: InterProLocationNormalized[] = [];
  for (const loc of locationsRaw) {
    const locRecord = asRecord(loc);
    const fragments = locRecord?.fragments;
    if (!Array.isArray(fragments)) {
      continue;
    }
    for (const fragment of fragments) {
      const frag = asRecord(fragment);
      const start = asNumber(frag?.start);
      const end = asNumber(frag?.end);
      if (start !== null && end !== null) {
        locations.push({ start, end });
      }
    }
  }
  return locations;
}

function readMemberDatabases(value: unknown): InterProMemberDbNormalized[] {
  const record = asRecord(value);
  if (!record) {
    return [];
  }
  const members: InterProMemberDbNormalized[] = [];
  for (const [database, entries] of Object.entries(record)) {
    const entryMap = asRecord(entries);
    if (!entryMap) {
      continue;
    }
    for (const [accession, name] of Object.entries(entryMap)) {
      members.push({
        database,
        accession,
        name: asString(name) ?? accession,
      });
    }
  }
  return members;
}

function normalizeEntry(item: unknown): InterProEntryNormalized | null {
  const record = asRecord(item);
  const metadata = asRecord(record?.metadata);
  if (!metadata) {
    return null;
  }
  const accession = asString(metadata.accession);
  const name = asString(metadata.name);
  const type = asString(metadata.type);
  if (!accession || !name || !type) {
    return null;
  }
  return {
    accession: accession.toUpperCase(),
    name,
    type,
    goTerms: readGoTerms(metadata.go_terms),
    locations: readLocations(record?.proteins),
    memberDatabases: readMemberDatabases(metadata.member_databases),
  };
}

export function buildInterProProvenance(
  uniprotAccession: string,
  retrievedAt: string,
): Provenance {
  return {
    tool: "InterPro REST API",
    source: "https://www.ebi.ac.uk/interpro/api/",
    retrievedAt,
    parameters: {
      uniprotAccession,
      proteinEndpoint: `https://www.ebi.ac.uk/interpro/api/protein/uniprot/${uniprotAccession}`,
      entriesEndpoint: `https://www.ebi.ac.uk/interpro/api/entry/interpro/protein/uniprot/${uniprotAccession}`,
    },
    rawResultId: null,
    version: "interpro-api",
  };
}

export function normalizeInterProPayload(
  uniprotAccession: string,
  payload: InterProRawPayload,
  retrievedAt: string,
): InterProNormalizedAnnotation {
  const proteinMeta = asRecord(payload.protein.metadata);
  const organismRecord = asRecord(proteinMeta?.source_organism);
  const results = Array.isArray(payload.entries.results)
    ? payload.entries.results
    : [];

  const entries = results
    .map((item) => normalizeEntry(item))
    .filter((entry): entry is InterProEntryNormalized => entry !== null);

  const countFromApi = asNumber(payload.entries.count);
  const entryCount = countFromApi ?? entries.length;

  return {
    uniprotAccession,
    proteinName: asString(proteinMeta?.name),
    proteinId: asString(proteinMeta?.id),
    organism:
      asString(organismRecord?.scientificName) ??
      asString(organismRecord?.fullName),
    length: asNumber(proteinMeta?.length),
    entryCount,
    entries,
    proteinPageUrl: `https://www.ebi.ac.uk/interpro/protein/UniProt/${uniprotAccession}/`,
    provenance: buildInterProProvenance(uniprotAccession, retrievedAt),
  };
}
