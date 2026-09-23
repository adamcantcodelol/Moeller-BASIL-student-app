import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  createInterProDataAdapter,
  InterProAdapterError,
} from "@/adapters/interpro";
import type { InterProRawPayload } from "@/adapters/interpro";

const fixture = JSON.parse(
  readFileSync("tests/fixtures/interpro-p04637.json", "utf8"),
) as InterProRawPayload;

describe("InterProDataAdapter", () => {
  it("fetches protein + entries and normalizes them", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/entry/interpro/protein/uniprot/P04637")) {
        return Response.json(fixture.entries);
      }
      if (url.includes("/protein/uniprot/P04637")) {
        return Response.json(fixture.protein);
      }
      return new Response("not found", { status: 404 });
    });

    const adapter = createInterProDataAdapter({
      fetchImpl: fetchImpl as typeof fetch,
    });
    const raw = await adapter.run({ uniprotAccession: "p04637" });
    const normalized = adapter.normalize(raw);

    expect(fetchImpl).toHaveBeenCalled();
    expect(normalized.uniprotAccession).toBe("P04637");
    expect(normalized.entries.length).toBeGreaterThan(0);
    expect(adapter.getProvenance().retrievedAt).toBeTruthy();
  });

  it("maps 204/404 to NOT_FOUND without fabricating annotations", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const adapter = createInterProDataAdapter({
      fetchImpl: fetchImpl as typeof fetch,
    });
    await expect(
      adapter.run({ uniprotAccession: "P04637" }),
    ).rejects.toMatchObject({
      name: "InterProAdapterError",
      code: "NOT_FOUND",
    } satisfies Partial<InterProAdapterError>);
  });

  it("rejects invalid accessions before contacting the API", async () => {
    const fetchImpl = vi.fn();
    const adapter = createInterProDataAdapter({
      fetchImpl: fetchImpl as typeof fetch,
    });
    await expect(
      adapter.run({ uniprotAccession: "P53_HUMAN" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
