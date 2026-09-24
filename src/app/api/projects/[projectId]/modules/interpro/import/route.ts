import { getProjectDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { importInterProResults } from "@/lib/services/interproService";
import { IMPORT_FORMATS, type ImportFormat } from "@/types/importWorkflow";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as {
      format?: string;
      content?: string;
      notes?: string;
    };

    if (!body.content || typeof body.content !== "string") {
      return jsonError(
        "Import requires non-empty content from a legitimate InterPro / InterProScan export.",
        400,
      );
    }
    if (
      !body.format ||
      !IMPORT_FORMATS.includes(body.format as ImportFormat)
    ) {
      return jsonError(
        `Import format must be one of: ${IMPORT_FORMATS.join(", ")}.`,
        400,
      );
    }

    const db = await getProjectDatabase(projectId);
    const result = await importInterProResults(db, projectId, {
      format: body.format as ImportFormat,
      content: body.content,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
    }
    return handleServiceError(error);
  }
}
