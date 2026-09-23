import type { Project } from "@/types/project";
import type { PdbStructure } from "@/types/structure";
import type { ModuleRun } from "@/types/moduleRun";
import type { Note } from "@/types/note";
import type { ScientificResult } from "@/types/result";
import type { ScientificJob } from "@/types/scientificJob";
import type { Provenance } from "@/types/provenance";
import { parseJson } from "@/lib/ids";
import type { InferSelectModel } from "drizzle-orm";
import {
  evidence,
  moduleRuns,
  notes,
  projects,
  results,
  scientificJobs,
  structures,
} from "@/db/schema";
import type { Evidence, EvidenceResidue, EvidenceStrength } from "@/types/evidence";

export function mapProject(row: InferSelectModel<typeof projects>): Project {
  return {
    id: row.id,
    name: row.name,
    studentId: row.studentId,
    status: row.status as Project["status"],
    isDemo: Boolean(row.isDemo),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapStructure(
  row: InferSelectModel<typeof structures>,
): PdbStructure {
  return {
    id: row.id,
    projectId: row.projectId,
    pdbId: row.pdbId,
    title: row.title,
    organism: row.organism,
    chains: parseJson<string[] | null>(row.chainsJson, null),
    sequence: row.sequence,
    metadata: parseJson<Record<string, unknown> | null>(row.metadataJson, null),
    source: row.source as PdbStructure["source"],
    retrievedAt: row.retrievedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapModuleRun(
  row: InferSelectModel<typeof moduleRuns>,
): ModuleRun {
  return {
    id: row.id,
    projectId: row.projectId,
    moduleId: row.moduleId,
    status: row.status as ModuleRun["status"],
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    parameters: parseJson<Record<string, unknown> | null>(
      row.parametersJson,
      null,
    ),
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapNote(row: InferSelectModel<typeof notes>): Note {
  return {
    id: row.id,
    projectId: row.projectId,
    moduleId: row.moduleId,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapResultRow(
  row: InferSelectModel<typeof results>,
): ScientificResult {
  return {
    id: row.id,
    moduleRunId: row.moduleRunId,
    type: row.type as ScientificResult["type"],
    rawData: parseJson<unknown | null>(row.rawDataJson, null),
    normalizedData: parseJson<unknown | null>(row.normalizedDataJson, null),
    source: row.source,
    provenance: parseJson<Provenance | null>(row.provenanceJson, null),
    isDemo: Boolean(row.isDemo),
    createdAt: row.createdAt,
  };
}

export function mapScientificJob(
  row: InferSelectModel<typeof scientificJobs>,
): ScientificJob {
  return {
    id: row.id,
    moduleRunId: row.moduleRunId,
    tool: row.tool,
    status: row.status as ScientificJob["status"],
    mode: row.mode as ScientificJob["mode"],
    parameters: parseJson<Record<string, unknown> | null>(
      row.parametersJson,
      null,
    ),
    error: row.error,
    cacheHit: Boolean(row.cacheHit),
    resultId: row.resultId,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}


export function mapEvidence(row: InferSelectModel<typeof evidence>): Evidence {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type,
    description: row.description,
    sourceResultId: row.sourceResultId,
    sourceModuleId: row.sourceModuleId ?? null,
    residues: parseJson<EvidenceResidue[] | null>(row.residuesJson, null),
    strength: (row.strength as EvidenceStrength | null) ?? null,
    provenance: parseJson<Provenance | null>(row.provenanceJson, null),
    isDemo: Boolean(row.isDemo),
    createdAt: row.createdAt,
  };
}
