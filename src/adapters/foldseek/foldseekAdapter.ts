import type { ScientificAdapter } from "@/adapters/scientificAdapter";
import { DEFAULT_ADAPTER_TIMEOUT_MS } from "@/adapters/fetch";
import { normalizeFoldseekPayload } from "@/adapters/foldseek/normalize";
import type {
  FoldseekFetchInput,
  FoldseekNormalizedSearch,
  FoldseekRawPayload,
} from "@/adapters/foldseek/types";
import { FoldseekAdapterError } from "@/adapters/foldseek/types";
import { validatePdbId } from "@/lib/validation/pdbId";
import { nowIso } from "@/lib/ids";
import { buildProvenance } from "@/lib/provenance/buildProvenance";
import type { Provenance } from "@/types/provenance";

const TICKET_URL = "https://search.foldseek.com/api/ticket";
const ticketStatusUrl = (id: string) =>
  `https://search.foldseek.com/api/ticket/${id}`;
const resultUrl = (id: string) =>
  `https://search.foldseek.com/api/result/${id}/0`;
const rcsbPdbUrl = (pdbId: string) =>
  `https://files.rcsb.org/download/${pdbId}.pdb`;

const DEFAULT_MODE = "3diaa" as const;
const DEFAULT_DATABASE = "pdb100";

export interface FoldseekAdapterOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

async function readJson(
  response: Response,
  label: string,
): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new FoldseekAdapterError(
      "INVALID_RESPONSE",
      `Foldseek returned non-JSON for ${label}.`,
      error,
    );
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new FoldseekAdapterError(
      "INVALID_RESPONSE",
      `Foldseek returned an unexpected payload for ${label}.`,
    );
  }
  return body as Record<string, unknown>;
}

