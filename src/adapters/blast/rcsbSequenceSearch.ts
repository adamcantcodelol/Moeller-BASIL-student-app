import { DEFAULT_ADAPTER_TIMEOUT_MS } from "@/adapters/fetch";
import {
  BlastAdapterError,
  type BlastHitNormalized,
  type BlastNormalizedSearch,
} from "@/adapters/blast/types";
import { buildProvenance } from "@/lib/provenance/buildProvenance";
import { nowIso } from "@/lib/ids";

/**
 * RCSB PDB sequence similarity search (MMseqs2 against all PDB polymer
 * entities). A real, free, public API that answers in seconds, used as the
 * fast classroom default for the BLAST step. NCBI BLAST stays available in the
 * BLAST module. Results are labelled with the method so students never
 * confuse the two.
 *
 * Docs: https://search.rcsb.org/#sequence-search-service
 */
export const RCSB_SEARCH_URL = "https://search.rcsb.org/rcsbsearch/v2/query";
export const RCSB_GRAPHQL_URL = "https://data.rcsb.org/graphql";
export const RCSB_SEQUENCE_METHOD = "rcsb-mmseqs2" as const;
export const RCSB_SEQUENCE_DATABASE = "pdb (RCSB, 95% identity clusters)";
export const RCSB_SEQUENCE_METHOD_LABEL =
  "RCSB PDB sequence search (MMseqs2, BLAST-style)";
/** Same default E-value cutoff NCBI web blastp uses. */
export const RCSB_SEQUENCE_EVALUE_CUTOFF = 0.05;
export const RCSB_SEQUENCE_MAX_HITS = 50;
/** Group near-identical PDB entries so students see diverse homologs. */
export const RCSB_SEQUENCE_CLUSTER_IDENTITY = 95;

export interface RcsbSequenceSearchInput {
  sequence: string;
  queryTitle?: string;
}

export interface RcsbSequenceSearchRaw {
  method: typeof RCSB_SEQUENCE_METHOD;
  request: Record<string, unknown>;
  response: {
    query_id?: string;
    total_count?: number;
    group_by_count?: number;
    result_set: unknown[];
  };
  entityDetails: Record<
    string,
    { description: string | null; organism: string | null; entryTitle: string | null }
  >;
}

export interface RcsbSequenceSearchOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildRcsbSequenceQuery(sequence: string) {
  return {
    query: {
      type: "terminal",
      service: "sequence",
      parameters: {
        evalue_cutoff: RCSB_SEQUENCE_EVALUE_CUTOFF,
        identity_cutoff: 0,
        sequence_type: "protein",
        value: sequence,
      },
    },
    return_type: "polymer_entity",
    request_options: {
      paginate: { start: 0, rows: RCSB_SEQUENCE_MAX_HITS },
      results_content_type: ["experimental"],
      results_verbosity: "verbose",
      scoring_strategy: "sequence",
      group_by: {
        aggregation_method: "sequence_identity",
        similarity_cutoff: RCSB_SEQUENCE_CLUSTER_IDENTITY,
      },
      group_by_return_type: "representatives",
    },
  };
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  label: string,
): Promise<Response> {
  try {
    return await fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    throw new BlastAdapterError(
      timedOut ? "TIMEOUT" : "NETWORK",
      timedOut
        ? `Timed out contacting RCSB (${label}). No hits were invented.`
        : `Could not reach RCSB (${label}). No hits were invented.`,
      error,
    );
  }
}

