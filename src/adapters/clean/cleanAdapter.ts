import { parseExpasyEnzymeName } from "@/adapters/clean/normalize";
import {
  CLEAN_API_BASE,
  CLEAN_HEALTH_PROBE_JOB_ID,
  CleanAdapterError,
  isCleanPhase,
  type CleanHealthStatus,
  type CleanPhase,
} from "@/adapters/clean/types";
import { nowIso } from "@/lib/ids";

export const CLEAN_REQUEST_TIMEOUT_MS = 20_000;
export const CLEAN_HEALTH_TIMEOUT_MS = 8_000;
const USER_AGENT =
  "MoellerBASIL-student-app/1.0 (+https://moeller-basil.moeller-basil.workers.dev)";

export interface CleanClientOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  baseUrl?: string;
}

/**
 * Thin server-side client for the public UIUC MoleculeMaker CLEAN API.
 * Called only from the Worker — students never contact MMLI directly.
 * No auth, captcha, or email is required (enableHCAPTCHA=false in the SPA
 * config; email is optional). Never invents EC numbers.
 */
export class CleanClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;

  constructor(options: CleanClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
    this.timeoutMs = options.timeoutMs ?? CLEAN_REQUEST_TIMEOUT_MS;
    this.baseUrl = options.baseUrl ?? CLEAN_API_BASE;
  }

  private async request(
    path: string,
    init: RequestInit,
    label: string,
    timeoutMs = this.timeoutMs,
  ): Promise<Response> {
    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
          ...(init.headers as Record<string, string> | undefined),
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        throw new CleanAdapterError(
          "TIMEOUT",
          `Timed out contacting CLEAN (${label}). No EC numbers were invented.`,
          null,
          error,
        );
      }
      throw new CleanAdapterError(
        "NETWORK",
        `Could not reach CLEAN (${label}). No EC numbers were invented.`,
        null,
        error,
      );
    }
  }

  /** POST /clean/jobs — returns the MMLI job id. */
  async submit(header: string, sequence: string): Promise<string> {
    const body = {
      email: "",
      job_info: JSON.stringify({ input_fasta: [{ header, sequence }] }),
    };
    const response = await this.request(
      "/clean/jobs",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      "submit",
    );
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new CleanAdapterError(
        "NETWORK",
        `CLEAN submit returned HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}. No EC numbers were invented.`,
        response.status,
      );
    }
    const json = (await response.json().catch(() => null)) as {
      job_id?: unknown;
    } | null;
    if (!json || typeof json.job_id !== "string" || !json.job_id) {
      throw new CleanAdapterError(
        "INVALID_RESPONSE",
        "CLEAN submit did not return a job_id. No EC numbers were invented.",
      );
    }
    return json.job_id;
  }

  /** GET /clean/jobs/{job_id} — returns the run phase. */
  async getPhase(jobId: string): Promise<CleanPhase> {
    const response = await this.request(
      `/clean/jobs/${encodeURIComponent(jobId)}`,
      { method: "GET" },
      "status",
    );
    if (response.status === 404) {
      throw new CleanAdapterError(
        "NOT_FOUND",
        `CLEAN job ${jobId} was not found. No EC numbers were invented.`,
        404,
      );
    }
    if (!response.ok) {
      throw new CleanAdapterError(
        "NETWORK",
        `CLEAN status check returned HTTP ${response.status}.`,
        response.status,
      );
    }
    const json = (await response.json().catch(() => null)) as unknown;
    const record = Array.isArray(json) ? json[0] : json;
    const phase =
      record && typeof record === "object"
        ? (record as Record<string, unknown>).phase
        : undefined;
    if (Array.isArray(json) && json.length === 0) {
      throw new CleanAdapterError(
        "NOT_FOUND",
        `CLEAN job ${jobId} has no runs on record. No EC numbers were invented.`,
      );
    }
    if (!isCleanPhase(phase)) {
      throw new CleanAdapterError(
        "INVALID_RESPONSE",
        `CLEAN status for ${jobId} had an unknown phase.`,
      );
    }
    return phase;
  }

  /**
   * GET /clean/results/{job_id}. 5xx → RESULTS_UNAVAILABLE (the MMLI
   * object store is failing); 404 → NOT_FOUND (no result file).
   */
  async getResults(jobId: string): Promise<unknown> {
    const response = await this.request(
      `/clean/results/${encodeURIComponent(jobId)}`,
      { method: "GET" },
      "results",
    );
    if (response.status >= 500) {
      throw new CleanAdapterError(
        "RESULTS_UNAVAILABLE",
        `CLEAN results returned HTTP ${response.status}.`,
        response.status,
      );
    }
    if (response.status === 404) {
      throw new CleanAdapterError(
        "NOT_FOUND",
        "CLEAN finished but its result file was not found. No EC numbers were invented.",
        404,
      );
    }
    if (!response.ok) {
      throw new CleanAdapterError(
        "NETWORK",
        `CLEAN results returned HTTP ${response.status}.`,
        response.status,
      );
    }
    const text = await response.text();
    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      throw new CleanAdapterError(
        "INVALID_RESPONSE",
        "CLEAN results were not valid JSON. No EC numbers were invented.",
        response.status,
        error,
      );
    }
  }

  /**
   * Health probe: can the backend read job outputs right now?
   * 200/404 for a known job id = storage reachable. 5xx/timeout = broken.
   */
  async probeResultsHealth(
    probeJobId: string = CLEAN_HEALTH_PROBE_JOB_ID,
    timeoutMs: number = CLEAN_HEALTH_TIMEOUT_MS,
  ): Promise<CleanHealthStatus> {
    const checkedAt = nowIso();
    try {
      const response = await this.request(
        `/clean/results/${encodeURIComponent(probeJobId)}`,
        { method: "GET" },
        "health probe",
        timeoutMs,
      );
      // Drain the body so the connection can be reused.
      await response.text().catch(() => "");
      if (response.status === 200 || response.status === 404) {
        return {
          ok: true,
          httpStatus: response.status,
          checkedAt,
          detail: `Results store reachable (HTTP ${response.status}).`,
        };
      }
      return {
        ok: false,
        httpStatus: response.status,
        checkedAt,
        detail: `Results endpoint returned HTTP ${response.status}.`,
      };
    } catch (error) {
      return {
        ok: false,
        httpStatus: null,
        checkedAt,
        detail:
          error instanceof Error ? error.message : "Health probe failed.",
      };
    }
  }
}

/**
 * Best-effort ExPASy ENZYME accepted names (e.g. 4.2.1.1 → "carbonic
 * anhydrase"). Failures just leave the name null — never guessed.
 */
export async function fetchExpasyEnzymeNames(
  ecNumbers: string[],
  options: { fetchImpl?: typeof fetch; timeoutMs?: number; limit?: number } = {},
): Promise<Record<string, string>> {
  const fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
  const unique = [
    ...new Set(ecNumbers.filter((ec) => /^\d+\.\d+\.\d+\.\d+$/.test(ec))),
  ].slice(0, options.limit ?? 5);
  const names: Record<string, string> = {};
  await Promise.all(
    unique.map(async (ec) => {
      try {
        const response = await fetchImpl(
          `https://enzyme.expasy.org/EC/${ec}.txt`,
          {
            headers: { "User-Agent": USER_AGENT },
            signal: AbortSignal.timeout(options.timeoutMs ?? 5_000),
          },
        );
        if (!response.ok) return;
        const name = parseExpasyEnzymeName(await response.text());
        if (name) names[ec] = name;
      } catch {
        // Leave unnamed — the EC number itself is still real CLEAN output.
      }
    }),
  );
  return names;
}
