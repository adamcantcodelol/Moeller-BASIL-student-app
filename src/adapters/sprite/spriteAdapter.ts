import type { ScientificAdapter } from "@/adapters/scientificAdapter";
import { DEFAULT_ADAPTER_TIMEOUT_MS } from "@/adapters/fetch";
import { normalizeSpritePayload } from "@/adapters/sprite/normalize";
import {
  DEFAULT_SPRITE_DATABASE,
  isSpriteDatabase,
  SPRITE_API_BASE,
  SPRITE_PROVENANCE_SOURCE,
  SpriteAdapterError,
  type SpriteDatabase,
  type SpriteFetchInput,
  type SpriteNormalizedSearch,
  type SpriteRawPayload,
} from "@/adapters/sprite/types";
import { validatePdbId } from "@/lib/validation/pdbId";
import { nowIso } from "@/lib/ids";
import { buildProvenance } from "@/lib/provenance/buildProvenance";
import type { Provenance } from "@/types/provenance";

const uploadUrl = `${SPRITE_API_BASE}/upload`;
const sessionUrl = (sessionId: string) =>
  `${SPRITE_API_BASE}/session_data/${encodeURIComponent(sessionId)}`;
const resultsUrl = (sessionId: string, strucId: string) =>
  `${SPRITE_API_BASE}/results/${encodeURIComponent(sessionId)}/${encodeURIComponent(strucId)}?limit=50&orientation=right_superposition`;

export interface SpriteAdapterOptions {
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
    throw new SpriteAdapterError(
      "INVALID_RESPONSE",
      `SPRITE returned non-JSON for ${label}.`,
      error,
    );
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new SpriteAdapterError(
      "INVALID_RESPONSE",
      `SPRITE returned an unexpected payload for ${label}.`,
    );
  }
  return body as Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function resolveDatabase(raw: string | undefined): SpriteDatabase {
  const database = (raw ?? DEFAULT_SPRITE_DATABASE).trim();
  if (!isSpriteDatabase(database)) {
    throw new SpriteAdapterError(
      "VALIDATION",
      `Unsupported SPRITE database "${database}". Allowed: csa3, all3, m-csa3, csa32, m-csa32.`,
    );
  }
  return database;
}

