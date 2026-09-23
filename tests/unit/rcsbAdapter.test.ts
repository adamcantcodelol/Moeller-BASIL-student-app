import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createRcsbDataAdapter, RcsbAdapterError } from "@/adapters/rcsb";
import type { RcsbRawPayload } from "@/adapters/rcsb/types";

const fixture = JSON.parse(
  readFileSync("tests/fixtures/rcsb-4hhb.json", "utf8"),
) as RcsbRawPayload;

describe("RcsbDataAdapter", () => {
  it("fetches entry + polymer entities and normalizes them", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/entry/4HHB")) {
        return Response.json(fixture.entry);
      }
      if (url.includes("/polymer_entity/4HHB/1")) {
        return Response.json(fixture.polymerEntities[0]);
      }
      if (url.includes("/polymer_entity/4HHB/2")) {
        return Response.json(fixture.polymerEntities[1]);
      }
      return new Response("not found", { status: 404 });
    });

    const adapter = createRcsbDataAdapter({ fetchImpl: fetchImpl as typeof fetch });
    const raw = await adapter.run({ pdbId: "4hhb" });
    const normalized = adapter.normalize(raw);

    expect(fetchImpl).toHaveBeenCalled();
    expect(normalized.pdbId).toBe("4HHB");
    expect(normalized.title).toBeTruthy();
    expect(adapter.getProvenance().retrievedAt).toBeTruthy();
  });

  it("surfaces NOT_FOUND without fabricating metadata", async () => {
    const fetchImpl = vi.fn(async () => new Response("missing", { status: 404 }));
    const adapter = createRcsbDataAdapter({ fetchImpl: fetchImpl as typeof fetch });
    await expect(adapter.run({ pdbId: "1ZZZ" })).rejects.toMatchObject({
      name: "RcsbAdapterError",
      code: "NOT_FOUND",
    } satisfies Partial<RcsbAdapterError>);
  });
});
