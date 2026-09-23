import { desc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { hypotheses, hypothesisVersions, moduleRuns } from "@/db/schema";
import { createId, nowIso } from "@/lib/ids";
import { getProjectById } from "@/lib/db/queries/projects";
import { getModuleRun } from "@/lib/db/queries/moduleRuns";
import { ServiceError } from "@/lib/services/projectService";
import { reviewStudentHypothesis } from "@/lib/hypothesis/reviewHypothesis";
import type {
  Hypothesis,
  HypothesisReview,
  HypothesisVersion,
} from "@/types/hypothesis";
import { listEvidenceForProject } from "@/lib/services/evidenceService";

function mapHypothesis(row: typeof hypotheses.$inferSelect): Hypothesis {
  return {
    id: row.id,
    projectId: row.projectId,
    text: row.text,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapVersion(row: typeof hypothesisVersions.$inferSelect): HypothesisVersion {
  return {
    id: row.id,
    hypothesisId: row.hypothesisId,
    text: row.text,
    reasonForChange: row.reasonForChange,
    createdAt: row.createdAt,
  };
}

export async function getHypothesisForProject(
  db: AppDatabase,
  projectId: string,
): Promise<{
  hypothesis: Hypothesis | null;
  versions: HypothesisVersion[];
  review: HypothesisReview | null;
}> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }
  const rows = await db
    .select()
    .from(hypotheses)
    .where(eq(hypotheses.projectId, projectId))
    .limit(1);
  if (rows.length === 0) {
    return { hypothesis: null, versions: [], review: null };
  }
  const hypothesis = mapHypothesis(rows[0]);
  const versionRows = await db
    .select()
    .from(hypothesisVersions)
    .where(eq(hypothesisVersions.hypothesisId, hypothesis.id))
    .orderBy(desc(hypothesisVersions.createdAt));
  return {
    hypothesis,
    versions: versionRows.map(mapVersion),
    review: reviewStudentHypothesis(hypothesis.text),
  };
}

/**
 * Saves student-authored hypothesis text only. Never generates hypothesis content.
 */
export async function saveHypothesis(
  db: AppDatabase,
  projectId: string,
  input: { text: string; reasonForChange?: string },
): Promise<{
  hypothesis: Hypothesis;
  review: HypothesisReview;
}> {
  const project = await getProjectById(db, projectId);
  if (!project) {
    throw new ServiceError("Project not found.", 404);
  }
  const text = input.text?.trim() ?? "";
  if (!text) {
    throw new ServiceError(
      "Hypothesis text is required. The platform will not write it for you.",
      400,
    );
  }

  const timestamp = nowIso();
  const existing = await db
    .select()
    .from(hypotheses)
    .where(eq(hypotheses.projectId, projectId))
    .limit(1);

  let hypothesis: Hypothesis;
  if (existing.length === 0) {
    const id = createId();
    await db.insert(hypotheses).values({
      id,
      projectId,
      text,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await db.insert(hypothesisVersions).values({
      id: createId(),
      hypothesisId: id,
      text,
      reasonForChange: input.reasonForChange?.trim() || "initial",
      createdAt: timestamp,
    });
    hypothesis = {
      id,
      projectId,
      text,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  } else {
    const row = existing[0];
    await db
      .update(hypotheses)
      .set({ text, updatedAt: timestamp })
      .where(eq(hypotheses.id, row.id));
    await db.insert(hypothesisVersions).values({
      id: createId(),
      hypothesisId: row.id,
      text,
      reasonForChange: input.reasonForChange?.trim() || null,
      createdAt: timestamp,
    });
    hypothesis = {
      id: row.id,
      projectId,
      text,
      createdAt: row.createdAt,
      updatedAt: timestamp,
    };
  }

  const run = await getModuleRun(db, projectId, "hypothesis-builder");
  if (run && run.status !== "complete") {
    await db
      .update(moduleRuns)
      .set({
        status: "in_progress",
        startedAt: run.startedAt ?? timestamp,
        error: null,
        updatedAt: timestamp,
      })
      .where(eq(moduleRuns.id, run.id));
  }

  return { hypothesis, review: reviewStudentHypothesis(text) };
}

export async function completeHypothesisModule(
  db: AppDatabase,
  projectId: string,
): Promise<{ runId: string; status: string }> {
  const { hypothesis, review } = await getHypothesisForProject(db, projectId);
  if (!hypothesis) {
    throw new ServiceError(
      "Save your own hypothesis before completing this module. The platform will not write it for you.",
      400,
    );
  }
  const evidence = await listEvidenceForProject(db, projectId);
  if (evidence.length === 0) {
    throw new ServiceError(
      "Record active-site evidence before completing the hypothesis module so claims can be checked against residues you entered.",
      400,
    );
  }
  const failed = review?.checks.filter((check) => !check.passed) ?? [];
  if (failed.length > 0) {
    throw new ServiceError(
      `Strengthen your hypothesis first: ${failed.map((check) => check.label).join(", ")}.`,
      400,
    );
  }

  const run = await getModuleRun(db, projectId, "hypothesis-builder");
  if (!run) {
    throw new ServiceError("Hypothesis module run is missing.", 500);
  }
  const timestamp = nowIso();
  await db
    .update(moduleRuns)
    .set({
      status: "complete",
      completedAt: timestamp,
      startedAt: run.startedAt ?? timestamp,
      error: null,
      updatedAt: timestamp,
    })
    .where(eq(moduleRuns.id, run.id));
  return { runId: run.id, status: "complete" };
}
