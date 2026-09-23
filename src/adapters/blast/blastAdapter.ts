import type { ScientificAdapter } from "@/adapters/scientificAdapter";
import { DEFAULT_ADAPTER_TIMEOUT_MS } from "@/adapters/fetch";
import { normalizeBlastPayload } from "@/adapters/blast/normalize";
import {
  BLAST_API_URL,
  BLAST_CONTACT_EMAIL,
  BLAST_HITLIST_SIZE,
  BLAST_PROVENANCE_SOURCE,
  BLAST_TOOL_NAME,
  DEFAULT_BLAST_DATABASE,
  BlastAdapterError,
  isBlastDatabase,
  type BlastDatabase,
  type BlastFetchInput,
  type BlastNormalizedSearch,
  type BlastRawPayload,
} from "@/adapters/blast/types";
import { nowIso } from "@/lib/ids";
import { buildProvenance } from "@/lib/provenance/buildProvenance";
import type { Provenance } from "@/types/provenance";

export interface BlastAdapterOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function resolveDatabase(raw: string | undefined): BlastDatabase {
  const database = (raw ?? DEFAULT_BLAST_DATABASE).trim();
  if (!isBlastDatabase(database)) {
    throw new BlastAdapterError(
      "VALIDATION",
      `Unsupported BLAST database "${database}". Allowed: swissprot, pdbaa, refseq_protein, nr.`,
    );
  }
  return database;
}

/** Strip FASTA headers and whitespace; keep AA letters only. */
export function sanitizeProteinSequence(raw: string): string {
  const withoutHeaders = raw
    .split("\n")
    .filter((line) => !line.trim().startsWith(">"))
    .join("");
  return withoutHeaders.replace(/[^A-Za-z]/g, "").toUpperCase();
}

function parseQBlastInfo(text: string): {
  rid: string | null;
  rtoe: number | null;
  status: string | null;
  thereAreHits: boolean | null;
} {
  const blockMatch = text.match(
    /QBlastInfoBegin([\s\S]*?)QBlastInfoEnd/i,
  );
  const block = blockMatch?.[1] ?? text;
  const ridMatch = block.match(/\bRID\s*=\s*([A-Za-z0-9_-]+)/i);
  const rtoeMatch = block.match(/\bRTOE\s*=\s*(\d+)/i);
  const statusMatch = block.match(/\bStatus\s*=\s*([A-Za-z]+)/i);
  const hitsMatch = block.match(/\bThereAreHits\s*=\s*(yes|no)/i);
  return {
    rid: ridMatch?.[1] ?? null,
    rtoe: rtoeMatch ? Number(rtoeMatch[1]) : null,
    status: statusMatch?.[1]?.toUpperCase() ?? null,
    thereAreHits:
      hitsMatch?.[1] !== undefined
        ? hitsMatch[1].toLowerCase() === "yes"
        : null,
  };
}

