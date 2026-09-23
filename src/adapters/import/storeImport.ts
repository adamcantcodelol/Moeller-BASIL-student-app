import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { moduleRuns, results } from "@/db/schema";
import { createId, nowIso } from "@/lib/ids";
import { buildImportProvenance, withRawResultId } from "@/lib/provenance/buildProvenance";
import { ScientificError } from "@/adapters/errors";
import { getImportWorkflow } from "@/adapters/import/workflows";
import type { ImportPayload } from "@/types/importWorkflow";
import type { ScientificResult } from "@/types/result";
import { mapResultRow } from "@/lib/db/mappers";

export interface StoreImportOptions {
  moduleRunId: string;
  payload: ImportPayload;
  isDemo: boolean;
}

export interface StoreImportResult {
  rawResult: ScientificResult;
  provenanceSource: "import";
}

/**
 * Persists a student-imported raw scientific payload.
 * Phase 3 does not invent normalized scientific fields from imports.
 */
export async function storeImportedRawResult(
  db: AppDatabase,
  options: StoreImportOptions,
): Promise<StoreImportResult> {
  const workflow = getImportWorkflow(options.payload.tool);
  if (!workflow) {
    throw new ScientificError(
      "IMPORT_INVALID",
      `No import workflow is registered for tool "${options.payload.tool}".`,
    );
  }

  const validation = workflow.validateFormat(options.payload);
  if (!validation.ok) {
    throw new ScientificError(
      "IMPORT_INVALID",
      validation.errors.join(" "),
    );
  }

  const runRows = await db
    .select()
    .from(moduleRuns)
    .where(eq(moduleRuns.id, options.moduleRunId))
    .limit(1);
  if (runRows.length === 0) {
    throw new ScientificError(
      "JOB",
      `Module run ${options.moduleRunId} was not found for import.`,
    );
  }

  const timestamp = nowIso();
  const rawResultId = createId();
  const provenance = withRawResultId(
    buildImportProvenance({
      tool: workflow.tool,
      format: options.payload.format,
      parameters: {
        notes: options.payload.notes ?? null,
        contentLength: options.payload.content.length,
      },
      rawResultId,
    }),
    rawResultId,
  );

  await db.insert(results).values({
    id: rawResultId,
    moduleRunId: options.moduleRunId,
    type: "raw",
    rawDataJson: JSON.stringify({
      format: options.payload.format,
      content: options.payload.content,
      notes: options.payload.notes ?? null,
    }),
    normalizedDataJson: null,
    source: "import",
    provenanceJson: JSON.stringify(provenance),
    isDemo: options.isDemo,
    createdAt: timestamp,
  });

  await db
    .update(moduleRuns)
    .set({
      status:
        runRows[0].status === "not_available_yet"
          ? "not_available_yet"
          : "in_progress",
      startedAt: runRows[0].startedAt ?? timestamp,
      error: null,
      updatedAt: timestamp,
    })
    .where(eq(moduleRuns.id, options.moduleRunId));

  const inserted = await db
    .select()
    .from(results)
    .where(eq(results.id, rawResultId))
    .limit(1);

  return {
    rawResult: mapResultRow(inserted[0]),
    provenanceSource: "import",
  };
}
