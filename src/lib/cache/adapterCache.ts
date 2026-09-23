import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { adapterResponseCache } from "@/db/schema";
import { nowIso } from "@/lib/ids";
import type {
  AdapterCacheEntry,
  AdapterCacheLookup,
} from "@/types/adapterCache";
import {
  buildAdapterCacheKey,
  fingerprintRequest,
} from "@/lib/cache/keys";

export const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function mapCacheRow(
  row: typeof adapterResponseCache.$inferSelect,
): AdapterCacheEntry {
  return {
    cacheKey: row.cacheKey,
    tool: row.tool,
    requestFingerprint: row.requestFingerprint,
    responseJson: row.responseJson,
    retrievedAt: row.retrievedAt,
    expiresAt: row.expiresAt,
    provenanceJson: row.provenanceJson,
  };
}

export async function lookupAdapterCache(
  db: AppDatabase,
  tool: string,
  request: unknown,
): Promise<AdapterCacheLookup> {
  const requestFingerprint = fingerprintRequest(request);
  const cacheKey = await buildAdapterCacheKey(tool, requestFingerprint);
  const rows = await db
    .select()
    .from(adapterResponseCache)
    .where(eq(adapterResponseCache.cacheKey, cacheKey))
    .limit(1);

  if (rows.length === 0) {
    return { hit: false, entry: null, stale: false };
  }

  const entry = mapCacheRow(rows[0]);
  const stale = entry.expiresAt <= nowIso();
  if (stale) {
    return { hit: false, entry, stale: true };
  }

  return { hit: true, entry, stale: false };
}

export async function putAdapterCache(
  db: AppDatabase,
  input: {
    tool: string;
    request: unknown;
    response: unknown;
    provenance?: unknown;
    ttlMs?: number;
    retrievedAt?: string;
  },
): Promise<AdapterCacheEntry> {
  const requestFingerprint = fingerprintRequest(input.request);
  const cacheKey = await buildAdapterCacheKey(input.tool, requestFingerprint);
  const retrievedAt = input.retrievedAt ?? nowIso();
  const ttlMs = input.ttlMs ?? DEFAULT_CACHE_TTL_MS;
  const expiresAt = new Date(Date.parse(retrievedAt) + ttlMs).toISOString();

  const values = {
    cacheKey,
    tool: input.tool,
    requestFingerprint,
    responseJson: JSON.stringify(input.response),
    retrievedAt,
    expiresAt,
    provenanceJson: input.provenance
      ? JSON.stringify(input.provenance)
      : null,
  };

  const existing = await db
    .select()
    .from(adapterResponseCache)
    .where(eq(adapterResponseCache.cacheKey, cacheKey))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(adapterResponseCache)
      .set(values)
      .where(eq(adapterResponseCache.cacheKey, cacheKey));
  } else {
    await db.insert(adapterResponseCache).values(values);
  }

  return {
    cacheKey,
    tool: input.tool,
    requestFingerprint,
    responseJson: values.responseJson,
    retrievedAt,
    expiresAt,
    provenanceJson: values.provenanceJson,
  };
}

/** Evict expired entries (optional maintenance). */
export async function purgeExpiredAdapterCache(
  db: AppDatabase,
): Promise<number> {
  const now = nowIso();
  const rows = await db.select().from(adapterResponseCache);
  let removed = 0;
  for (const row of rows) {
    if (row.expiresAt <= now) {
      await db
        .delete(adapterResponseCache)
        .where(eq(adapterResponseCache.cacheKey, row.cacheKey));
      removed += 1;
    }
  }
  return removed;
}

export function parseCachedResponse<T>(entry: AdapterCacheEntry): T {
  return JSON.parse(entry.responseJson) as T;
}
