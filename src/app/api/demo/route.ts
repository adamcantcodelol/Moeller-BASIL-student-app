import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError } from "@/lib/http";
import { ensureDemoProject } from "@/lib/services/demoService";
import { DEMO_PROJECT_ID } from "@/types/demo";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const db = await getRequestDatabase();
    await ensureDemoProject(db);
    return Response.json({
      projectId: DEMO_PROJECT_ID,
      demoLabel: "DEMO DATA",
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
