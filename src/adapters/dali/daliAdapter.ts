import type { ScientificAdapter } from "@/adapters/scientificAdapter";
import { DEFAULT_ADAPTER_TIMEOUT_MS } from "@/adapters/fetch";
import { normalizeDaliPayload } from "@/adapters/dali/normalize";
import {
  DALI_PROVENANCE_SOURCE,
  DALI_SUBMIT_URL,
  DaliAdapterError,
  type DaliFetchInput,
  type DaliNormalizedSearch,
  type DaliRawPayload,
} from "@/adapters/dali/types";
import { validatePdbId } from "@/lib/validation/pdbId";
import { nowIso } from "@/lib/ids";
import { buildProvenance } from "@/lib/provenance/buildProvenance";
import type { Provenance } from "@/types/provenance";

export interface DaliAdapterOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function normalizeChain(chain: string): string {
  const trimmed = chain.trim();
  if (!/^[A-Za-z0-9]$/.test(trimmed)) {
    throw new DaliAdapterError(
      "VALIDATION",
      "Dali requires a single-character chain id (e.g. A).",
    );
  }
  return trimmed.toUpperCase();
}

function resolveJobDir(url: string): string {
  // Ensure trailing slash directory URL (strip index.html)
  if (url.endsWith("index.html")) {
    return url.slice(0, -"index.html".length);
  }
  return url.endsWith("/") ? url : `${url}/`;
}

