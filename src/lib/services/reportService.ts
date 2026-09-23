import { desc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { moduleRuns, reports } from "@/db/schema";
import { createId, nowIso } from "@/lib/ids";
import { getProjectOverview } from "@/lib/services/projectService";
import { getModuleRun } from "@/lib/db/queries/moduleRuns";
import { listEvidenceForProject } from "@/lib/services/evidenceService";
import { getHypothesisForProject } from "@/lib/services/hypothesisService";
import {
  buildStudentReportMarkdown,
  buildTeacherReportMarkdown,
} from "@/lib/reports/buildReport";

export interface StoredReport {
  id: string;
  projectId: string;
  type: "student" | "teacher";
  content: string;
  createdAt: string;
}

export async function generateReports(
  db: AppDatabase,
  projectId: string,
): Promise<{ student: StoredReport; teacher: StoredReport }> {
  const overview = await getProjectOverview(db, projectId);
  const evidence = await listEvidenceForProject(db, projectId);
  const { hypothesis } = await getHypothesisForProject(db, projectId);

  const payload = {
    project: overview.project,
    structure: overview.structure,
    moduleRuns: overview.moduleRuns,
    evidence,
    hypothesis,
  };

  const studentMarkdown = buildStudentReportMarkdown(payload);
  const teacherMarkdown = buildTeacherReportMarkdown(payload);
  const timestamp = nowIso();

  const studentId = createId();
  const teacherId = createId();
  await db.insert(reports).values([
    {
      id: studentId,
      projectId,
      type: "student",
      fileReference: studentMarkdown,
      createdAt: timestamp,
    },
    {
      id: teacherId,
      projectId,
      type: "teacher",
      fileReference: teacherMarkdown,
      createdAt: timestamp,
    },
  ]);

  const run = await getModuleRun(db, projectId, "reports");
  if (run) {
    await db
      .update(moduleRuns)
      .set({
        status: "complete",
        startedAt: run.startedAt ?? timestamp,
        completedAt: timestamp,
        error: null,
        updatedAt: timestamp,
      })
      .where(eq(moduleRuns.id, run.id));
  }

  return {
    student: {
      id: studentId,
      projectId,
      type: "student",
      content: studentMarkdown,
      createdAt: timestamp,
    },
    teacher: {
      id: teacherId,
      projectId,
      type: "teacher",
      content: teacherMarkdown,
      createdAt: timestamp,
    },
  };
}

export async function listReports(
  db: AppDatabase,
  projectId: string,
): Promise<StoredReport[]> {
  await getProjectOverview(db, projectId);
  const rows = await db
    .select()
    .from(reports)
    .where(eq(reports.projectId, projectId))
    .orderBy(desc(reports.createdAt));
  return rows.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    type: row.type as "student" | "teacher",
    content: row.fileReference ?? "",
    createdAt: row.createdAt,
  }));
}
