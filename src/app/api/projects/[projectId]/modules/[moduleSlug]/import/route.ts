import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { importToolResults } from "@/lib/services/importToolService";
import { IMPORT_FORMATS, type ImportFormat } from "@/types/importWorkflow";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; moduleSlug: string }> },
) {
  try {
    const { projectId, moduleSlug } = await context.params;
    const body = (await request.json()) as {
      format?: string;
      content?: string;
      notes?: string;
    };
    if (!body.content || typeof body.content !== "string") {
      return jsonError("Import requires non-empty content.", 400);
    }
    if (!body.format || !IMPORT_FORMATS.includes(body.format as ImportFormat)) {
      return jsonError(
        `Import format must be one of: ${IMPORT_FORMATS.join(", ")}.`,
        400,
      );
    }
    const db = await getRequestDatabase();
    const result = await importToolResults(db, projectId, moduleSlug, {
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
