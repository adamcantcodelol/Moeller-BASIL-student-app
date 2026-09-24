import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDatabase } from "../helpers/db";
import { createProject } from "@/lib/services/projectService";
import { saveStudentPdbId } from "@/lib/services/structureService";
import { structures } from "@/db/schema";
import { nowIso } from "@/lib/ids";
import {
  CLEAN_HEALTH_TTL_MS,
  CLEAN_UNAVAILABLE_MESSAGE,
  CleanClient,
  clearCleanResultsHealthCache,
  getCleanResultsHealth,
} from "@/adapters/clean";
import {
  CleanUnavailableError,
  listCleanResults,
  pollCleanJob,
  submitCleanPrediction,
} from "@/lib/services/cleanService";

const CA2 =
  "MSHHWGYGKHNGPEHWHKDFPIAKGERQSPVDIDTHTAKYDPSLKPLSVSYDQATSLRILNNGHAFNVEFDDSQDKAVLKGGPLDGTYRLIQFHFHWGSLDGQGSEHTVDKKKYAAELHLVHWNTKYGDFGKAVQQPDGLAVLGIFLKVGSAKPGLQKVVDVLDSIKTKGKSADFTNFDPRGLLPESLDYWTYPGSLTTPPLLECVTWIVLKEPISVSSEQVLKFRKLNFNGEGEPEELMVDNWRPAQPLKNRQIKASFK";

type Route = (url: string, init?: RequestInit) => Response | Promise<Response>;

function fakeFetch(route: Route) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    route(String(input), init),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

async function seedProject() {
  const db = await createTestDatabase();
  const project = await createProject(db, { name: "CLEAN 1CA2" });
  await saveStudentPdbId(db, project.id, "1CA2");
  const timestamp = nowIso();
  await db
    .update(structures)
    .set({ source: "rcsb", sequence: CA2, retrievedAt: timestamp, updatedAt: timestamp })
    .where(eq(structures.projectId, project.id));
  return { db, project };
}

beforeEach(() => clearCleanResultsHealthCache());
afterEach(() => vi.unstubAllGlobals());

describe("CLEAN health probe + cache", () => {
  it("treats 500 as unavailable and 404/200 as reachable", async () => {
    const f500 = fakeFetch(() => new Response("Internal Server Error", { status: 500 }));
    expect((await new CleanClient({ fetchImpl: f500 }).probeResultsHealth()).ok).toBe(false);
    const f404 = fakeFetch(() => new Response('{"detail":"404"}', { status: 404 }));
    expect((await new CleanClient({ fetchImpl: f404 }).probeResultsHealth()).ok).toBe(true);
    const fErr = fakeFetch(() => {
      throw new TypeError("network down");
    });
    const down = await new CleanClient({ fetchImpl: fErr }).probeResultsHealth();
    expect(down).toMatchObject({ ok: false, httpStatus: null });
  });

  it("probes the results endpoint for the known job id", async () => {
    const f = fakeFetch(() => new Response("x", { status: 500 }));
    await new CleanClient({ fetchImpl: f }).probeResultsHealth();
    expect(String(f.mock.calls[0]![0])).toBe(
      "https://mmli.fastapi.mmli2.ncsa.illinois.edu/clean/results/d157127706a74c629b6a2559c78e6d0e",
    );
  });

  it("caches the verdict ~5 minutes, and force bypasses the cache", async () => {
    let t = 1_000_000;
    const now = () => t;
    const f = fakeFetch(() => new Response("x", { status: 500 }));
    const client = new CleanClient({ fetchImpl: f });
    const first = await getCleanResultsHealth({ client, now });
    const second = await getCleanResultsHealth({ client, now });
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    t += CLEAN_HEALTH_TTL_MS + 1;
    await getCleanResultsHealth({ client, now });
    expect(f).toHaveBeenCalledTimes(2);
    await getCleanResultsHealth({ client, now, force: true });
    expect(f).toHaveBeenCalledTimes(3);
  });
});