export class SpriteSearchAdapter
  implements
    ScientificAdapter<SpriteFetchInput, SpriteRawPayload, SpriteNormalizedSearch>
{
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private lastProvenance: Provenance | null = null;
  private lastDatabase = DEFAULT_SPRITE_DATABASE;

  constructor(options: SpriteAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_ADAPTER_TIMEOUT_MS;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit | undefined,
    label: string,
  ): Promise<Response> {
    try {
      return await this.fetchImpl(url, {
        ...init,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        throw new SpriteAdapterError(
          "TIMEOUT",
          `Timed out contacting SPRITE (${label}). No hits were invented.`,
          error,
        );
      }
      throw new SpriteAdapterError(
        "NETWORK",
        `Could not reach SPRITE (${label}). No hits were invented.`,
        error,
      );
    }
  }

  async run(input: SpriteFetchInput): Promise<SpriteRawPayload> {
    const validation = validatePdbId(input.pdbId);
    if (!validation.ok) {
      throw new SpriteAdapterError("VALIDATION", validation.error);
    }
    const pdbId = validation.pdbId;
    const database = resolveDatabase(input.database);
    this.lastDatabase = database;
    const retrievedAt = nowIso();

    const form = new FormData();
    form.append("sprite_db", database);
    form.append("query_pdbid", pdbId);

    const uploadResponse = await this.fetchWithTimeout(
      uploadUrl,
      { method: "POST", body: form },
      "upload",
    );

    if (!uploadResponse.ok) {
      throw new SpriteAdapterError(
        "NETWORK",
        `SPRITE upload returned HTTP ${uploadResponse.status}. No hits were invented.`,
      );
    }

    const upload = await readJson(uploadResponse, "upload");
    if (upload.ok !== true) {
      throw new SpriteAdapterError(
        "INVALID_RESPONSE",
        "SPRITE upload did not return ok:true. No hits were invented.",
      );
    }

    const sessionId =
      typeof upload.session_id === "string" ? upload.session_id : null;
    const structures = Array.isArray(upload.structures)
      ? upload.structures
      : [];
    const first = asRecord(structures[0]);
    const strucId =
      first && typeof first.struc_id === "string"
        ? first.struc_id
        : first && typeof first.struc_id === "number"
          ? String(first.struc_id)
          : null;

    if (!sessionId || !strucId) {
      throw new SpriteAdapterError(
        "INVALID_RESPONSE",
        "SPRITE upload did not return session_id/struc_id. No hits were invented.",
      );
    }

    this.lastProvenance = buildProvenance({
      tool: "GrAfSS SPRITE",
      source: SPRITE_PROVENANCE_SOURCE,
      retrievedAt,
      parameters: {
        pdbId,
        sessionId,
        strucId,
        database,
        mongoId: upload.mongo_id ?? null,
        api: "grafss.ukm.my/api/sprite",
      },
      version: "grafss.ukm.my/api/sprite",
    });

    // One immediate status check — many jobs finish in seconds.
    return this.pollSession(pdbId, sessionId, strucId, database, {
      allowPending: true,
      retrievedAt,
    });
  }

  async pollSession(
    pdbId: string,
    sessionId: string,
    strucId: string,
    database?: string,
    options?: { allowPending?: boolean; retrievedAt?: string },
  ): Promise<SpriteRawPayload> {
    const db = resolveDatabase(database ?? this.lastDatabase);
    this.lastDatabase = db;
    const retrievedAt = options?.retrievedAt ?? nowIso();
    const allowPending = options?.allowPending ?? false;

    const statusResponse = await this.fetchWithTimeout(
      sessionUrl(sessionId),
      undefined,
      "session poll",
    );
    if (statusResponse.status === 404) {
      throw new SpriteAdapterError(
        "NOT_FOUND",
        `SPRITE session ${sessionId} was not found. No hits were invented.`,
      );
    }
    if (!statusResponse.ok) {
      throw new SpriteAdapterError(
        "NETWORK",
        `SPRITE session poll returned HTTP ${statusResponse.status}.`,
      );
    }

    const session = await readJson(statusResponse, "session poll");
    const structures = Array.isArray(session.structures)
      ? session.structures
      : [];
    const structure =
      structures.find((item) => {
        const record = asRecord(item);
        if (!record) return false;
        const id =
          typeof record.struc_id === "string"
            ? record.struc_id
            : typeof record.struc_id === "number"
              ? String(record.struc_id)
              : null;
        return id === strucId;
      }) ?? structures[0];
    const structureRecord = asRecord(structure);
    const celery = asRecord(structureRecord?.celery);
    const celeryState =
      typeof celery?.state === "string" ? celery.state : null;

    if (celeryState === "FAILURE" || celeryState === "REVOKED") {
      throw new SpriteAdapterError(
        "FAILED",
        `SPRITE reported ${celeryState} for session ${sessionId}. No hits were invented.`,
      );
    }

    if (celeryState !== "COMPLETED") {
      if (allowPending) {
        this.lastProvenance = buildProvenance({
          tool: "GrAfSS SPRITE",
          source: SPRITE_PROVENANCE_SOURCE,
          retrievedAt,
          parameters: {
            pdbId,
            sessionId,
            strucId,
            database: db,
            celeryState,
            api: "grafss.ukm.my/api/sprite",
          },
          version: "grafss.ukm.my/api/sprite",
        });
        return {
          sessionId,
          strucId,
          pdbId,
          database: db,
          celeryState,
          results: null,
          sessionSnapshot: session,
        };
      }
      throw new SpriteAdapterError(
        "PENDING",
        `SPRITE job ${sessionId} is still ${celeryState ?? "PENDING"}.`,
      );
    }

    const resultsResponse = await this.fetchWithTimeout(
      resultsUrl(sessionId, strucId),
      undefined,
      "results",
    );
    if (!resultsResponse.ok) {
      throw new SpriteAdapterError(
        "NETWORK",
        `SPRITE results fetch returned HTTP ${resultsResponse.status}.`,
      );
    }
    const results = await readJson(resultsResponse, "results");

    this.lastProvenance = buildProvenance({
      tool: "GrAfSS SPRITE",
      source: SPRITE_PROVENANCE_SOURCE,
      retrievedAt,
      parameters: {
        pdbId,
        sessionId,
        strucId,
        database: db,
        celeryState: "COMPLETED",
        totalResults: results.total_results ?? null,
        api: "grafss.ukm.my/api/sprite",
      },
      version: "grafss.ukm.my/api/sprite",
    });

    return {
      sessionId,
      strucId,
      pdbId,
      database: db,
      celeryState: "COMPLETED",
      results,
      sessionSnapshot: session,
    };
  }

  normalize(output: SpriteRawPayload): SpriteNormalizedSearch {
    const retrievedAt = this.lastProvenance?.retrievedAt ?? nowIso();
    return normalizeSpritePayload(output, { retrievedAt });
  }

  getProvenance(): Provenance {
    if (!this.lastProvenance) {
      return buildProvenance({
        tool: "GrAfSS SPRITE",
        source: SPRITE_PROVENANCE_SOURCE,
        retrievedAt: "",
        parameters: {},
        version: "grafss.ukm.my/api/sprite",
      });
    }
    return this.lastProvenance;
  }
}

export function createSpriteSearchAdapter(
  options?: SpriteAdapterOptions,
): SpriteSearchAdapter {
  return new SpriteSearchAdapter(options);
}
