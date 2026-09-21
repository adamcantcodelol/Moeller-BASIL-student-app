import { getRequestDatabase } from "@/lib/db/request";
import { handleServiceError } from "@/lib/http";
import { createProject, listProjects } from "@/lib/services/projectService";
import { createProjectInputSchema } from "@/lib/validation/project";
import { validatePdbId } from "@/lib/validation/pdbId";
import { saveStudentPdbId } from "@/lib/services/structureService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getRequestDatabase();
    const projects = await listProjects(db);
    return Response.json({
      projects: projects.map((project) => ({
        ...project,
        demoLabel: project.isDemo ? "DEMO DATA" : null,
      })),
    });
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createProjectInputSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid project input." },
        { status: 400 },
      );
    }

    const db = await getRequestDatabase();
    const project = await createProject(db, {
      name: parsed.data.name,
      studentId: parsed.data.studentId ?? null,
    });

    if (parsed.data.pdbId) {
      const pdb = validatePdbId(parsed.data.pdbId);
      if (!pdb.ok) {
        return Response.json({ error: pdb.error, project }, { status: 400 });
      }
      await saveStudentPdbId(db, project.id, pdb.pdbId);
    }

    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return handleServiceError(error);
  }
}
