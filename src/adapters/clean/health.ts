import { CleanClient } from "@/adapters/clean/cleanAdapter";
import type { CleanHealthStatus } from "@/adapters/clean/types";

/** Cache the upstream health verdict ~5 minutes per Worker isolate. */
export const CLEAN_HEALTH_TTL_MS = 5 * 60_000;

let cached: { status: CleanHealthStatus; expiresAt: number } | null = null;

export async function getCleanResultsHealth(options: {
  force?: boolean;
  client?: CleanClient;
  now?: () => number;
} = {}): Promise<CleanHealthStatus & { cached: boolean }> {
  const now = options.now ?? Date.now;
  if (!options.force && cached && cached.expiresAt > now()) {
    return { ...cached.status, cached: true };
  }
  const client = options.client ?? new CleanClient();
  const status = await client.probeResultsHealth();
  cached = { status, expiresAt: now() + CLEAN_HEALTH_TTL_MS };
  return { ...status, cached: false };
}

/** Record a fresh verdict learned elsewhere (e.g. a real results 5xx). */
export function recordCleanResultsHealth(
  status: CleanHealthStatus,
  now: () => number = Date.now,
): void {
  cached = { status, expiresAt: now() + CLEAN_HEALTH_TTL_MS };
}

export function clearCleanResultsHealthCache(): void {
  cached = null;
}
