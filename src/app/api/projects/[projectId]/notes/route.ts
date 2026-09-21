import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError, jsonError } from "@/lib/http";
import { addModuleNote, listNotesForModule } from "@/lib/services/noteService";
import { noteInputSchema } from "@/lib/validation/project";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const moduleId = new URL(request.url).searchParams.get("moduleId");
    if (!moduleId) {
      return jsonError("moduleId query parameter is required.", 400);
    }
    const db = await getRequestDatabase();
    const notes = await listNotesForModule(db, projectId, moduleId);
    return Response.json({ notes });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const parsed = noteInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid note." },
        { status: 400 },
      );
    }
    const db = await getRequestDatabase();
    const note = await addModuleNote(
      db,
      projectId,
      parsed.data.moduleId,
      parsed.data.content,
    );
    return Response.json({ note }, { status: 201 });
  } catch (error) {
    return handleServiceError(error);
  }
}
