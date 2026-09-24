import { deflateRawSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import {
  createSwissDockSearchAdapter,
  normalizeSwissDockPayload,
  SwissDockAdapterError,
} from "@/adapters/swissdock";
import { classifySwissDockStatus } from "@/adapters/swissdock/swissdockAdapter";
import { readZipEntry } from "@/adapters/swissdock/zip";

/** Build a tiny one-file deflate ZIP like SwissDock's results.zip. */
function makeZip(name: string, text: string): Uint8Array<ArrayBuffer> {
  const nameBytes = Buffer.from(name);
  const data = deflateRawSync(Buffer.from(text));
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(text.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(text.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(0, 42);
  const cdOffset = local.length + nameBytes.length + data.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + nameBytes.length, 12);
  end.writeUInt32LE(cdOffset, 16);
  return new Uint8Array(Buffer.concat([local, nameBytes, data, central, nameBytes, end]));
}

const VINA_PDBQT = `MODEL 1
REMARK VINA RESULT:    -4.477      0.000      0.000
ENDMDL
MODEL 2
REMARK VINA RESULT:    -4.468      0.072      1.614
ENDMDL
`;

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
        return new Response(
          "Your parameters:\nThis job is estimated to take 0:00:11 (h:mm:ss).\n\nYour session can be submitted.",
          { status: 200 },
        );
      }
      if (url.includes("/startdock")) {
        return new Response("Using session number: 999\n\nYour session has been submitted.", {
          status: 200,
        });
      }
      if (url.includes("/checkstatus")) {
        return new Response("Calculation is in the queue. Number of jobs before yours: 0", {
          status: 200,
        });
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

  it("classifies real SwissDock checkstatus wording", () => {
    expect(classifySwissDockStatus("Calculation is in the queue. Number of jobs before yours: 2")).toBe("running");
    expect(classifySwissDockStatus("Calculation currently running. Run time: 9:30")).toBe("running");
    expect(classifySwissDockStatus("Calculation is finished.\nTo retrieve the results")).toBe("finished");
    expect(
      classifySwissDockStatus("Your parameters:\n...\nYour session cannot be run.\nPlease change some parameters."),
    ).toBe("refused");
  });

  it("fails honestly (no spinning) when SwissDock refuses the session", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("Your parameters:\n\tMethod: Vina\nYour session cannot be run.\nPlease change some parameters.\n", {
        status: 200,
      }),
    );
    const adapter = createSwissDockSearchAdapter({ fetchImpl: fetchImpl as typeof fetch });
    await expect(
      adapter.pollSession("29126847", "2QRU", "CCO", { allowPending: true }),
    ).rejects.toMatchObject({ code: "FAILED" });
  });

  it("retrieves results.zip and parses real Vina poses when finished", async () => {
    const zip = makeZip("vina_dock.pdbqt", VINA_PDBQT);
    expect((await readZipEntry(zip, (n) => n === "vina_dock.pdbqt"))?.text).toBe(VINA_PDBQT);
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/checkstatus")) {
        return new Response("Calculation is finished.\nTo retrieve the results, please run the following command:", {
          status: 200,
        });
      }
      if (url.includes("/retrievesession")) {
        return new Response(zip, { status: 200 });
      }
      return new Response("no", { status: 404 });
    });
    const adapter = createSwissDockSearchAdapter({ fetchImpl: fetchImpl as typeof fetch });
    const raw = await adapter.pollSession("21538973", "3PTB", "NC(=N)c1ccccc1", { allowPending: true });
    expect(raw.phase).toBe("ready");
    const normalized = normalizeSwissDockPayload(raw);
    expect(normalized.poseCount).toBe(2);
    expect(normalized.poses[0]).toMatchObject({ rank: 1, affinity: -4.477 });
  });
});
