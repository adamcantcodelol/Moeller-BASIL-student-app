/**
 * Cloudflare D1 rejects any string/row over 2,000,000 bytes. Some upstream
 * tools (e.g. Foldseek for multi-chain PDBs) return 5–10 MB raw JSON, and a
 * failed INSERT used to cascade: the drizzle error message embeds every bound
 * parameter, so writing that message to the job / pipeline row failed too and
 * the API answered "An unexpected error occurred.".
 */
export const D1_SAFE_TEXT_BYTES = 1_500_000;

function utf8Length(text: string): number {
  // JSON from our adapters is overwhelmingly ASCII; only pay for exact
  // encoding when the string is near the limit.
  if (text.length * 3 <= D1_SAFE_TEXT_BYTES) return text.length;
  return new TextEncoder().encode(text).length;
}

/**
 * Serialize a raw upstream payload for storage. If it cannot fit in a D1 row,
 * store an honest placeholder (never a fabricated or silently altered payload).
 */
export function serializeRawForStorage(
  raw: unknown,
  context: { tool: string; source: string },
): string {
  const json = JSON.stringify(raw);
  const bytes = utf8Length(json);
  if (bytes <= D1_SAFE_TEXT_BYTES) return json;
  return JSON.stringify({
    rawPayloadStored: false,
    tool: context.tool,
    source: context.source,
    originalBytes: bytes,
    reason: `The full ${context.tool} response (${(bytes / 1_000_000).toFixed(1)} MB) is larger than the database row limit (2 MB), so it was not stored. The normalized hits were computed from the full response; re-run or open the source to see everything.`,
  });
}

const MAX_ERROR_CHARS = 600;

/**
 * Turn any thrown error into a short, plain-English message that is safe to
 * store in D1 and show to students/teachers.
 */
export function toSafeErrorMessage(error: unknown, fallback: string): string {
  let message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : fallback;
  if (!message || !message.trim()) message = fallback;

  // drizzle-orm wraps D1 errors as "Failed query: <sql>\nparams: <values>".
  if (/Failed query:|D1_ERROR|SQLITE_/i.test(message)) {
    const tooBig = /too ?big|TOOBIG|string or blob|length exceeded|SQLITE_TOOBIG/i.test(
      message,
    );
    const cause =
      error instanceof Error && error.cause instanceof Error
        ? error.cause.message
        : "";
    const causeTooBig = /too ?big|TOOBIG|string or blob/i.test(cause);
    message =
      tooBig || causeTooBig
        ? "The result was too large to save in the class database. No result was invented."
        : "Saving this result to the class database failed (the database may be busy). No result was invented — try again in a minute.";
  }

  message = message.replace(/\s+/g, " ").trim();
  return message.length > MAX_ERROR_CHARS
    ? `${message.slice(0, MAX_ERROR_CHARS - 1)}…`
    : message;
}

/** Short server-log description (name, message head, cause head). */
export function describeErrorForLog(error: unknown): string {
  if (!(error instanceof Error)) return String(error).slice(0, 300);
  const cause =
    error.cause instanceof Error
      ? ` | cause: ${error.cause.name}: ${error.cause.message.slice(0, 300)}`
      : "";
  return `${error.name}: ${error.message.slice(0, 300)}${cause}`;
}
