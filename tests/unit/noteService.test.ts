import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/db";
import { addModuleNote, listNotesForModule } from "@/lib/services/noteService";
import { createProject } from "@/lib/services/projectService";
import { PDB_SETUP_MODULE_ID } from "@/modules/registry";

describe("noteService", () => {
  it("stores student observations on a module", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "Notes test" });
    await addModuleNote(db, project.id, PDB_SETUP_MODULE_ID, "The ID looks valid.");
    const notes = await listNotesForModule(db, project.id, PDB_SETUP_MODULE_ID);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.content).toBe("The ID looks valid.");
  });
});
