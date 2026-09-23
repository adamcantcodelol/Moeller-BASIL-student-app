import type { ScientificAdapter } from "@/adapters/scientificAdapter";
import { ScientificHttpError } from "@/adapters/errors";
import { fetchJsonObject, DEFAULT_ADAPTER_TIMEOUT_MS } from "@/adapters/fetch";
import { normalizeInterProPayload } from "@/adapters/interpro/normalize";
import type {
  InterProFetchInput,
  InterProNormalizedAnnotation,
  InterProRawPayload,
} from "@/adapters/interpro/types";
import { InterProAdapterError } from "@/adapters/interpro/types";
import { validateUniProtAccession } from "@/lib/validation/uniprotAccession";
import { nowIso } from "@/lib/ids";
import { buildProvenance } from "@/lib/provenance/buildProvenance";
import type { Provenance } from "@/types/provenance";

const PROTEIN_URL = (accession: string) =>
  `https://www.ebi.ac.uk/interpro/api/protein/uniprot/${accession}`;
const ENTRIES_URL = (accession: string) =>
  `https://www.ebi.ac.uk/interpro/api/entry/interpro/protein/uniprot/${accession}?page_size=100`;

export interface InterProAdapterOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function mapHttpError(error: unknown, accession: string): never {
  if (error instanceof ScientificHttpError) {
    if (error.code === "TIMEOUT") {
      throw new InterProAdapterError(
        "TIMEOUT",
        `Timed out contacting InterPro for ${accession}. Student work was not replaced with simulated annotations.`,
        error,
      );
    }
    if (error.code === "NOT_FOUND") {
      throw new InterProAdapterError(
        "NOT_FOUND",
        `UniProt accession ${accession} was not found in InterPro / UniProt. Confirm the accession on uniprot.org or interpro.ebi.ac.uk. No annotations were invented.`,
        error,
      );
    }
    if (error.code === "INVALID_RESPONSE") {
      throw new InterProAdapterError(
        "INVALID_RESPONSE",
        `InterPro returned an unexpected payload for ${accession}.`,
        error,
      );
    }
    const httpPart =
      error.httpStatus !== null
        ? `InterPro returned HTTP ${error.httpStatus} for ${accession}. No fabricated annotations were stored.`
        : `Could not reach InterPro for ${accession}. Check network access and retry. No fabricated annotations were stored.`;
    throw new InterProAdapterError("NETWORK", httpPart, error);
  }
  throw error;
}

export class InterProDataAdapter
  implements
    ScientificAdapter<
      InterProFetchInput,
      InterProRawPayload,
      InterProNormalizedAnnotation
    >
{
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private lastProvenance: Provenance | null = null;

  constructor(options: InterProAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_ADAPTER_TIMEOUT_MS;
  }

  async run(input: InterProFetchInput): Promise<InterProRawPayload> {
    const validation = validateUniProtAccession(input.uniprotAccession);
    if (!validation.ok) {
      throw new InterProAdapterError("VALIDATION", validation.error);
    }
    const accession = validation.accession;
    const retrievedAt = nowIso();

    let protein: Record<string, unknown>;
    try {
      protein = await fetchJsonObject(PROTEIN_URL(accession), {
        fetchImpl: this.fetchImpl,
        timeoutMs: this.timeoutMs,
        label: `InterPro protein ${accession}`,
      });
    } catch (error) {
      mapHttpError(error, accession);
    }

    let entries: Record<string, unknown>;
    try {
      entries = await fetchJsonObject(ENTRIES_URL(accession), {
        fetchImpl: this.fetchImpl,
        timeoutMs: this.timeoutMs,
        label: `InterPro entries ${accession}`,
      });
    } catch (error) {
      mapHttpError(error, accession);
    }

    this.lastProvenance = buildProvenance({
      tool: "InterPro REST API",
      source: "https://www.ebi.ac.uk/interpro/api/",
      retrievedAt,
      parameters: {
        uniprotAccession: accession,
        proteinEndpoint: PROTEIN_URL(accession),
        entriesEndpoint: ENTRIES_URL(accession),
      },
      rawResultId: null,
      version: "interpro-api",
    });

    return { protein, entries };
  }

  normalize(output: InterProRawPayload): InterProNormalizedAnnotation {
    const proteinMeta =
      output.protein.metadata !== null &&
      typeof output.protein.metadata === "object" &&
      !Array.isArray(output.protein.metadata)
        ? (output.protein.metadata as Record<string, unknown>)
        : null;
    const accessionRaw =
      typeof proteinMeta?.accession === "string"
        ? proteinMeta.accession.toUpperCase()
        : null;
    if (!accessionRaw) {
      throw new InterProAdapterError(
        "INVALID_RESPONSE",
        "InterPro protein response did not include an accession.",
      );
    }
    const retrievedAt = this.lastProvenance?.retrievedAt ?? nowIso();
    return normalizeInterProPayload(accessionRaw, output, retrievedAt);
  }

  getProvenance(): Provenance {
    if (!this.lastProvenance) {
      return buildProvenance({
        tool: "InterPro REST API",
        source: "https://www.ebi.ac.uk/interpro/api/",
        retrievedAt: "",
        parameters: {},
        rawResultId: null,
        version: "interpro-api",
      });
    }
    return this.lastProvenance;
  }
}

export function createInterProDataAdapter(
  options?: InterProAdapterOptions,
): InterProDataAdapter {
  return new InterProDataAdapter(options);
}
