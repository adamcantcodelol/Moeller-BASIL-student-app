import { ServiceError } from "@/lib/services/projectService";

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function handleServiceError(error: unknown) {
  if (error instanceof ServiceError) {
    return jsonError(error.message, error.status);
  }
  return jsonError("An unexpected error occurred.", 500);
}