export class FoldseekSearchAdapter
  implements
    ScientificAdapter<
      FoldseekFetchInput,
      FoldseekRawPayload,
      FoldseekNormalizedSearch
    >
{
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private lastProvenance: Provenance | null = null;
  private lastMode: "3diaa" | "tmalign" = DEFAULT_MODE;
  private lastDatabase = DEFAULT_DATABASE;

  constructor(options: FoldseekAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_ADAPTER_TIMEOUT_MS;
  }

  private async downloadPdb(pdbId: string): Promise<string> {
    let response: Response;
    try {
      response = await this.fetchImpl(rcsbPdbUrl(pdbId), {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        throw new FoldseekAdapterError(
          "TIMEOUT",
          `Timed out downloading PDB ${pdbId} from RCSB for Foldseek.`,
          error,
        );
      }
      throw new FoldseekAdapterError(
        "NETWORK",
        `Could not download PDB ${pdbId} from RCSB for Foldseek.`,
        error,
      );
    }
    if (response.status === 404) {
      throw new FoldseekAdapterError(
        "NOT_FOUND",
        `PDB ${pdbId} was not found on RCSB files. No Foldseek hits were invented.`,
      );
    }
    if (!response.ok) {
      throw new FoldseekAdapterError(
        "NETWORK",
        `RCSB returned HTTP ${response.status} while downloading ${pdbId}.`,
      );
    }
    return response.text();
  }

  async run(input: FoldseekFetchInput): Promise<FoldseekRawPayload> {
    const validation = validatePdbId(input.pdbId);
    if (!validation.ok) {
      throw new FoldseekAdapterError("VALIDATION", validation.error);
    }
    const pdbId = validation.pdbId;
    const mode = input.mode ?? DEFAULT_MODE;
    const database = input.database ?? DEFAULT_DATABASE;
    this.lastMode = mode;
    this.lastDatabase = database;
    const retrievedAt = nowIso();

    const pdbText = input.pdbText ?? (await this.downloadPdb(pdbId));

    const form = new FormData();
    form.append(
      "q",
      new Blob([pdbText], { type: "application/octet-stream" }),
      `${pdbId}.pdb`,
    );
    form.append("mode", mode);
    form.append("database[]", database);

    let ticketResponse: Response;
    try {
      ticketResponse = await this.fetchImpl(TICKET_URL, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        throw new FoldseekAdapterError(
          "TIMEOUT",
          `Timed out submitting Foldseek search for ${pdbId}.`,
          error,
        );
      }
      throw new FoldseekAdapterError(
        "NETWORK",
        `Could not reach Foldseek for ${pdbId}. No hits were invented.`,
        error,
      );
    }

    if (!ticketResponse.ok) {
      throw new FoldseekAdapterError(
        "NETWORK",
        `Foldseek ticket submit returned HTTP ${ticketResponse.status}.`,
      );
    }

    const ticket = await readJson(ticketResponse, "ticket submit");
    const ticketId = typeof ticket.id === "string" ? ticket.id : null;
    const ticketStatus =
      typeof ticket.status === "string" ? ticket.status : "UNKNOWN";
    if (!ticketId) {
      throw new FoldseekAdapterError(
        "INVALID_RESPONSE",
        "Foldseek did not return a ticket id. No hits were invented.",
      );
    }

    this.lastProvenance = buildProvenance({
      tool: "Foldseek Search Server",
      source: "https://search.foldseek.com/api",
      retrievedAt,
      parameters: { pdbId, ticketId, mode, database, ticketStatus },
      version: "search.foldseek.com/api",
    });

    if (ticketStatus !== "COMPLETE") {
      return {
        ticketId,
        ticketStatus,
        result: null,
        pdbId,
      };
    }

    return this.fetchResultPayload(pdbId, ticketId, ticketStatus, retrievedAt, mode, database);
  }

  private async fetchResultPayload(
    pdbId: string,
    ticketId: string,
    ticketStatus: string,
    retrievedAt: string,
    mode: string,
    database: string,
  ): Promise<FoldseekRawPayload> {
    const resultResponse = await this.fetchImpl(resultUrl(ticketId), {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!resultResponse.ok) {
      throw new FoldseekAdapterError(
        "NETWORK",
        `Foldseek result fetch returned HTTP ${resultResponse.status}.`,
      );
    }
    const result = await readJson(resultResponse, "result");
    this.lastProvenance = buildProvenance({
      tool: "Foldseek Search Server",
      source: "https://search.foldseek.com/api",
      retrievedAt,
      parameters: { pdbId, ticketId, mode, database },
      version: "search.foldseek.com/api",
    });
    return { ticketId, ticketStatus, result, pdbId };
  }

  /** Poll an existing Foldseek ticket and fetch results when complete. */
  async pollTicket(
    pdbId: string,
    ticketId: string,
    options?: { mode?: string; database?: string },
  ): Promise<FoldseekRawPayload> {
    const mode = options?.mode ?? this.lastMode;
    const database = options?.database ?? this.lastDatabase;
    this.lastMode = mode === "tmalign" ? "tmalign" : "3diaa";
    this.lastDatabase = database;
    const retrievedAt = nowIso();

    const statusResponse = await this.fetchImpl(ticketStatusUrl(ticketId), {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!statusResponse.ok) {
      throw new FoldseekAdapterError(
        "NETWORK",
        `Foldseek ticket poll returned HTTP ${statusResponse.status}.`,
      );
    }
    const statusBody = await readJson(statusResponse, "ticket poll");
    const ticketStatus =
      typeof statusBody.status === "string" ? statusBody.status : "UNKNOWN";

    if (ticketStatus === "ERROR") {
      throw new FoldseekAdapterError(
        "INVALID_RESPONSE",
        `Foldseek reported ERROR for ticket ${ticketId}. No hits were invented.`,
      );
    }
    if (ticketStatus !== "COMPLETE") {
      throw new FoldseekAdapterError(
        "PENDING",
        `Foldseek job ${ticketId} is still ${ticketStatus}.`,
      );
    }

    const resultResponse = await this.fetchImpl(resultUrl(ticketId), {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!resultResponse.ok) {
      throw new FoldseekAdapterError(
        "NETWORK",
        `Foldseek result fetch returned HTTP ${resultResponse.status}.`,
      );
    }
    const result = await readJson(resultResponse, "result");
    this.lastProvenance = buildProvenance({
      tool: "Foldseek Search Server",
      source: "https://search.foldseek.com/api",
      retrievedAt,
      parameters: { pdbId, ticketId, mode, database },
      version: "search.foldseek.com/api",
    });
    return { ticketId, ticketStatus, result, pdbId };
  }

  normalize(output: FoldseekRawPayload): FoldseekNormalizedSearch {
    const retrievedAt = this.lastProvenance?.retrievedAt ?? nowIso();
    return normalizeFoldseekPayload(output, {
      mode: this.lastMode,
      database: this.lastDatabase,
      retrievedAt,
    });
  }

  getProvenance(): Provenance {
    if (!this.lastProvenance) {
      return buildProvenance({
        tool: "Foldseek Search Server",
        source: "https://search.foldseek.com/api",
        retrievedAt: "",
        parameters: {},
        version: "search.foldseek.com/api",
      });
    }
    return this.lastProvenance;
  }
}

export function createFoldseekSearchAdapter(
  options?: FoldseekAdapterOptions,
): FoldseekSearchAdapter {
  return new FoldseekSearchAdapter(options);
}