describe("cleanService unavailable path", () => {
  it("refuses to submit when results storage is failing (no job, honest message)", async () => {
    const { db, project } = await seedProject();
    const f = fakeFetch((url) => {
      if (url.includes("/clean/results/")) return new Response("Internal Server Error", { status: 500 });
      throw new Error(`unexpected ${url}`);
    });
    const client = new CleanClient({ fetchImpl: f });
    await expect(submitCleanPrediction(db, project.id, { client })).rejects.toBeInstanceOf(
      CleanUnavailableError,
    );
    await expect(submitCleanPrediction(db, project.id, { client })).rejects.toThrow(
      CLEAN_UNAVAILABLE_MESSAGE,
    );
    // No submit was attempted and no job recorded.
    expect(f.mock.calls.every((c) => !String(c[0]).endsWith("/clean/jobs"))).toBe(true);
    expect((await listCleanResults(db, project.id)).jobs).toHaveLength(0);
  });

  it("retries results twice ~30s apart after completion, then fails honestly", async () => {
    const { db, project } = await seedProject();
    let t = 5_000_000;
    const now = () => t;
    let resultsCalls = 0;
    const f = fakeFetch((url, init) => {
      if (url.endsWith("/clean/jobs") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { email: string; job_info: string };
        expect(body.email).toBe("");
        const info = JSON.parse(body.job_info) as { input_fasta: { header: string; sequence: string }[] };
        expect(info.input_fasta[0]).toEqual({ header: "1CA2_entity1", sequence: CA2 });
        return Response.json({ job_id: "mmli-1" }, { status: 201 });
      }
      if (url.endsWith("/clean/jobs/mmli-1")) return Response.json([{ phase: "completed" }]);
      if (url.endsWith("/clean/results/mmli-1")) {
        resultsCalls += 1;
        return new Response("Internal Server Error", { status: 500 });
      }
      throw new Error(`unexpected ${url}`);
    });
    const client = new CleanClient({ fetchImpl: f });
    const submitted = await submitCleanPrediction(db, project.id, {
      client,
      now,
      skipHealthCheck: true,
    });
    expect(submitted.pending).toBe(true);

    const p1 = await pollCleanJob(db, project.id, submitted.job.id, { client, now });
    expect(p1).toMatchObject({ pending: true, phase: "completed", nextCheckMs: 30_000 });
    expect(resultsCalls).toBe(1);

    // Too soon: no upstream call.
    t += 10_000;
    const early = await pollCleanJob(db, project.id, submitted.job.id, { client, now });
    expect(early.pending).toBe(true);
    expect(resultsCalls).toBe(1);

    t += 25_000;
    await pollCleanJob(db, project.id, submitted.job.id, { client, now });
    expect(resultsCalls).toBe(2);

    t += 31_000;
    await expect(
      pollCleanJob(db, project.id, submitted.job.id, { client, now }),
    ).rejects.toBeInstanceOf(CleanUnavailableError);
    expect(resultsCalls).toBe(3);

    const listed = await listCleanResults(db, project.id);
    expect(listed.jobs[0]!.status).toBe("failed");
    expect(listed.jobs[0]!.error).toContain(CLEAN_UNAVAILABLE_MESSAGE);
    expect(listed.latestNormalized).toBeNull();

    // Verdict is cached so the next submit is refused immediately.
    await expect(
      submitCleanPrediction(db, project.id, { client, now }),
    ).rejects.toBeInstanceOf(CleanUnavailableError);
  });

  it("stores real predictions once results come back", async () => {
    const { db, project } = await seedProject();
    let phaseCalls = 0;
    const f = fakeFetch((url, init) => {
      if (url.endsWith("/clean/jobs") && init?.method === "POST")
        return Response.json({ job_id: "mmli-2" }, { status: 201 });
      if (url.endsWith("/clean/jobs/mmli-2")) {
        phaseCalls += 1;
        return Response.json([{ phase: phaseCalls === 1 ? "processing" : "completed" }]);
      }
      if (url.endsWith("/clean/results/mmli-2"))
        return Response.json(
          JSON.stringify([
            { sequence: "1CA2_entity1", result: [{ ecNumber: "EC:4.2.1.1", score: 0.9 }] },
          ]),
        );
      throw new Error(`unexpected ${url}`);
    });
    const names = fakeFetch(() => new Response("ID   4.2.1.1\nDE   carbonic anhydrase.\n"));
    const client = new CleanClient({ fetchImpl: f });
    const submitted = await submitCleanPrediction(db, project.id, { client, skipHealthCheck: true });
    const running = await pollCleanJob(db, project.id, submitted.job.id, { client, enzymeNameFetch: names });
    expect(running).toMatchObject({ pending: true, phase: "processing" });
    const done = await pollCleanJob(db, project.id, submitted.job.id, { client, enzymeNameFetch: names });
    expect(done.pending).toBe(false);
    expect(done.normalized?.topPrediction).toMatchObject({
      ecNumber: "4.2.1.1",
      level: "High",
      enzymeName: "carbonic anhydrase",
    });
    const listed = await listCleanResults(db, project.id);
    expect(listed.latestNormalized?.kind).toBe("clean-live");
    expect(listed.jobs[0]!.status).toBe("succeeded");
  });

  it("fails honestly when CLEAN reports an error phase", async () => {
    const { db, project } = await seedProject();
    const f = fakeFetch((url, init) => {
      if (url.endsWith("/clean/jobs") && init?.method === "POST")
        return Response.json({ job_id: "mmli-3" }, { status: 201 });
      if (url.endsWith("/clean/jobs/mmli-3")) return Response.json([{ phase: "error" }]);
      throw new Error(`unexpected ${url}`);
    });
    const client = new CleanClient({ fetchImpl: f });
    const submitted = await submitCleanPrediction(db, project.id, { client, skipHealthCheck: true });
    await expect(pollCleanJob(db, project.id, submitted.job.id, { client })).rejects.toThrow(
      /reported "error"/,
    );
    expect((await listCleanResults(db, project.id)).jobs[0]!.status).toBe("failed");
  });
});
