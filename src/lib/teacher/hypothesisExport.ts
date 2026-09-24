import { and, eq, inArray } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { hypotheses, projects, structures } from "@/db/schema";

export interface HypothesisExportRow {
  projectId: string;
  studentName: string | null;
  classCode: string | null;
  projectName: string;
  pdbId: string | null;
  /** Current (most recently saved) student-written hypothesis; null if none yet. */
  hypothesisText: string | null;
  lastUpdated: string | null;
}

function mapRow(row: {
  projects: typeof projects.$inferSelect;
  structures: typeof structures.$inferSelect | null;
  hypotheses: typeof hypotheses.$inferSelect | null;
}): HypothesisExportRow {
  return {
    projectId: row.projects.id,
    studentName: row.projects.studentName,
    classCode: row.projects.classCode,
    projectName: row.projects.name,
    pdbId: row.structures?.pdbId ?? null,
    hypothesisText: row.hypotheses?.text ?? null,
    lastUpdated: row.hypotheses?.updatedAt ?? null,
  };
}

/** Latest hypothesis per class-owned project for the given class codes. */
export async function listLatestHypotheses(
  db: AppDatabase,
  classCodes: string[],
): Promise<HypothesisExportRow[]> {
  if (classCodes.length === 0) return [];
  const rows = await db
    .select()
    .from(projects)
    .leftJoin(structures, eq(structures.projectId, projects.id))
    .leftJoin(hypotheses, eq(hypotheses.projectId, projects.id))
    .where(and(eq(projects.ownerType, "class"), inArray(projects.classCode, classCodes)))
    .orderBy(projects.classCode, projects.studentName, projects.name);
  return rows.map(mapRow);
}

export async function getLatestHypothesisForProject(
  db: AppDatabase,
  projectId: string,
): Promise<HypothesisExportRow | null> {
  const rows = await db
    .select()
    .from(projects)
    .leftJoin(structures, eq(structures.projectId, projects.id))
    .leftJoin(hypotheses, eq(hypotheses.projectId, projects.id))
    .where(eq(projects.id, projectId))
    .limit(1);
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

export const HYPOTHESIS_CSV_HEADER = [
  "Student name",
  "Class code",
  "Project name",
  "PDB ID",
  "Hypothesis",
  "Last updated",
];

/** RFC 4180 cell; also neutralizes spreadsheet formula injection (=,+,-,@). */
export function csvCell(value: string | null | undefined): string {
  let text = value ?? "";
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function hypothesesToCsv(rows: HypothesisExportRow[]): string {
  const lines = [HYPOTHESIS_CSV_HEADER.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.studentName,
        row.classCode,
        row.projectName,
        row.pdbId,
        row.hypothesisText ?? "(no hypothesis saved yet)",
        row.lastUpdated,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  // BOM so Excel opens UTF-8 names correctly.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function hypothesisToText(row: HypothesisExportRow): string {
  return [
    `Student: ${row.studentName ?? "—"}`,
    `Class code: ${row.classCode ?? "—"}`,
    `Project: ${row.projectName}`,
    `PDB ID: ${row.pdbId ?? "—"}`,
    `Last updated: ${row.lastUpdated ?? "—"}`,
    "",
    "Current hypothesis (student-written):",
    row.hypothesisText ?? "(no hypothesis saved yet)",
    "",
  ].join("\n");
}

export function safeFilename(text: string): string {
  return text.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "export";
}