export class DaliSearchAdapter
  implements
    ScientificAdapter<DaliFetchInput, DaliRawPayload, DaliNormalizedSearch>
{
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private lastProvenance: Provenance | null = null;

  constructor(options: DaliAdapterOptions = {}) {
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
        redirect: init?.redirect ?? "manual",
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        throw new DaliAdapterError(
          "TIMEOUT",
          `Timed out contacting Dali (${label}). No hits were invented.`,
          error,
        );
      }
      throw new DaliAdapterError(
        "NETWORK",
        `Could not reach Dali (${label}). No hits were invented.`,
        error,
      );
    }
  }

  private setProvenance(params: Record<string, unknown>, retrievedAt: string) {
    this.lastProvenance = buildProvenance({
      tool: "Dali",
      source: DALI_PROVENANCE_SOURCE,
      retrievedAt,
      parameters: params,
      version: "ekhidna2 dump.cgi PDB search",
    });
  }

  async run(input: DaliFetchInput): Promise<DaliRawPayload> {
    const validation = validatePdbId(input.pdbId);
    if (!validation.ok) {
      throw new DaliAdapterError("VALIDATION", validation.error);
    }
    const pdbId = validation.pdbId.toLowerCase();
    const chain = normalizeChain(input.chain);
    const retrievedAt = nowIso();
    const cd1 = `${pdbId}${chain}`;

    const form = new FormData();
    form.append("method", "search");
    form.append("cd1", cd1);
    form.append("title", `moeller-basil-${cd1}`);
    form.append("address", "");
    form.append("submit", "Submit");

    const response = await this.fetchWithTimeout(
      DALI_SUBMIT_URL,
      { method: "POST", body: form, redirect: "manual" },
      "submit",
    );

    let jobUrl: string | null = null;
    if (response.status >= 300 && response.status < 400) {
      const loc = response.headers.get("Location");
      if (loc) {
        jobUrl = loc.startsWith("http")
          ? loc
          : `http://ekhidna2.biocenter.helsinki.fi${loc.startsWith("/") ? "" : "/"}${loc}`;
      }
    }
    if (!jobUrl) {
      // Some stacks follow redirects; parse body
      const text = await response.text();
      const match = text.match(
        /https?:\/\/ekhidna2\.biocenter\.helsinki\.fi\/barcosel\/tmp\/\/?[A-Za-z0-9_-]+\/?/i,
      );
      jobUrl = match?.[0] ?? null;
    }
    if (!jobUrl) {
      throw new DaliAdapterError(
        "INVALID_RESPONSE",
        "Dali submit did not return a job URL. No hits were invented.",
      );
    }

    const dir = resolveJobDir(jobUrl);
    this.setProvenance(
      { pdbId, chain, cd1, jobUrl: dir, api: DALI_SUBMIT_URL },
      retrievedAt,
    );

    return this.pollJob(pdbId, chain, dir, {
      allowPending: true,
      retrievedAt,
    });
  }

  async pollJob(
    pdbId: string,
    chain: string,
    jobUrl: string,
    options?: { allowPending?: boolean; retrievedAt?: string },
  ): Promise<DaliRawPayload> {
    const retrievedAt = options?.retrievedAt ?? nowIso();
    const allowPending = options?.allowPending ?? false;
    const dir = resolveJobDir(jobUrl);
    const indexUrl = `${dir}index.html`;

    const response = await this.fetchWithTimeout(
      indexUrl,
      { redirect: "follow" },
      "poll",
    );
    if (response.status === 404) {
      throw new DaliAdapterError(
        "NOT_FOUND",
        `Dali job page not found at ${dir}. No hits were invented.`,
      );
    }
    if (!response.ok) {
      throw new DaliAdapterError(
        "NETWORK",
        `Dali poll returned HTTP ${response.status}.`,
      );
    }
    const html = await response.text();

    if (/ERROR:/i.test(html)) {
      throw new DaliAdapterError(
        "FAILED",
        "Dali reported an ERROR for this job. No hits were invented.",
      );
    }

    if (/Status:\s*Queued/i.test(html)) {
      this.setProvenance(
        { pdbId, chain, jobUrl: dir, status: "Queued" },
        retrievedAt,
      );
      if (allowPending) {
        return {
          pdbId,
          chain,
          jobUrl: dir,
          status: "Queued",
          summaryText: null,
          indexHtml: html,
        };
      }
      throw new DaliAdapterError("PENDING", `Dali job is Queued at ${dir}`);
    }
    if (/Status:\s*Running/i.test(html)) {
      this.setProvenance(
        { pdbId, chain, jobUrl: dir, status: "Running" },
        retrievedAt,
      );
      if (allowPending) {
        return {
          pdbId,
          chain,
          jobUrl: dir,
          status: "Running",
          summaryText: null,
          indexHtml: html,
        };
      }
      throw new DaliAdapterError("PENDING", `Dali job is Running at ${dir}`);
    }

    // Finished pages link to summary .txt (ProDy uses *-90.txt or similar)
    const txtMatch =
      html.match(/href=["']([^"']+\.txt)["']/i) ??
      html.match(/=([A-Za-z0-9._-]+-90\.txt)/i) ??
      html.match(/([A-Za-z0-9._-]+\.txt)/i);
    let summaryName = txtMatch?.[1] ?? null;
    if (summaryName && summaryName.startsWith("=")) {
      summaryName = summaryName.slice(1);
    }
    // Prefer non--25/-50 variants when multiple; ProDy strips -90 then appends subset
    const allTxt = Array.from(
      html.matchAll(/href=["']([^"']+\.txt)["']/gi),
      (m) => m[1]!,
    );
    if (allTxt.length > 0) {
      summaryName =
        allTxt.find((n) => !/-25\.txt$/i.test(n) && !/-50\.txt$/i.test(n)) ??
        allTxt[0]!;
    }

    if (!summaryName) {
      // Still spinning with different wording
      if (/Your job/i.test(html) || /queued|running/i.test(html)) {
        if (allowPending) {
          return {
            pdbId,
            chain,
            jobUrl: dir,
            status: "Running",
            summaryText: null,
            indexHtml: html,
          };
        }
        throw new DaliAdapterError("PENDING", `Dali job still pending at ${dir}`);
      }
      throw new DaliAdapterError(
        "INVALID_RESPONSE",
        "Dali finished page had no summary .txt link. No hits were invented.",
      );
    }

    const summaryUrl = summaryName.startsWith("http")
      ? summaryName
      : `${dir}${summaryName.replace(/^\.\//, "")}`;
    const summaryResponse = await this.fetchWithTimeout(
      summaryUrl,
      { redirect: "follow" },
      "summary",
    );
    if (!summaryResponse.ok) {
      throw new DaliAdapterError(
        "NETWORK",
        `Dali summary fetch returned HTTP ${summaryResponse.status}.`,
      );
    }
    const summaryText = await summaryResponse.text();

    this.setProvenance(
      {
        pdbId,
        chain,
        jobUrl: dir,
        status: "READY",
        summaryUrl,
        api: DALI_PROVENANCE_SOURCE,
      },
      retrievedAt,
    );

    return {
      pdbId,
      chain,
      jobUrl: dir,
      status: "READY",
      summaryText,
      indexHtml: html,
    };
  }

  normalize(output: DaliRawPayload): DaliNormalizedSearch {
    return normalizeDaliPayload(output, {
      retrievedAt: this.lastProvenance?.retrievedAt,
      provenance: this.lastProvenance ?? undefined,
    });
  }

  getProvenance(): Provenance {
    if (!this.lastProvenance) {
      return buildProvenance({
        tool: "Dali",
        source: DALI_PROVENANCE_SOURCE,
        retrievedAt: "",
        parameters: {},
        version: "ekhidna2 dump.cgi PDB search",
      });
    }
    return this.lastProvenance;
  }
}

export function createDaliSearchAdapter(
  options?: DaliAdapterOptions,
): DaliSearchAdapter {
  return new DaliSearchAdapter(options);
}
