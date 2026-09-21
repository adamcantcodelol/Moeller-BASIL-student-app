import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { getModuleRun } from "@/lib/db/queries/moduleRuns";
import {
  assertModuleAccessible,
  completePdbSetup,
} from "@/lib/services/moduleRunService";
import { completePdbSetupSchema } from "@/lib/validation/project";
import { PDB_SETUP_MODULE_ID } from "@/modules/registry";

export const dynamic = "force-dynamic";

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
    if (definition.id !== PDB_SETUP_MODULE_ID) {
      return jsonError(
        "This module is not implemented yet and cannot be marked complete.",
        400,
      );
    }
    const body = await request.json();
    const parsed = completePdbSetupSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Send { \"complete\": true } to finish PDB Setup.", 400);
    }
    const db = await getRequestDatabase();
    const run = await completePdbSetup(db, projectId);
    return Response.json({ run });
  } catch (error) {
    return handleServiceError(error);
  }
}