/** Run the RCSB sequence search and fetch entity names for the hits. */
export async function runRcsbSequenceSearch(
  input: RcsbSequenceSearchInput,
  options: RcsbSequenceSearchOptions = {},
): Promise<RcsbSequenceSearchRaw> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_ADAPTER_TIMEOUT_MS;
  const sequence = input.sequence;
  if (sequence.length < 10) {
    throw new BlastAdapterError(
      "VALIDATION",
      "Sequence search needs a protein sequence of at least 10 amino acids. No hits were invented.",
    );
  }
  const request = buildRcsbSequenceQuery(sequence);
  const response = await fetchWithTimeout(
    fetchImpl,
    RCSB_SEARCH_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request),
    },
    timeoutMs,
    "sequence search",
  );

  // RCSB answers 204 No Content when nothing matches — a real empty result.
  let parsed: RcsbSequenceSearchRaw["response"] = { result_set: [] };
  if (response.status !== 204) {
    if (!response.ok) {
      throw new BlastAdapterError(
        "NETWORK",
        `RCSB sequence search returned HTTP ${response.status}. No hits were invented.`,
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new BlastAdapterError(
        "INVALID_RESPONSE",
        "RCSB sequence search returned non-JSON. No hits were invented.",
        error,
      );
    }
    const record = asRecord(body);
    if (!record || !Array.isArray(record.result_set)) {
      throw new BlastAdapterError(
        "INVALID_RESPONSE",
        "RCSB sequence search returned an unexpected payload. No hits were invented.",
      );
    }
    parsed = {
      query_id: typeof record.query_id === "string" ? record.query_id : undefined,
      total_count: num(record.total_count) ?? undefined,
      group_by_count: num(record.group_by_count) ?? undefined,
      result_set: record.result_set,
    };
  }

  const ids = parsed.result_set
    .map((row) => asRecord(row)?.identifier)
    .filter((id): id is string => typeof id === "string");

  const entityDetails: RcsbSequenceSearchRaw["entityDetails"] = {};
  if (ids.length > 0) {
    // Names are nice-to-have; a failure here keeps the real hits (no invented names).
    try {
      const gql = await fetchWithTimeout(
        fetchImpl,
        RCSB_GRAPHQL_URL,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            query:
              "query($ids:[String!]!){polymer_entities(entity_ids:$ids){rcsb_id rcsb_polymer_entity{pdbx_description} rcsb_entity_source_organism{scientific_name} entry{struct{title}}}}",
            variables: { ids },
          }),
        },
        timeoutMs,
        "entity names",
      );
      if (gql.ok) {
        const body = asRecord(await gql.json());
        const entities = asRecord(body?.data)?.polymer_entities;
        if (Array.isArray(entities)) {
          for (const entity of entities) {
            const e = asRecord(entity);
            const id = typeof e?.rcsb_id === "string" ? e.rcsb_id : null;
            if (!id) continue;
            const description = asRecord(e?.rcsb_polymer_entity)?.pdbx_description;
            const organisms = e?.rcsb_entity_source_organism;
            const organism = Array.isArray(organisms)
              ? asRecord(organisms[0])?.scientific_name
              : null;
            const title = asRecord(asRecord(e?.entry)?.struct)?.title;
            entityDetails[id] = {
              description: typeof description === "string" ? description : null,
              organism: typeof organism === "string" ? organism : null,
              entryTitle: typeof title === "string" ? title : null,
            };
          }
        }
      }
    } catch {
      // keep hits without names
    }
  }

  return { method: RCSB_SEQUENCE_METHOD, request, response: parsed, entityDetails };
}

function formatEvalue(value: number | null): string | null {
  if (value === null) return null;
  if (value === 0) return "0";
  return value < 0.001 ? value.toExponential(1) : String(Number(value.toPrecision(2)));
}

export function normalizeRcsbSequenceSearch(
  raw: RcsbSequenceSearchRaw,
  options: { queryLength: number; retrievedAt?: string; pdbId?: string | null },
): BlastNormalizedSearch {
  const retrievedAt = options.retrievedAt ?? nowIso();
  const hits: BlastHitNormalized[] = [];
  for (const row of raw.response.result_set) {
    const record = asRecord(row);
    const identifier = typeof record?.identifier === "string" ? record.identifier : null;
    if (!identifier) continue;
    const services = Array.isArray(record?.services) ? record.services : [];
    const node = asRecord(
      (asRecord(services[0])?.nodes as unknown[] | undefined)?.[0],
    );
    const match = asRecord((node?.match_context as unknown[] | undefined)?.[0]);
    const identity = num(match?.sequence_identity);
    const details = raw.entityDetails[identifier];
    const titleParts = [
      details?.description,
      details?.organism ? `[${details.organism}]` : null,
    ].filter(Boolean);
    hits.push({
      accession: identifier,
      hitId: identifier,
      title: titleParts.length > 0 ? titleParts.join(" ") : details?.entryTitle ?? null,
      evalue: formatEvalue(num(match?.evalue)),
      bitScore: num(match?.bitscore),
      identityPct: identity === null ? null : Math.round(identity * 1000) / 10,
      alignmentLength: num(match?.alignment_length),
      queryFrom: num(match?.query_beg),
      queryTo: num(match?.query_end),
      hitFrom: num(match?.subject_beg),
      hitTo: num(match?.subject_end),
    });
  }

  const provenance = buildProvenance({
    tool: RCSB_SEQUENCE_METHOD_LABEL,
    source: RCSB_SEARCH_URL,
    retrievedAt,
    parameters: {
      method: RCSB_SEQUENCE_METHOD,
      algorithm: "MMseqs2 (RCSB Search API sequence service)",
      database: RCSB_SEQUENCE_DATABASE,
      evalueCutoff: RCSB_SEQUENCE_EVALUE_CUTOFF,
      maxHits: RCSB_SEQUENCE_MAX_HITS,
      clusterIdentityPct: RCSB_SEQUENCE_CLUSTER_IDENTITY,
      queryLength: options.queryLength,
      pdbId: options.pdbId ?? null,
      queryId: raw.response.query_id ?? null,
      totalMatchingEntities: raw.response.total_count ?? 0,
      clusters: raw.response.group_by_count ?? hits.length,
      entityNames: RCSB_GRAPHQL_URL,
    },
    version: "RCSB Search API v2",
  });

  return {
    rid: raw.response.query_id ?? "rcsb",
    database: RCSB_SEQUENCE_DATABASE,
    program: "mmseqs2",
    method: RCSB_SEQUENCE_METHOD,
    methodLabel: RCSB_SEQUENCE_METHOD_LABEL,
    status: "READY",
    queryLength: options.queryLength,
    hitCount: hits.length,
    hits,
    provenance,
  };
}
