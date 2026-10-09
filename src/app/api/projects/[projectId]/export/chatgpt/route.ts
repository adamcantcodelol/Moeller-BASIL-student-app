import { eq } from "drizzle-orm";
import { notes } from "@/db/schema";
import { getProjectDatabase } from "@/lib/db/request";
import { mapNote } from "@/lib/db/mappers";
import { handleServiceError } from "@/lib/http";
import { buildChatGptExport } from "@/lib/reports/chatgptExport";
import { renderExportPdf } from "@/lib/reports/chatgptPdf";
import { loadExportExtras } from "@/lib/reports/chatgptExtras";
import { listEvidenceForProject } from "@/lib/services/evidenceService";
import { getHypothesisForProject } from "@/lib/services/hypothesisService";
import { getProjectResultsSections } from "@/lib/services/pipelineService";
import { getProjectOverview } from "@/lib/services/projectService";

export const dynamic = "force-dynamic";

/** "Export for ChatGPT": ShannonGPT instructions + this project's stored data as one PDF. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const db = await getProjectDatabase(projectId); // requireProjectAccess
    const overview = await getProjectOverview(db, projectId);
    const [{ sections }, evidence, hyp, noteRows] = await Promise.all([
      getProjectResultsSections(db, projectId),
      listEvidenceForProject(db, projectId),
      getHypothesisForProject(db, projectId),
      db.select().from(notes).where(eq(notes.projectId, projectId)),
    ]);
    const extras = await loadExportExtras(db, {
      projectId,
      pdbId: overview.structure?.pdbId ?? null,
      sections,
      evidence,
    }).catch(() => null);
    const blocks = buildChatGptExport({
      project: overview.project,
      structure: overview.structure,
      sections,
      evidence,
      hypothesis: hyp.hypothesis,
      versions: hyp.versions,
      notes: noteRows.map(mapNote).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      exportedAt: new Date().toISOString(),
      extras,
    });
    const bytes = await renderExportPdf(blocks, `ShannonGPT export - ${overview.project.name}`);
    const slug = (overview.structure?.pdbId ?? overview.project.name)
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "project";
    return new Response(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="shannongpt-${slug}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
