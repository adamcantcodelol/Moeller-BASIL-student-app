import type { Project } from "@/types/project";
import type { PdbStructure } from "@/types/structure";
import type { ModuleRun } from "@/types/moduleRun";
import type { Note } from "@/types/note";
import { parseJson } from "@/lib/ids";
import type { InferSelectModel } from "drizzle-orm";
import {
  moduleRuns,
  notes,
  projects,
  structures,
} from "@/db/schema";

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
