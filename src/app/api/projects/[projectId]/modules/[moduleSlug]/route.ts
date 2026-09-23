import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { getModuleRun } from "@/lib/db/queries/moduleRuns";
import {
  assertModuleAccessible,
  completePdbSetup,
} from "@/lib/services/moduleRunService";
import { completeImportModule } from "@/lib/services/importToolService";
import { completeInterProModule } from "@/lib/services/interproService";
import { completeFoldseekModule } from "@/lib/services/foldseekService";
import { completeActiveSiteModule } from "@/lib/services/evidenceService";
import { completeHypothesisModule } from "@/lib/services/hypothesisService";
import { completeShannonBotModule } from "@/lib/services/shannonBotService";
import { completePdbSetupSchema } from "@/lib/validation/project";
import { PDB_SETUP_MODULE_ID } from "@/modules/registry";

export const dynamic = "force-dynamic";

const IMPORT_COMPLETE_SLUGS = new Set([
  "sprite",
  "blast",
  "clean",
  "dali",
  "swissdock",
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; moduleSlug: string }> },
) {
  try {
    const { projectId, moduleSlug } = await context.params;
    const definition = await assertModuleAccessible(moduleSlug);
    const db = await getRequestDatabase();
    const run = await getModuleRun(db, projectId, definition.id);
    return Response.json({ module: definition, run });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; moduleSlug: string }> },
) {
  try {
    const { projectId, moduleSlug } = await context.params;
    const definition = await assertModuleAccessible(moduleSlug);
    const body = await request.json();
    const parsed = completePdbSetupSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Send { "complete": true } to finish this module.', 400);
    }

    const db = await getRequestDatabase();

    if (definition.id === PDB_SETUP_MODULE_ID) {
      const run = await completePdbSetup(db, projectId);
      return Response.json({ run });
    }
    if (definition.id === "interpro") {
      return Response.json(await completeInterProModule(db, projectId));
    }
    if (definition.id === "foldseek") {
      return Response.json(await completeFoldseekModule(db, projectId));
    }
    if (definition.id === "active-site-evidence") {
      return Response.json(await completeActiveSiteModule(db, projectId));
    }
    if (definition.id === "hypothesis-builder") {
      return Response.json(await completeHypothesisModule(db, projectId));
    }
    if (definition.id === "shannonbot-review") {
      return Response.json(await completeShannonBotModule(db, projectId));
    }
    if (IMPORT_COMPLETE_SLUGS.has(definition.slug)) {
      return Response.json(
        await completeImportModule(db, projectId, definition.slug),
      );
    }

    return jsonError(
      "This module is not implemented yet and cannot be marked complete.",
      400,
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
    }
    return handleServiceError(error);
  }
}
