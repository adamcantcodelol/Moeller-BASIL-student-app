import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createTestDatabase } from "../helpers/db";
import { createProject, ServiceError } from "@/lib/services/projectService";
import {
  fetchAndSaveRcsbStructure,
  saveStudentPdbId,
} from "@/lib/services/structureService";
import type { RcsbRawPayload } from "@/adapters/rcsb/types";

const rcsbFixture = JSON.parse(
  readFileSync("tests/fixtures/rcsb-4hhb.json", "utf8"),
) as RcsbRawPayload;

describe("structureService", () => {
  it("stores a student PDB ID without filling biological metadata", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "Structure test" });
    const structure = await saveStudentPdbId(db, project.id, "1tim");

    expect(structure.pdbId).toBe("1TIM");
    expect(structure.source).toBe("student_input");
    expect(structure.title).toBeNull();
    expect(structure.organism).toBeNull();
    expect(structure.sequence).toBeNull();
    expect(structure.retrievedAt).toBeNull();
  });

  it("rejects invalid PDB IDs", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "Invalid PDB" });
    await expect(saveStudentPdbId(db, project.id, "nope")).rejects.toBeInstanceOf(
      ServiceError,
    );
  });

  it("persists RCSB metadata with provenance and rcsb source", async () => {
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

    const db = await createTestDatabase();
    const project = await createProject(db, { name: "RCSB fetch test" });
    await saveStudentPdbId(db, project.id, "4HHB");
    const { structure, normalized } = await fetchAndSaveRcsbStructure(
      db,
      project.id,
    );

    expect(structure.source).toBe("rcsb");
    expect(structure.retrievedAt).toBeTruthy();
    expect(structure.title).toBe(normalized.title);
    expect(structure.organism).toMatch(/Homo sapiens/i);
    expect(structure.metadata?.provenance).toBeTruthy();

    vi.unstubAllGlobals();
  });
});