export class BlastSearchAdapter
  implements
    ScientificAdapter<BlastFetchInput, BlastRawPayload, BlastNormalizedSearch>
{
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private lastProvenance: Provenance | null = null;
  private lastDatabase: BlastDatabase = DEFAULT_BLAST_DATABASE;

  constructor(options: BlastAdapterOptions = {}) {
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
        throw new BlastAdapterError(
          "TIMEOUT",
          `Timed out contacting NCBI BLAST (${label}). No hits were invented.`,
          error,
        );
      }
      throw new BlastAdapterError(
        "NETWORK",
        `Could not reach NCBI BLAST (${label}). No hits were invented.`,
        error,
      );
    }
  }

  private setProvenance(params: Record<string, unknown>, retrievedAt: string) {
    this.lastProvenance = buildProvenance({
      tool: "NCBI BLAST",
      source: BLAST_PROVENANCE_SOURCE,
      retrievedAt,
      parameters: params,
      version: "NCBI BLAST Common URL API",
    });
  }

  async run(input: BlastFetchInput): Promise<BlastRawPayload> {
    const sequence = sanitizeProteinSequence(input.sequence ?? "");
    if (sequence.length < 10) {
      throw new BlastAdapterError(
        "VALIDATION",
        "BLAST needs a protein sequence of at least 10 amino acids from Protein / PDB Setup (or paste). No hits were invented.",
      );
    }
    if (sequence.length > 10_000) {
      throw new BlastAdapterError(
        "VALIDATION",
        "Sequence is too long for classroom BLAST (>10000 aa). No hits were invented.",
      );
    }
    const database = resolveDatabase(input.database);
    this.lastDatabase = database;
    const retrievedAt = nowIso();

    const title = (input.queryTitle ?? "moeller-basil").replace(/[^\w.-]+/g, "_");
    const fasta = `>${title}\n${sequence}`;
    const body = new URLSearchParams({
      CMD: "Put",
      PROGRAM: "blastp",
      DATABASE: database,
      QUERY: fasta,
      TOOL: BLAST_TOOL_NAME,
      EMAIL: BLAST_CONTACT_EMAIL,
      HITLIST_SIZE: String(BLAST_HITLIST_SIZE),
    });

    const response = await this.fetchWithTimeout(
      BLAST_API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "text/html, text/plain, */*",
        },
        body: body.toString(),
      },
      "Put",
    );

    if (!response.ok) {
      throw new BlastAdapterError(
        "NETWORK",
        `NCBI BLAST Put returned HTTP ${response.status}. No hits were invented.`,
      );
    }

    const text = await response.text();
    const info = parseQBlastInfo(text);
    if (!info.rid) {
      throw new BlastAdapterError(
        "INVALID_RESPONSE",
        "NCBI BLAST Put did not return an RID. No hits were invented.",
      );
    }

    this.setProvenance(
      {
        rid: info.rid,
        rtoe: info.rtoe,
        database,
        program: "blastp",
        queryLength: sequence.length,
        tool: BLAST_TOOL_NAME,
        email: BLAST_CONTACT_EMAIL,
        api: BLAST_API_URL,
      },
      retrievedAt,
    );

    // One immediate SearchInfo check — occasionally jobs finish quickly.
    return this.pollRid(info.rid, database, {
      allowPending: true,
      retrievedAt,
      rtoe: info.rtoe,
      queryLength: sequence.length,
    });
  }

  async pollRid(
    rid: string,
    database?: string,
    options?: {
      allowPending?: boolean;
      retrievedAt?: string;
      rtoe?: number | null;
      queryLength?: number | null;
    },
  ): Promise<BlastRawPayload> {
    const db = resolveDatabase(database ?? this.lastDatabase);
    this.lastDatabase = db;
    const retrievedAt = options?.retrievedAt ?? nowIso();
    const allowPending = options?.allowPending ?? false;
    const cleanRid = rid.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(cleanRid)) {
      throw new BlastAdapterError("VALIDATION", "Invalid BLAST RID.");
    }

    const infoUrl = `${BLAST_API_URL}?CMD=Get&FORMAT_OBJECT=SearchInfo&RID=${encodeURIComponent(cleanRid)}`;
    const infoResponse = await this.fetchWithTimeout(
      infoUrl,
      { headers: { Accept: "text/plain, text/html, */*" } },
      "SearchInfo",
    );
    if (!infoResponse.ok) {
      throw new BlastAdapterError(
        "NETWORK",
        `NCBI BLAST SearchInfo returned HTTP ${infoResponse.status}.`,
      );
    }
    const infoText = await infoResponse.text();
    const info = parseQBlastInfo(infoText);
    const status = (info.status ?? "UNKNOWN").toUpperCase();

    if (status === "FAILED" || status === "UNKNOWN") {
      // UNKNOWN can mean expired RID
      throw new BlastAdapterError(
        status === "FAILED" ? "FAILED" : "NOT_FOUND",
        `NCBI BLAST reported Status=${status} for RID ${cleanRid}. No hits were invented.`,
      );
    }

    if (status !== "READY") {
      this.setProvenance(
        {
          rid: cleanRid,
          database: db,
          status,
          rtoe: options?.rtoe ?? info.rtoe,
          queryLength: options?.queryLength ?? null,
          api: BLAST_API_URL,
        },
        retrievedAt,
      );
      if (allowPending) {
        return {
          rid: cleanRid,
          rtoe: options?.rtoe ?? info.rtoe,
          database: db,
          program: "blastp",
          status,
          resultsText: null,
          resultsFormat: null,
          queryLength: options?.queryLength ?? null,
          thereAreHits: info.thereAreHits,
        };
      }
      throw new BlastAdapterError(
        "PENDING",
        `NCBI BLAST RID ${cleanRid} is still ${status}.`,
      );
    }

    // Prefer XML (parseable in Workers without unzip). Fall back to Text.
    let resultsText: string | null = null;
    let resultsFormat: "XML" | "Text" | null = null;

    const xmlUrl = `${BLAST_API_URL}?CMD=Get&RID=${encodeURIComponent(cleanRid)}&FORMAT_TYPE=XML`;
    const xmlResponse = await this.fetchWithTimeout(
      xmlUrl,
      { headers: { Accept: "application/xml, text/xml, */*" } },
      "Get XML",
    );
    if (xmlResponse.ok) {
      const xml = await xmlResponse.text();
      if (xml.includes("<BlastOutput") || xml.includes("<Hit>")) {
        resultsText = xml;
        resultsFormat = "XML";
      }
    }

    if (!resultsText) {
      const textUrl = `${BLAST_API_URL}?CMD=Get&RID=${encodeURIComponent(cleanRid)}&FORMAT_TYPE=Text`;
      const textResponse = await this.fetchWithTimeout(
        textUrl,
        { headers: { Accept: "text/plain, */*" } },
        "Get Text",
      );
      if (!textResponse.ok) {
        throw new BlastAdapterError(
          "NETWORK",
          `NCBI BLAST Get returned HTTP ${textResponse.status}.`,
        );
      }
      resultsText = await textResponse.text();
      resultsFormat = "Text";
    }

    this.setProvenance(
      {
        rid: cleanRid,
        database: db,
        status: "READY",
        thereAreHits: info.thereAreHits,
        resultsFormat,
        queryLength: options?.queryLength ?? null,
        api: BLAST_API_URL,
      },
      retrievedAt,
    );

    return {
      rid: cleanRid,
      rtoe: options?.rtoe ?? info.rtoe,
      database: db,
      program: "blastp",
      status: "READY",
      resultsText,
      resultsFormat,
      queryLength: options?.queryLength ?? null,
      thereAreHits: info.thereAreHits,
    };
  }

  normalize(output: BlastRawPayload): BlastNormalizedSearch {
    const retrievedAt = this.lastProvenance?.retrievedAt ?? nowIso();
    return normalizeBlastPayload(output, {
      retrievedAt,
      provenance: this.lastProvenance ?? undefined,
    });
  }

  getProvenance(): Provenance {
    if (!this.lastProvenance) {
      return buildProvenance({
        tool: "NCBI BLAST",
        source: BLAST_PROVENANCE_SOURCE,
        retrievedAt: "",
        parameters: {},
        version: "NCBI BLAST Common URL API",
      });
    }
    return this.lastProvenance;
  }
}

export function createBlastSearchAdapter(
  options?: BlastAdapterOptions,
): BlastSearchAdapter {
  return new BlastSearchAdapter(options);
}
