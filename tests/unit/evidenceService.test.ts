import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/db";
import { createProject } from "@/lib/services/projectService";
import {
  completeActiveSiteModule,
  createEvidenceRecord,
  listEvidenceForProject,
} from "@/lib/services/evidenceService";
import { ServiceError } from "@/lib/services/projectService";

describe("evidenceService", () => {
  it("stores student evidence residues with module provenance", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "Evidence" });

    const created = await createEvidenceRecord(db, project.id, {
      type: "domain_residue",
      description: "InterPro domain covers catalytic histidine region",
      sourceModuleId: "interpro",
      strength: "supporting",
      residues: [{ chain: "A", position: 57, aminoAcid: "H" }],
    });

    expect(created.sourceModuleId).toBe("interpro");
    expect(created.residues?.[0]?.position).toBe(57);
    expect(created.provenance?.source).toBe("student_observation");

    const listed = await listEvidenceForProject(db, project.id);
    expect(listed).toHaveLength(1);

    const completed = await completeActiveSiteModule(db, project.id);
    expect(completed.status).toBe("complete");
  });

  it("refuses empty residues instead of inventing them", async () => {
    const db = await createTestDatabase();
    const project = await createProject(db, { name: "No invent" });
    await expect(
      createEvidenceRecord(db, project.id, {
        type: "guess",
        description: "no residues",
        sourceModuleId: "blast",
        residues: [],
      }),
    ).rejects.toBeInstanceOf(ServiceError);
  });
});
