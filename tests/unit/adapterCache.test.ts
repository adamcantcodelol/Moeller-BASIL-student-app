import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/db";
import {
  lookupAdapterCache,
  putAdapterCache,
  parseCachedResponse,
  purgeExpiredAdapterCache,
} from "@/lib/cache/adapterCache";
import { fingerprintRequest } from "@/lib/cache/keys";

describe("adapter response cache", () => {
  it("stores and returns legitimate cached responses", async () => {
    const db = await createTestDatabase();
    const request = { pdbId: "4HHB" };
    const response = { entry: { rcsb_id: "4HHB" } };

    await putAdapterCache(db, {
      tool: "rcsb",
      request,
      response,
      ttlMs: 60_000,
    });

    const lookup = await lookupAdapterCache(db, "rcsb", request);
    expect(lookup.hit).toBe(true);
    expect(parseCachedResponse(lookup.entry!)).toEqual(response);
    expect(fingerprintRequest(request)).toContain("4HHB");
  });

  it("treats expired entries as misses", async () => {
    const db = await createTestDatabase();
    await putAdapterCache(db, {
      tool: "rcsb",
      request: { pdbId: "1ABC" },
      response: { ok: true },
      ttlMs: -1,
      retrievedAt: new Date(Date.now() - 10_000).toISOString(),
    });

    const lookup = await lookupAdapterCache(db, "rcsb", { pdbId: "1ABC" });
    expect(lookup.hit).toBe(false);
    expect(lookup.stale).toBe(true);

    const purged = await purgeExpiredAdapterCache(db);
    expect(purged).toBeGreaterThanOrEqual(1);
  });
});
