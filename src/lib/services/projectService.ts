import type { AppDatabase } from "@/db/client";
import { moduleRuns, projects } from "@/db/schema";
import { createId, nowIso } from "@/lib/ids";
import { CURRICULUM_MODULES } from "@/modules/registry";
import { getProjectById, listProjects } from "@/lib/db/queries/projects";
import { listModuleRunsForProject } from "@/lib/db/queries/moduleRuns";
import { getStructureByProjectId } from "@/lib/db/queries/structures";
import type { Project } from "@/types/project";
import type { ModuleRun } from "@/types/moduleRun";
import type { PdbStructure } from "@/types/structure";

export class ServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export interface CreateProjectInput {
  name: string;
  studentId?: string | null;
}

export interface ProjectOverview {
  project: Project;
  structure: PdbStructure | null;
  moduleRuns: ModuleRun[];
}

export async function createProject(
  db: AppDatabase,
  input: CreateProjectInput,
): Promise<Project> {
  const timestamp = nowIso();
  const id = createId();

  await db.insert(projects).values({
    id,
    name: input.name,
    studentId: input.studentId?.trim() ? input.studentId.trim() : null,
    status: "active",
    isDemo: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  // Insert one row at a time — D1 rejects large multi-row inserts
  // ("too many SQL variables").
  for (const curriculumModule of CURRICULUM_MODULES) {
    await db.insert(moduleRuns).values({
      id: createId(),
      projectId: id,
      moduleId: curriculumModule.id,
      status: curriculumModule.implemented ? "not_started" : "not_available_yet",
      startedAt: null,
      completedAt: null,
      parametersJson: null,
      error: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  const created = await getProjectById(db, id);
  if (!created) {
    throw new ServiceError("Project could not be created.", 500);
  }
  return created;
}

export async function getProjectOverview(
  db: AppDatabase,
  projectId: string,
): Promise<ProjectOverview> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }

  const [structure, runs] = await Promise.all([
    getStructureByProjectId(db, projectId),
    listModuleRunsForProject(db, projectId),
  ]);

  return { project, structure, moduleRuns: runs };
}

export { listProjects };
