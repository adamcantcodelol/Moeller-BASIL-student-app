/**
 * Shared scientific-adapter error hierarchy.
 * Failures must surface clearly — never fabricate results.
 */

export const SCIENTIFIC_ERROR_CODES = [
  "NOT_IMPLEMENTED",
  "TIMEOUT",
  "NETWORK",
  "NOT_FOUND",
  "INVALID_RESPONSE",
  "VALIDATION",
  "IMPORT_INVALID",
  "CACHE",
  "JOB",
] as const;

export type ScientificErrorCode = (typeof SCIENTIFIC_ERROR_CODES)[number];

export class ScientificError extends Error {
  readonly code: ScientificErrorCode;

  constructor(
    code: ScientificErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ScientificError";
    this.code = code;
  }
}

export class ScientificHttpError extends ScientificError {
  readonly httpStatus: number | null;

  constructor(
    code: Extract<ScientificErrorCode, "TIMEOUT" | "NETWORK" | "INVALID_RESPONSE" | "NOT_FOUND">,
    message: string,
    options?: { httpStatus?: number | null; cause?: unknown },
  ) {
    super(code, message, options?.cause);
    this.name = "ScientificHttpError";
    this.httpStatus = options?.httpStatus ?? null;
  }
}

export function isScientificError(error: unknown): error is ScientificError {
  return error instanceof ScientificError;
}

/** Maps adapter failures to HTTP-ish service statuses without inventing payloads. */
export function scientificErrorHttpStatus(error: ScientificError): number {
  switch (error.code) {
    case "NOT_FOUND":
      return 404;
    case "VALIDATION":
    case "IMPORT_INVALID":
      return 400;
    case "NOT_IMPLEMENTED":
      return 501;
    case "TIMEOUT":
    case "NETWORK":
      return 502;
    case "INVALID_RESPONSE":
    case "CACHE":
    case "JOB":
      return 500;
    default:
      return 500;
  }
}
