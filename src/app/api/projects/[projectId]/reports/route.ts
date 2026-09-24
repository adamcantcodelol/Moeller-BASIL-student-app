import { getProjectDatabase } from "@/lib/db/request";
import { handleServiceError } from "@/lib/http";
import { generateReports, listReports } from "@/lib/services/reportService";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getProjectDatabase(projectId);
    return Response.json({ reports: await listReports(db, projectId) });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getProjectDatabase(projectId);
    return Response.json(await generateReports(db, projectId));
  } catch (error) {
    return handleServiceError(error);
  }
}
