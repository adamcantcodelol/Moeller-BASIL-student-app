import { describe, expect, it, vi } from "vitest";
import {
  createSpriteSearchAdapter,
  SpriteAdapterError,
} from "@/adapters/sprite";

describe("SpriteSearchAdapter", () => {
  it("submits upload, polls session, and fetches results when complete", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/upload") && init?.method === "POST") {
        return Response.json({
          ok: true,
          session_id: "sess-abc",
          mongo_id: "mongo1",
          structures: [
            {
              struc_id: "0",
              ori_name: "4cha.pdb",
              success: ["files are in allowed format"],
              err: [],
              filepath: "/tmp/4cha.pdb",
            },
          ],
        });
      }
      if (url.includes("/session_data/sess-abc")) {
        return Response.json({
          session_id: "sess-abc",
          db: "csa3",
          structures: [
            {
              struc_id: "0",
              celery: { task_id: "t1", state: "COMPLETED" },
              right_superposition_count: { match_counter: 1, saved_counter: 1 },
              left_superposition_count: { match_counter: 0, saved_counter: 0 },
              status: [{ detail: "SPRITE search completed", error: null }],
            },
          ],
        });
      }
      if (url.includes("/results/sess-abc/0")) {
        return Response.json({
          total_results: 1,
          total_pages: 1,
          total_matches: 1,
          matches: [
            {
              pdb_id: "1ds2",
              pattern_id: "1ds2_c00",
              size: 5,
              description: "PROTEINASE B",
              rmsd: 0.26,
              transform: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
              pat_residues: [],
              match_residues: [
                { chain: "F", res_no: "57", res_type: "HIS" },
              ],
            },
          ],
        });
      }
      return new Response("not found", { status: 404 });
    });

    const adapter = createSpriteSearchAdapter({
      fetchImpl: fetchImpl as typeof fetch,
    });
    const raw = await adapter.run({ pdbId: "4cha", database: "csa3" });
    expect(raw.sessionId).toBe("sess-abc");
    expect(raw.results).not.toBeNull();
    const normalized = adapter.normalize(raw);
    expect(normalized.hitCount).toBe(1);
    expect(normalized.hits[0]?.pdbId).toBe("1ds2");
    expect(adapter.getProvenance().source).toBe("https://grafss.ukm.my");
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("returns pending payload when celery is not COMPLETED", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/upload") && init?.method === "POST") {
        return Response.json({
          ok: true,
          session_id: "sess-pending",
          structures: [{ struc_id: "0", ori_name: "1crn.pdb" }],
          mongo_id: "m2",
        });
      }
      if (url.includes("/session_data/sess-pending")) {
        return Response.json({
          session_id: "sess-pending",
          structures: [
            {
              struc_id: "0",
              celery: { task_id: "t2", state: "STARTED" },
            },
          ],
        });
      }
      return new Response("not found", { status: 404 });
    });

    const adapter = createSpriteSearchAdapter({
      fetchImpl: fetchImpl as typeof fetch,
    });
    const raw = await adapter.run({ pdbId: "1crn" });
    expect(raw.results).toBeNull();
    expect(raw.celeryState).toBe("STARTED");
    expect(raw.sessionId).toBe("sess-pending");
  });

  it("pollSession throws PENDING while running", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        session_id: "sess-p",
        structures: [
          { struc_id: "0", celery: { state: "PENDING" } },
        ],
      }),
    );
    const adapter = createSpriteSearchAdapter({
      fetchImpl: fetchImpl as typeof fetch,
    });
    await expect(
      adapter.pollSession("4CHA", "sess-p", "0", "csa3"),
    ).rejects.toMatchObject({
      name: "SpriteAdapterError",
      code: "PENDING",
    } satisfies Partial<SpriteAdapterError>);
  });

  it("rejects unsupported databases before calling the API", async () => {
    const fetchImpl = vi.fn();
    const adapter = createSpriteSearchAdapter({
      fetchImpl: fetchImpl as typeof fetch,
    });
    await expect(
      adapter.run({ pdbId: "4cha", database: "not-a-db" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects invalid PDB ids before contacting the API", async () => {
    const fetchImpl = vi.fn();
    const adapter = createSpriteSearchAdapter({
      fetchImpl: fetchImpl as typeof fetch,
    });
    await expect(adapter.run({ pdbId: "BAD" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
