import { describe, expect, it, vi } from "vitest";
import {
  createSwissDockSearchAdapter,
  SwissDockAdapterError,
} from "@/adapters/swissdock";

const PDB_WITH_HEM = `HEADER    TEST
HETATM    1  FE  HEM A 142      10.000  20.000  30.000  1.00 10.00           FE
HETATM    2  CHA HEM A 142      11.000  21.000  31.000  1.00 10.00           C
ATOM      3  N   ALA A   1      1.000   2.000   3.000  1.00 10.00           N
END
`;

describe("SwissDockSearchAdapter", () => {
  it("auto-extracts HEM ligand + chemcomp SMILES and returns pending", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("files.rcsb.org")) {
        return new Response(PDB_WITH_HEM, { status: 200 });
      }
      if (url.includes("/chemcomp/HEM")) {
        return Response.json({
          rcsb_chem_comp_descriptor: { SMILES: "CCO" },
        });
      }
      if (url.includes("/preplig")) {
        return new Response("Session number: 999\nPrepared.", { status: 200 });
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
    const raw = await adapter.run({ pdbId: "4HHB" });
    expect(raw.sessionNumber).toBe("999");
    expect(raw.phase).toBe("docking");
    expect(raw.smiles).toBe("CCO");
    expect(raw.resultsText).toBeNull();
  });

  it("errors when PDB has no ligand and no SMILES override", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("files.rcsb.org")) {
        return new Response("ATOM 1 N ALA A 1 1 2 3\nEND\n", { status: 200 });
      }
      return new Response("no", { status: 404 });
    });
    const adapter = createSwissDockSearchAdapter({
      fetchImpl: fetchImpl as typeof fetch,
    });
    await expect(adapter.run({ pdbId: "1CRN" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
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
