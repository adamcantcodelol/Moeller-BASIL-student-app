import { readFileSync } from "node:fs";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "../helpers/db";
import { createProject } from "@/lib/services/projectService";
import {
  completeInterProModule,
  fetchAndSaveInterProAnnotations,
  importInterProResults,
  listInterProResults,
} from "@/lib/services/interproService";
import type { InterProRawPayload } from "@/adapters/interpro";

const fixture = JSON.parse(
  readFileSync("tests/fixtures/interpro-p04637.json", "utf8"),
) as InterProRawPayload;

describe("interproService", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/entry/interpro/protein/uniprot/P04637")) {
          return Response.json(fixture.entries);
        }
        if (url.includes("/protein/uniprot/P04637")) {
          return Response.json(fixture.protein);
        }
        return new Response(null, { status: 204 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores raw + normalized results with job success", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "InterPro live" });

    const result = await fetchAndSaveInterProAnnotations(
      db,
      project.id,
      "P04637",
    );
    expect(result.job.status).toBe("succeeded");
    expect(result.normalized.uniprotAccession).toBe("P04637");
    expect(result.cacheHit).toBe(false);

    const listed = await listInterProResults(db, project.id);
    expect(listed.latestNormalized?.entries.length).toBeGreaterThan(0);
    expect(listed.results.some((row) => row.type === "raw")).toBe(true);
    expect(listed.results.some((row) => row.type === "normalized")).toBe(true);

    const completed = await completeInterProModule(db, project.id);
    expect(completed.status).toBe("complete");
  });

  it("supports import fallback without inventing normalized science", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "InterPro import" });

    const imported = await importInterProResults(db, project.id, {
      format: "json",
      content: JSON.stringify({ note: "legitimate export placeholder" }),
      notes: "Exported from InterPro website",
    });
    expect(imported.job.status).toBe("succeeded");
    expect(imported.job.mode).toBe("import");

    const listed = await listInterProResults(db, project.id);
    const rawImport = listed.results.find((row) => row.source === "import");
    expect(rawImport).toBeTruthy();
    expect(rawImport?.type).toBe("raw");
  });
});
