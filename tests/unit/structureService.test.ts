import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/db";
import { createProject } from "@/lib/services/projectService";
import { saveStudentPdbId } from "@/lib/services/structureService";
import { ServiceError } from "@/lib/services/projectService";

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
});
