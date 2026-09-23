import { describe, expect, it, vi } from "vitest";
import { createDaliSearchAdapter, DaliAdapterError } from "@/adapters/dali";

describe("DaliSearchAdapter", () => {
  it("submits and returns pending when Queued", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("dump.cgi") && init?.method === "POST") {
        return new Response("Redirected", {
          status: 302,
          headers: {
            Location:
              "http://ekhidna2.biocenter.helsinki.fi/barcosel/tmp//1crnA//index.html",
          },
        });
      }
      if (url.includes("barcosel/tmp")) {
        return new Response(
          `<html><h1>Status: Queued</h1></html>`,
          { status: 200 },
        );
      }
      return new Response("no", { status: 404 });
    });
    const adapter = createDaliSearchAdapter({
      fetchImpl: fetchImpl as typeof fetch,
    });
    const raw = await adapter.run({ pdbId: "1crn", chain: "A" });
    expect(raw.status).toBe("Queued");
    expect(raw.summaryText).toBeNull();
    expect(adapter.getProvenance().source).toContain("ekhidna2");
  });

  it("maps validation errors for bad chain", async () => {
    const adapter = createDaliSearchAdapter({
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    await expect(
      adapter.run({ pdbId: "1crn", chain: "AB" }),
    ).rejects.toBeInstanceOf(DaliAdapterError);
  });
});
