import { describeErrorForLog } from "@/lib/db/storageLimits";
import { ServiceError } from "@/lib/services/projectService";

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function handleServiceError(
  error: unknown,
  fallbackMessage = "An unexpected error occurred.",
) {
  if (error instanceof ServiceError) {
    return jsonError(error.message, error.status);
  }
  // Log the real cause (clamped) so `wrangler tail` shows it; never echo
  // raw internals (SQL, bound params) to students.
  console.error("[api] unhandled error:", describeErrorForLog(error));
  return jsonError(fallbackMessage, 500);
}
