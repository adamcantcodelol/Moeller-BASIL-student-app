import { describe, expect, it, vi } from "vitest";
import {
  createSwissDockSearchAdapter,
  SwissDockAdapterError,
} from "@/adapters/swissdock";

describe("SwissDockSearchAdapter", () => {
  it("requires SMILES and valid box", async () => {
    const adapter = createSwissDockSearchAdapter({
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    await expect(
      adapter.run({
        pdbId: "4HHB",
        smiles: "",
        boxCenter: "1_2_3",
        boxSize: "20_20_20",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("runs preplig→target→params→start and returns pending", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/preplig")) {
        return new Response("Session number: 999\nPrepared.", { status: 200 });
      }
      if (url.includes("files.rcsb.org")) {
        return new Response("ATOM      1\n", { status: 200 });
      }
      if (url.includes("/preptarget") && init?.method === "POST") {
        return new Response("target ok", { status: 200 });
      }
      if (url.includes("/setparameters")) {
        return new Response("params ok", { status: 200 });
      }
      if (url.includes("/startdock")) {
        return new Response("submitted", { status: 200 });
      }
      if (url.includes("/checkstatus")) {
        return new Response("Job is running. Please wait.", { status: 200 });
      }
      return new Response("no", { status: 404 });
    });
    const adapter = createSwissDockSearchAdapter({
      fetchImpl: fetchImpl as typeof fetch,
    });
    const raw = await adapter.run({
      pdbId: "4HHB",
      smiles: "CCO",
      boxCenter: "10_0_5",
      boxSize: "20_20_20",
    });
    expect(raw.sessionNumber).toBe("999");
    expect(raw.phase).toBe("docking");
    expect(raw.resultsText).toBeNull();
  });

  it("pollSession throws PENDING when not allowPending", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("Job is running", { status: 200 }),
    );
    const adapter = createSwissDockSearchAdapter({
      fetchImpl: fetchImpl as typeof fetch,
    });
    await expect(
      adapter.pollSession("1", "4HHB", "CCO"),
    ).rejects.toBeInstanceOf(SwissDockAdapterError);
  });
});
