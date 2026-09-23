import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { moduleRuns, results, structures } from "@/db/schema";
import { createId, nowIso } from "@/lib/ids";
import { getProjectById } from "@/lib/db/queries/projects";
import { getStructureByProjectId } from "@/lib/db/queries/structures";
import { getModuleRun } from "@/lib/db/queries/moduleRuns";
import { validatePdbId } from "@/lib/validation/pdbId";
import { PDB_SETUP_MODULE_ID } from "@/modules/registry";
import type { PdbStructure } from "@/types/structure";
import { ServiceError } from "@/lib/services/projectService";
import {
  createRcsbDataAdapter,
  RcsbAdapterError,
  type RcsbNormalizedStructure,
} from "@/adapters/rcsb";

export async function saveStudentPdbId(
  db: AppDatabase,
  projectId: string,
  rawPdbId: string,
): Promise<PdbStructure> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }

  const validation = validatePdbId(rawPdbId);
  if (!validation.ok) {
    throw new ServiceError(validation.error, 400);
  }

  const existing = await getStructureByProjectId(db, projectId);
  const timestamp = nowIso();

  if (existing) {
    await db
      .update(structures)
      .set({
        pdbId: validation.pdbId,
        source: project.isDemo ? "demo" : "student_input",
        title: null,
        organism: null,
        chainsJson: null,
        sequence: null,
        metadataJson: null,
        retrievedAt: null,
        updatedAt: timestamp,
      })
      .where(eq(structures.id, existing.id));
  } else {
    await db.insert(structures).values({
      id: createId(),
      projectId,
      pdbId: validation.pdbId,
      title: null,
      organism: null,
      chainsJson: null,
      sequence: null,
      metadataJson: null,
      source: project.isDemo ? "demo" : "student_input",
      retrievedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  const run = await getModuleRun(db, projectId, PDB_SETUP_MODULE_ID);
  if (run && run.status === "not_started") {
    await db
      .update(moduleRuns)
      .set({
        status: "in_progress",
        startedAt: timestamp,
        updatedAt: timestamp,
      })
      .where(eq(moduleRuns.id, run.id));
  }

  const saved = await getStructureByProjectId(db, projectId);
  if (!saved) {
    throw new ServiceError("Structure could not be saved.", 500);
  }
  return saved;
}

export interface FetchRcsbResult {
  structure: PdbStructure;
  normalized: RcsbNormalizedStructure;
}

function mapRcsbError(error: unknown): never {
  if (error instanceof RcsbAdapterError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "TIMEOUT" || error.code === "NETWORK"
          ? 502
          : 400;
    throw new ServiceError(error.message, status);
  }
  throw error;
}

/**
 * Retrieves verified metadata from the RCSB PDB Data API and persists it.
 * Does not invent title/organism/sequence when RCSB fails.
 */
export async function fetchAndSaveRcsbStructure(
  db: AppDatabase,
  projectId: string,
  rawPdbId?: string,
): Promise<FetchRcsbResult> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }

  const existing = await getStructureByProjectId(db, projectId);
  const pdbInput = rawPdbId ?? existing?.pdbId;
  if (!pdbInput) {
    throw new ServiceError(
      "Save a PDB identifier before retrieving RCSB metadata.",
      400,
    );
  }

  const validation = validatePdbId(pdbInput);
  if (!validation.ok) {
    throw new ServiceError(validation.error, 400);
  }

  const adapter = createRcsbDataAdapter();
  let normalized: RcsbNormalizedStructure;
  let raw: Awaited<ReturnType<typeof adapter.run>>;
  try {
    raw = await adapter.run({ pdbId: validation.pdbId });
    normalized = adapter.normalize(raw);
  } catch (error) {
    mapRcsbError(error);
  }

  const timestamp = nowIso();
  const metadata = {
    experimentalMethod: normalized.experimentalMethod,
    resolutionAngstrom: normalized.resolutionAngstrom,
    polymerEntities: normalized.polymerEntities,
    structureCifUrl: normalized.structureCifUrl,
    structurePdbUrl: normalized.structurePdbUrl,
    entryPageUrl: normalized.entryPageUrl,
    provenance: normalized.provenance,
  };

  if (existing) {
    await db
      .update(structures)
      .set({
        pdbId: normalized.pdbId,
        title: normalized.title,
        organism: normalized.organism,
        chainsJson: JSON.stringify(normalized.chains),
        sequence: normalized.sequence,
        metadataJson: JSON.stringify(metadata),
        source: "rcsb",
        retrievedAt: normalized.provenance.retrievedAt,
        updatedAt: timestamp,
      })
      .where(eq(structures.id, existing.id));
  } else {
    await db.insert(structures).values({
      id: createId(),
      projectId,
      pdbId: normalized.pdbId,
      title: normalized.title,
      organism: normalized.organism,
      chainsJson: JSON.stringify(normalized.chains),
      sequence: normalized.sequence,
      metadataJson: JSON.stringify(metadata),
      source: "rcsb",
      retrievedAt: normalized.provenance.retrievedAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  const run = await getModuleRun(db, projectId, PDB_SETUP_MODULE_ID);
  if (run) {
    await db
      .update(moduleRuns)
      .set({
        status: run.status === "complete" ? "complete" : "in_progress",
        startedAt: run.startedAt ?? timestamp,
        parametersJson: JSON.stringify({ pdbId: normalized.pdbId }),
        error: null,
        updatedAt: timestamp,
      })
      .where(eq(moduleRuns.id, run.id));

    const rawResultId = createId();
    const provenance = {
      ...normalized.provenance,
      rawResultId,
    };

    await db.insert(results).values([
      {
        id: rawResultId,
        moduleRunId: run.id,
        type: "raw",
        rawDataJson: JSON.stringify(raw),
        normalizedDataJson: null,
        source: "rcsb",
        provenanceJson: JSON.stringify(provenance),
        isDemo: project.isDemo,
        createdAt: timestamp,
      },
      {
        id: createId(),
        moduleRunId: run.id,
        type: "normalized",
        rawDataJson: null,
        normalizedDataJson: JSON.stringify(normalized),
        source: "rcsb",
        provenanceJson: JSON.stringify(provenance),
        isDemo: project.isDemo,
        createdAt: timestamp,
      },
    ]);
  }

  const structure = await getStructureByProjectId(db, projectId);
  if (!structure) {
    throw new ServiceError("Structure could not be saved after RCSB fetch.", 500);
  }

  return { structure, normalized };
}
