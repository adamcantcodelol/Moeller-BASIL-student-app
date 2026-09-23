import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createTestDatabase } from "../helpers/db";
import { createProject } from "@/lib/services/projectService";
import {
  fetchAndSaveRcsbStructure,
  saveStudentPdbId,
} from "@/lib/services/structureService";
import { completePdbSetup } from "@/lib/services/moduleRunService";
import { ServiceError } from "@/lib/services/projectService";
import { getModuleRun } from "@/lib/db/queries/moduleRuns";
import type { RcsbRawPayload } from "@/adapters/rcsb/types";

const rcsbFixture = JSON.parse(
  readFileSync("tests/fixtures/rcsb-4hhb.json", "utf8"),
) as RcsbRawPayload;

async function stubRcsbFetch() {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/entry/4HHB")) {
      return Response.json(rcsbFixture.entry);
    }
    if (url.includes("/polymer_entity/4HHB/1")) {
      return Response.json(rcsbFixture.polymerEntities[0]);
    }
    if (url.includes("/polymer_entity/4HHB/2")) {
      return Response.json(rcsbFixture.polymerEntities[1]);
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchImpl);
}

describe("moduleRunService", () => {
  it("completes PDB Setup only after RCSB metadata is retrieved", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "Completion test" });

    await expect(completePdbSetup(db, project.id)).rejects.toBeInstanceOf(
      ServiceError,
    );

    await saveStudentPdbId(db, project.id, "4hhb");
    await expect(completePdbSetup(db, project.id)).rejects.toBeInstanceOf(
      ServiceError,
    );

    await stubRcsbFetch();
    await fetchAndSaveRcsbStructure(db, project.id);
    const run = await completePdbSetup(db, project.id);
    expect(run.status).toBe("complete");
    vi.unstubAllGlobals();
  });

  it("opens all curriculum modules as not_started once implemented", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "Phase guard" });
    const blast = await getModuleRun(db, project.id, "blast");
    const hypothesis = await getModuleRun(db, project.id, "hypothesis-builder");
    expect(blast?.status).toBe("not_started");
    expect(hypothesis?.status).toBe("not_started");
  });
});
