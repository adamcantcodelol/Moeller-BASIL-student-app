import { ScientificHttpError } from "@/adapters/errors";

export const DEFAULT_ADAPTER_TIMEOUT_MS = 15_000;

export interface FetchJsonOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Label used in error messages (tool or resource name). */
  label?: string;
}

/**
 * Shared JSON GET with timeout. Never invents a body on failure.
 */
export async function fetchJsonWithTimeout(
  url: string,
  options: FetchJsonOptions = {},
): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_ADAPTER_TIMEOUT_MS;
  const label = options.label ?? url;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new ScientificHttpError(
        "TIMEOUT",
        `Timed out contacting ${label}. Student work was not replaced with simulated data.`,
        { cause: error },
      );
    }
    throw new ScientificHttpError(
      "NETWORK",
      `Could not reach ${label}. Check network access and retry. No fabricated data was stored.`,
      { cause: error },
    );
  }

  if (response.status === 404) {
    throw new ScientificHttpError(
      "NOT_FOUND",
      `Resource not found at ${label}. No fabricated data was stored.`,
      { httpStatus: 404 },
    );
  }

  if (!response.ok) {
    throw new ScientificHttpError(
      "NETWORK",
      `External service returned HTTP ${response.status} for ${label}. No fabricated data was stored.`,
      { httpStatus: response.status },
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new ScientificHttpError(
      "INVALID_RESPONSE",
      `External service returned non-JSON for ${label}.`,
      { httpStatus: response.status, cause: error },
    );
  }

  return body;
}

export async function fetchJsonObject(
  url: string,
  options: FetchJsonOptions = {},
): Promise<Record<string, unknown>> {
  const body = await fetchJsonWithTimeout(url, options);
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ScientificHttpError(
      "INVALID_RESPONSE",
      `External service returned an unexpected payload for ${options.label ?? url}.`,
    );
  }
  return body as Record<string, unknown>;
}
