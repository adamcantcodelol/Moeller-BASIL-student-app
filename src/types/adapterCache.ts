export interface AdapterCacheEntry {
  cacheKey: string;
  tool: string;
  requestFingerprint: string;
  responseJson: string;
  retrievedAt: string;
  expiresAt: string;
  provenanceJson: string | null;
}

export interface AdapterCacheLookup {
  hit: boolean;
  entry: AdapterCacheEntry | null;
  stale: boolean;
}
