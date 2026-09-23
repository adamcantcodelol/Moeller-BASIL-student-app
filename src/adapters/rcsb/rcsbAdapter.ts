import type { ScientificAdapter } from "@/adapters/scientificAdapter";
import { ScientificHttpError } from "@/adapters/errors";
import { fetchJsonObject, DEFAULT_ADAPTER_TIMEOUT_MS } from "@/adapters/fetch";
import { normalizeRcsbPayload } from "@/adapters/rcsb/normalize";
import type {
  RcsbFetchInput,
  RcsbNormalizedStructure,
  RcsbRawPayload,
} from "@/adapters/rcsb/types";
import { RcsbAdapterError } from "@/adapters/rcsb/types";
import { validatePdbId } from "@/lib/validation/pdbId";
import { nowIso } from "@/lib/ids";
import { buildProvenance } from "@/lib/provenance/buildProvenance";
import type { Provenance } from "@/types/provenance";

const ENTRY_URL = (pdbId: string) =>
  `https://data.rcsb.org/rest/v1/core/entry/${pdbId}`;
const POLYMER_ENTITY_URL = (pdbId: string, entityId: string) =>
  `https://data.rcsb.org/rest/v1/core/polymer_entity/${pdbId}/${entityId}`;

export interface RcsbAdapterOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function readPolymerEntityIds(entry: Record<string, unknown>): string[] {
  const identifiers = entry.rcsb_entry_container_identifiers;
  if (
    identifiers === null ||
    typeof identifiers !== "object" ||
    Array.isArray(identifiers)
  ) {
    return [];
  }
  const ids = (identifiers as Record<string, unknown>).polymer_entity_ids;
  if (!Array.isArray(ids)) {
    return [];
  }
  return ids.filter((id): id is string => typeof id === "string");
}

function mapHttpError(error: unknown, pdbId: string): never {
  if (error instanceof ScientificHttpError) {
    if (error.code === "TIMEOUT") {
      throw new RcsbAdapterError(
        "TIMEOUT",
        `Timed out contacting RCSB for ${pdbId}. Student work was not replaced with simulated data.`,
        error,
      );
    }
    if (error.code === "NOT_FOUND") {
      throw new RcsbAdapterError(
        "NOT_FOUND",
        `PDB ID ${pdbId} was not found in the RCSB archive. Confirm the identifier on rcsb.org. No metadata was invented.`,
        error,
      );
    }
    if (error.code === "INVALID_RESPONSE") {
      throw new RcsbAdapterError(
        "INVALID_RESPONSE",
        `RCSB returned an unexpected payload for ${pdbId}.`,
        error,
      );
    }
    const httpPart =
      error.httpStatus !== null
        ? `RCSB returned HTTP ${error.httpStatus} for ${pdbId}. No fabricated metadata was stored.`
        : `Could not reach RCSB for ${pdbId}. Check network access and retry. No fabricated metadata was stored.`;
    throw new RcsbAdapterError("NETWORK", httpPart, error);
  }
  throw error;
}

export class RcsbDataAdapter
  implements
    ScientificAdapter<RcsbFetchInput, RcsbRawPayload, RcsbNormalizedStructure>
{
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private lastProvenance: Provenance | null = null;

  constructor(options: RcsbAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_ADAPTER_TIMEOUT_MS;
  }

  async run(input: RcsbFetchInput): Promise<RcsbRawPayload> {
    const validation = validatePdbId(input.pdbId);
    if (!validation.ok) {
      throw new RcsbAdapterError("INVALID_RESPONSE", validation.error);
    }
    const pdbId = validation.pdbId;
    const retrievedAt = nowIso();

    let entry: Record<string, unknown>;
    try {
      entry = await fetchJsonObject(ENTRY_URL(pdbId), {
        fetchImpl: this.fetchImpl,
        timeoutMs: this.timeoutMs,
        label: `RCSB entry ${pdbId}`,
      });
    } catch (error) {
      mapHttpError(error, pdbId);
    }

    const entityIds = readPolymerEntityIds(entry);
    const polymerEntities: Record<string, unknown>[] = [];

    for (const entityId of entityIds) {
      try {
        polymerEntities.push(
          await fetchJsonObject(POLYMER_ENTITY_URL(pdbId, entityId), {
            fetchImpl: this.fetchImpl,
            timeoutMs: this.timeoutMs,
            label: `RCSB polymer entity ${pdbId}/${entityId}`,
          }),
        );
      } catch (error) {
        mapHttpError(error, pdbId);
      }
    }

    this.lastProvenance = buildProvenance({
      tool: "RCSB PDB Data API",
      source: "https://data.rcsb.org/",
      retrievedAt,
      parameters: {
        pdbId,
        entryEndpoint: ENTRY_URL(pdbId),
        polymerEntityIds: entityIds,
      },
      rawResultId: null,
      version: "rest/v1",
    });

    return { entry, polymerEntities };
  }

  normalize(output: RcsbRawPayload): RcsbNormalizedStructure {
    const entryId =
      typeof output.entry.rcsb_id === "string"
        ? output.entry.rcsb_id
        : typeof (output.entry.entry as { id?: string } | undefined)?.id ===
            "string"
          ? (output.entry.entry as { id: string }).id
          : null;
    if (!entryId) {
      throw new RcsbAdapterError(
        "INVALID_RESPONSE",
        "RCSB entry response did not include an entry identifier.",
      );
    }
    const retrievedAt = this.lastProvenance?.retrievedAt ?? nowIso();
    return normalizeRcsbPayload(entryId.toUpperCase(), output, retrievedAt);
  }

  getProvenance(): Provenance {
    if (!this.lastProvenance) {
      return buildProvenance({
        tool: "RCSB PDB Data API",
        source: "https://data.rcsb.org/",
        retrievedAt: "",
        parameters: {},
        rawResultId: null,
        version: "rest/v1",
      });
    }
    return this.lastProvenance;
  }
}

export function createRcsbDataAdapter(
  options?: RcsbAdapterOptions,
): RcsbDataAdapter {
  return new RcsbDataAdapter(options);
}
